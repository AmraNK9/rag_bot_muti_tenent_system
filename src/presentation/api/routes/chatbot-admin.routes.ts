import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { chatbotAdminAuthMiddleware, ChatbotAdminRequest } from '../../middleware/chatbot-admin-auth.middleware';
import { resellerAuthMiddleware, ResellerRequest } from '../../middleware/reseller-auth.middleware';
import { adminSecretAuth } from '../../middleware/admin-secret-auth.middleware';
import { ChatBot, Messages, ChatbotAdmin, Business, Reseller, PlanRequest, ChatbotActivity, ResellerTopUp, Plan, SystemSetting, AuditLog, P2PTopupTransaction, SystemBotConfig, SystemBotFaq, ChatSession } from '../../../infrastructure/db/models';
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

// ─── 24. POST /chatbot-admin/register — Standalone signup ────────────────────────
router.post('/chatbot-admin/register', async (req: Request, res: Response) => {
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
router.post('/chatbot-admin/login', async (req: Request, res: Response) => {
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
router.get('/chatbot-admin/profile', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
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
        default_language: chatbot.default_language,
      } : null,
      credits,
      business: business ? await (async () => {
        let plan_name = business.subscription_plan || 'Free';
        let plan_query_limit: number | null = null;
        if (business.subscription_plan) {
          const plan = await Plan.findOne({ where: { name: business.subscription_plan } });
          if (plan) { plan_name = plan.name; plan_query_limit = plan.query_limit; }
        }
        return {
          id: business.id,
          name: business.name,
          plan: business.plan,
          plan_name,
          plan_query_limit,
          subscriptionPlan: business.subscription_plan,
          subscriptionEndDate: business.subscription_end_date,
          topupId: business.topup_id,
          telegram_chat_id: business.telegram_chat_id,
          telegram_username: business.telegram_username,
        };
      })() : null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 26a. PUT /chatbot-admin/profile/telegram — Update business telegram profile ───
router.put('/chatbot-admin/profile/telegram', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const admin = await ChatbotAdmin.findByPk(adminReq.chatbotAdmin.adminId);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found.' });

    let chatbot: ChatBot | null = null;
    if (admin.chatbot_id) chatbot = await ChatBot.findByPk(admin.chatbot_id);

    const business = chatbot
      ? await Business.findByPk(chatbot.business_id)
      : await Business.findOne({ where: { name: `Standalone_${admin.email}` } });

    if (!business) return res.status(404).json({ success: false, error: 'Business not found.' });

    const { telegram_chat_id, telegram_username } = req.body;
    await business.update({
      telegram_chat_id: telegram_chat_id !== undefined ? telegram_chat_id : business.telegram_chat_id,
      telegram_username: telegram_username !== undefined ? telegram_username : business.telegram_username,
    });

    return res.json({ success: true, business });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 27. PUT /chatbot-admin/chatbot — Edit chatbot metadata (standalone only) ───────
router.put('/chatbot-admin/chatbot', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    if (!adminReq.chatbotAdmin.isStandalone) {
      return res.status(403).json({ success: false, error: 'Only standalone chatbot admins can customize chatbot metadata.' });
    }

    const { name, description, bot_token, handover_timeout_mins, default_language, bot_role, type } = req.body;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    const updates: any = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (handover_timeout_mins !== undefined) updates.handover_timeout_mins = Number(handover_timeout_mins);
    if (default_language) updates.default_language = default_language;
    if (bot_role) updates.bot_role = bot_role;
    if (type) updates.type = type;

    // Handle bot token update
    if (bot_token && bot_token !== chatbot.token) {
      const existingBot = await ChatBot.findOne({ where: { token: bot_token } });
      if (existingBot && existingBot.id !== chatbot.id) {
        return res.status(400).json({ success: false, error: 'This token is already connected to another bot in the system.' });
      }
      const isTokenValid = await telegramService.validateBotToken(bot_token);
      if (!isTokenValid) {
        return res.status(400).json({ success: false, error: 'Invalid Telegram Bot Token. Please check your token and try again.' });
      }

      // Try to delete old webhook if it exists
      try {
        if (chatbot.token && chatbot.token !== 'mock-token' && chatbot.token !== 'mock-telegram-token') {
          await telegramService.deleteWebhook(chatbot.token);
        }
      } catch (err) {
        console.error('[Webhook] Failed to delete old webhook:', err);
      }

      updates.token = bot_token;
    }

    await chatbot.update(updates);

    // If token was updated, try to set the new webhook automatically
    if (updates.token) {
      try {
        await chatbotWebhookService.registerWebhook(chatbot.business_id, chatbot.id);
      } catch (err) {
        console.error('[Webhook] Failed to register new webhook during update:', err);
      }
    }

    // Invalidate Redis cache for this chatbot so the new language/settings take effect immediately
    try {
      const { redisService } = await import('../../../infrastructure/redis/redis.service');
      await redisService.del(`chatbot_config_v2:${chatbot.id}`);
    } catch (err) {
      console.error('[Redis] Failed to invalidate chatbot config cache:', err);
    }

    return res.json({ success: true, chatbot });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 28. GET /chatbot-admin/conversations — Chat list ───────────────────────────
router.get('/chatbot-admin/conversations', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.json({ success: true, conversations: [] });

    const sequelize = SequelizeService.getClient();
    const conversations = await sequelize.query(
      `SELECT m.sender_id, count_tbl.message_count, count_tbl.unread_count, m.sent_date AS last_message_at, m.message AS last_message, m.sender_type AS last_sender_type, m.reply_source AS last_reply_source
       FROM messages m
       INNER JOIN (
         SELECT sender_id,
                MAX(id) AS max_id,
                COUNT(*) AS message_count,
                SUM(CASE WHEN sender_type = 'user' AND is_read = false THEN 1 ELSE 0 END) AS unread_count
         FROM messages
         WHERE chatbot_id = :chatbotId
         GROUP BY sender_id
       ) count_tbl ON m.id = count_tbl.max_id
       ORDER BY m.id DESC`,
      {
        replacements: { chatbotId },
        type: QueryTypes.SELECT,
      }
    ) as Array<{ sender_id: string; message_count: string; unread_count: number; last_message_at: Date; last_message: string; last_sender_type: string }>;

    return res.json({ success: true, conversations });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 29. GET /chatbot-admin/conversations/:senderId — Chat history ────────────────
router.get('/chatbot-admin/conversations/:senderId', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
    const senderId = req.params.senderId;

    // Mark user messages as read automatically when history is requested
    await Messages.update(
      { is_read: true },
      { where: { chatbot_id: chatbotId, sender_id: senderId, sender_type: 'user', is_read: false } }
    );

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const since = Number(req.query.since) || 0;

    // Delta sync mode: when `since` is provided, return only messages newer than that ID
    // This is used by the frontend cache to avoid re-fetching all messages
    const whereClause: any = { chatbot_id: chatbotId, sender_id: senderId };
    if (since > 0) {
      const { Op } = await import('sequelize');
      whereClause.id = { [Op.gt]: since };
    }

    const messages = await Messages.findAndCountAll({
      where: whereClause,
      order: [['sent_date', 'DESC']],
      limit,
      offset,
    });

    return res.json({ success: true, messages: messages.rows, total: messages.count, limit, offset });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 30. POST /chatbot-admin/conversations/:senderId/reply — Send reply ───────────
router.post('/chatbot-admin/conversations/:senderId/reply', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
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

    // Use raw message without inline tag for seamless handover
    const telegramMessage = message;

    // Send via Telegram
    const msgId = await telegramService.sendMessage(chatbot.token, senderId, telegramMessage, undefined, 'HTML');

    // Update ChatSession to refresh the timeout
    const [session] = await ChatSession.findOrCreate({
      where: { chatbot_id: chatbotId, sender_id: senderId },
      defaults: { chatbot_id: chatbotId, sender_id: senderId, is_human_takeover: true }
    });
    // Ensure it's active and bump updated_at
    session.is_human_takeover = true;
    session.updated_at = new Date();
    await session.save();

    // Save message to DB
    const savedMsg = await Messages.create({
      chatbot_id: chatbotId,
      sender_id: senderId,
      message: message,
      sender_type: 'bot',
      reply_source: 'admin',
    });

    // Broadcast new message via Socket.io
    try {
      SocketService.io.to(chatbotId.toString()).emit('new_message', savedMsg.toJSON());
    } catch (err) {
      console.error('Socket emit error (admin reply):', err);
    }

    return res.json({ success: true, message: savedMsg });
  } catch (error) {
    console.error('[Error in chatbot-admin reply API]:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 30a. GET /chatbot-admin/conversations/:senderId/session — Chat Takeover Status ───
router.get('/chatbot-admin/conversations/:senderId/session', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
    const senderId = String(req.params.senderId);

    const session = await ChatSession.findOne({
      where: { chatbot_id: chatbotId, sender_id: senderId }
    });

    let isActiveTakeover = false;
    if (session && session.is_human_takeover) {
      const chatbot = await ChatBot.findByPk(chatbotId);
      const timeoutMins = chatbot?.handover_timeout_mins || 30;
      const now = new Date();
      const diffMins = (now.getTime() - session.updated_at.getTime()) / 60000;
      isActiveTakeover = diffMins < timeoutMins;
    }

    return res.json({ success: true, is_human_takeover: isActiveTakeover });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 30b. POST /chatbot-admin/conversations/:senderId/takeover — Toggle Takeover ───
router.post('/chatbot-admin/conversations/:senderId/takeover', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });
    const senderId = String(req.params.senderId);
    const { takeover } = req.body;

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) return res.status(404).json({ success: false, error: 'Chatbot not found.' });

    const [session] = await ChatSession.findOrCreate({
      where: { chatbot_id: chatbotId, sender_id: senderId },
      defaults: { chatbot_id: chatbotId, sender_id: senderId, is_human_takeover: takeover }
    });

    if (session.is_human_takeover !== takeover) {
      session.is_human_takeover = takeover;
      session.updated_at = new Date();
      await session.save();
    }

    // Send visual notification to the Telegram user
    const alertMessage = takeover 
      ? '<b>👨‍💻 Admin has joined the chat.</b>' 
      : '<b>🤖 The admin has left. I am your AI assistant again.</b>';
      
    await telegramService.sendMessage(chatbot.token, senderId, alertMessage, undefined, 'HTML');

    // Optionally broadcast via Socket to update other admins looking at the same chat
    try {
      SocketService.io.to(chatbotId.toString()).emit('takeover_changed', { senderId, isTakeoverMode: takeover });
    } catch (err) {
      console.error('Socket emit error for takeover:', err);
    }

    return res.json({ success: true, is_human_takeover: session.is_human_takeover });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 31. GET /chatbot-admin/knowledge — View knowledge chunks ────────────────────
router.get('/chatbot-admin/knowledge', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
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
router.post('/chatbot-admin/knowledge/ingest', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
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
router.delete('/chatbot-admin/knowledge/chunks/:docId', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
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
router.put('/chatbot-admin/system-prompt', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
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
router.get('/chatbot-admin/system-prompt', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
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


// ─── 36. GET /chatbot-admin/action-requests — View pending actions ───────────────
router.get('/chatbot-admin/action-requests', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });

    // Ensure we have ActionRequest imported in this file
    const { ActionRequest } = await import('../../../infrastructure/db/models');

    const actions = await ActionRequest.findAll({
      where: { chatbot_id: chatbotId, status: 'pending' },
      order: [['created_at', 'DESC']]
    });

    return res.json({ success: true, actions });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 37. POST /chatbot-admin/action-requests/:id/resolve — Resolve action ────────
router.post('/chatbot-admin/action-requests/:id/resolve', chatbotAdminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adminReq = req as ChatbotAdminRequest;
    const chatbotId = adminReq.chatbotAdmin.chatbotId;
    if (!chatbotId) return res.status(400).json({ success: false, error: 'No chatbot associated with this admin.' });

    const { ActionRequest } = await import('../../../infrastructure/db/models');
    
    const actionId = req.params.id;
    const actionReq = await ActionRequest.findOne({ where: { id: actionId, chatbot_id: chatbotId } });
    if (!actionReq) return res.status(404).json({ success: false, error: 'Action request not found.' });

    await actionReq.update({
      status: 'resolved',
      resolved_by: 'admin'
    });

    return res.json({ success: true, action: actionReq });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export { router };
