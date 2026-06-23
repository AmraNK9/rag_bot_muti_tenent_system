import { Reseller } from '../../infrastructure/db/models';

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
      // 1. Fetch all resellers authorized to collect payments
      const activeCollectors = await Reseller.findAll({
        where: { can_collect_payments: true },
      });

      if (activeCollectors.length === 0) {
        return null; // Fallback to system payment
      }

      let eligibleCollectors = [...activeCollectors];

      // 2. Apply routing priority rule
      // If transaction is large (Pro Plan) or client is VIP/Royal, prioritize highly trusted collectors (reliability >= 90)
      const isHighValue = params.planName === 'pro' || params.clientLevel === 'royal';
      if (isHighValue) {
        const trustedCollectors = activeCollectors.filter(
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
