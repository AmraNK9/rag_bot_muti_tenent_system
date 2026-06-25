import axios from 'axios';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('chatbot_admin_token');
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
      localStorage.removeItem('chatbot_admin_token');
      localStorage.removeItem('chatbot_admin_profile');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post('/chatbot-admin/login', { email, password }).then((r) => r.data);

export const registerStandalone = (params: {
  name: string;
  email: string;
  password: string;
  referralCode?: string;
}) =>
  api.post('/chatbot-admin/register', params).then((r) => r.data);

// ─── Profile & Metadata ────────────────────────────────────────────────────
export const getProfile = () => api.get('/chatbot-admin/profile').then((r) => r.data);

export const updateChatbot = (name: string, description: string) =>
  api.put('/chatbot-admin/chatbot', { name, description }).then((r) => r.data);

// ─── Conversations ─────────────────────────────────────────────────────────
export const getConversations = () => api.get('/chatbot-admin/conversations').then((r) => r.data);

export const getMessages = (senderId: string, limit = 50, offset = 0) =>
  api.get(`/chatbot-admin/conversations/${senderId}`, { params: { limit, offset } }).then((r) => r.data);

export const replyToConversation = (senderId: string, message: string) =>
  api.post(`/chatbot-admin/conversations/${senderId}/reply`, { message }).then((r) => r.data);

// ─── Knowledge Base ────────────────────────────────────────────────────────
export const getKnowledgeChunks = (limit = 20, offset = 0) =>
  api.get('/chatbot-admin/knowledge', { params: { limit, offset } }).then((r) => r.data);

export const ingestDocument = (documentText: string) =>
  api.post('/chatbot-admin/knowledge/ingest', { documentText }).then((r) => r.data);

export const deleteChunk = (docId: string) =>
  api.delete(`/chatbot-admin/knowledge/chunks/${encodeURIComponent(docId)}`).then((r) => r.data);

export const updateChunk = (docId: string, text: string) =>
  api.put(`/chatbot-admin/knowledge/chunks/${encodeURIComponent(docId)}`, { text }).then((r) => r.data);

// ─── Chatbot Creation ──────────────────────────────────────────────────────
export const createChatbot = (name: string, token: string, type: 'telegram' | 'facebook', botRole: 'sales' | 'faq' | 'support' | 'custom') =>
  api.post('/chatbot-admin/chatbot', { name, token, type, botRole }).then((r) => r.data);

// ─── System Prompt ─────────────────────────────────────────────────────────
export const getSystemPrompt = () => api.get('/chatbot-admin/system-prompt').then((r) => r.data);

export const updateSystemPrompt = (customSystemPrompt: string) =>
  api.put('/chatbot-admin/system-prompt', { customSystemPrompt }).then((r) => r.data);

// ─── Subscription Upgrades ─────────────────────────────────────────────────
export const getPaymentMethods = (planName: string, clientLevel = 'regular') =>
  api.get('/subscription/payment-methods', { params: { planName, clientLevel } }).then((r) => r.data);

export const submitUpgrade = (planName: string, screenshotBase64: string, resellerId: number | null) =>
  api.post('/subscription/upgrade', { planName, screenshotBase64, resellerId }).then((r) => r.data);
export const getPlans = () =>
  api.get('/plans').then((res) => res.data);
export const getSubscriptionHistory = () =>
  api.get('/subscription/history').then((res) => res.data);
