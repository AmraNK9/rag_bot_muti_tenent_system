import axios from 'axios';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});
//hello git hub actions
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
export const getProfile = () => api.get(`/chatbot-admin/profile?t=${Date.now()}`).then((r) => r.data);

export const updateChatbot = (name: string, description: string, bot_token?: string, handover_timeout_mins?: number, default_language?: string, bot_role?: string, type?: string) =>
  api.put('/chatbot-admin/chatbot', { name, description, bot_token, handover_timeout_mins, default_language, bot_role, type }).then((r) => r.data.chatbot);

// ─── Conversations ─────────────────────────────────────────────────────────
export const getConversations = () => api.get(`/chatbot-admin/conversations?t=${Date.now()}`).then((r) => r.data);

export const getMessages = (senderId: string, limit = 50, offset = 0) =>
  api.get(`/chatbot-admin/conversations/${senderId}?limit=${limit}&offset=${offset}&t=${Date.now()}`).then((r) => r.data);

// Delta sync: fetch only messages newer than `sinceId`
export const getMessagesSince = (senderId: string, sinceId: number) =>
  api.get(`/chatbot-admin/conversations/${senderId}?since=${sinceId}&limit=200&t=${Date.now()}`).then((r) => r.data);

export const replyToConversation = (senderId: string, message: string) =>
  api.post(`/chatbot-admin/conversations/${senderId}/reply`, { message }).then((r) => r.data);

// ─── Smart Items (Knowledge Base) ────────────────────────────────────────────
export const getSmartItems = (limit = 100, offset = 0, search?: string, type?: string) => {
  const params: Record<string, any> = { limit, offset, t: Date.now() };
  if (search) params.search = search;
  if (type) params.type = type;
  return api.get('/chatbot-admin/smart-items', { params }).then((r) => r.data);
};

export const createSmartItem = (data: any) =>
  api.post('/chatbot-admin/smart-items', data).then((r) => r.data);

export const deleteSmartItem = (id: string | number) =>
  api.delete(`/chatbot-admin/smart-items/${id}`).then((r) => r.data);

export const updateSmartItem = (id: string | number, data: any) =>
  api.put(`/chatbot-admin/smart-items/${id}`, data).then((r) => r.data);

// Legacy Knowledge Base (For backward compatibility if needed)
export const getKnowledgeChunks = (limit = 20, offset = 0) =>
  api.get(`/chatbot-admin/knowledge?limit=${limit}&offset=${offset}&t=${Date.now()}`).then((r) => r.data);

export const ingestDocument = (documentText: string) =>
  api.post('/chatbot-admin/knowledge/ingest', { documentText }).then((r) => r.data);

export const deleteChunk = (docId: string) =>
  api.delete(`/chatbot-admin/knowledge/chunks/${encodeURIComponent(docId)}`).then((r) => r.data);

export const updateChunk = (docId: string, text: string) =>
  api.put(`/chatbot-admin/knowledge/chunks/${encodeURIComponent(docId)}`, { text }).then((r) => r.data);

// ─── Chatbot Creation ──────────────────────────────────────────────────────
export const createChatbot = (name: string, token: string, type: 'telegram' | 'facebook', botRole: 'sales' | 'faq' | 'support' | 'custom', forceConnect?: boolean, customSystemPrompt?: string) =>
  api.post('/chatbot-admin/chatbot', { name, token, type, botRole, forceConnect, custom_system_prompt: customSystemPrompt }).then((r) => r.data);

// ─── System Prompt ─────────────────────────────────────────────────────────
export const getSystemPrompt = () => api.get(`/chatbot-admin/system-prompt?t=${Date.now()}`).then((r) => r.data);

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

export const getSystemBotInfo = () =>
  api.get('/system-bot/info').then((res) => res.data);

export const updateTelegramProfile = (telegram_chat_id: string, telegram_username?: string) =>
  api.put('/chatbot-admin/profile/telegram', { telegram_chat_id, telegram_username }).then((res) => res.data);

// ─── Human Takeover ────────────────────────────────────────────────────────
export const getChatSessionStatus = (senderId: string) =>
  api.get(`/chatbot-admin/conversations/${senderId}/session`).then((r) => r.data);

export const toggleChatTakeover = (senderId: string, takeover: boolean) =>
  api.post(`/chatbot-admin/conversations/${senderId}/takeover`, { takeover }).then((r) => r.data);

// ─── Action Requests ───────────────────────────────────────────────────────
export const getActionRequests = () =>
  api.get(`/chatbot-admin/action-requests?t=${Date.now()}`).then((r) => r.data);

export const resolveActionRequest = (id: number) =>
  api.post(`/chatbot-admin/action-requests/${id}/resolve`).then((r) => r.data);
