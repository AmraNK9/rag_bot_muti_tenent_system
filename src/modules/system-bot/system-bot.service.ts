import { TelegramService } from '../../infrastructure/telegram/telegram.service';
import { SystemBotConfig, SystemBotFaq, Reseller, Business, ChatBot } from '../../infrastructure/db/models';

export class SystemBotService {
  private telegramService: TelegramService;

  constructor(telegramService?: TelegramService) {
    this.telegramService = telegramService || new TelegramService();
  }

  /**
   * Retrieves active system bot configuration from DB.
   */
  async getConfig(): Promise<SystemBotConfig | null> {
    return SystemBotConfig.findOne({ where: { is_active: true } });
  }

  /**
   * Processes incoming updates sent to the System Core Telegram Bot webhook.
   */
  async handleUpdate(update: any): Promise<void> {
    if (!update || !update.message) return;

    const message = update.message;
    const chatId = message.chat?.id;
    const text = message.text?.trim() || '';
    const username = message.from?.username || message.from?.first_name || '';

    if (!chatId || !text) return;

    const config = await this.getConfig();
    const botToken = config?.bot_token || process.env.SYSTEM_BOT_TOKEN || 'mock-system-bot-token';

    // 1. Check for reseller account linking deep-link: /start connect_<resellerId>
    if (text.startsWith('/start connect_')) {
      const parts = text.split('connect_');
      const resellerId = Number(parts[1]);

      if (!isNaN(resellerId) && resellerId > 0) {
        const reseller = await Reseller.findByPk(resellerId);
        if (reseller) {
          await reseller.update({
            telegram_chat_id: String(chatId),
            telegram_username: username,
          });

          // Broadcast real-time WebSocket update to reseller app
          try {
            const { SocketService } = await import('../../infrastructure/socket/socket.service');
            SocketService.io.to(`reseller_${resellerId}`).emit('telegram_connected', {
              telegram_chat_id: String(chatId),
              telegram_username: username,
            });
          } catch (sErr) {
            console.error('[Socket Broadcast Error] telegram_connected:', sErr);
          }

          const replyMsg = `✅ Account Linked Successfully!\n\nHello ${reseller.name}, your Telegram account has been linked to Reseller Account #${resellerId}.\nYou will now receive real-time instant notifications right here whenever a client requests a plan upgrade.`;
          await this.sendMessageSafely(botToken, chatId, replyMsg);
          return;
        }
      }
    }

    // 1b. Check for business client account linking deep-link: /start connect_business_<businessId>
    if (text.startsWith('/start connect_business_')) {
      const parts = text.split('connect_business_');
      const businessId = Number(parts[1]);

      if (!isNaN(businessId) && businessId > 0) {
        const business = await Business.findByPk(businessId);
        if (business) {
          await business.update({
            telegram_chat_id: String(chatId),
            telegram_username: username,
          });

          // Broadcast real-time WebSocket update to chatbot admin app
          try {
            const { SocketService } = await import('../../infrastructure/socket/socket.service');
            const payload = {
              telegram_chat_id: String(chatId),
              telegram_username: username,
            };
            SocketService.io.to(`business_${businessId}`).emit('business_telegram_connected', payload);
            const chatbots = await ChatBot.findAll({ where: { business_id: businessId } });
            chatbots.forEach(bot => {
              SocketService.io.to(bot.id.toString()).emit('business_telegram_connected', payload);
            });
          } catch (sErr) {
            console.error('[Socket Broadcast Error] business_telegram_connected:', sErr);
          }

          const replyMsg = `✅ Shop Account Linked Successfully!\n\nHello ${business.name}, your Telegram account has been connected to your Chatbot Admin Portal.\nYou will now receive instant alerts right here for low message credits, staff handoff requests, and plan upgrade approvals!`;
          await this.sendMessageSafely(botToken, chatId, replyMsg);
          return;
        }
      }
    }

    // 2. Standard /start or /help command
    if (text === '/start' || text === '/help') {
      const welcomeMsg = `🤖 Welcome to the SaaS Chatbot Platform Assistant!\n\nI can help you with:\n• 💎 Package Pricing & Limits (/pricing)\n• 🤝 Reseller Partnership Info (/reseller)\n• ⚙️ How to Top Up Credits (/topup)\n\nYou can also ask me any questions directly, or tap one of the quick topics below!`;
      await this.sendMessageSafely(botToken, chatId, welcomeMsg);
      return;
    }

    if (text === '/pricing') {
      const reply = `💎 **Subscription Packages**\n\n1. **Lite Plan**: 500 queries/month\n2. **Basic Plan**: 2,000 queries/month\n3. **Pro Plan**: 10,000 queries/month + priority AI support.\n\nVisit your Chatbot Admin dashboard under the Billing tab to upgrade!`;
      await this.sendMessageSafely(botToken, chatId, reply);
      return;
    }

    if (text === '/reseller') {
      const reply = `🤝 **Become a Reseller Agent**\n\nEarn up to 30% commission on client subscriptions! Manage client top-ups via P2P direct transfer or postpaid credit limit.\n\nSign up today at our Reseller Portal: /reseller`;
      await this.sendMessageSafely(botToken, chatId, reply);
      return;
    }

    if (text === '/topup') {
      const reply = `⚙️ **How to Top Up Credits**\n\n1. Log in to Chatbot Admin portal.\n2. Go to the Billing tab and select a package.\n3. Transfer via KBZ Pay and upload your receipt screenshot!\n4. Or contact your assigned reseller for instant P2P credit load.`;
      await this.sendMessageSafely(botToken, chatId, reply);
      return;
    }

    // 3. Match against System FAQs database
    const faqs = await SystemBotFaq.findAll({ where: { is_active: true } });
    const lowerText = text.toLowerCase();

    let matchedFaq = faqs.find((f) => lowerText.includes(f.question.toLowerCase()) || f.question.toLowerCase().includes(lowerText));

    if (!matchedFaq) {
      // Keyword based match
      matchedFaq = faqs.find((f) => {
        const keywords = f.question.toLowerCase().split(' ');
        return keywords.some((kw) => kw.length > 3 && lowerText.includes(kw));
      });
    }

    if (matchedFaq) {
      await this.sendMessageSafely(botToken, chatId, `💡 **${matchedFaq.question}**\n\n${matchedFaq.answer}`);
      return;
    }

    // Default Fallback Response
    const fallbackMsg = `Thank you for reaching out! I am the SaaS Platform Assistant. 🤖\n\nFor instant details on packages, tap /pricing or /reseller. You can also contact our support team or check our portal FAQs!`;
    await this.sendMessageSafely(botToken, chatId, fallbackMsg);
  }

  /**
   * Sends a real-time Telegram notification to a reseller when a plan upgrade request is created.
   */
  async notifyResellerUpgradeRequest(resellerChatId: string | number, requestData: {
    businessName: string;
    planName: string;
    price: number;
  }): Promise<void> {
    const config = await this.getConfig();
    const botToken = config?.bot_token || process.env.SYSTEM_BOT_TOKEN || 'mock-system-bot-token';

    const msg = `🔔 **NEW PLAN UPGRADE REQUEST!**\n\n🏢 Business: ${requestData.businessName}\n💎 Plan: ${requestData.planName.toUpperCase()}\n💰 Amount: ${Number(requestData.price).toLocaleString()} MMK\n\nPlease log in to your Reseller Portal to review and approve this request.`;
    await this.sendMessageSafely(botToken, resellerChatId, msg);
  }

  /**
   * Sends a real-time Telegram notification to a business owner when human agent assistance is needed.
   */
  async notifyBusinessHumanAgentNeeded(businessChatId: string | number, data: {
    chatbotName: string;
    senderId: string;
    reason: string;
  }): Promise<void> {
    const config = await this.getConfig();
    const botToken = config?.bot_token || process.env.SYSTEM_BOT_TOKEN || 'mock-system-bot-token';

    const msg = `🙋‍♂️ **STAFF ASSISTANCE REQUIRED!**\n\n🤖 Bot: ${data.chatbotName}\n👤 Customer: User ${data.senderId}\n💬 Reason: ${data.reason}\n\nPlease log in to your Chatbot Admin dashboard to reply to the customer directly!`;
    await this.sendMessageSafely(botToken, businessChatId, msg);
  }

  /**
   * Sends a real-time Telegram notification to a business owner when message credits run low.
   */
  async notifyBusinessLowCredits(businessChatId: string | number, data: {
    businessName: string;
    remainingCredits: number;
  }): Promise<void> {
    const config = await this.getConfig();
    const botToken = config?.bot_token || process.env.SYSTEM_BOT_TOKEN || 'mock-system-bot-token';

    const msg = `⚠️ **LOW MESSAGE CREDITS WARNING!**\n\n🏢 Shop: ${data.businessName}\n📊 Remaining Credits: ${data.remainingCredits} queries\n\nYour chatbot message credits are running low. Please log in to your Chatbot Admin portal under Billing to top up and prevent bot downtime!`;
    await this.sendMessageSafely(botToken, businessChatId, msg);
  }

  /**
   * Registers the webhook with Telegram using the provided botToken and publicUrl.
   */
  async registerWebhook(botToken: string, publicUrl: string): Promise<any> {
    if (!botToken || botToken === 'mock-system-bot-token') {
      console.log('[SystemBotService] Mock bot token in use. Skipping webhook registration.');
      return null;
    }
    const webhookUrl = `${publicUrl}/api/v1/webhook/system-bot`;
    console.log(`[SystemBotService] Registering System Bot Webhook → ${webhookUrl}`);
    return this.telegramService.setWebhook(botToken, webhookUrl);
  }

  /**
   * Retrieves bot information (including username) from Telegram.
   */
  async getBotUsername(botToken: string): Promise<string> {
    if (!botToken || botToken === 'mock-system-bot-token') return 'mock_bot';
    try {
      const info = await this.telegramService.getMe(botToken);
      if (info.ok && info.result?.username) {
        return info.result.username;
      }
    } catch (e) {
      console.error('[SystemBotService] getMe failed:', e);
    }
    return 'mock_bot';
  }

  private async sendMessageSafely(botToken: string, chatId: string | number, text: string): Promise<void> {
    if (botToken === 'mock-system-bot-token' || process.env.NODE_ENV === 'test') {
      console.log(`[Mock System Bot] Sent to ${chatId}: ${text}`);
      return;
    }
    try {
      await this.telegramService.sendMessage(botToken, chatId, text);
    } catch (err) {
      console.error(`[System Bot Error] Failed to send message to ${chatId}:`, err);
    }
  }
}
