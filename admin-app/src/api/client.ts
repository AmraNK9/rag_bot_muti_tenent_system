import axios from 'axios';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
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
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_business');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────
export const login = (name: string, password: string) =>
  api.post('/auth/login', { name, password }).then((r) => r.data);

// ─── Profile & Credits ─────────────────────────────────────────────────────
export const getProfile = () => api.get('/profile').then((r) => r.data);
export const getCredits = () => api.get('/credits').then((r) => r.data);

// ─── Chatbots ──────────────────────────────────────────────────────────────
export const getChatbots = () => api.get('/chatbots').then((r) => r.data);

// ─── Knowledge Base ────────────────────────────────────────────────────────
export const getKnowledgeChunks = (chatbotId: number, limit = 20, offset = 0) =>
  api.get(`/knowledge/${chatbotId}`, { params: { limit, offset } }).then((r) => r.data);

export const deleteChunk = (chatbotId: number, docId: string) =>
  api.delete(`/knowledge/${chatbotId}/chunks/${encodeURIComponent(docId)}`).then((r) => r.data);

export const updateChunk = (chatbotId: number, docId: string, text: string) =>
  api.put(`/knowledge/${chatbotId}/chunks/${encodeURIComponent(docId)}`, { text }).then((r) => r.data);

export const clearKnowledge = (chatbotId: number) =>
  api.delete(`/knowledge/${chatbotId}`).then((r) => r.data);

export const ingestDocument = (chatbotId: number, documentText: string) =>
  api.post('/knowledge/ingest', { chatbotId, documentText }).then((r) => r.data);

// ─── Conversations ─────────────────────────────────────────────────────────
export const getConversations = (chatbotId: number) =>
  api.get(`/chatbots/${chatbotId}/conversations`).then((r) => r.data);

export const getMessages = (chatbotId: number, senderId: string, limit = 50, offset = 0) =>
  api.get(`/chatbots/${chatbotId}/conversations/${senderId}`, { params: { limit, offset } }).then((r) => r.data);

export const replyToConversation = (chatbotId: number, senderId: string, message: string) =>
  api.post(`/chatbots/${chatbotId}/conversations/${senderId}/reply`, { message }).then((r) => r.data);

export const getChatbotAdmins = (chatbotId: number) =>
  api.get(`/chatbots/${chatbotId}/admins`).then((r) => r.data);

export const createChatbotAdmin = (chatbotId: number, data: any) =>
  api.post(`/chatbots/${chatbotId}/admins`, data).then((r) => r.data);

export const updateChatbotAdmin = (chatbotId: number, adminId: number, data: any) =>
  api.put(`/chatbots/${chatbotId}/admins/${adminId}`, data).then((r) => r.data);

export const deleteChatbotAdmin = (chatbotId: number, adminId: number) =>
  api.delete(`/chatbots/${chatbotId}/admins/${adminId}`).then((r) => r.data);

