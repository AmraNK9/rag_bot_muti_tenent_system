import { Business, TopUpHistory } from '../../infrastructure/db/models';

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

    return business.active_messages_count > 0;
  }

  /**
   * Atomically deduct one credit from the business.
   * Returns false if no credits remaining.
   */
  async deductCredit(businessId: number): Promise<boolean> {
    const business = await Business.findByPk(businessId);
    if (!business || business.active_messages_count <= 0) return false;

    await business.decrement('active_messages_count', { by: 1 });
    return true;
  }

  /**
   * Get plan limits for a given tier.
   */
  getPlanLimits(planOrSubPlan: string): { maxChatbots: number; defaultCredits: number } {
    return PLAN_LIMITS[planOrSubPlan] || PLAN_LIMITS.free;
  }
}
