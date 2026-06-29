import { PlanRequest, Business, Reseller, Plan, ChatBot, Messages } from '../../infrastructure/db/models';
import { calculateCommissions } from '../../presentation/api/routes';
import { SocketService } from '../../infrastructure/socket/socket.service';

export class ResellerService {
  async processPlanRequestApproval(requestId: number, resellerId: number): Promise<void> {
    const planRequest = await PlanRequest.findOne({
      where: { id: requestId, reseller_id: resellerId, status: 'pending' },
    });
    if (!planRequest) throw new Error('Pending plan request not found.');

    const business = await Business.findByPk(planRequest.business_id);
    if (!business) throw new Error('Associated Business client not found.');

    const reseller = await Reseller.findByPk(resellerId);
    if (!reseller) throw new Error('Reseller not found.');

    // Calculate commissions & fees
    const calc = await calculateCommissions(business.id, Number(planRequest.price), reseller.id);
    const netRequiredPrice = calc.price - calc.approverFee;

    // Check if account is suspended
    if (!reseller.can_sell) {
      throw new Error('Your account is suspended for selling. Please settle your pending debts.');
    }

    const usedPrepaid = !reseller.can_collect_payments;
    if (usedPrepaid) {
      if (Number(reseller.prepaid_balance) < calc.price) {
        throw new Error(`Insufficient prepaid balance. (Prepaid: ${reseller.prepaid_balance}, Required: ${calc.price})`);
      }
    } else {
      if (Number(reseller.pending_debt) + netRequiredPrice > Number(reseller.postpaid_limit)) {
        throw new Error(`Postpaid limit exceeded. (Pending Debt: ${reseller.pending_debt}, Required Net: ${netRequiredPrice}, Limit: ${reseller.postpaid_limit})`);
      }
    }

    // 1. Upgrade Business Plan & credits dynamically from plans table
    const planProfile = await Plan.findOne({ where: { name: planRequest.plan_name } });
    const duration = planProfile ? planProfile.duration_days : 30;
    const newCredits = planProfile ? planProfile.query_limit : 500;
    let maxBots = 1;
    if (planRequest.plan_name === 'pro') maxBots = 3;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + duration);

    await business.update({
      plan: 'subscription',
      subscription_plan: planRequest.plan_name as any,
      subscription_end_date: expiryDate,
      active_messages_count: business.active_messages_count + newCredits,
      total_chatbots: maxBots,
    });

    // 2. Allocate Referrer Commissions
    if (calc.referrerId && calc.referrerCommission > 0) {
      const referrer = await Reseller.findByPk(calc.referrerId);
      if (referrer) {
        await referrer.update({
          balance: Number(referrer.balance) + calc.referrerCommission,
        });
      }
    }

    // 3. Allocate Approver Fee / Deduct prepaid balance
    if (usedPrepaid) {
      await reseller.update({
        prepaid_balance: Number(reseller.prepaid_balance) - calc.price,
        balance: Number(reseller.balance) + calc.approverFee,
        total_collected: Number(reseller.total_collected) + calc.price,
      });
    } else {
      const netDebtIncrease = calc.price - calc.approverFee;
      await reseller.update({
        pending_debt: Number(reseller.pending_debt) + netDebtIncrease,
        balance: Number(reseller.balance) + calc.approverFee,
        total_collected: Number(reseller.total_collected) + calc.price,
      });
    }

    // 4. Mark Plan Request approved with snapshots
    await planRequest.update({
      status: 'approved',
      referrer_id: calc.referrerId,
      referrer_commission_rate: calc.referrerRate,
      referrer_commission_amount: calc.referrerCommission,
      approver_commission_rate: calc.approverRate,
      approver_commission_amount: calc.approverFee,
      is_first_payment: calc.isFirstPayment,
    });

    // 4.5. Create system chat notification & broadcast
    try {
      const chatbot = await ChatBot.findOne({ where: { business_id: business.id } });
      if (chatbot) {
        const savedMsg = await Messages.create({
          chatbot_id: chatbot.id,
          sender_id: 'system',
          message: `Your Plan Upgrade Request for "${planRequest.plan_name.toUpperCase()}" has been Approved! Your bot credit limit has been increased by ${newCredits} messages.`,
          sender_type: 'user',
        });
        SocketService.io.to(chatbot.id.toString()).emit('new_message', savedMsg.toJSON());
      }
    } catch (err) {
      console.error('[System Notification Error] Failed to create or emit system message:', err);
    }
  }

  async processPlanRequestRejection(requestId: number, resellerId: number): Promise<void> {
    const planRequest = await PlanRequest.findOne({
      where: { id: requestId, reseller_id: resellerId, status: 'pending' },
    });
    if (!planRequest) throw new Error('Pending plan request not found.');

    await planRequest.update({ status: 'rejected' });
    
    // Create system chat notification & broadcast
    try {
      const chatbot = await ChatBot.findOne({ where: { business_id: planRequest.business_id } });
      if (chatbot) {
        const savedMsg = await Messages.create({
          chatbot_id: chatbot.id,
          sender_id: 'system',
          message: `Your Plan Upgrade Request for "${planRequest.plan_name.toUpperCase()}" has been Rejected. Please verify your payment details and submit again.`,
          sender_type: 'user',
        });
        SocketService.io.to(chatbot.id.toString()).emit('new_message', savedMsg.toJSON());
      }
    } catch (err) {
      console.error('[System Notification Error] Failed to create or emit system message:', err);
    }
  }
}
