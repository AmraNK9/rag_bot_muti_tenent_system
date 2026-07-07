import { RetrievalGenerationService } from '../services/retrieval-generation.service';
import { ChatMemoryService } from '../services/chat-memory.service';
import { ChatBot, ChatSession } from '../../../infrastructure/db/models';
import { SubscriptionService } from '../../subscription/subscription.service';
import { debugLogger } from '../../../core/logger';
import { ChatbotAnalyticsService } from '../services/chatbot-analytics.service';
import { SocketService } from '../../../infrastructure/socket/socket.service';

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
    photo?: Array<{ file_id: string }>;
    date: number;
  };
  callback_query?: {
    id: string;
    data: string;
  };
}

/**
 * Debounce interval for Telegram editMessageText calls (ms).
 * Telegram rate limits at ~30 edits/min per chat, so 500ms is safe.
 */
const TELEGRAM_EDIT_DEBOUNCE_MS = 500;

export class WebhookController {
  /** In-memory cache for bot tokens with expiration to avoid redundant DB lookups */
  private tokenCache: Map<number, { token: string; expiresAt: number }> = new Map();
  private subscriptionService: SubscriptionService;

  constructor(
    private retrievalGenService: RetrievalGenerationService,
    private chatMemoryService: ChatMemoryService
  ) {
    this.subscriptionService = new SubscriptionService();
  }

  /**
   * Receives incoming messages from Telegram Webhook, manages conversation logs,
   * performs streaming search retrieval + generation, and delivers progressive responses.
   */
  async handleTelegramWebhook(
    chatbotId: number,
    update: TelegramWebhookUpdate
  ): Promise<{ success: boolean; replyText?: string }> {
    // Handle callback queries (like the Admin tag inline button)
    if (update.callback_query) {
      try {
        const botToken = await this.resolveBotToken(chatbotId);
        const telegramService = new (require('../../infrastructure/telegram/telegram.service').TelegramService)();
        await telegramService.answerCallbackQuery(botToken, update.callback_query.id);
      } catch (e) {
        console.error('Failed to answer callback query:', e);
      }
      return { success: true };
    }

    if (!update.message || (!update.message.text && !update.message.photo)) {
      return { success: false };
    }

    const senderId = String(update.message.from.id);
    const chatId = update.message.chat.id;
    const userText = update.message.text || '';

    try {
      // Resolve bot token (cached or from DB)
      const botToken = await this.resolveBotToken(chatbotId);

      // Send "typing" indicator immediately for better UX
      void this.sendChatAction(botToken, chatId, 'typing').catch(() => {});

      // Credit check: resolve business_id from chatbot and check credits
      const chatbot = await ChatBot.findByPk(chatbotId);
      if (chatbot) {
        const hasCredits = await this.subscriptionService.checkCredits(chatbot.business_id);
        if (!hasCredits) {
          debugLogger.log('CREDITS', `Business ${chatbot.business_id} has no credits remaining — blocking message`);
          await this.sendTelegramMessage(botToken, chatId,
            '⚠️ This bot\'s message credits have been exhausted. Please contact the business owner to top up credits.'
          );
          return { success: false, replyText: 'Credits exhausted' };
        }
        // Deduct one credit atomically
        await this.subscriptionService.deductCredit(chatbot.business_id);
        debugLogger.log('CREDITS', `Deducted 1 credit for Business ${chatbot.business_id}`);

        // Record activity log to analytics buffer (estimated API cost: $0.00015)
        ChatbotAnalyticsService.recordActivity(chatbotId, 1, 0.00015);
      }

      // ─── EXTRACT IMAGE URL ───
      let imageTag = '[Photo]';
      if (update.message.photo && update.message.photo.length > 0) {
        try {
          const fileId = update.message.photo[update.message.photo.length - 1].file_id;
          const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
          const fileData = await fileRes.json() as any;
          if (fileData.ok && fileData.result?.file_path) {
            imageTag = `[PHOTO:https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}]`;
          }
        } catch (e) {
          console.error('Failed to get Telegram file path', e);
        }
      }

      // Save user's incoming message to DB first (so it appears in history)
      const userMsgRecord = await this.chatMemoryService.saveMessage(chatbotId, senderId, userText || imageTag, true);
      
      // Real-time UI update: emit event to chatbot admin room
      try {
        SocketService.io.to(chatbotId.toString()).emit('new_message', userMsgRecord.toJSON());
      } catch (err) { console.error('Socket emit error:', err); }

      // ─── IMAGE INTERCEPTOR (Bypass LLM) ───
      if (update.message.photo && update.message.photo.length > 0) {
        debugLogger.log('PIPELINE', 'Image received. Intercepting and creating action banner.');
        
        // 1. Auto-reply to Customer FIRST (so it is NOT the last message in DB)
        const replyText = 'လူကြီးမင်းပို့လိုက်သော ပုံကို လက်ခံရရှိပါပြီရှင်။ Admin မှ ကိုယ်တိုင် ကြည့်ရှုစစ်ဆေးပြီး ချက်ချင်း အကြောင်းပြန်ပေးပါမည်။ ခေတ္တစောင့်ဆိုင်းပေးပါရှင်။';
        await this.sendTelegramMessage(botToken, chatId, replyText);
        
        const botMsgRecord = await this.chatMemoryService.saveMessage(chatbotId, senderId, replyText, false);
        try {
          SocketService.io.to(chatbotId.toString()).emit('new_message', botMsgRecord.toJSON());
        } catch (err) { console.error('Socket emit error:', err); }

        // 2. Trigger Action Banner AND Telegram Notification via Tool
        try {
          const { RequestHumanAgentTool } = await import('../tools/request-human-agent.tool');
          const tool = new RequestHumanAgentTool();
          await tool.execute({
            action_type: 'checkout_req',
            summary: 'Customer uploaded an image. Please verify if it is a payment receipt or product inquiry.'
          }, { chatbotId, senderId });
        } catch (e) {
          console.error('[Image Interceptor] Tool execution error', e);
        }

        return { success: true };
      }

      // ─── HUMAN TAKEOVER PROTOCOL ───
      // Check if an admin has taken over the chat. If so, and the session hasn't expired, stay silent.
      const session = await ChatSession.findOne({
        where: { chatbot_id: chatbotId, sender_id: senderId }
      });
      if (session && session.is_human_takeover) {
        const timeoutMins = chatbot?.handover_timeout_mins || 30;
        const now = new Date();
        const diffMins = (now.getTime() - session.updated_at.getTime()) / 60000;
        
        if (diffMins < timeoutMins) {
          debugLogger.log('HANDOVER', `Admin has taken over chat for ${senderId}. AI is silent.`);
          return { success: true };
        } else {
          debugLogger.log('HANDOVER', `Admin session expired for ${senderId} (inactive for >${timeoutMins} mins). Auto-releasing.`);
          await session.update({ is_human_takeover: false });
        }
      }

      // Stream response chunks and deliver progressively to Telegram
      const assistantReply = await this.streamAndDeliver(
        chatbotId,
        senderId,
        chatId,
        botToken,
        userText
      );

      // Fire-and-forget: save bot's response message to DB and emit to UI
      void this.chatMemoryService.saveMessage(chatbotId, senderId, assistantReply, false).then(botMsgRecord => {
        try {
          SocketService.io.to(chatbotId.toString()).emit('new_message', botMsgRecord.toJSON());
        } catch (err) { console.error('Socket emit error:', err); }
      }).catch(err => {
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

  private async resolveBotToken(chatbotId: number): Promise<string> {
    const cached = this.tokenCache.get(chatbotId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) {
      throw new Error(`Cannot resolve token: ChatBot ID ${chatbotId} not found.`);
    }

    // Cache for 5 minutes
    this.tokenCache.set(chatbotId, { token: chatbot.token, expiresAt: Date.now() + 5 * 60 * 1000 });
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
