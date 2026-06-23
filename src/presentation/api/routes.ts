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
import { ChatBot, Messages } from '../../infrastructure/db/models';
import { QueryTypes } from 'sequelize';
import { SequelizeService } from '../../infrastructure/db/sequelize.service';

// ─── Service Initialization ──────────────────────────────────────────────────
const authService = new AuthService();
const subscriptionService = new SubscriptionService();
const vectorStore = new PgVectorStoreService();
const embeddingService = new VoyageEmbeddingService();
const businessService = new BusinessService(vectorStore);
const knowledgeService = new KnowledgeService(embeddingService, vectorStore);
const telegramService = new TelegramService();
const chatbotWebhookService = new ChatbotWebhookService(telegramService, tunnelService);

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

export default apiRouter;
