import { Business, TopUpHistory } from '../../infrastructure/db/models';
import { redisService } from '../../infrastructure/redis/redis.service';

// Plan tier limits
const PLAN_LIMITS: Record<string, { maxChatbots: number; defaultCredits: number }> = {
  free: { maxChatbots: 1, defaultCredits: 50 },
  basic: { maxChatbots: 3, defaultCredits: 500 },
  pro: { maxChatbots: 10, defaultCredits: 2000 },
  enterprise: { maxChatbots: 9999, defaultCredits: 10000 },
};

export class SubscriptionService {
  /**
   * Get business plan details and remaining credits.
   */
  async getBusinessPlan(businessId: number): Promise<{
    plan: string;
    activeMessagesCount: number;
    subscriptionPlan: string | null;
    subscriptionEndDate: Date | null;
    totalChatbots: number;
  }> {
    const business = await Business.findByPk(businessId);
    if (!business) throw new Error(`Business ID ${businessId} not found.`);

    return {
      plan: business.plan,
      activeMessagesCount: business.active_messages_count,
      subscriptionPlan: business.subscription_plan,
      subscriptionEndDate: business.subscription_end_date,
      totalChatbots: business.total_chatbots,
    };
  }

  /**
   * Submit a top-up request (KPay, cash, or promotion).
   * Status starts as 'pending' — requires admin approval to add credits.
   */
  async submitTopUp(params: {
    businessId: number;
    transactionId: string;
    price: number;
    billingType: 'kpay' | 'cash' | 'none';
    topupType: 'prepaid_credits' | 'subscription' | 'promotion';
    receiptFileUrl?: string;
    messageCount: number;
  }): Promise<TopUpHistory> {
    const business = await Business.findByPk(params.businessId);
    if (!business) throw new Error(`Business ID ${params.businessId} not found.`);

    const topUp = await TopUpHistory.create({
      business_id: params.businessId,
      transaction_id: params.transactionId,
      price: params.price,
      billing_type: params.billingType,
      topup_type: params.topupType,
      receipt_file_url: params.receiptFileUrl || null,
      status: 'pending',
      message_count: params.messageCount,
    });

    console.log(`[Subscription] Top-up submitted: Business ${params.businessId}, TxID ${params.transactionId}, ${params.messageCount} credits pending`);
    return topUp;
  }

  /**
   * Approve a pending top-up — adds credits to the business.
   */
  async approveTopUp(topUpId: number): Promise<TopUpHistory> {
    const topUp = await TopUpHistory.findByPk(topUpId);
    if (!topUp) throw new Error(`TopUp ID ${topUpId} not found.`);
    if (topUp.status !== 'pending') throw new Error(`TopUp ID ${topUpId} is already ${topUp.status}.`);

    const business = await Business.findByPk(topUp.business_id);
    if (!business) throw new Error(`Business ID ${topUp.business_id} not found.`);

    // Add credits
    await business.increment('active_messages_count', { by: topUp.message_count });
    
    // Invalidate Redis Cache so it reads the new amount
    await redisService.del(`credits:${topUp.business_id}`);

    // If subscription top-up, update plan
    if (topUp.topup_type === 'subscription') {
      const subscriptionDays = 30; // 1 month
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + subscriptionDays);

      // Determine subscription tier based on credits
      let subPlan: 'basic' | 'pro' | 'enterprise' = 'basic';
      if (topUp.message_count >= 10000) subPlan = 'enterprise';
      else if (topUp.message_count >= 2000) subPlan = 'pro';

      const limits = PLAN_LIMITS[subPlan];
      await business.update({
        plan: 'subscription',
        subscription_plan: subPlan,
        subscription_end_date: newEndDate,
        total_chatbots: limits.maxChatbots,
      });
    } else if (topUp.topup_type === 'prepaid_credits') {
      if (business.plan === 'free') {
        await business.update({ plan: 'prepaid_credits' });
      }
    }

    // Mark as approved
    await topUp.update({ status: 'approved' });

    console.log(`[Subscription] Top-up APPROVED: ID ${topUpId}, +${topUp.message_count} credits for Business ${topUp.business_id}`);
    return topUp;
  }

  /**
   * Reject a pending top-up.
   */
  async rejectTopUp(topUpId: number): Promise<TopUpHistory> {
    const topUp = await TopUpHistory.findByPk(topUpId);
    if (!topUp) throw new Error(`TopUp ID ${topUpId} not found.`);
    if (topUp.status !== 'pending') throw new Error(`TopUp ID ${topUpId} is already ${topUp.status}.`);

    await topUp.update({ status: 'rejected' });
    console.log(`[Subscription] Top-up REJECTED: ID ${topUpId}`);
    return topUp;
  }

  /**
   * Get top-up history for a business.
   */
  async getTopUpHistory(businessId: number): Promise<TopUpHistory[]> {
    return TopUpHistory.findAll({
      where: { business_id: businessId },
      order: [['billing_date', 'DESC']],
    });
  }

  /**
   * Check if a business has remaining message credits.
   */
  async checkCredits(businessId: number): Promise<boolean> {
    const cachedCredits = await redisService.get(`credits:${businessId}`);
    let remainingCredits = 0;

    if (cachedCredits !== null) {
      remainingCredits = parseInt(cachedCredits, 10);
    } else {
      const business = await Business.findByPk(businessId);
      if (!business) return false;

      // Check subscription expiry
      if (business.plan === 'subscription' && business.subscription_end_date) {
        if (new Date() > business.subscription_end_date) {
          // Subscription expired — revert to free plan
          await business.update({
            plan: 'free',
            subscription_plan: null,
            subscription_end_date: null,
            total_chatbots: PLAN_LIMITS.free.maxChatbots,
          });
          console.log(`[Subscription] Business ${businessId} subscription expired, reverted to free plan`);
        }
      }

      remainingCredits = business.active_messages_count;
      // Cache for 2 hours (7200 seconds)
      await redisService.set(`credits:${businessId}`, remainingCredits.toString(), { EX: 7200 });
    }

    return remainingCredits > 0;
  }

  /**
   * Atomically deduct one credit from the business via Redis Cache.
   * Returns false if no credits remaining.
   */
  async deductCredit(businessId: number): Promise<boolean> {
    const creditKey = `credits:${businessId}`;
    
    // 1. Instant deduction in Redis (RAM)
    let cachedCredits = await redisService.get(creditKey);
    if (cachedCredits === null) {
      await this.checkCredits(businessId); // Populates the cache
      cachedCredits = await redisService.get(creditKey);
      if (cachedCredits === null) return false;
    }

    if (parseInt(cachedCredits, 10) <= 0) return false;

    const remaining = await redisService.decr(creditKey);
    if (remaining === null) return false; // Redis down fallback

    // 2. Track the deduction for DB Sync (Dirty Tracking)
    void (async () => {
      try {
        await redisService.hIncrBy('credits_used_hash', businessId.toString(), 1);
        await redisService.sAdd('active_credit_sync', businessId.toString());
      } catch (e) {
        console.error('[Subscription] Failed to track credit deduction in Redis:', e);
      }
    })();

    console.log(`[Subscription] Credit deducted for Business #${businessId} via Redis. Remaining: ${remaining}`);

    // Trigger Telegram & In-App Low Credit Alert when credits reach thresholds (e.g. 50, 20, 10, 5, 1)
    if ([50, 20, 10, 5, 1].includes(remaining) || (remaining <= 10 && remaining > 0)) {
      // 1. In-App Notification in Chatbot Admin
      try {
        const { ChatBot, Messages } = await import('../../infrastructure/db/models');
        const chatbot = await ChatBot.findOne({ where: { business_id: businessId } });
        if (chatbot) {
          const sysMsg = await Messages.create({
            chatbot_id: chatbot.id,
            sender_id: 'system',
            message: `⚠️ [LOW CREDITS] Your chatbot message credits are running low (${remaining} remaining). Please top up in Billing!`,
            sender_type: 'user',
          });
          const { SocketService } = await import('../../infrastructure/socket/socket.service');
          SocketService.io.to(chatbot.id.toString()).emit('new_message', sysMsg.toJSON());
        }
      } catch (inAppErr) {
        console.error('[LowCreditInAppAlert Error]', inAppErr);
      }

      // 2. Telegram Notification to Business Owner
      if (business.telegram_chat_id) {
        try {
          const { SystemBotService } = await import('../system-bot/system-bot.service');
          const sysBot = new SystemBotService();
          await sysBot.notifyBusinessLowCredits(business.telegram_chat_id, {
            businessName: business.name,
            remainingCredits: remaining,
          });
          console.log(`[LowCreditAlert] Dispatched Telegram alert to ChatID ${business.telegram_chat_id} (Remaining: ${remaining})`);
        } catch (err) {
          console.error('[LowCreditAlert Error]', err);
        }
      } else {
        console.log(`[LowCreditAlert] Business #${businessId} has remaining ${remaining} credits but telegram_chat_id is NOT linked yet.`);
      }
    }

    return true;
  }

  /**
   * Get plan limits for a given tier.
   */
  getPlanLimits(planOrSubPlan: string): { maxChatbots: number; defaultCredits: number } {
    return PLAN_LIMITS[planOrSubPlan] || PLAN_LIMITS.free;
  }

  /**
   * Background Cron Job: Sync deducted credits from Redis to Database
   */
  async syncCreditsToDB(): Promise<void> {
    try {
      const activeBusinessIds = await redisService.sMembers('active_credit_sync');
      if (!activeBusinessIds || activeBusinessIds.length === 0) {
        // No active users in the last 15 mins, skip!
        return;
      }

      console.log(`[Subscription DB Sync] Found ${activeBusinessIds.length} active businesses. Starting DB Sync...`);

      const usedCreditsHash = await redisService.hGetAll('credits_used_hash');
      
      // Clear Redis tracking sets immediately to start fresh for the next 15 mins
      await redisService.del('active_credit_sync');
      await redisService.del('credits_used_hash');

      // Update Database
      for (const bIdStr of activeBusinessIds) {
        const usedAmountStr = usedCreditsHash[bIdStr];
        if (usedAmountStr) {
          const usedAmount = parseInt(usedAmountStr, 10);
          const businessId = parseInt(bIdStr, 10);
          
          if (usedAmount > 0 && !isNaN(businessId)) {
             // Directly decrement in SQL DB
             const business = await Business.findByPk(businessId);
             if (business) {
                await business.decrement('active_messages_count', { by: usedAmount });
             }
          }
        }
      }
      
      console.log(`[Subscription DB Sync] Successfully synced credits for ${activeBusinessIds.length} businesses.`);
    } catch (err) {
      console.error('[Subscription DB Sync] Failed to sync credits to DB:', err);
    }
  }
}
