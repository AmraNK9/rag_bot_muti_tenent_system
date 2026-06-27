export interface DashboardStats {
  id?: number;
  name: string;
  balance: number;
  prepaid_balance: number;
  pending_debt: number;
  postpaid_limit: number;
  can_sell: boolean;
  totalCollected: number;
  commissionPercentage: number;
  reliabilityScore: number;
  referredCount: number;
  can_collect_payments: boolean;
  approverRate: number;
  referrerFirstRate: number;
  referrerRecRate: number;
  trustScoreFactor: number;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
}

export interface PlanRequest {
  id: number;
  business_id: number;
  reseller_id: number | null;
  plan_id: number | null;
  plan_name: string;
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  price: string | number;
  created_at: string;
  business?: {
    name: string;
  };
}

export interface P2PTopupTransaction {
  id: number;
  reseller_id: number;
  business_id: number;
  package_price: string | number;
  credit_amount: number;
  commission_earned: string | number;
  net_deducted: string | number;
  created_at: string;
  business?: {
    name: string;
    topup_id: string;
  };
}

export interface TopUpHistoryItem {
  id: number;
  business_id: number;
  amount_paid: string | number;
  credit_amount: string | number;
  type: 'prepaid_topup' | 'postpaid_settlement';
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Plan {
  id: number;
  name: string;
  price: string | number;
  query_limit: number;
  duration_days: number;
  is_active: boolean;
  is_only_p2p?: boolean;
}
