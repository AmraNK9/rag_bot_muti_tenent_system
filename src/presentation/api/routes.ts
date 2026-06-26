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
import { ChatBot, Messages, ChatbotAdmin, Business, Reseller, PlanRequest, ChatbotActivity, ResellerTopUp, Plan, SystemSetting, AuditLog, P2PTopupTransaction } from '../../infrastructure/db/models';
import { QueryTypes } from 'sequelize';
import { SequelizeService } from '../../infrastructure/db/sequelize.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { chatbotAdminAuthMiddleware, ChatbotAdminRequest } from '../middleware/chatbot-admin-auth.middleware';
import { ChatbotAdminAuthService } from '../../modules/auth/chatbot-admin-auth.service';
import { PaymentRoutingService } from '../../modules/subscription/payment-routing.service';
import { resellerAuthMiddleware, ResellerRequest } from '../middleware/reseller-auth.middleware';
import { SystemPromptFactory } from '../../infrastructure/prompt/prompt.factory';
import { SocketService } from '../../infrastructure/socket/socket.service';

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

interface CommissionCalculation {
  isFirstPayment: boolean;
  price: number;
  referrerId: number | null;
  referrerRate: number;
  referrerCommission: number;
  approverId: number | null;
  approverRate: number;
  approverFee: number;
}

async function calculateCommissions(
  businessId: number,
  planPrice: number,
  approverResellerId: number | null
): Promise<CommissionCalculation> {
  // 1. Check if first payment
  const approvedRequestsCount = await PlanRequest.count({
    where: { business_id: businessId, status: 'approved' }
  });
  const isFirstPayment = approvedRequestsCount === 0;

  // 2. Fetch global system settings
  const settings = await SystemSetting.findOne();
  const defaultFirstRate = settings ? Number(settings.referrer_first_month_rate) : 30.00;
  const defaultRecRate = settings ? Number(settings.referrer_recurring_rate) : 10.00;
  const defaultAppRate = settings ? Number(settings.approver_fee_rate) : 10.00;

  // 3. Resolve referrer
  const business = await Business.findByPk(businessId);
  const referrerId = business ? business.referred_by_reseller_id : null;
  let referrerRate = isFirstPayment ? defaultFirstRate : defaultRecRate;
  let referrerCommission = 0;

  if (referrerId) {
    const referrer = await Reseller.findByPk(referrerId);
    if (referrer) {
      // Check overrides
      if (isFirstPayment && referrer.custom_referrer_first_rate !== null) {
        referrerRate = Number(referrer.custom_referrer_first_rate);
      } else if (!isFirstPayment && referrer.custom_referrer_recurring_rate !== null) {
        referrerRate = Number(referrer.custom_referrer_recurring_rate);
      }
      
      const baseCommission = (planPrice * referrerRate) / 100;
      // Adjust by reliability and trust score factor
      referrerCommission = baseCommission * (Number(referrer.reliability_score) / 100) * Number(referrer.trust_score_factor);
    }
  }

  // 4. Resolve approver
  let approverRate = defaultAppRate;
  let approverFee = 0;
  if (approverResellerId) {
    const approver = await Reseller.findByPk(approverResellerId);
    if (approver) {
      if (approver.custom_approver_rate !== null) {
        approverRate = Number(approver.custom_approver_rate);
      } else if (approver.commission_percentage !== undefined && approver.commission_percentage !== null) {
        approverRate = Number(approver.commission_percentage);
      }
      const baseFee = (planPrice * approverRate) / 100;
      // Adjust by reliability and trust score factor
      approverFee = baseFee * (Number(approver.reliability_score) / 100) * Number(approver.trust_score_factor);
    }
  }

  return {
    isFirstPayment,
    price: planPrice,
    referrerId,
    referrerRate,
    referrerCommission: Math.round(referrerCommission * 100) / 100, // round to 2 decimals
    approverId: approverResellerId,
    approverRate,
    approverFee: Math.round(approverFee * 100) / 100,
  };
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
    const { name, email, password, referralCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields: "name", "email", or "password".' });
    }

    let referredByResellerId: number | null = null;
    if (referralCode) {
      const reseller = await Reseller.findOne({ where: { id: Number(referralCode) } });
      if (reseller) {
        referredByResellerId = reseller.id;
      }
    }

    const result = await chatbotAdminAuthService.registerStandalone({
      name,
      email,
      password,
      referredByResellerId,
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

    console.log(`[LOGIN API] Attempting login for email: ${email}`);

    const result = await chatbotAdminAuthService.login(email, password);
    
    console.log(`[LOGIN API] Success for: ${email}`);
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

    let chatbot: ChatBot | null = null;
    let credits = 0;

    console.log(`[Profile API] Hit by adminId: ${admin.id}, email: ${admin.email}, chatbot_id in DB: ${admin.chatbot_id}`);

    if (admin.chatbot_id) {
      chatbot = await ChatBot.findByPk(admin.chatbot_id);
    }

    const business = chatbot
      ? await Business.findByPk(chatbot.business_id)
      : await Business.findOne({ where: { name: `Standalone_${admin.email}` } });

    // Auto-heal logic: If admin has no chatbot_id but their standalone business has a chatbot
    if (!chatbot && business) {
      const possibleBot = await ChatBot.findOne({ where: { business_id: business.id } });
      if (possibleBot) {
        chatbot = possibleBot;
        await admin.update({ chatbot_id: possibleBot.id });
      }
    }

    if (business) {
      credits = business.active_messages_count;
      console.log(`[Profile API] Business found: ${business.id}, credits: ${credits}`);
    } else {
      console.log(`[Profile API] Business NOT found for ${admin.email}`);
    }

    console.log(`[Profile API] Returning chatbot:`, chatbot ? chatbot.id : 'null', `credits:`, credits);

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
      chatbot: chatbot ? {
        id: chatbot.id,
        name: chatbot.name,
        description: chatbot.description,
        type: chatbot.type,
        bot_role: chatbot.bot_role,
        custom_system_prompt: chatbot.custom_system_prompt,
      } : null,
      credits,
      business: business ? {
        id: business.id,
        name: business.name,
        plan: business.plan,
        subscriptionPlan: business.subscription_plan,
        subscriptionEndDate: business.subscription_end_date,
        topupId: business.topup_id,
      } : null,
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
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
    const chatbot = await ChatBot.findByPk(chatbotId);
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
    if (!chatbotId) return res.json({ success: true, conversations: [] });

    const sequelize = SequelizeService.getClient();
    const conversations = await sequelize.query(
      `SELECT sender_id, COUNT(*) AS message_count, MAX(sent_date) AS last_message_at
       FROM messages
       WHERE chatbot_id = :chatbotId
       GROUP BY sender_id
       ORDER BY last_message_at DESC`,
      {
        replacements: { chatbotId },
        type: QueryTypes.SELECT,
      }
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
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
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
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
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

    // Broadcast new message via Socket.io
    try {
      SocketService.io.to(chatbotId.toString()).emit('new_message', savedMsg.toJSON());
    } catch (err) {
      console.error('Socket emit error (admin reply):', err);
    }

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
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
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
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
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

// ─── 35. PUT /chatbot-admin/system-prompt — Update system prompt ──────────────────
apiRouter.put('/chatbot-admin/system-prompt', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.canManageSystemPrompt) {
      return res.status(403).json({ success: false, error: 'Access denied: missing system prompt management permission.' });
    }

    const { customSystemPrompt } = req.body;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    await chatbot.update({ custom_system_prompt: customSystemPrompt || null });
    return res.json({ success: true, customSystemPrompt: chatbot.custom_system_prompt });
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

    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    const activeStrategy = chatbot.bot_role || 'sales';
    const factory = new SystemPromptFactory();
    const business = await Business.findByPk(chatbot.business_id);
    const context = {
      businessName: business ? business.name : 'Platform',
      businessDetailInfo: business ? business.detail_info : '',
      botName: chatbot.name,
      botType: chatbot.type
    };
    const activePrompt = factory.getPrompt(activeStrategy, context);

    return res.json({ success: true, customSystemPrompt: chatbot.custom_system_prompt, activePrompt });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 36. PUT /api/v1/knowledge/:chatbotId/chunks/:docId — Edit knowledge chunk ─────
apiRouter.put('/knowledge/:chatbotId/chunks/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.chatbotId);
    const docId = decodeURIComponent(String(req.params.docId));
    const { text } = req.body;

    if (!text) return res.status(400).json({ success: false, error: 'Missing required field: "text".' });

    const chatbot = await verifyChatbotOwnership(chatbotId, authReq.business.id);
    if (!chatbot) return res.status(403).json({ success: false, error: 'ChatBot not found or access denied.' });

    // 1. Delete old chunk from vector store
    await vectorStore.deleteDocument(docId);

    // 2. Generate embedding for new text
    const [embedding] = await embeddingService.embedDocuments([text]);

    // 3. Save new chunk
    const collectionName = `business_${authReq.business.id}`;
    await vectorStore.addDocuments(collectionName, [{
      id: docId,
      text: text,
      embedding: embedding,
      metadata: {
        chatbot_id: chatbotId,
        business_id: authReq.business.id,
      }
    }]);

    return res.json({ success: true, message: 'Chunk updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 37. PUT /api/v1/chatbot-admin/knowledge/chunks/:docId — Admin edit knowledge chunk
apiRouter.put('/chatbot-admin/knowledge/chunks/:docId', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.canManageKnowledge) {
      return res.status(403).json({ success: false, error: 'Access denied: missing knowledge base management permission.' });
    }

    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });

    const docId = decodeURIComponent(String(req.params.docId));
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'Missing required field: "text".' });

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    // 1. Delete old chunk
    await vectorStore.deleteDocument(docId);

    // 2. Generate embedding for new text
    const [embedding] = await embeddingService.embedDocuments([text]);

    // 3. Save new chunk
    const collectionName = `business_${chatbot.business_id}`;
    await vectorStore.addDocuments(collectionName, [{
      id: docId,
      text: text,
      embedding: embedding,
      metadata: {
        chatbot_id: chatbotId,
        business_id: chatbot.business_id,
      }
    }]);

    return res.json({ success: true, message: 'Chunk updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 38. POST /api/v1/chatbot-admin/chatbot — Deferred chatbot creation ─────────
apiRouter.post('/chatbot-admin/chatbot', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const { name, token, type, botRole } = req.body;

    if (!name || !token || !type) {
      return res.status(400).json({ success: false, error: 'Missing required fields: "name", "token", or "type".' });
    }

    const admin = await ChatbotAdmin.findByPk(adminReq.chatbotAdmin.adminId);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found.' });

    if (admin.chatbot_id) {
      return res.status(400).json({ success: false, error: 'Admin already has a chatbot.' });
    }

    const business = await Business.findOne({ where: { name: `Standalone_${admin.email}` } });
    if (!business) return res.status(404).json({ success: false, error: 'Standalone business account not found.' });

    // Create the chatbot
    const chatbot = await ChatBot.create({
      business_id: business.id,
      name,
      token,
      type,
      bot_role: botRole || 'sales',
    });

    // Link admin to chatbot
    await admin.update({ chatbot_id: chatbot.id });

    // Generate a new token with chatbotId updated
    const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const newToken = jwt.sign({
      adminId: admin.id,
      chatbotId: chatbot.id,
      name: admin.name,
      isStandalone: admin.is_standalone,
      canManageKnowledge: admin.can_manage_knowledge,
      canManageSystemPrompt: admin.can_manage_system_prompt,
    }, secret, { expiresIn: '24h' });

    return res.json({ success: true, chatbot, token: newToken });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 39. GET /api/v1/subscription/payment-methods — Get payment routing details ───
apiRouter.get('/subscription/payment-methods', async (req: Request, res: Response) => {
  try {
    const planName = (req.query.planName || 'lite') as 'lite' | 'basic' | 'pro';
    const clientLevel = (req.query.clientLevel || 'regular') as 'royal' | 'regular';

    const reseller = await PaymentRoutingService.selectResellerForPayment({ planName, clientLevel });

    if (reseller) {
      return res.json({
        success: true,
        resellerId: reseller.id,
        kpay_no: reseller.kpay_no,
        kpay_name: reseller.kpay_name,
        note: `Transfer to reseller agent "${reseller.name}"`,
      });
    }

    // System fallback
    return res.json({
      success: true,
      resellerId: null,
      kpay_no: process.env.SYSTEM_KPAY_NO || '09987654321',
      kpay_name: process.env.SYSTEM_KPAY_NAME || 'Platform Admin Office',
      note: 'Transfer directly to Central Platform account',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 40. POST /api/v1/subscription/upgrade — Submit upgrade receipt file ────────
apiRouter.post('/subscription/upgrade', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const { planName, screenshotBase64, resellerId } = req.body;

    if (!planName || !screenshotBase64) {
      return res.status(400).json({ success: false, error: 'Missing required fields: "planName" or "screenshotBase64".' });
    }

    const admin = await ChatbotAdmin.findByPk(adminReq.chatbotAdmin.adminId);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found.' });

    // Resolve Business
    let businessId: number | null = null;
    if (admin.chatbot_id) {
      const chatbot = await ChatBot.findByPk(admin.chatbot_id);
      if (chatbot) businessId = chatbot.business_id;
    } else {
      const business = await Business.findOne({ where: { name: `Standalone_${admin.email}` } });
      if (business) businessId = business.id;
    }

    if (!businessId) {
      return res.status(404).json({ success: false, error: 'Business account not resolved.' });
    }

    // Resolve plan price dynamically from database
    const planProfile = await Plan.findOne({ where: { name: planName, is_active: true } });
    if (!planProfile) {
      return res.status(400).json({ success: false, error: `Plan '${planName}' is invalid or currently inactive.` });
    }
    const price = Number(planProfile.price);

    // Decode and save base64 screenshot to disk (NO base64 in DB)
    const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    const filepath = path.join(__dirname, '../../../uploads/receipts', filename);

    // Save to disk
    fs.writeFileSync(filepath, buffer);
    const fileUrl = `/uploads/receipts/${filename}`;

    const request = await PlanRequest.create({
      business_id: businessId,
      reseller_id: resellerId ? Number(resellerId) : null,
      plan_name: planName,
      plan_id: planProfile.id,
      screenshot_url: fileUrl,
      status: 'pending',
      price: price,
    });

    return res.json({ success: true, request });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 40.5 GET /subscription/history ──────────────────────────────────────────
apiRouter.get('/subscription/history', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const chatbotAdminId = (req as any).adminId;
    const admin = await ChatbotAdmin.findByPk(chatbotAdminId, { include: [ChatBot] });
    if (!admin || !admin.chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    const requests = await PlanRequest.findAll({
      where: { business_id: admin.chatbot.business_id },
      order: [['created_at', 'DESC']]
    });

    return res.json({ success: true, history: requests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
// ═══════════════════════════════════════════════════════════════════════════
// RESELLER APIS
// ═══════════════════════════════════════════════════════════════════════════

// ─── 41. POST /reseller/auth/register ────────────────────────────────────────────
apiRouter.post('/reseller/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, kpay_no, kpay_name } = req.body;
    if (!name || !email || !password || !kpay_no || !kpay_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const existing = await Reseller.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const reseller = await Reseller.create({
      name,
      email,
      password: hashedPassword,
      commission_percentage: 30.00, // 30% default
      balance: 5000.00, // Welcome Bonus
      can_collect_payments: false, // Prepaid default
      reliability_score: 100,
      total_collected: 0.00,
      kpay_no,
      kpay_name,
    });

    const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const token = jwt.sign({ resellerId: reseller.id, name: reseller.name, email: reseller.email }, secret, { expiresIn: '24h' });

    return res.json({
      success: true,
      token,
      reseller: { id: reseller.id, name: reseller.name, email: reseller.email, kpay_no: reseller.kpay_no },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 42. POST /reseller/auth/login ───────────────────────────────────────────────
apiRouter.post('/reseller/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Missing email or password.' });
    }

    const reseller = await Reseller.findOne({ where: { email } });
    if (!reseller) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, reseller.password);
    if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const token = jwt.sign({ resellerId: reseller.id, name: reseller.name, email: reseller.email }, secret, { expiresIn: '24h' });

    return res.json({
      success: true,
      token,
      reseller: { id: reseller.id, name: reseller.name, email: reseller.email, kpay_no: reseller.kpay_no },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 43. GET /reseller/dashboard — Reseller dashboard statistics ─────────────────
apiRouter.get('/reseller/dashboard', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const reseller = await Reseller.findByPk(resReq.reseller.resellerId);
    if (!reseller) return res.status(404).json({ success: false, error: 'Reseller not found.' });

    const referredCount = await Business.count({ where: { referred_by_reseller_id: reseller.id } });

    const settings = await SystemSetting.findOne();
    const defaultFirstRate = settings ? Number(settings.referrer_first_month_rate) : 30.00;
    const defaultRecRate = settings ? Number(settings.referrer_recurring_rate) : 10.00;
    const defaultAppRate = settings ? Number(settings.approver_fee_rate) : 10.00;

    const approverRate = reseller.custom_approver_rate !== null ? Number(reseller.custom_approver_rate) : defaultAppRate;
    const referrerFirstRate = reseller.custom_referrer_first_rate !== null ? Number(reseller.custom_referrer_first_rate) : defaultFirstRate;
    const referrerRecRate = reseller.custom_referrer_recurring_rate !== null ? Number(reseller.custom_referrer_recurring_rate) : defaultRecRate;

    return res.json({
      success: true,
      stats: {
        name: reseller.name,
        balance: reseller.balance,
        prepaid_balance: reseller.prepaid_balance,
        pending_debt: reseller.pending_debt,
        postpaid_limit: reseller.postpaid_limit,
        can_sell: reseller.can_sell,
        totalCollected: reseller.total_collected,
        commissionPercentage: reseller.commission_percentage,
        reliabilityScore: reseller.reliability_score,
        referredCount,
        can_collect_payments: reseller.can_collect_payments,
        approverRate,
        referrerFirstRate,
        referrerRecRate,
        trustScoreFactor: Number(reseller.trust_score_factor),
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 44. GET /reseller/requests — Get pending referred requests ──────────────────
apiRouter.get('/reseller/requests', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const requests = await PlanRequest.findAll({
      where: { reseller_id: resReq.reseller.resellerId, status: 'pending' },
      include: [{ model: Business, as: 'business', attributes: ['name', 'detail_info'] }],
    });
    return res.json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 44.5 GET /reseller/requests/history — Get handled requests history ────────
apiRouter.get('/reseller/requests/history', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const { Op } = require('sequelize');
    const requests = await PlanRequest.findAll({
      where: { 
        reseller_id: resReq.reseller.resellerId, 
        status: { [Op.ne]: 'pending' } 
      },
      include: [{ model: Business, as: 'business', attributes: ['name', 'detail_info'] }],
      order: [['created_at', 'DESC']]
    });
    return res.json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
// ─── 45. POST /reseller/requests/:id/approve — Reseller approve payment request ───
apiRouter.post('/reseller/requests/:id/approve', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const requestId = Number(req.params.id);

    const planRequest = await PlanRequest.findOne({
      where: { id: requestId, reseller_id: resReq.reseller.resellerId, status: 'pending' },
    });
    if (!planRequest) return res.status(404).json({ success: false, error: 'Pending plan request not found.' });

    const business = await Business.findByPk(planRequest.business_id);
    if (!business) return res.status(404).json({ success: false, error: 'Associated Business client not found.' });

    const reseller = await Reseller.findByPk(resReq.reseller.resellerId);
    if (!reseller) return res.status(404).json({ success: false, error: 'Reseller not found.' });

    // Calculate commissions & fees
    const calc = await calculateCommissions(business.id, Number(planRequest.price), reseller.id);
    const netRequiredPrice = calc.price - calc.approverFee;

    // Check if account is suspended
    if (!reseller.can_sell) {
      return res.status(403).json({
        success: false,
        error: 'Your account is suspended for selling. Please settle your pending debts.',
      });
    }

    const usedPrepaid = !reseller.can_collect_payments;
    if (usedPrepaid) {
      // For prepaid, check if they have enough balance for the FULL price. 
      // (They will get commission back immediately, but need full balance to clear).
      if (Number(reseller.prepaid_balance) < calc.price) {
        return res.status(400).json({
          success: false,
          error: `Insufficient prepaid balance. (Prepaid: ${reseller.prepaid_balance}, Required: ${calc.price})`
        });
      }
    } else {
      // Fallback to Postpaid Limit (Checking Net Price)
      if (Number(reseller.pending_debt) + netRequiredPrice > Number(reseller.postpaid_limit)) {
        return res.status(400).json({
          success: false,
          error: `Postpaid limit exceeded. (Pending Debt: ${reseller.pending_debt}, Required Net: ${netRequiredPrice}, Limit: ${reseller.postpaid_limit})`
        });
      }
    }

    // 1. Upgrade Business Plan & credits dynamically from plans table
    const planProfile = await Plan.findOne({ where: { name: planRequest.plan_name } });
    const duration = planProfile ? planProfile.duration_days : 30;
    const newCredits = planProfile ? planProfile.query_limit : 500;
    let maxBots = 1;
    if (planRequest.plan_name === 'pro') maxBots = 3;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + duration);

    await business.update({
      plan: 'subscription',
      subscription_plan: planRequest.plan_name as any,
      subscription_end_date: expiryDate,
      active_messages_count: business.active_messages_count + newCredits,
      total_chatbots: maxBots,
    });

    // 2. Allocate Referrer Commissions
    if (calc.referrerId && calc.referrerCommission > 0) {
      const referrer = await Reseller.findByPk(calc.referrerId);
      if (referrer) {
        await referrer.update({
          balance: Number(referrer.balance) + calc.referrerCommission,
        });
      }
    }

    // 3. Allocate Approver Fee / Deduct prepaid balance
    if (usedPrepaid) {
      await reseller.update({
        prepaid_balance: Number(reseller.prepaid_balance) - calc.price,
        balance: Number(reseller.balance) + calc.approverFee,
        total_collected: Number(reseller.total_collected) + calc.price,
      });
    } else {
      // Postpaid: they collected the physical cash. They owe the Admin the net amount, keeping their commission.
      const netDebtIncrease = calc.price - calc.approverFee;
      await reseller.update({
        pending_debt: Number(reseller.pending_debt) + netDebtIncrease,
        balance: Number(reseller.balance) + calc.approverFee,
        total_collected: Number(reseller.total_collected) + calc.price,
      });
    }

    // 4. Mark Plan Request approved with snapshots
    await planRequest.update({
      status: 'approved',
      referrer_id: calc.referrerId,
      referrer_commission_rate: calc.referrerRate,
      referrer_commission_amount: calc.referrerCommission,
      approver_commission_rate: calc.approverRate,
      approver_commission_amount: calc.approverFee,
      is_first_payment: calc.isFirstPayment,
    });

    return res.json({ success: true, message: `Approved plan ${planRequest.plan_name} for Business ID ${business.id}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46. POST /reseller/requests/:id/reject — Reseller reject payment request ─────
apiRouter.post('/reseller/requests/:id/reject', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const requestId = Number(req.params.id);

    const planRequest = await PlanRequest.findOne({
      where: { id: requestId, reseller_id: resReq.reseller.resellerId, status: 'pending' },
    });
    if (!planRequest) return res.status(404).json({ success: false, error: 'Pending plan request not found.' });

    await planRequest.update({ status: 'rejected' });
    return res.json({ success: true, message: 'Request rejected.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46a. POST /reseller/topup — Reseller submit prepaid wallet top-up ────────────
apiRouter.post('/reseller/topup', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const { amount_paid, credit_amount, type, screenshotBase64 } = req.body;
    const amtPaidNum = Number(amount_paid);
    const crtAmtNum = Number(credit_amount);
    const topupType = type === 'postpaid_settlement' ? 'postpaid_settlement' : 'prepaid_topup';

    if (!screenshotBase64) return res.status(400).json({ success: false, error: 'Receipt image is required.' });
    if (isNaN(amtPaidNum) || amtPaidNum <= 0) return res.status(400).json({ success: false, error: 'Valid amount_paid is required.' });
    if (isNaN(crtAmtNum) || crtAmtNum <= 0) return res.status(400).json({ success: false, error: 'Valid credit_amount is required.' });

    // Decode and save base64 receipt to disk
    const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `receipt_topup_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    const filepath = path.join(__dirname, '../../../uploads/receipts', filename);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, buffer);
    const fileUrl = `/uploads/receipts/${filename}`;

    const topup = await ResellerTopUp.create({
      reseller_id: resReq.reseller.resellerId,
      amount_paid: amtPaidNum,
      credit_amount: crtAmtNum,
      type: topupType,
      screenshot_url: fileUrl,
      status: 'pending',
    });
    return res.json({ success: true, topup });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46b. GET /reseller/topups — Get top-up history ──────────────────────────────────
apiRouter.get('/reseller/topups', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const topups = await ResellerTopUp.findAll({
      where: { reseller_id: resReq.reseller.resellerId },
      order: [['created_at', 'DESC']],
    });
    return res.json({ success: true, topups });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
// ─── 46c. GET /reseller/p2p-verify/:topup_id — Verify business topup ID ──────────────────
apiRouter.get('/reseller/p2p-verify/:topup_id', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { topup_id } = req.params;
    const business = await Business.findOne({ where: { topup_id } });
    if (!business) return res.status(404).json({ success: false, error: 'User not found.' });
    
    // Mask name: Show first 2 chars, then ***, then last 2 chars
    const name = business.name;
    const maskedName = name.length > 4 
      ? `${name.substring(0, 2)}***${name.substring(name.length - 2)}`
      : `${name.substring(0, 1)}***`;

    return res.json({ success: true, maskedName });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46d. POST /reseller/p2p-topup — Execute P2P Direct Top-Up ───────────────────────
apiRouter.post('/reseller/p2p-topup', resellerAuthMiddleware, async (req: Request, res: Response) => {
  const sequelize = SequelizeService.getClient();
  const t = await sequelize.transaction();
  try {
    const resReq = req as ResellerRequest;
    const resellerId = resReq.reseller.resellerId;
    const { topup_id, package_price, credit_amount } = req.body;

    if (!topup_id || !package_price || !credit_amount) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    // 1. Lock Reseller
    const reseller = await Reseller.findByPk(resellerId, { transaction: t, lock: true });
    if (!reseller) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'Reseller not found.' });
    }

    if (!reseller.can_sell) {
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Account suspended.' });
    }

    // 2. Lock Business
    const business = await Business.findOne({ where: { topup_id }, transaction: t, lock: true });
    if (!business) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // 3. Calculate financial details
    const commissionRate = reseller.commission_percentage || 0;
    const commissionEarned = package_price * (commissionRate / 100);
    const netDeduction = package_price - commissionEarned;

    // 4. Verify balance/limits
    const isPrepaid = !reseller.can_collect_payments;
    if (isPrepaid) {
      if (Number(reseller.prepaid_balance || 0) < package_price) {
        await t.rollback();
        return res.status(400).json({ success: false, error: `Insufficient prepaid balance. Required: ${package_price}` });
      }
      
      await reseller.update({
        prepaid_balance: Number(reseller.prepaid_balance) - package_price,
        balance: Number(reseller.balance) + commissionEarned,
        total_collected: Number(reseller.total_collected || 0) + package_price,
      }, { transaction: t });

    } else {
      // Postpaid Check (Checking Net Price)
      const netDebtIncrease = package_price - commissionEarned;
      if (Number(reseller.pending_debt || 0) + netDebtIncrease > Number(reseller.postpaid_limit || 0)) {
        await t.rollback();
        return res.status(400).json({ success: false, error: `Postpaid limit exceeded. Required Net: ${netDebtIncrease}` });
      }

      await reseller.update({
        pending_debt: Number(reseller.pending_debt) + netDebtIncrease,
        balance: Number(reseller.balance) + commissionEarned,
        total_collected: Number(reseller.total_collected || 0) + package_price,
      }, { transaction: t });
    }

    // 5. Add Credits to Business
    await business.update({
      active_messages_count: Number(business.active_messages_count || 0) + Number(credit_amount)
    }, { transaction: t });

    // 6. Log Transaction
    await P2PTopupTransaction.create({
      reseller_id: resellerId,
      business_id: business.id,
      package_price,
      credit_amount,
      commission_earned: commissionEarned,
      net_deducted: netDeduction,
    }, { transaction: t });

    await t.commit();
    return res.json({ success: true, message: 'Top-up successful.', commissionEarned });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
// ═══════════════════════════════════════════════════════════════════════════
// TOTAL (SUPER) ADMIN APIS
// ═══════════════════════════════════════════════════════════════════════════

// Simple admin key auth helper
const adminSecretAuth = (req: Request, res: Response, next: any) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== (process.env.ADMIN_SECRET || 'dev-admin-secret')) {
    return res.status(403).json({ success: false, error: 'Forbidden: admin privilege required.' });
  }
  next();
};

// ─── 47. GET /total-admin/resellers — List all resellers ─────────────────────────
apiRouter.get('/total-admin/resellers', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const resellers = await Reseller.findAll({ order: [['created_at', 'DESC']] });
    return res.json({ success: true, resellers });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 48. PUT /total-admin/resellers/:id — Edit reseller properties ──────────────
apiRouter.put('/total-admin/resellers/:id', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const resellerId = Number(req.params.id);
    const {
      reliability_score,
      can_collect_payments,
      commission_percentage,
      custom_referrer_first_rate,
      custom_referrer_recurring_rate,
      custom_approver_rate,
      trust_score_factor,
      postpaid_limit,
      can_sell
    } = req.body;

    const reseller = await Reseller.findByPk(resellerId);
    if (!reseller) return res.status(404).json({ success: false, error: 'Reseller not found.' });

    const updates: any = {};
    if (reliability_score !== undefined) updates.reliability_score = Number(reliability_score);
    if (can_collect_payments !== undefined) updates.can_collect_payments = !!can_collect_payments;
    if (commission_percentage !== undefined) updates.commission_percentage = Number(commission_percentage);
    if (custom_referrer_first_rate !== undefined) {
      updates.custom_referrer_first_rate = custom_referrer_first_rate === null ? null : Number(custom_referrer_first_rate);
    }
    if (custom_referrer_recurring_rate !== undefined) {
      updates.custom_referrer_recurring_rate = custom_referrer_recurring_rate === null ? null : Number(custom_referrer_recurring_rate);
    }
    if (custom_approver_rate !== undefined) {
      updates.custom_approver_rate = custom_approver_rate === null ? null : Number(custom_approver_rate);
    }
    if (trust_score_factor !== undefined) updates.trust_score_factor = Number(trust_score_factor);
    if (postpaid_limit !== undefined) updates.postpaid_limit = Number(postpaid_limit);
    if (can_sell !== undefined) updates.can_sell = !!can_sell;

    await reseller.update(updates);
    return res.json({ success: true, reseller });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 49. GET /total-admin/analytics — Fetch platform usage analytics ─────────────
apiRouter.get('/total-admin/analytics', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const activeChatbots = await ChatBot.count();
    const totalBusinesses = await Business.count();
    const totalResellers = await Reseller.count();
    
    // Revenue from Plan Requests
    const approvedRequests = await PlanRequest.findAll({ where: { status: 'approved' } });
    const totalRevenue = approvedRequests.reduce((sum, req) => sum + Number(req.price || 0), 0);

    const activities = await ChatbotActivity.findAll({ order: [['activity_date', 'ASC']] });

    let totalQueries = 0;
    let totalApiCost = 0;
    activities.forEach((act) => {
      totalQueries += act.query_count;
      totalApiCost += Number(act.api_cost);
    });

    return res.json({
      success: true,
      stats: {
        activeChatbots,
        totalBusinesses,
        totalResellers,
        totalRevenue,
        totalQueries,
        totalApiCost,
        activities,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 49B. GET /total-admin/audit-logs — Fetch audit logs ─────────────
apiRouter.get('/total-admin/audit-logs', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.findAll({ order: [['created_at', 'DESC']], limit: 100 });
    return res.json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 50. GET /total-admin/requests — Get all subscription requests ─────────────
apiRouter.get('/total-admin/requests', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const requests = await PlanRequest.findAll({
      order: [['created_at', 'DESC']],
      include: [
        { model: Business, as: 'business', attributes: ['name'] },
        { model: Reseller, as: 'reseller', attributes: ['name'] },
      ]
    });
    return res.json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 51. POST /total-admin/requests/:id/approve — Override approve ──────────────
apiRouter.post('/total-admin/requests/:id/approve', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const requestId = Number(req.params.id);
    const planRequest = await PlanRequest.findOne({ where: { id: requestId, status: 'pending' } });
    if (!planRequest) return res.status(404).json({ success: false, error: 'Pending request not found.' });

    const business = await Business.findByPk(planRequest.business_id);
    if (!business) return res.status(404).json({ success: false, error: 'Business client not found.' });

    // Calculate commissions & fees
    const calc = await calculateCommissions(business.id, Number(planRequest.price), planRequest.reseller_id);

    // 1. Upgrade Business Plan & credits dynamically from plans table
    const planProfile = await Plan.findOne({ where: { name: planRequest.plan_name } });
    const duration = planProfile ? planProfile.duration_days : 30;
    const newCredits = planProfile ? planProfile.query_limit : 500;
    let maxBots = 1;
    if (planRequest.plan_name === 'pro') maxBots = 3;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + duration);

    await business.update({
      plan: 'subscription',
      subscription_plan: planRequest.plan_name,
      plan_id: planRequest.plan_id || (planProfile ? planProfile.id : null),
      subscription_end_date: expiryDate,
      active_messages_count: business.active_messages_count + newCredits,
      total_chatbots: maxBots,
    });

    // 2. Allocate Referrer Commissions
    if (calc.referrerId && calc.referrerCommission > 0) {
      const referrer = await Reseller.findByPk(calc.referrerId);
      if (referrer) {
        await referrer.update({
          balance: Number(referrer.balance) + calc.referrerCommission,
        });
      }
    }

    // 3. Allocate Approver Fee / Deduct prepaid balance
    if (planRequest.reseller_id) {
      const reseller = await Reseller.findByPk(planRequest.reseller_id);
      if (reseller) {
        if (!reseller.can_collect_payments) {
          const netRequiredPrice = calc.price - calc.approverFee;
          await reseller.update({
            prepaid_balance: Number(reseller.prepaid_balance || 0) - netRequiredPrice,
            balance: Number(reseller.balance) + calc.approverFee, // Credit their commission wallet so 'Earned' goes up
            total_collected: Number(reseller.total_collected || 0) + calc.price,
          });
        } else {
          const netDebtIncrease = calc.price - calc.approverFee;
          await reseller.update({
            balance: Number(reseller.balance) + calc.approverFee, // Credit their commission wallet
            total_collected: Number(reseller.total_collected || 0) + calc.price,
            pending_debt: Number(reseller.pending_debt || 0) + netDebtIncrease, // Add net price to their debt
          });
        }
      }
    }

    // 4. Mark request approved with snapshots
    await planRequest.update({
      status: 'approved',
      referrer_id: calc.referrerId,
      referrer_commission_rate: calc.referrerRate,
      referrer_commission_amount: calc.referrerCommission,
      approver_commission_rate: calc.approverRate,
      approver_commission_amount: calc.approverFee,
      is_first_payment: calc.isFirstPayment,
    });

    return res.json({ success: true, message: 'Request approved via admin override.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 52. GET /total-admin/topups — Get all reseller top-ups ──────────────────────
apiRouter.get('/total-admin/topups', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const topups = await ResellerTopUp.findAll({
      order: [['created_at', 'DESC']],
      include: [
        { model: Reseller, as: 'reseller', attributes: ['name', 'email', 'balance', 'can_collect_payments', 'commission_percentage'] },
      ]
    });
    return res.json({ success: true, topups });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 53. POST /total-admin/topups/:id/approve — Approve reseller top-up ──────────
apiRouter.post('/total-admin/topups/:id/approve', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const topupId = Number(req.params.id);
    const topup = await ResellerTopUp.findOne({ where: { id: topupId, status: 'pending' } });
    if (!topup) return res.status(404).json({ success: false, error: 'Pending reseller top-up request not found.' });

    const reseller = await Reseller.findByPk(topup.reseller_id);
    if (!reseller) return res.status(404).json({ success: false, error: 'Reseller not found.' });

    // Update status to approved and apply the credit appropriately
    await topup.update({ status: 'approved' });

    if (topup.type === 'prepaid_topup') {
      await reseller.update({
        prepaid_balance: Number(reseller.prepaid_balance || 0) + Number(topup.credit_amount),
      });
    } else if (topup.type === 'postpaid_settlement') {
      const currentDebt = Number(reseller.pending_debt || 0);
      const paymentAmount = Number(topup.amount_paid);
      
      let newDebt = currentDebt - paymentAmount;
      if (newDebt < 0) newDebt = 0; // Prevent negative debt

      await reseller.update({
        pending_debt: newDebt,
      });
    }

    return res.json({ success: true, message: `Approved reseller top-up. Credited ${topup.credit_amount} MMK.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 54. POST /total-admin/topups/:id/reject — Reject reseller top-up ────────────
apiRouter.post('/total-admin/topups/:id/reject', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const topupId = Number(req.params.id);
    const topup = await ResellerTopUp.findOne({ where: { id: topupId, status: 'pending' } });
    if (!topup) return res.status(404).json({ success: false, error: 'Pending reseller top-up request not found.' });

    await topup.update({ status: 'rejected' });
    return res.json({ success: true, message: 'Reseller top-up rejected.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 55. GET /total-admin/settings — Get global commission system settings ──────
apiRouter.get('/total-admin/settings', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({
        referrer_first_month_rate: 30.00,
        referrer_recurring_rate: 10.00,
        approver_fee_rate: 10.00,
      });
    }
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 56. PUT /total-admin/settings — Update global settings ───────────────────────
apiRouter.put('/total-admin/settings', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const { referrer_first_month_rate, referrer_recurring_rate, approver_fee_rate } = req.body;
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({
        referrer_first_month_rate: 30.00,
        referrer_recurring_rate: 10.00,
        approver_fee_rate: 10.00,
      });
    }
    await settings.update({
      referrer_first_month_rate: Number(referrer_first_month_rate),
      referrer_recurring_rate: Number(referrer_recurring_rate),
      approver_fee_rate: Number(approver_fee_rate),
    });
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 57. GET /total-admin/plans — Get all pricing plans ───────────────────────────
apiRouter.get('/total-admin/plans', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const plans = await Plan.findAll({ order: [['id', 'ASC']] });
    return res.json({ success: true, plans });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 58. PUT /total-admin/plans/:id — Update a plan configuration ─────────────────
apiRouter.put('/total-admin/plans/:id', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);
    const { name, price, query_limit, duration_days, is_active, max_chat_history, services } = req.body;
    const plan = await Plan.findByPk(planId);
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found.' });

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (price !== undefined) updates.price = Number(price);
    if (query_limit !== undefined) updates.query_limit = Number(query_limit);
    if (duration_days !== undefined) updates.duration_days = Number(duration_days);
    if (is_active !== undefined) updates.is_active = !!is_active;
    if (max_chat_history !== undefined) updates.max_chat_history = Number(max_chat_history);
    if (services !== undefined) updates.services = Array.isArray(services) ? services : JSON.parse(services);

    await plan.update(updates);
    return res.json({ success: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
// ─── 59. POST /total-admin/plans — Create a new plan configuration ────────────────
apiRouter.post('/total-admin/plans', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const { name, price, query_limit, duration_days, is_active, max_chat_history, services } = req.body;
    const plan = await Plan.create({
      name,
      price: Number(price),
      query_limit: Number(query_limit),
      duration_days: duration_days !== undefined ? Number(duration_days) : 30,
      is_active: is_active !== undefined ? !!is_active : true,
      max_chat_history: max_chat_history !== undefined ? Number(max_chat_history) : 10,
      services: services !== undefined ? (Array.isArray(services) ? services : JSON.parse(services)) : []
    });
    return res.json({ success: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 60. GET /plans — Get all active pricing plans (Public) ───────────────────────
apiRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await Plan.findAll({ 
      where: { is_active: true },
      order: [['price', 'ASC']] 
    });
    return res.json({ success: true, plans });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export default apiRouter;
