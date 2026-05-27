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
      id: string;
      first_name?: string;
      username?: string;
    };
    chat: {
      id: string;
      type: string;
    };
    text?: string;
    date: number;
  };
}

/**
 * Debounce interval for Telegram editMessageText calls (ms).
 * Telegram rate limits at ~30 edits/min per chat, so 500ms is safe.
 */
const TELEGRAM_EDIT_DEBOUNCE_MS = 500;

export class WebhookController {
  /** In-memory cache for bot tokens to avoid redundant DB lookups */
  private tokenCache: Map<number, string> = new Map();

  constructor(
    private retrievalGenService: RetrievalGenerationService,
    private chatMemoryService: ChatMemoryService
  ) {}

  /**
   * Receives incoming messages from Telegram Webhook, manages conversation logs,
   * performs streaming search retrieval + generation, and delivers progressive responses.
   */
  async handleTelegramWebhook(
    chatbotId: number,
    update: TelegramWebhookUpdate
  ): Promise<{ success: boolean; replyText?: string }> {
    if (!update.message || !update.message.text) {
      return { success: false };
    }

    const senderId = update.message.from.id;
    const chatId = update.message.chat.id;
    const userText = update.message.text;

    try {
      // Resolve bot token (cached or from DB)
      const botToken = await this.resolveBotToken(chatbotId);

      // Send "typing" indicator immediately for better UX
      void this.sendChatAction(botToken, chatId, 'typing').catch(() => {});

      // Stream response chunks and deliver progressively to Telegram
      const assistantReply = await this.streamAndDeliver(
        chatbotId,
        senderId,
        chatId,
        botToken,
        userText
      );

      // Fire-and-forget: save bot's response message to DB
      void this.chatMemoryService.saveMessage(chatbotId, senderId, assistantReply, false).catch(err => {
        console.error(`[Webhook] Failed to save bot reply to DB:`, err);
      });

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
   * Streams LLM response and progressively updates Telegram message.
   *
   * Strategy:
   * 1. Accumulate chunks until first meaningful content (~first few tokens)
   * 2. Send initial message via sendMessage
   * 3. Continue accumulating chunks, updating via editMessageText with debouncing
   * 4. Final edit with the complete response
   */
  private async streamAndDeliver(
    chatbotId: number,
    senderId: string,
    chatId: string,
    botToken: string,
    userMessage: string
  ): Promise<string> {
    const stream = this.retrievalGenService.generateResponseStream({
      chatbotId,
      senderId,
      userMessage,
    });

    let fullText = '';
    let sentMessageId: number | null = null;
    let lastEditTime = 0;
    let pendingEditTimeout: ReturnType<typeof setTimeout> | null = null;

    // Check if we're in mock/test mode
    const isMockMode = botToken === 'mock-token' || botToken === 'mock-telegram-token' || process.env.NODE_ENV === 'test';

    for await (const chunk of stream) {
      fullText += chunk;

      if (isMockMode) {
        // In mock mode, just accumulate — no Telegram API calls
        continue;
      }

      if (sentMessageId === null) {
        // Send the initial message once we have some content
        if (fullText.length >= 10 || chunk.includes('\n')) {
          sentMessageId = await this.sendTelegramMessage(botToken, chatId, fullText);
          lastEditTime = Date.now();
        }
      } else {
        // Debounced edit: only update if enough time has passed
        const now = Date.now();
        if (now - lastEditTime >= TELEGRAM_EDIT_DEBOUNCE_MS) {
          if (pendingEditTimeout) {
            clearTimeout(pendingEditTimeout);
            pendingEditTimeout = null;
          }
          await this.editTelegramMessage(botToken, chatId, sentMessageId, fullText);
          lastEditTime = Date.now();
        } else if (!pendingEditTimeout) {
          // Schedule a delayed edit to ensure we don't miss the latest content
          pendingEditTimeout = setTimeout(async () => {
            pendingEditTimeout = null;
            if (sentMessageId !== null) {
              await this.editTelegramMessage(botToken, chatId, sentMessageId, fullText);
              lastEditTime = Date.now();
            }
          }, TELEGRAM_EDIT_DEBOUNCE_MS - (now - lastEditTime));
        }
      }
    }

    // Final delivery — ensure the complete text is sent/updated
    if (isMockMode) {
      console.log(`[Telegram Webhook Simulated Delivery] ChatBot (ID: ${chatbotId}) -> User (ID: ${chatId}): "${fullText}"`);
    } else if (sentMessageId === null && fullText) {
      // Stream ended before initial send threshold — send the full message
      await this.sendTelegramMessage(botToken, chatId, fullText);
    } else if (sentMessageId !== null) {
      // Final edit with complete text
      if (pendingEditTimeout) {
        clearTimeout(pendingEditTimeout);
      }
      await this.editTelegramMessage(botToken, chatId, sentMessageId, fullText);
    }

    return fullText;
  }

  /**
   * Resolves bot token from cache or DB.
   */
  private async resolveBotToken(chatbotId: number): Promise<string> {
    const cached = this.tokenCache.get(chatbotId);
    if (cached) return cached;

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) {
      throw new Error(`Cannot resolve token: ChatBot ID ${chatbotId} not found.`);
    }

    this.tokenCache.set(chatbotId, chatbot.token);
    return chatbot.token;
  }

  /**
   * Sends a new message to Telegram. Returns the message_id for subsequent edits.
   */
  private async sendTelegramMessage(
    botToken: string,
    chatId: string,
    text: string
  ): Promise<number> {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
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
        console.warn(`Telegram sendMessage error ${response.status}: ${errorText}`);
        return -1;
      }

      const data = await response.json() as { result: { message_id: number } };
      return data.result.message_id;
    } catch (err) {
      console.error(`Failed to send message to Telegram:`, err);
      return -1;
    }
  }

  /**
   * Edits an existing Telegram message with updated text.
   */
  private async editTelegramMessage(
    botToken: string,
    chatId: string,
    messageId: number,
    text: string
  ): Promise<void> {
    if (messageId === -1) return; // Skip if initial send failed

    const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // "message is not modified" is expected when content hasn't changed
        if (!errorText.includes('message is not modified')) {
          console.warn(`Telegram editMessageText error ${response.status}: ${errorText}`);
        }
      }
    } catch (err) {
      console.error(`Failed to edit Telegram message:`, err);
    }
  }

  /**
   * Sends a chat action indicator (e.g., "typing") to the user.
   */
  private async sendChatAction(
    botToken: string,
    chatId: string,
    action: string
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${botToken}/sendChatAction`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          action: action,
        }),
      });
    } catch {
      // Non-critical — ignore failures
    }
  }
}
