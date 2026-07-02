import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { chatbotAdminAuthMiddleware, ChatbotAdminRequest } from '../../middleware/chatbot-admin-auth.middleware';
import { resellerAuthMiddleware, ResellerRequest } from '../../middleware/reseller-auth.middleware';
import { adminSecretAuth } from '../../middleware/admin-secret-auth.middleware';
import { ChatBot, Messages, ChatbotAdmin, Business, Reseller, PlanRequest, ChatbotActivity, ResellerTopUp, Plan, SystemSetting, AuditLog, P2PTopupTransaction, SystemBotConfig, SystemBotFaq } from '../../../infrastructure/db/models';
import { QueryTypes } from 'sequelize';
import { SequelizeService } from '../../../infrastructure/db/sequelize.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { SystemPromptFactory } from '../../../infrastructure/prompt/prompt.factory';
import { SocketService } from '../../../infrastructure/socket/socket.service';
import { calculateCommissions } from '../../../modules/subscription/commission.utils';
import { PaymentRoutingService } from '../../../modules/subscription/payment-routing.service';
import { TelegramService } from '../../../infrastructure/telegram/telegram.service';
import { authService, subscriptionService, businessService, knowledgeService, smartItemService, telegramService, chatbotWebhookService, chatbotAdminAuthService, systemBotService, vectorStore, embeddingService, tunnelService } from '../container';

const router = Router();

async function verifyChatbotOwnership(chatbotId: number, businessId: number): Promise<ChatBot | null> {
  return ChatBot.findOne({ where: { id: chatbotId, business_id: businessId } });
}

// ─── 1. POST /auth/register ─────────────────────────────────────────────────
router.post('/auth/register', async (req: Request, res: Response) => {
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
router.post('/auth/login', async (req: Request, res: Response) => {
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
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
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
router.post('/chatbots', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/chatbots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbots = await ChatBot.findAll({ where: { business_id: authReq.business.id } });
    return res.json({ success: true, chatbots });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 6. DELETE /chatbots/:id ────────────────────────────────────────────────
router.delete('/chatbots/:id', authMiddleware, async (req: Request, res: Response) => {
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
router.post('/knowledge/ingest', authMiddleware, async (req: Request, res: Response) => {
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
router.post('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await chatbotWebhookService.registerWebhook(authReq.business.id, Number(req.params.id));
    return res.json({ success: true, webhookUrl: result.webhookUrl, telegram: result.telegramResponse });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 9. GET /chatbots/:id/webhook ───────────────────────────────────────────
router.get('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
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
router.delete('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/credits', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const planInfo = await subscriptionService.getBusinessPlan(authReq.business.id);
    return res.json({ success: true, ...planInfo });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 12. POST /topup ────────────────────────────────────────────────────────
router.post('/topup', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/topup/history', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/knowledge/:chatbotId', authMiddleware, async (req: Request, res: Response) => {
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
router.delete('/knowledge/:chatbotId/chunks/:docId', authMiddleware, async (req: Request, res: Response) => {
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
router.delete('/knowledge/:chatbotId', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/chatbots/:id/conversations', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/chatbots/:id/conversations/:senderId', authMiddleware, async (req: Request, res: Response) => {
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
router.post('/chatbots/:id/conversations/:senderId/reply', authMiddleware, async (req: Request, res: Response) => {
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
    console.error('[Error in business-admin reply API]:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 20. GET /chatbots/:id/admins — Business Admin list chatbot admins ───────────
router.get('/chatbots/:id/admins', authMiddleware, async (req: Request, res: Response) => {
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
router.post('/chatbots/:id/admins', authMiddleware, async (req: Request, res: Response) => {
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
router.put('/chatbots/:id/admins/:adminId', authMiddleware, async (req: Request, res: Response) => {
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
router.delete('/chatbots/:id/admins/:adminId', authMiddleware, async (req: Request, res: Response) => {
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

// ─── 36. PUT /api/v1/knowledge/:chatbotId/chunks/:docId — Edit knowledge chunk ─────
router.put('/knowledge/:chatbotId/chunks/:docId', authMiddleware, async (req: Request, res: Response) => {
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

// ─── Smart Items (Product Management) ──────────────────────────────────────

router.get('/chatbot-admin/smart-items', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as ChatbotAdminRequest;
    if (!authReq.chatbotAdmin.chatbotId) return res.status(403).json({ success: false, error: 'No chatbot assigned' });
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search as string | undefined;
    const itemType = req.query.type as 'product' | 'info' | undefined;
    const result = await smartItemService.getSmartItems(authReq.chatbotAdmin.chatbotId, limit, offset, search, itemType);
    res.json({ success: true, items: result.items, total: result.total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/chatbot-admin/smart-items', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as ChatbotAdminRequest;
    if (!authReq.chatbotAdmin.canManageKnowledge) return res.status(403).json({ success: false, error: 'Access denied: missing knowledge base management permission.' });
    if (!authReq.chatbotAdmin.chatbotId) return res.status(403).json({ success: false, error: 'No chatbot assigned' });
    const { item_type, title, content, price, stock_count, auto_track_stock } = req.body;
    if (!item_type || !title || !content) {
      return res.status(400).json({ success: false, error: 'item_type, title, and content are required' });
    }
    const item = await smartItemService.createSmartItem(authReq.chatbotAdmin.chatbotId, {
      item_type, title, content, price, stock_count, auto_track_stock
    });
    res.json({ success: true, item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/chatbot-admin/smart-items/:id', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as ChatbotAdminRequest;
    if (!authReq.chatbotAdmin.canManageKnowledge) return res.status(403).json({ success: false, error: 'Access denied: missing knowledge base management permission.' });
    if (!authReq.chatbotAdmin.chatbotId) return res.status(403).json({ success: 403, error: 'No chatbot assigned' });
    const itemId = Number(req.params.id);
    const item = await smartItemService.updateSmartItem(authReq.chatbotAdmin.chatbotId, itemId, req.body);
    res.json({ success: true, item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/chatbot-admin/smart-items/:id', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as ChatbotAdminRequest;
    if (!authReq.chatbotAdmin.canManageKnowledge) return res.status(403).json({ success: false, error: 'Access denied: missing knowledge base management permission.' });
    if (!authReq.chatbotAdmin.chatbotId) return res.status(403).json({ success: false, error: 'No chatbot assigned' });
    const itemId = Number(req.params.id);
    await smartItemService.deleteSmartItem(authReq.chatbotAdmin.chatbotId, itemId);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 37. PUT /api/v1/chatbot-admin/knowledge/chunks/:docId — Admin edit knowledge chunk
router.put('/chatbot-admin/knowledge/chunks/:docId', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
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
router.post('/chatbot-admin/chatbot', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const { name, token, type, botRole, forceConnect } = req.body;

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

    // Validate Bot Token
    const telegramService = new TelegramService();
    const isTokenValid = await telegramService.validateBotToken(token);
    if (!isTokenValid) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_TOKEN', error: 'Invalid Telegram Bot Token. Please check your token and try again.' });
    }

    // Check for existing webhook
    if (!forceConnect && type === 'telegram') {
      const webhookInfo = await telegramService.getWebhookInfo(token);
      if (webhookInfo?.ok && webhookInfo.result?.url && webhookInfo.result.url.trim() !== '') {
        const appUrl = process.env.APP_URL || process.env.NGROK_URL || '';
        if (!appUrl || !webhookInfo.result.url.startsWith(appUrl)) {
          return res.status(409).json({ 
            success: false, 
            errorCode: 'WEBHOOK_EXISTS', 
            error: 'This bot token is already connected to another system. Please force connect to override.' 
          });
        }
      }
    }

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
router.get('/subscription/payment-methods', async (req: Request, res: Response) => {
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
router.post('/subscription/upgrade', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.isStandalone) {
      return res.status(403).json({ success: false, error: 'Only standalone admins can manage billing and subscriptions.' });
    }
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

    // Real-time broadcast to reseller and total_admin via WebSocket
    try {
      const fullRequest = await PlanRequest.findByPk(request.id, {
        include: [{ model: Business, as: 'business', attributes: ['name'] }]
      });
      if (fullRequest) {
        const payload = fullRequest.toJSON();
        if (request.reseller_id) {
          SocketService.io.to(`reseller_${request.reseller_id}`).emit('new_upgrade_request', payload);
        }
        SocketService.io.to('total_admin').emit('new_upgrade_request', payload);
      }
    } catch (err) {
      console.error('[Socket Broadcast Error] Failed to emit new_upgrade_request:', err);
    }

    // Trigger Telegram notification to assigned reseller if linked
    if (request.reseller_id) {
      try {
        const reseller = await Reseller.findByPk(request.reseller_id);
        if (reseller && reseller.telegram_chat_id) {
          const business = await Business.findByPk(businessId);
          await systemBotService.notifyResellerUpgradeRequest(reseller.telegram_chat_id, {
            requestId: request.id,
            businessName: business ? business.name : `Business #${businessId}`,
            planName: planName,
            price: price,
            screenshotUrl: request.screenshot_url,
          });
        }
      } catch (tErr) {
        console.error('[System Bot Notification Error]', tErr);
      }
    }

    return res.json({ success: true, request });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 40.5 GET /subscription/history ──────────────────────────────────────────
router.get('/subscription/history', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const admin = await ChatbotAdmin.findByPk(adminReq.chatbotAdmin.adminId);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found.' });

    let businessId: number | null = null;
    if (admin.chatbot_id) {
      const chatbot = await ChatBot.findByPk(admin.chatbot_id);
      if (chatbot) businessId = chatbot.business_id;
    }
    if (!businessId) {
      const business = await Business.findOne({ where: { name: `Standalone_${admin.email}` } });
      if (business) businessId = business.id;
    }

    if (!businessId) {
      return res.json({ success: true, history: [] });
    }

    const requests = await PlanRequest.findAll({
      where: { business_id: businessId },
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

// ─── 47. GET /total-admin/resellers — List all resellers ─────────────────────────
router.get('/total-admin/resellers', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const resellers = await Reseller.findAll({ order: [['created_at', 'DESC']] });
    return res.json({ success: true, resellers });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 48. PUT /total-admin/resellers/:id — Edit reseller properties ──────────────
router.put('/total-admin/resellers/:id', adminSecretAuth, async (req: Request, res: Response) => {
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
    if (commission_percentage !== undefined) {
      updates.commission_percentage = commission_percentage === null ? null : Number(commission_percentage);
    }
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
router.get('/total-admin/analytics', adminSecretAuth, async (req: Request, res: Response) => {
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
router.get('/total-admin/audit-logs', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.findAll({ order: [['created_at', 'DESC']], limit: 100 });
    return res.json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 50. GET /total-admin/requests — Get all subscription requests ─────────────
router.get('/total-admin/requests', adminSecretAuth, async (req: Request, res: Response) => {
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
router.post('/total-admin/requests/:id/approve', adminSecretAuth, async (req: Request, res: Response) => {
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

    // 4.5. Create system chat notification & broadcast
    try {
      SocketService.io.to(`business_${business.id}`).emit('plan_upgraded', {
        plan_name: planRequest.plan_name,
        credits_added: newCredits,
        status: 'approved',
        message: `Plan upgraded to ${planRequest.plan_name.toUpperCase()} by Admin`,
      });

      const chatbot = await ChatBot.findOne({ where: { business_id: business.id } });
      if (chatbot) {
        const savedMsg = await Messages.create({
          chatbot_id: chatbot.id,
          sender_id: 'system',
          message: `Your Plan Upgrade Request for "${planRequest.plan_name.toUpperCase()}" has been Approved! Your bot credit limit has been increased by ${newCredits} messages.`,
          sender_type: 'user',
        });
        SocketService.io.to(chatbot.id.toString()).emit('new_message', savedMsg.toJSON());
      }
    } catch (err) {
      console.error('[System Notification Error] Failed to create or emit system message:', err);
    }

    return res.json({ success: true, message: 'Request approved via admin override.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 51a. POST /total-admin/requests/:id/reject — Override reject ─────────────
router.post('/total-admin/requests/:id/reject', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const requestId = Number(req.params.id);
    const planRequest = await PlanRequest.findOne({ where: { id: requestId, status: 'pending' } });
    if (!planRequest) return res.status(404).json({ success: false, error: 'Pending request not found.' });

    await planRequest.update({ status: 'rejected' });

    // Create system chat notification & broadcast
    try {
      SocketService.io.to(`business_${planRequest.business_id}`).emit('plan_rejected', {
        plan_name: planRequest.plan_name,
        status: 'rejected',
        message: `Plan upgrade request for ${planRequest.plan_name.toUpperCase()} was rejected by Admin.`,
      });

      const chatbot = await ChatBot.findOne({ where: { business_id: planRequest.business_id } });
      if (chatbot) {
        const savedMsg = await Messages.create({
          chatbot_id: chatbot.id,
          sender_id: 'system',
          message: `Your Plan Upgrade Request for "${planRequest.plan_name.toUpperCase()}" has been Rejected by the Admin. Please verify your payment details and submit again.`,
          sender_type: 'user',
        });
        SocketService.io.to(chatbot.id.toString()).emit('new_message', savedMsg.toJSON());
      }
    } catch (err) {
      console.error('[System Notification Error] Failed to create or emit system message:', err);
    }

    return res.json({ success: true, message: 'Request rejected via admin override.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 52. GET /total-admin/topups — Get all reseller top-ups ──────────────────────
router.get('/total-admin/topups', adminSecretAuth, async (req: Request, res: Response) => {
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
router.post('/total-admin/topups/:id/approve', adminSecretAuth, async (req: Request, res: Response) => {
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

      const updateData: any = { pending_debt: newDebt };
      
      // Auto-reactivate reseller if debt is fully cleared
      if (newDebt === 0) {
        updateData.can_sell = true;
        updateData.can_collect_payments = true;
      }

      await reseller.update(updateData);
    }

    return res.json({ success: true, message: `Approved reseller top-up. Credited ${topup.credit_amount} MMK.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 54. POST /total-admin/topups/:id/reject — Reject reseller top-up ────────────
router.post('/total-admin/topups/:id/reject', adminSecretAuth, async (req: Request, res: Response) => {
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
router.get('/total-admin/settings', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({
        referrer_first_month_rate: 30.00,
        referrer_recurring_rate: 10.00,
        approver_fee_rate: 10.00,
        topup_commission_rate: 30.00,
      } as any);
    }
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 56. PUT /total-admin/settings — Update global settings ───────────────────────
router.put('/total-admin/settings', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const { referrer_first_month_rate, referrer_recurring_rate, approver_fee_rate, topup_commission_rate } = req.body;
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({
        referrer_first_month_rate: 30.00,
        referrer_recurring_rate: 10.00,
        approver_fee_rate: 10.00,
        topup_commission_rate: 30.00,
      } as any);
    }
    await settings.update({
      referrer_first_month_rate: Number(referrer_first_month_rate),
      referrer_recurring_rate: Number(referrer_recurring_rate),
      approver_fee_rate: Number(approver_fee_rate),
      topup_commission_rate: topup_commission_rate !== undefined ? Number(topup_commission_rate) : settings.topup_commission_rate,
    });
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 57. GET /total-admin/plans — Get all pricing plans ───────────────────────────
router.get('/total-admin/plans', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const plans = await Plan.findAll({ order: [['id', 'ASC']] });
    return res.json({ success: true, plans });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 58. PUT /total-admin/plans/:id — Update a plan configuration ─────────────────
router.put('/total-admin/plans/:id', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);
    const { name, price, query_limit, duration_days, is_active, max_chat_history, services, is_only_p2p } = req.body;
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
    if (is_only_p2p !== undefined) updates.is_only_p2p = !!is_only_p2p;

    await plan.update(updates);
    return res.json({ success: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
// ─── 59. POST /total-admin/plans — Create a new plan configuration ────────────────
router.post('/total-admin/plans', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const { name, price, query_limit, duration_days, is_active, max_chat_history, services, is_only_p2p } = req.body;
    const plan = await Plan.create({
      name,
      price: Number(price),
      query_limit: Number(query_limit),
      duration_days: duration_days !== undefined ? Number(duration_days) : 30,
      is_active: is_active !== undefined ? !!is_active : true,
      max_chat_history: max_chat_history !== undefined ? Number(max_chat_history) : 10,
      services: services !== undefined ? (Array.isArray(services) ? services : JSON.parse(services)) : [],
      is_only_p2p: is_only_p2p !== undefined ? !!is_only_p2p : false,
    });
    return res.json({ success: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 62. GET /total-admin/system-bot/config — Get core bot configuration ─────────
router.get('/total-admin/system-bot/config', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    let config = await SystemBotConfig.findOne();
    if (!config) {
      config = await SystemBotConfig.create({
        bot_token: process.env.SYSTEM_BOT_TOKEN || 'mock-system-bot-token',
        bot_name: 'SaaS Platform Assistant',
        system_prompt: 'You are the official AI Sales and Support Assistant for our SaaS Chatbot Management Platform.',
        is_active: true,
      });
    }
    return res.json({ success: true, config });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 63. PUT /total-admin/system-bot/config — Update core bot configuration ──────
router.put('/total-admin/system-bot/config', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const { bot_token, bot_name, system_prompt, is_active } = req.body;
    let config = await SystemBotConfig.findOne();
    if (!config) {
      config = await SystemBotConfig.create({
        bot_token: bot_token || 'mock-system-bot-token',
        bot_name: bot_name || 'SaaS Platform Assistant',
        system_prompt: system_prompt || '',
        is_active: is_active !== undefined ? !!is_active : true,
      });
    } else {
      await config.update({
        bot_token: bot_token !== undefined ? bot_token : config.bot_token,
        bot_name: bot_name !== undefined ? bot_name : config.bot_name,
        system_prompt: system_prompt !== undefined ? system_prompt : config.system_prompt,
        is_active: is_active !== undefined ? !!is_active : config.is_active,
      });
    }

    // Auto-register webhook if tunnel active and valid bot_token
    try {
      const publicUrl = tunnelService.getPublicUrl();
      if (publicUrl && config.bot_token && config.bot_token !== 'mock-system-bot-token') {
        await systemBotService.registerWebhook(config.bot_token, publicUrl);
      }
    } catch (whErr) {
      console.error('[System Bot Webhook Auto-Register Error]', whErr);
    }

    return res.json({ success: true, config });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 64. GET /total-admin/system-bot/faqs — Get all FAQs ──────────────────────────
router.get('/total-admin/system-bot/faqs', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const faqs = await SystemBotFaq.findAll({ order: [['id', 'ASC']] });
    return res.json({ success: true, faqs });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 65. POST /total-admin/system-bot/faqs — Create FAQ ───────────────────────────
router.post('/total-admin/system-bot/faqs', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const { question, answer, category, is_active } = req.body;
    const faq = await SystemBotFaq.create({
      question,
      answer,
      category: category || 'general',
      is_active: is_active !== undefined ? !!is_active : true,
    });
    return res.json({ success: true, faq });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 66. PUT /total-admin/system-bot/faqs/:id — Update FAQ ────────────────────────
router.put('/total-admin/system-bot/faqs/:id', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const faqId = Number(req.params.id);
    const faq = await SystemBotFaq.findByPk(faqId);
    if (!faq) return res.status(404).json({ success: false, error: 'FAQ not found.' });

    const { question, answer, category, is_active } = req.body;
    await faq.update({
      question: question !== undefined ? question : faq.question,
      answer: answer !== undefined ? answer : faq.answer,
      category: category !== undefined ? category : faq.category,
      is_active: is_active !== undefined ? !!is_active : faq.is_active,
    });
    return res.json({ success: true, faq });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 67. DELETE /total-admin/system-bot/faqs/:id — Delete FAQ ─────────────────────
router.delete('/total-admin/system-bot/faqs/:id', adminSecretAuth, async (req: Request, res: Response) => {
  try {
    const faqId = Number(req.params.id);
    const faq = await SystemBotFaq.findByPk(faqId);
    if (!faq) return res.status(404).json({ success: false, error: 'FAQ not found.' });

    await faq.destroy();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});


export { router };
