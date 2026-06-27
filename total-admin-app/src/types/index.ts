export interface Reseller {
  id: number;
  name: string;
  email: string;
  commission_percentage: number;
  balance: number;
  can_collect_payments: boolean;
  reliability_score: number;
  total_collected: number;
  kpay_no: string;
  kpay_name: string;
  custom_referrer_first_rate: number | null;
  custom_referrer_recurring_rate: number | null;
  custom_approver_rate: number | null;
  trust_score_factor: number;
  prepaid_balance?: number;
  pending_debt?: number;
  postpaid_limit?: number;
  can_sell?: boolean;
  created_at: string;
}

export interface Analytics {
  activeChatbots: number;
  totalBusinesses: number;
  totalResellers: number;
  totalRevenue: number;
  totalQueries: number;
  totalApiCost: number;
  activities: any[];
}

export interface PlanRequest {
  id: number;
  business_id: number;
  reseller_id: number | null;
  plan_name: string;
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  price: number;
  created_at: string;
  business?: { id: number; name: string };
  reseller?: { id: number; name: string };
}

export interface SystemSetting {
  id: number;
  referrer_first_month_rate: number;
  referrer_recurring_rate: number;
  approver_fee_rate: number;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  query_limit: number;
  duration_days: number;
  is_active: boolean;
  max_chat_history: number;
  services: string[];
  is_only_p2p?: boolean;
}

export interface ResellerTopUp {
  id: number;
  reseller_id: number;
  amount_paid: number;
  credit_amount: number;
  type: 'prepaid_topup' | 'postpaid_settlement';
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reseller?: { id: number; name: string; commission_percentage?: number };
}

export interface AuditLog {
  id: number;
  admin_id: number | null;
  action: string;
  description: string;
  created_at: string;
}
