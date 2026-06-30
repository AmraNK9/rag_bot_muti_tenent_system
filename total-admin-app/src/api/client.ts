import axios from 'axios';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach secret key to every request
api.interceptors.request.use((config) => {
  const secret = localStorage.getItem('total_admin_secret');
  if (secret) {
    config.headers['x-admin-secret'] = secret;
  }
  return config;
});

// Auto-logout on 403
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 403) {
      localStorage.removeItem('total_admin_secret');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Super Admin Endpoints ────────────────────────────────────────────────
export const getResellers = () =>
  api.get('/total-admin/resellers').then((r) => r.data);

export const updateReseller = (
  id: number,
  data: {
    reliability_score?: number;
    can_collect_payments?: boolean;
    commission_percentage?: number;
    custom_referrer_first_rate?: number | null;
    custom_referrer_recurring_rate?: number | null;
    custom_approver_rate?: number | null;
    trust_score_factor?: number;
    postpaid_limit?: number;
    can_sell?: boolean;
  }
) =>
  api.put(`/total-admin/resellers/${id}`, data).then((r) => r.data);

export const getAnalytics = () =>
  api.get('/total-admin/analytics').then((r) => r.data);

export const getAuditLogs = () =>
  api.get('/total-admin/audit-logs').then((r) => r.data);

export const getRequests = () =>
  api.get('/total-admin/requests').then((r) => r.data);

export const approveRequest = (id: number) =>
  api.post(`/total-admin/requests/${id}/approve`).then((r) => r.data);

export const rejectRequest = (id: number) =>
  api.post(`/total-admin/requests/${id}/reject`).then((r) => r.data);

export const getResellerTopUps = () =>
  api.get('/total-admin/topups').then((r) => r.data);

export const approveResellerTopUp = (id: number) =>
  api.post(`/total-admin/topups/${id}/approve`).then((r) => r.data);

export const rejectResellerTopUp = (id: number) =>
  api.post(`/total-admin/topups/${id}/reject`).then((r) => r.data);

export const getSystemSettings = () =>
  api.get('/total-admin/settings').then((r) => r.data);

export const updateSystemSettings = (data: {
  referrer_first_month_rate: number;
  referrer_recurring_rate: number;
  approver_fee_rate: number;
}) =>
  api.put('/total-admin/settings', data).then((r) => r.data);

export const getPlans = () =>
  api.get('/total-admin/plans').then((r) => r.data);

export const updatePlan = (
  id: number,
  data: {
    name?: string;
    price?: number;
    query_limit?: number;
    duration_days?: number;
    is_active?: boolean;
    max_chat_history?: number;
    services?: string[];
  }
) =>
  api.put(`/total-admin/plans/${id}`, data).then((r) => r.data);

export const createPlan = (
  data: {
    name: string;
    price: number;
    query_limit: number;
    duration_days: number;
    is_active: boolean;
    max_chat_history: number;
    services: string[];
  }
) =>
  api.post(`/total-admin/plans`, data).then((r) => r.data);

// ─── System Core Bot APIs ───────────────────────────────────────────────────
export const getSystemBotConfig = () =>
  api.get('/total-admin/system-bot/config').then((r) => r.data);

export const updateSystemBotConfig = (data: { bot_token?: string; bot_name?: string; system_prompt?: string; is_active?: boolean }) =>
  api.put('/total-admin/system-bot/config', data).then((r) => r.data);

export const getSystemBotFaqs = () =>
  api.get('/total-admin/system-bot/faqs').then((r) => r.data);

export const createSystemBotFaq = (data: { question: string; answer: string; category?: string; is_active?: boolean }) =>
  api.post('/total-admin/system-bot/faqs', data).then((r) => r.data);

export const updateSystemBotFaq = (id: number, data: { question?: string; answer?: string; category?: string; is_active?: boolean }) =>
  api.put(`/total-admin/system-bot/faqs/${id}`, data).then((r) => r.data);

export const deleteSystemBotFaq = (id: number) =>
  api.delete(`/total-admin/system-bot/faqs/${id}`).then((r) => r.data);
