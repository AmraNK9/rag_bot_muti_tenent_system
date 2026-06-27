export interface Plan {
  id: number;
  name: string;
  price: number;
  query_limit: number;
  duration_days: number;
  max_chat_history: number;
  services: string[];
}

export interface AdminProfile {
  id: number;
  name: string;
  email: string;
  isStandalone: boolean;
  canManageKnowledge: boolean;
  canManageSystemPrompt: boolean;
}

export interface ChatbotDetails {
  id: number;
  name: string;
  description: string | null;
  type: string;
  bot_role: string;
  custom_system_prompt: string | null;
}

export interface Conversation {
  sender_id: string;
  message_count: string;
  last_message_at: string;
}

export interface Message {
  id: number;
  sender_id: string;
  message: string;
  sender_type: 'user' | 'bot';
  sent_date: string;
}

export interface KnowledgeChunk {
  id: string;
  text: string;
  metadata?: { chatbot_id?: number | string; source?: string };
}

export interface BusinessDetails {
  id: number;
  name: string;
  plan: string;
  subscriptionPlan?: string | null;
  subscriptionEndDate?: string | null;
  topupId?: string | null;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
}
