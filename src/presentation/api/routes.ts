import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuthService } from '../../modules/auth/auth.service';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { BusinessService } from '../../modules/business/business.service';
import { KnowledgeService } from '../../modules/knowledge/knowledge.service';
import { ChatbotWebhookService } from '../../modules/chatbot/chatbot-webhook.service';
import { DeepSeekService } from '../../infrastructure/llm/deepseek.service';
import { VoyageEmbeddingService } from '../../infrastructure/embeddings/voyage.service';
import { PgVectorStoreService } from '../../infrastructure/vectorstore/pgvector.service';
import { TelegramService } from '../../infrastructure/telegram/telegram.service';
import { tunnelService } from '../../infrastructure/tunnel/tunnel.service';
import { ChatBot, Messages, ChatbotAdmin, Business } from '../../infrastructure/db/models';
import { QueryTypes } from 'sequelize';
import { SequelizeService } from '../../infrastructure/db/sequelize.service';
import bcrypt from 'bcryptjs';
import { chatbotAdminAuthMiddleware, ChatbotAdminRequest } from '../middleware/chatbot-admin-auth.middleware';
import { ChatbotAdminAuthService } from '../../modules/auth/chatbot-admin-auth.service';

// ─── Service Initialization ──────────────────────────────────────────────────
const authService = new AuthService();
const subscriptionService = new SubscriptionService();
const vectorStore = new PgVectorStoreService();
const embeddingService = new VoyageEmbeddingService();
const businessService = new BusinessService(vectorStore);
const knowledgeService = new KnowledgeService(embeddingService, vectorStore);
const telegramService = new TelegramService();
const chatbotWebhookService = new ChatbotWebhookService(telegramService, tunnelService);
const chatbotAdminAuthService = new ChatbotAdminAuthService();

const apiRouter = Router();

// ─── Helper: verify chatbot ownership ───────────────────────────────────────
async function verifyChatbotOwnership(chatbotId: number, businessId: number): Promise<ChatBot | null> {
  return ChatBot.findOne({ where: { id: chatbotId, business_id: businessId } });
}

// ─── 1. POST /auth/register ─────────────────────────────────────────────────
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, detailInfo, password } = req.body;
    if (!name || !detailInfo || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields: "name", "detailInfo", and "password".' });
    }
    const result = await authService.register(name, detailInfo, password);
    return res.json({ success: true, token: result.token, business: { id: result.business.id, name: result.business.name, plan: result.business.plan } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 2. POST /auth/login ────────────────────────────────────────────────────
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields: "name" and "password".' });
    }
    const result = await authService.login(name, password);
    return res.json({ success: true, token: result.token, business: { id: result.business.id, name: result.business.name, plan: result.business.plan, active_messages_count: result.business.active_messages_count } });
  } catch (error) {
    return res.status(401).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 3. GET /profile ────────────────────────────────────────────────────────
apiRouter.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const planInfo = await subscriptionService.getBusinessPlan(authReq.business.id);
    const chatbotCount = await ChatBot.count({ where: { business_id: authReq.business.id } });
    return res.json({ success: true, profile: { id: authReq.business.id, name: authReq.business.name, plan: planInfo.plan, activeMessagesCount: planInfo.activeMessagesCount, subscriptionPlan: planInfo.subscriptionPlan, subscriptionEndDate: planInfo.subscriptionEndDate, totalChatbots: planInfo.totalChatbots, currentChatbotCount: chatbotCount } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 4. POST /chatbots ──────────────────────────────────────────────────────
apiRouter.post('/chatbots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, token, type, botRole, customSystemPrompt, apiId, apiHash } = req.body;
    if (!name || !token || !type) return res.status(400).json({ success: false, error: 'Missing required fields: "name", "token", and "type".' });
    if (type !== 'telegram' && type !== 'facebook') return res.status(400).json({ success: false, error: 'Type must be "telegram" or "facebook".' });

    const planInfo = await subscriptionService.getBusinessPlan(authReq.business.id);
    const currentCount = await ChatBot.count({ where: { business_id: authReq.business.id } });
    if (currentCount >= planInfo.totalChatbots) {
      return res.status(403).json({ success: false, error: `Chatbot limit reached. Your plan allows ${planInfo.totalChatbots} chatbot(s).` });
    }
    const chatbot = await businessService.createChatBot({ businessId: authReq.business.id, name, token, type, botRole, customSystemPrompt, apiId, apiHash });
    return res.json({ success: true, chatbot });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 5. GET /chatbots ───────────────────────────────────────────────────────
apiRouter.get('/chatbots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbots = await ChatBot.findAll({ where: { business_id: authReq.business.id } });
    return res.json({ success: true, chatbots });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 6. DELETE /chatbots/:id ────────────────────────────────────────────────
apiRouter.delete('/chatbots/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: `ChatBot with ID ${chatbotId} not found.` });
    if (chatbot.business_id !== authReq.business.id) return res.status(403).json({ success: false, error: 'Access denied.' });
    await chatbot.destroy();
    return res.json({ success: true, message: `ChatBot ${chatbotId} deleted successfully.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 7. POST /knowledge/ingest ──────────────────────────────────────────────
apiRouter.post('/knowledge/ingest', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { chatbotId, documentText, maxChunkSize, overlap } = req.body;
    if (!chatbotId || !documentText) return res.status(400).json({ success: false, error: 'Missing required fields: "chatbotId" and "documentText".' });
    const chatbot = await verifyChatbotOwnership(Number(chatbotId), authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: `ChatBot ID ${chatbotId} not found or access denied.` });
    const result = await knowledgeService.ingestDocument({ chatbotId: Number(chatbotId), businessId: authReq.business.id, documentText, maxChunkSize: maxChunkSize ? Number(maxChunkSize) : undefined, overlap: overlap ? Number(overlap) : undefined });
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 8. POST /chatbots/:id/webhook ──────────────────────────────────────────
apiRouter.post('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await chatbotWebhookService.registerWebhook(authReq.business.id, Number(req.params.id));
    return res.json({ success: true, webhookUrl: result.webhookUrl, telegram: result.telegramResponse });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 9. GET /chatbots/:id/webhook ───────────────────────────────────────────
apiRouter.get('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbot = await verifyChatbotOwnership(Number(req.params.id), authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });
    const info = await chatbotWebhookService.getWebhookInfo(Number(req.params.id));
    return res.json({ success: true, webhookInfo: info });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 10. DELETE /chatbots/:id/webhook ───────────────────────────────────────
apiRouter.delete('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbot = await verifyChatbotOwnership(Number(req.params.id), authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });
    const result = await chatbotWebhookService.deleteWebhook(Number(req.params.id));
    return res.json({ success: true, telegram: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 11. GET /credits ───────────────────────────────────────────────────────
apiRouter.get('/credits', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const planInfo = await subscriptionService.getBusinessPlan(authReq.business.id);
    return res.json({ success: true, ...planInfo });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 12. POST /topup ────────────────────────────────────────────────────────
apiRouter.post('/topup', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { transactionId, price, billingType, topupType, receiptFileUrl, messageCount } = req.body;
    if (!transactionId || price === undefined || !billingType || !topupType || messageCount === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }
    const topUp = await subscriptionService.submitTopUp({ businessId: authReq.business.id, transactionId, price: Number(price), billingType, topupType, receiptFileUrl, messageCount: Number(messageCount) });
    return res.json({ success: true, topUp });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 13. GET /topup/history ─────────────────────────────────────────────────
apiRouter.get('/topup/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const history = await subscriptionService.getTopUpHistory(authReq.business.id);
    return res.json({ success: true, history });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN — KNOWLEDGE BASE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// ─── 14. GET /knowledge/:chatbotId — list chunks (paginated) ────────────────
apiRouter.get('/knowledge/:chatbotId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.chatbotId);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    const collectionName = `business_${authReq.business.id}`;
    const { chunks, total } = await vectorStore.listDocuments(collectionName, 10000, 0);

    // Filter to only chunks for this specific chatbot
    const chatbotChunks = chunks.filter(c => String(c.metadata?.chatbot_id) === String(chatbotId));
    const paged = chatbotChunks.slice(offset, offset + limit);

    return res.json({ success: true, chunks: paged, total: chatbotChunks.length, limit, offset });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 15. DELETE /knowledge/:chatbotId/chunks/:docId ─────────────────────────
apiRouter.delete('/knowledge/:chatbotId/chunks/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.chatbotId);
    const docId = decodeURIComponent(String(req.params.docId));

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    const deleted = await vectorStore.deleteDocument(docId);
    if (!deleted) return res.status(404).json({ success: false, error: `Chunk "${docId}" not found.` });

    return res.json({ success: true, message: `Chunk deleted.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 16. DELETE /knowledge/:chatbotId — clear all knowledge ─────────────────
apiRouter.delete('/knowledge/:chatbotId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.chatbotId);

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    const collectionName = `business_${authReq.business.id}`;
    const { chunks } = await vectorStore.listDocuments(collectionName, 10000, 0);
    const chatbotChunks = chunks.filter(c => String(c.metadata?.chatbot_id) === String(chatbotId));

    let deletedCount = 0;
    for (const chunk of chatbotChunks) {
      await vectorStore.deleteDocument(chunk.id);
      deletedCount++;
    }

    return res.json({ success: true, deletedCount, message: `Cleared ${deletedCount} chunks.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN — CONVERSATIONS & MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

// ─── 17. GET /chatbots/:id/conversations — unique senders list ───────────────
apiRouter.get('/chatbots/:id/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    const sequelize = SequelizeService.getClient();
    const conversations = await sequelize.query(
      `SELECT sender_id, COUNT(*) AS message_count, MAX(sent_date) AS last_message_at
       FROM messages
       WHERE chatbot_id = :chatbotId
       GROUP BY sender_id
       ORDER BY last_message_at DESC;`,
      { replacements: { chatbotId }, type: QueryTypes.SELECT }
    ) as Array<{ sender_id: string; message_count: string; last_message_at: Date }>;

    return res.json({ success: true, conversations });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 18. GET /chatbots/:id/conversations/:senderId — chat history ─────────────
apiRouter.get('/chatbots/:id/conversations/:senderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);
    const senderId = req.params.senderId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    const messages = await Messages.findAndCountAll({
      where: { chatbot_id: chatbotId, sender_id: senderId },
      order: [['sent_date', 'ASC']],
      limit,
      offset,
    });

    return res.json({ success: true, messages: messages.rows, total: messages.count, limit, offset });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 19. POST /chatbots/:id/conversations/:senderId/reply — Business Admin reply ───
apiRouter.post('/chatbots/:id/conversations/:senderId/reply', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);
    const senderId = String(req.params.senderId);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Missing required field: "message".' });
    }

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    // Check & deduct credit
    const hasCredits = await subscriptionService.checkCredits(chatbot.business_id);
    if (!hasCredits) {
      return res.status(403).json({ success: false, error: 'Credits exhausted.' });
    }
    await subscriptionService.deductCredit(chatbot.business_id);

    // Send via Telegram
    const msgId = await telegramService.sendMessage(chatbot.token, senderId, message);

    // Save message to DB
    const savedMsg = await Messages.create({
      chatbot_id: chatbotId,
      sender_id: senderId,
      message: message,
      sender_type: 'bot',
    });

    return res.json({ success: true, message: savedMsg });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 20. GET /chatbots/:id/admins — Business Admin list chatbot admins ───────────
apiRouter.get('/chatbots/:id/admins', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    const admins = await ChatbotAdmin.findAll({
      where: { chatbot_id: chatbotId },
      attributes: { exclude: ['password'] },
    });

    return res.json({ success: true, admins });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 21. POST /chatbots/:id/admins — Business Admin create chatbot admin ─────────
apiRouter.post('/chatbots/:id/admins', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);
    const { name, email, password, can_manage_knowledge, can_manage_system_prompt } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields: "name", "email", or "password".' });
    }

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    // Check if email already exists
    const existing = await ChatbotAdmin.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: `Email "${email}" is already registered.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await ChatbotAdmin.create({
      chatbot_id: chatbotId,
      name,
      email,
      password: hashedPassword,
      is_standalone: false,
      can_manage_knowledge: !!can_manage_knowledge,
      can_manage_system_prompt: !!can_manage_system_prompt,
    });

    // Strip password from response
    const { password: _, ...adminData } = admin.toJSON() as any;

    return res.json({ success: true, admin: adminData });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 22. PUT /chatbots/:id/admins/:adminId — Business Admin update chatbot admin ──
apiRouter.put('/chatbots/:id/admins/:adminId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);
    const adminId = Number(req.params.adminId);
    const { name, email, password, can_manage_knowledge, can_manage_system_prompt } = req.body;

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    const admin = await ChatbotAdmin.findOne({ where: { id: adminId, chatbot_id: chatbotId } });
    if (!admin) return res.status(404).json({ success: false, error: 'Chatbot admin not found.' });

    const updates: any = {};
    if (name) updates.name = name;
    if (email) {
      // Check if email taken by someone else
      const existing = await ChatbotAdmin.findOne({ where: { email } });
      if (existing && existing.id !== adminId) {
        return res.status(400).json({ success: false, error: 'Email already taken by another account.' });
      }
      updates.email = email;
    }
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }
    if (can_manage_knowledge !== undefined) updates.can_manage_knowledge = !!can_manage_knowledge;
    if (can_manage_system_prompt !== undefined) updates.can_manage_system_prompt = !!can_manage_system_prompt;

    await admin.update(updates);

    const { password: _, ...adminData } = admin.toJSON() as any;
    return res.json({ success: true, admin: adminData });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 23. DELETE /chatbots/:id/admins/:adminId — Business Admin delete chatbot admin ─
apiRouter.delete('/chatbots/:id/admins/:adminId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);
    const adminId = Number(req.params.adminId);

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    const admin = await ChatbotAdmin.findOne({ where: { id: adminId, chatbot_id: chatbotId } });
    if (!admin) return res.status(404).json({ success: false, error: 'Chatbot admin not found.' });

    await admin.destroy();
    return res.json({ success: true, message: 'Chatbot admin deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHATBOT ADMIN APP APIS
// ═══════════════════════════════════════════════════════════════════════════

// ─── 24. POST /chatbot-admin/register — Standalone signup ────────────────────────
apiRouter.post('/chatbot-admin/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, botName, botToken, botType, botRole } = req.body;
    if (!name || !email || !password || !botName || !botToken || !botType) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const result = await chatbotAdminAuthService.registerStandalone({
      name,
      email,
      password,
      botName,
      botToken,
      botType,
      botRole: botRole || 'sales',
    });

    return res.json({
      success: true,
      token: result.token,
      admin: { id: result.admin.id, name: result.admin.name, email: result.admin.email },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 25. POST /chatbot-admin/login — Login ─────────────────────────────────────
apiRouter.post('/chatbot-admin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Missing email or password.' });
    }

    const result = await chatbotAdminAuthService.login(email, password);
    return res.json({
      success: true,
      token: result.token,
      admin: { id: result.admin.id, name: result.admin.name, email: result.admin.email },
    });
  } catch (error) {
    return res.status(401).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 26. GET /chatbot-admin/profile — Profile & credits ──────────────────────────
apiRouter.get('/chatbot-admin/profile', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const admin = await ChatbotAdmin.findByPk(adminReq.chatbotAdmin.adminId);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found.' });

    const chatbot = await ChatBot.findByPk(adminReq.chatbotAdmin.chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    const business = await Business.findByPk(chatbot.business_id);
    const credits = business ? business.active_messages_count : 0;

    return res.json({
      success: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        isStandalone: admin.is_standalone,
        canManageKnowledge: admin.can_manage_knowledge,
        canManageSystemPrompt: admin.can_manage_system_prompt,
      },
      chatbot: {
        id: chatbot.id,
        name: chatbot.name,
        description: chatbot.description,
        type: chatbot.type,
        bot_role: chatbot.bot_role,
        custom_system_prompt: chatbot.custom_system_prompt,
      },
      credits,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 27. PUT /chatbot-admin/chatbot — Edit chatbot metadata (standalone only) ───────
apiRouter.put('/chatbot-admin/chatbot', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.isStandalone) {
      return res.status(403).json({ success: false, error: 'Only standalone chatbot admins can customize chatbot metadata.' });
    }

    const { name, description } = req.body;
    const chatbot = await ChatBot.findByPk(adminReq.chatbotAdmin.chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    const updates: any = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    await chatbot.update(updates);
    return res.json({ success: true, chatbot });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 28. GET /chatbot-admin/conversations — Chat list ───────────────────────────
apiRouter.get('/chatbot-admin/conversations', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;

    const sequelize = SequelizeService.getClient();
    const conversations = await sequelize.query(
      `SELECT sender_id, COUNT(*) AS message_count, MAX(sent_date) AS last_message_at
       FROM messages
       WHERE chatbot_id = :chatbotId
       GROUP BY sender_id
       ORDER BY last_message_at DESC;`,
      { replacements: { chatbotId }, type: QueryTypes.SELECT }
    ) as Array<{ sender_id: string; message_count: string; last_message_at: Date }>;

    return res.json({ success: true, conversations });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 29. GET /chatbot-admin/conversations/:senderId — Chat history ────────────────
apiRouter.get('/chatbot-admin/conversations/:senderId', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    const senderId = req.params.senderId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const messages = await Messages.findAndCountAll({
      where: { chatbot_id: chatbotId, sender_id: senderId },
      order: [['sent_date', 'ASC']],
      limit,
      offset,
    });

    return res.json({ success: true, messages: messages.rows, total: messages.count, limit, offset });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 30. POST /chatbot-admin/conversations/:senderId/reply — Send reply ───────────
apiRouter.post('/chatbot-admin/conversations/:senderId/reply', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    const senderId = String(req.params.senderId);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Missing required field: "message".' });
    }

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    // Check & deduct credit
    const hasCredits = await subscriptionService.checkCredits(chatbot.business_id);
    if (!hasCredits) {
      return res.status(403).json({ success: false, error: 'Credits exhausted.' });
    }
    await subscriptionService.deductCredit(chatbot.business_id);

    // Send via Telegram
    const msgId = await telegramService.sendMessage(chatbot.token, senderId, message);

    // Save message to DB
    const savedMsg = await Messages.create({
      chatbot_id: chatbotId,
      sender_id: senderId,
      message: message,
      sender_type: 'bot',
    });

    return res.json({ success: true, message: savedMsg });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 31. GET /chatbot-admin/knowledge — View knowledge chunks ────────────────────
apiRouter.get('/chatbot-admin/knowledge', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.canManageKnowledge) {
      return res.status(403).json({ success: false, error: 'Access denied: missing knowledge base management permission.' });
    }

    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    const collectionName = `business_${chatbot.business_id}`;
    const { chunks } = await vectorStore.listDocuments(collectionName, 10000, 0);

    // Filter to only chunks for this specific chatbot
    const chatbotChunks = chunks.filter(c => String(c.metadata?.chatbot_id) === String(chatbotId));
    const paged = chatbotChunks.slice(offset, offset + limit);

    return res.json({ success: true, chunks: paged, total: chatbotChunks.length, limit, offset });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 32. POST /chatbot-admin/knowledge/ingest — Ingest knowledge ─────────────────
apiRouter.post('/chatbot-admin/knowledge/ingest', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.canManageKnowledge) {
      return res.status(403).json({ success: false, error: 'Access denied: missing knowledge base management permission.' });
    }

    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    const { documentText, maxChunkSize, overlap } = req.body;
    if (!documentText) return res.status(400).json({ success: false, error: 'Missing required field: "documentText".' });

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    const result = await knowledgeService.ingestDocument({
      chatbotId: chatbotId,
      businessId: chatbot.business_id,
      documentText,
      maxChunkSize: maxChunkSize ? Number(maxChunkSize) : undefined,
      overlap: overlap ? Number(overlap) : undefined,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 33. DELETE /chatbot-admin/knowledge/chunks/:docId — Delete chunk ──────────────
apiRouter.delete('/chatbot-admin/knowledge/chunks/:docId', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.canManageKnowledge) {
      return res.status(403).json({ success: false, error: 'Access denied: missing knowledge base management permission.' });
    }

    const docId = decodeURIComponent(String(req.params.docId));
    const deleted = await vectorStore.deleteDocument(docId);
    if (!deleted) return res.status(404).json({ success: false, error: `Chunk "${docId}" not found.` });

    return res.json({ success: true, message: 'Chunk deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 34. GET /chatbot-admin/system-prompt — View system prompt ────────────────────
apiRouter.get('/chatbot-admin/system-prompt', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.canManageSystemPrompt) {
      return res.status(403).json({ success: false, error: 'Access denied: missing system prompt management permission.' });
    }

    const chatbot = await ChatBot.findByPk(adminReq.chatbotAdmin.chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    return res.json({ success: true, customSystemPrompt: chatbot.custom_system_prompt });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 35. PUT /chatbot-admin/system-prompt — Update system prompt ──────────────────
apiRouter.put('/chatbot-admin/system-prompt', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.canManageSystemPrompt) {
      return res.status(403).json({ success: false, error: 'Access denied: missing system prompt management permission.' });
    }

    const { customSystemPrompt } = req.body;
    const chatbot = await ChatBot.findByPk(adminReq.chatbotAdmin.chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    await chatbot.update({ custom_system_prompt: customSystemPrompt || null });
    return res.json({ success: true, customSystemPrompt: chatbot.custom_system_prompt });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export default apiRouter;
