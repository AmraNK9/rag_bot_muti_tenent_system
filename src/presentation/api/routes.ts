import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuthService } from '../../modules/auth/auth.service';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { BusinessService } from '../../modules/business/business.service';
import { KnowledgeService } from '../../modules/knowledge/knowledge.service';
import { ChatbotWebhookService } from '../../modules/chatbot/chatbot-webhook.service';
import { DeepSeekService } from '../../infrastructure/llm/deepseek.service';
import { VoyageEmbeddingService } from '../../infrastructure/embeddings/voyage.service';
import { ChromaVectorStoreService } from '../../infrastructure/vectorstore/chroma.service';
import { TelegramService } from '../../infrastructure/telegram/telegram.service';
import { tunnelService } from '../../infrastructure/tunnel/tunnel.service';
import { ChatBot } from '../../infrastructure/db/models';

// ─── Service Initialization ──────────────────────────────────────────────────
const authService = new AuthService();
const subscriptionService = new SubscriptionService();
const vectorStore = new ChromaVectorStoreService();
const embeddingService = new VoyageEmbeddingService();
const businessService = new BusinessService(vectorStore);
const knowledgeService = new KnowledgeService(embeddingService, vectorStore);
const telegramService = new TelegramService();
const chatbotWebhookService = new ChatbotWebhookService(telegramService, tunnelService);

const apiRouter = Router();

// ─── 1. POST /auth/register ─────────────────────────────────────────────────
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    console.log('Received registration request:', req.body);
    const { name, detailInfo, password } = req.body;
    if (!name || !detailInfo || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: "name", "detailInfo", and "password".',
      });
    }

    const result = await authService.register(name, detailInfo, password);

    return res.json({
      success: true,
      token: result.token,
      business: {
        id: result.business.id,
        name: result.business.name,
        plan: result.business.plan,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 2. POST /auth/login ────────────────────────────────────────────────────
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: "name" and "password".',
      });
    }

    const result = await authService.login(name, password);

    return res.json({
      success: true,
      token: result.token,
      business: {
        id: result.business.id,
        name: result.business.name,
        plan: result.business.plan,
        active_messages_count: result.business.active_messages_count,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 3. GET /profile ────────────────────────────────────────────────────────
apiRouter.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const planInfo = await subscriptionService.getBusinessPlan(authReq.business.id);
    const chatbotCount = await ChatBot.count({ where: { business_id: authReq.business.id } });

    return res.json({
      success: true,
      profile: {
        id: authReq.business.id,
        name: authReq.business.name,
        plan: planInfo.plan,
        activeMessagesCount: planInfo.activeMessagesCount,
        subscriptionPlan: planInfo.subscriptionPlan,
        subscriptionEndDate: planInfo.subscriptionEndDate,
        totalChatbots: planInfo.totalChatbots,
        currentChatbotCount: chatbotCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 4. POST /chatbots ──────────────────────────────────────────────────────
apiRouter.post('/chatbots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, token, type, botRole, customSystemPrompt, apiId, apiHash } = req.body;

    if (!name || !token || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: "name", "token", and "type".',
      });
    }
    if (type !== 'telegram' && type !== 'facebook') {
      return res.status(400).json({
        success: false,
        error: 'Type must be "telegram" or "facebook".',
      });
    }

    // Check chatbot limit against subscription plan
    const planInfo = await subscriptionService.getBusinessPlan(authReq.business.id);
    const currentCount = await ChatBot.count({ where: { business_id: authReq.business.id } });
    if (currentCount >= planInfo.totalChatbots) {
      return res.status(403).json({
        success: false,
        error: `Chatbot limit reached. Your plan allows ${planInfo.totalChatbots} chatbot(s). Upgrade your plan to add more.`,
      });
    }

    const chatbot = await businessService.createChatBot({
      businessId: authReq.business.id,
      name,
      token,
      type,
      botRole,
      customSystemPrompt,
      apiId,
      apiHash,
    });

    return res.json({ success: true, chatbot });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 5. GET /chatbots ───────────────────────────────────────────────────────
apiRouter.get('/chatbots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbots = await ChatBot.findAll({
      where: { business_id: authReq.business.id },
    });

    return res.json({ success: true, chatbots });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 6. DELETE /chatbots/:id ────────────────────────────────────────────────
apiRouter.delete('/chatbots/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);

    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) {
      return res.status(404).json({
        success: false,
        error: `ChatBot with ID ${chatbotId} not found.`,
      });
    }
    if (chatbot.business_id !== authReq.business.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this chatbot.',
      });
    }

    await chatbot.destroy();

    return res.json({ success: true, message: `ChatBot ${chatbotId} deleted successfully.` });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 7. POST /knowledge/ingest ──────────────────────────────────────────────
apiRouter.post('/knowledge/ingest', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { chatbotId, documentText, maxChunkSize, overlap } = req.body;

    if (!chatbotId || !documentText) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: "chatbotId" and "documentText".',
      });
    }

    // Verify chatbot belongs to this business
    const chatbot = await ChatBot.findOne({
      where: { id: Number(chatbotId), business_id: authReq.business.id },
    });
    if (!chatbot) {
      return res.status(403).json({
        success: false,
        error: `ChatBot ID ${chatbotId} not found or does not belong to your business.`,
      });
    }

    const result = await knowledgeService.ingestDocument({
      chatbotId: Number(chatbotId),
      businessId: authReq.business.id,
      documentText,
      maxChunkSize: maxChunkSize ? Number(maxChunkSize) : undefined,
      overlap: overlap ? Number(overlap) : undefined,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 8. POST /chatbots/:id/webhook ──────────────────────────────────────────
apiRouter.post('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);

    const result = await chatbotWebhookService.registerWebhook(authReq.business.id, chatbotId);

    return res.json({
      success: true,
      webhookUrl: result.webhookUrl,
      telegram: result.telegramResponse,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 9. GET /chatbots/:id/webhook ───────────────────────────────────────────
apiRouter.get('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);

    // Verify ownership
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) {
      return res.status(404).json({
        success: false,
        error: `ChatBot with ID ${chatbotId} not found.`,
      });
    }
    if (chatbot.business_id !== authReq.business.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this chatbot.',
      });
    }

    const info = await chatbotWebhookService.getWebhookInfo(chatbotId);

    return res.json({ success: true, webhookInfo: info });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 10. DELETE /chatbots/:id/webhook ───────────────────────────────────────
apiRouter.delete('/chatbots/:id/webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatbotId = Number(req.params.id);

    // Verify ownership
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) {
      return res.status(404).json({
        success: false,
        error: `ChatBot with ID ${chatbotId} not found.`,
      });
    }
    if (chatbot.business_id !== authReq.business.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this chatbot.',
      });
    }

    const result = await chatbotWebhookService.deleteWebhook(chatbotId);

    return res.json({ success: true, telegram: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 11. GET /credits ───────────────────────────────────────────────────────
apiRouter.get('/credits', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const planInfo = await subscriptionService.getBusinessPlan(authReq.business.id);

    return res.json({ success: true, ...planInfo });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 12. POST /topup ────────────────────────────────────────────────────────
apiRouter.post('/topup', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { transactionId, price, billingType, topupType, receiptFileUrl, messageCount } = req.body;

    if (!transactionId || price === undefined || !billingType || !topupType || messageCount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: "transactionId", "price", "billingType", "topupType", and "messageCount".',
      });
    }

    const topUp = await subscriptionService.submitTopUp({
      businessId: authReq.business.id,
      transactionId,
      price: Number(price),
      billingType,
      topupType,
      receiptFileUrl,
      messageCount: Number(messageCount),
    });

    return res.json({ success: true, topUp });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── 13. GET /topup/history ─────────────────────────────────────────────────
apiRouter.get('/topup/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const history = await subscriptionService.getTopUpHistory(authReq.business.id);

    return res.json({ success: true, history });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default apiRouter;
