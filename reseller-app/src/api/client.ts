import axios from 'axios';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reseller_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('reseller_token');
      localStorage.removeItem('reseller_profile');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post('/reseller/auth/login', { email, password }).then((r) => r.data);

export const register = (params: {
  name: string;
  email: string;
  password: string;
  kpay_no: string;
  kpay_name: string;
}) =>
  api.post('/reseller/auth/register', params).then((r) => r.data);

// ─── Dashboard & Requests ──────────────────────────────────────────────────
export const getDashboard = () =>
  api.get('/reseller/dashboard').then((r) => r.data);

export const getRequests = () =>
  api.get('/reseller/requests').then((r) => r.data);

export const getRequestsHistory = () =>
  api.get('/reseller/requests/history').then((r) => r.data);

export const approveRequest = (id: number) =>
  api.post(`/reseller/requests/${id}/approve`).then((r) => r.data);

export const rejectRequest = (id: number) =>
  api.post(`/reseller/requests/${id}/reject`).then((r) => r.data);

export const getTopUpHistory = () =>
  api.get('/reseller/topups').then((r) => r.data);

export const submitTopUp = (amount_paid: number, credit_amount: number, type: 'prepaid_topup' | 'postpaid_settlement', screenshotBase64: string) =>
  api.post('/reseller/topup', { amount_paid, credit_amount, type, screenshotBase64 }).then((r) => r.data);

export const verifyTopupId = (topup_id: string) =>
  api.get(`/reseller/p2p-verify/${topup_id}`).then((r) => r.data);

export const submitP2PTopup = (topup_id: string, package_price: number, credit_amount: number) =>
  api.post('/reseller/p2p-topup', { topup_id, package_price, credit_amount }).then((r) => r.data);

export const getPlans = () =>
  api.get('/plans').then((r) => r.data);

export const getP2PHistory = () =>
  api.get('/reseller/p2p-history').then((r) => r.data);

