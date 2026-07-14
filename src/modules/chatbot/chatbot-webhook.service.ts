import { ChatBot } from '../../infrastructure/db/models';
import { TelegramService } from '../../infrastructure/telegram/telegram.service';
import { TunnelService } from '../../infrastructure/tunnel/tunnel.service';

/**
 * ChatbotWebhookService
 *
 * Domain-level use-case service (modules layer) that orchestrates
 * Telegram webhook registration and management for a given chatbot.
 *
 * Responsibilities:
 *  - Retrieve chatbot credentials from the database
 *  - Compose the correct webhook URL using the active Cloudflare tunnel URL
 *  - Delegate to TelegramService for all Telegram API calls
 */
export class ChatbotWebhookService {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly tunnelService: TunnelService
  ) {}

  /**
   * Registers the Telegram webhook for a specific chatbot.
   *
   * The webhook URL will be:
   *   https://<cloudflare-tunnel-url>/webhook/<businessId>/<chatbotId>
   *
   * @param businessId - ID of the owning Business
   * @param chatbotId  - ID of the ChatBot to register
   */
  async registerWebhook(
    businessId: number,
    chatbotId: number
  ): Promise<{ webhookUrl: string; telegramResponse: { ok: boolean; description: string } }> {
    // 1. Retrieve chatbot from DB to get the token
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) {
      throw new Error(`ChatBot with ID ${chatbotId} not found.`);
    }
    if (chatbot.business_id !== businessId) {
      throw new Error(`ChatBot ID ${chatbotId} does not belong to Business ID ${businessId}.`);
    }
    if (!chatbot.token || chatbot.token === 'mock-token' || chatbot.token === 'mock-telegram-token') {
      throw new Error(`ChatBot ID ${chatbotId} has no valid Telegram token.`);
    }

    // 2. Get the current public URL from Cloudflare tunnel
    const publicUrl = this.tunnelService.getPublicUrl();
    if (!publicUrl) {
      throw new Error(
        'Cloudflare tunnel is not running. Ensure the server started successfully with npm run dev.'
      );
    }

    // 3. Compose the webhook URL using businessId and chatbotId as path params
    const webhookUrl = `${publicUrl}/webhook/${businessId}/${chatbotId}`;

    // 4. Register the webhook with Telegram
    const telegramResponse = await this.telegramService.setWebhook(chatbot.token, webhookUrl);

    // 5. Fetch and save the bot's telegram username
    try {
      const meResponse = await this.telegramService.getMe(chatbot.token);
      if (meResponse.ok && meResponse.result?.username) {
        chatbot.telegram_username = meResponse.result.username;
        await chatbot.save();
        console.log(`[ChatbotWebhookService] Saved telegram_username: @${chatbot.telegram_username}`);
      }
    } catch (err) {
      console.warn(`[ChatbotWebhookService] Failed to fetch bot username:`, err);
    }

    console.log(
      `[ChatbotWebhookService] Webhook registered for ChatBot "${chatbot.name}" ` +
      `(ID: ${chatbotId}) → ${webhookUrl}`
    );

    return { webhookUrl, telegramResponse };
  }

  /**
   * Retrieves the current webhook info from Telegram for the given chatbot.
   *
   * @param chatbotId - ID of the ChatBot
   */
  async getWebhookInfo(chatbotId: number) {
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) {
      throw new Error(`ChatBot with ID ${chatbotId} not found.`);
    }
    if (!chatbot.token) {
      throw new Error(`ChatBot ID ${chatbotId} has no Telegram token.`);
    }

    return this.telegramService.getWebhookInfo(chatbot.token);
  }

  /**
   * Removes the Telegram webhook for the given chatbot.
   *
   * @param chatbotId - ID of the ChatBot
   */
  async deleteWebhook(chatbotId: number): Promise<{ ok: boolean; description: string }> {
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) {
      throw new Error(`ChatBot with ID ${chatbotId} not found.`);
    }
    if (!chatbot.token) {
      throw new Error(`ChatBot ID ${chatbotId} has no Telegram token.`);
    }

    return this.telegramService.deleteWebhook(chatbot.token);
  }
}
