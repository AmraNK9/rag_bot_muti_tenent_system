import { Reseller, Plan } from '../../infrastructure/db/models';

export class PaymentRoutingService {
  /**
   * Selects a reseller payment collector based on transaction size, client level, and trust reliability.
   * Returns null if no reseller is configured or available (falls back to main system payment).
   */
  public static async selectResellerForPayment(params: {
    planName: 'lite' | 'basic' | 'pro';
    clientLevel?: 'royal' | 'regular';
  }): Promise<Reseller | null> {
    try {
      // 0. Fetch the selected plan's price
      const planInfo = await Plan.findOne({ where: { name: params.planName, is_active: true } });
      const planPrice = planInfo ? Number(planInfo.price) : 0;

      // 1. Fetch all resellers authorized to collect payments
      const activeCollectors = await Reseller.findAll({
        where: { can_collect_payments: true },
      });

      if (activeCollectors.length === 0) {
        return null; // Fallback to system payment
      }

      // Filter: Reseller must have enough postpaid limit remaining for this transaction (checking Net Price)
      const collectorsWithLimit = activeCollectors.filter((r) => {
        const pendingDebt = Number(r.pending_debt || 0);
        const postpaidLimit = Number(r.postpaid_limit || 0);
        const commissionRate = Number(r.commission_percentage || 0);
        const commissionEarned = planPrice * (commissionRate / 100);
        const netPlanPrice = planPrice - commissionEarned;
        return (pendingDebt + netPlanPrice) <= postpaidLimit;
      });

      if (collectorsWithLimit.length === 0) {
        return null; // Fallback to system payment if no reseller has enough credit limit
      }

      let eligibleCollectors = [...collectorsWithLimit];

      // 2. Apply routing priority rule
      // If transaction is large (Pro Plan) or client is VIP/Royal, prioritize highly trusted collectors (reliability >= 90)
      const isHighValue = params.planName === 'pro' || params.clientLevel === 'royal';
      if (isHighValue) {
        const trustedCollectors = collectorsWithLimit.filter(
          (r) => Number(r.reliability_score) >= 90
        );
        if (trustedCollectors.length > 0) {
          eligibleCollectors = trustedCollectors;
        }
      }

      // 3. Random distribution (round-robin rotation simulation)
      const randomIndex = Math.floor(Math.random() * eligibleCollectors.length);
      return eligibleCollectors[randomIndex];
    } catch (err) {
      console.error('[PaymentRouting] Error routing payment to reseller:', err);
      return null;
    }
  }
}
