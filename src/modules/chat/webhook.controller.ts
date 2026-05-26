import { RetrievalGenerationService } from './retrieval-generation.service';
import { ChatMemoryService } from './chat-memory.service';
import { ChatBot } from '../../infrastructure/db/models';
declare const process: {
  env: {
    NODE_ENV?: string;
  };
};

export interface TelegramWebhookUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

export class WebhookController {
  constructor(
    private retrievalGenService: RetrievalGenerationService,
    private chatMemoryService: ChatMemoryService
  ) {}

  /**
   * Receives incoming messages from Telegram Webhook, manages conversation logs,
   * performs search retrieval, triggers generations, and delivers responses.
   */
  async handleTelegramWebhook(
    chatbotId: number,
    update: TelegramWebhookUpdate
  ): Promise<{ success: boolean; replyText?: string }> {
    if (!update.message || !update.message.text) {
      return { success: false };
    }

    const senderId = update.message.from.id;
    const userText = update.message.text;

    try {
      // 1. Save user's message in the DB (triggers background summarization if count hits 20)
      await this.chatMemoryService.saveMessage(chatbotId, senderId, userText, true);

      // 2. Compute the response (Hybrid search -> Prompt Factory -> DeepSeek)
      const assistantReply = await this.retrievalGenService.generateResponse({
        chatbotId,
        senderId,
        userMessage: userText,
      });

      // 3. Save bot's message response in the DB
      await this.chatMemoryService.saveMessage(chatbotId, senderId, assistantReply, false);

      // 4. Send response message back to the Telegram API
      await this.deliverTelegramMessage(chatbotId, senderId, assistantReply);

      return {
        success: true,
        replyText: assistantReply,
      };
    } catch (error) {
      console.error(`Error processing webhook update for ChatBot ID ${chatbotId}:`, error);
      return { success: false };
    }
  }

  /**
   * Delivers response back to the user via Telegram Bot API.
   */
  private async deliverTelegramMessage(
    chatbotId: number,
    chatId: number,
    text: string
  ): Promise<void> {
    // Retrieve chatbot credentials
    const chatbot = await ChatBot.findByPk(chatbotId);

    if (!chatbot) {
      throw new Error(`Cannot deliver message: ChatBot ID ${chatbotId} not found.`);
    }

    // Offline / Scaffold mode: log delivery parameters
    if (chatbot.token === 'mock-token' || process.env.NODE_ENV === 'test') {
      console.log(`[Telegram Webhook Simulated Delivery] ChatBot ${chatbot.name} (ID: ${chatbotId}) -> User (ID: ${chatId}): "${text}"`);
      return;
    }

    // Production delivery block:
    const url = `https://api.telegram.org/bot${chatbot.token}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Telegram API error status ${response.status}: ${errorText}`);
      }
    } catch (err) {
      console.error(`Failed to dispatch message to Telegram API:`, err);
    }
  }
}
