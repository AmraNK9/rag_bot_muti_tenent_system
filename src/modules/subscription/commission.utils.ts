import { PlanRequest, SystemSetting, Business, Reseller } from '../../infrastructure/db/models';

export interface CommissionCalculation {
  isFirstPayment: boolean;
  price: number;
  referrerId: number | null;
  referrerRate: number;
  referrerCommission: number;
  approverId: number | null;
  approverRate: number;
  approverFee: number;
}

export async function calculateCommissions(
  businessId: number,
  planPrice: number,
  approverResellerId: number | null
): Promise<CommissionCalculation> {
  // 1. Check if first payment
  const approvedRequestsCount = await PlanRequest.count({
    where: { business_id: businessId, status: 'approved' }
  });
  const isFirstPayment = approvedRequestsCount === 0;

  // 2. Fetch global system settings
  const settings = await SystemSetting.findOne();
  const defaultFirstRate = settings ? Number(settings.referrer_first_month_rate) : 30.00;
  const defaultRecRate = settings ? Number(settings.referrer_recurring_rate) : 10.00;
  const defaultAppRate = settings ? Number(settings.approver_fee_rate) : 10.00;

  // 3. Resolve referrer
  const business = await Business.findByPk(businessId);
  const referrerId = business ? business.referred_by_reseller_id : null;
  let referrerRate = isFirstPayment ? defaultFirstRate : defaultRecRate;
  let referrerCommission = 0;

  if (referrerId) {
    const referrer = await Reseller.findByPk(referrerId);
    if (referrer) {
      // Check overrides
      if (isFirstPayment && referrer.custom_referrer_first_rate !== null) {
        referrerRate = Number(referrer.custom_referrer_first_rate);
      } else if (!isFirstPayment && referrer.custom_referrer_recurring_rate !== null) {
        referrerRate = Number(referrer.custom_referrer_recurring_rate);
      }
      
      const baseCommission = (planPrice * referrerRate) / 100;
      // Adjust by reliability and trust score factor
      referrerCommission = baseCommission * (Number(referrer.reliability_score) / 100) * Number(referrer.trust_score_factor);
    }
  }

  // 4. Resolve approver
  let approverRate = defaultAppRate;
  let approverFee = 0;
  if (approverResellerId) {
    const approver = await Reseller.findByPk(approverResellerId);
    if (approver) {
      if (approver.custom_approver_rate !== null) {
        approverRate = Number(approver.custom_approver_rate);
      } else if (approver.commission_percentage !== undefined && approver.commission_percentage !== null) {
        approverRate = Number(approver.commission_percentage);
      }
      const baseFee = (planPrice * approverRate) / 100;
      // Adjust by reliability and trust score factor
      approverFee = baseFee * (Number(approver.reliability_score) / 100) * Number(approver.trust_score_factor);
    }
  }

  return {
    isFirstPayment,
    price: planPrice,
    referrerId,
    referrerRate,
    referrerCommission: Math.round(referrerCommission * 100) / 100, // round to 2 decimals
    approverId: approverResellerId,
    approverRate,
    approverFee: Math.round(approverFee * 100) / 100,
  };
}
