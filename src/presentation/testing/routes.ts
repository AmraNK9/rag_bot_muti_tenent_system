import { Router, Request, Response } from 'express';
import { DeepSeekService } from '../../infrastructure/llm/deepseek.service';
import { VoyageEmbeddingService } from '../../infrastructure/embeddings/voyage.service';
import { PgVectorStoreService } from '../../infrastructure/vectorstore/pgvector.service';
import { ToolCallingRegistry } from '../../infrastructure/registry/tool-calling.registry';
import { SystemPromptFactory } from '../../infrastructure/prompt/prompt.factory';
import { QueryExtractionTool } from '../../modules/chat/query-extraction.tool';
import { ChatMemoryService } from '../../modules/chat/chat-memory.service';
import { RetrievalGenerationService } from '../../modules/chat/retrieval-generation.service';
import { WebhookController } from '../../modules/chat/webhook.controller';
import { BusinessService } from '../../modules/business/business.service';
import { KnowledgeService } from '../../modules/knowledge/knowledge.service';
import { chunkMyanmarText } from '../../modules/knowledge/myanmar-chunker';
import { Business, ChatBot, Messages, SummerizeMessages, TopUpHistory } from '../../infrastructure/db/models';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { ChatbotWebhookService } from '../../modules/chatbot/chatbot-webhook.service';
import { TelegramService } from '../../infrastructure/telegram/telegram.service';
import { tunnelService } from '../../infrastructure/tunnel/tunnel.service';

// Initialize services
const llmService = new DeepSeekService();
const embeddingService = new VoyageEmbeddingService();
const vectorStore = new PgVectorStoreService();
const promptFactory = new SystemPromptFactory();

const toolRegistry = new ToolCallingRegistry();
toolRegistry.registerTool(new QueryExtractionTool());

const chatMemoryService = new ChatMemoryService(llmService);
const retrievalGenService = new RetrievalGenerationService(
  llmService,
  embeddingService,
  vectorStore,
  toolRegistry,
  promptFactory,
  chatMemoryService
);

const webhookController = new WebhookController(retrievalGenService, chatMemoryService);
const businessService = new BusinessService(vectorStore);
const knowledgeService = new KnowledgeService(embeddingService, vectorStore);
const subscriptionService = new SubscriptionService();
const telegramService = new TelegramService();
const chatbotWebhookService = new ChatbotWebhookService(telegramService, tunnelService);

const testRouter = Router();

// 1. Embedding Endpoint (relative to /api/test)
testRouter.post('/embedding', async (req: Request, res: Response) => {
  try {
    const { text, texts } = req.body;
    if (texts && Array.isArray(texts)) {
      const embeddings = await embeddingService.embedDocuments(texts);
      return res.json({ success: true, texts, embeddings });
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Request body must contain "text" or "texts"' });
    }
    const embedding = await embeddingService.embedQuery(text);
    return res.json({ success: true, text, embedding });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Chroma Collections
testRouter.post('/chroma/collection', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing parameter: "name"' });
    }
    await vectorStore.initializeCollection(name);
    res.json({ success: true, message: `Collection "${name}" initialized successfully.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Chroma Add Documents
testRouter.post('/chroma/add', async (req: Request, res: Response) => {
  try {
    const { collectionName, id, text, metadata, embedding } = req.body;
    if (!collectionName || !id || !text) {
      return res.status(400).json({ success: false, error: 'Missing parameters: "collectionName", "id", and "text" are required.' });
    }

    let docEmbedding = embedding;
    if (!docEmbedding) {
      docEmbedding = await embeddingService.embedQuery(text);
    }

    const vectorDoc = {
      id,
      text,
      embedding: docEmbedding,
      metadata: metadata || {}
    };

    await vectorStore.addDocuments(collectionName, [vectorDoc]);
    res.json({ success: true, message: `Document "${id}" added to collection "${collectionName}" successfully.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Chroma Search Documents
testRouter.post('/chroma/search', async (req: Request, res: Response) => {
  try {
    const { collectionName, queryText, filter, limit } = req.body;
    if (!collectionName || !queryText) {
      return res.status(400).json({ success: false, error: 'Missing parameters: "collectionName" and "queryText" are required.' });
    }

    const queryEmbedding = await embeddingService.embedQuery(queryText);
    const results = await vectorStore.search(
      collectionName,
      queryEmbedding,
      filter || {},
      limit !== undefined ? Number(limit) : 5
    );

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Business Signup
testRouter.post('/business', async (req: Request, res: Response) => {
  try {
    const { name, detailInfo, password } = req.body;
    if (!name || !detailInfo) {
      return res.status(400).json({ success: false, error: 'Missing parameters: "name" and "detailInfo" are required.' });
    }
    const business = await businessService.signupBusiness(name, detailInfo, password);
    res.json({ success: true, business });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Get Businesses
testRouter.get('/businesses', async (req: Request, res: Response) => {
  try {
    const businesses = await Business.findAll();
    res.json({ success: true, businesses });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Create Chatbot
testRouter.post('/chatbot', async (req: Request, res: Response) => {
  try {
    const { businessId, name, token, type, apiId, apiHash, botRole, customSystemPrompt } = req.body;
    if (!businessId || !name || !token || !type) {
      return res.status(400).json({ success: false, error: 'Missing parameters: "businessId", "name", "token", and "type" are required.' });
    }
    if (type !== 'telegram' && type !== 'facebook') {
      return res.status(400).json({ success: false, error: 'Type must be "telegram" or "facebook"' });
    }
    const chatbot = await businessService.createChatBot({
      businessId: Number(businessId),
      name,
      token,
      type,
      apiId,
      apiHash,
      botRole: botRole || 'sales',
      customSystemPrompt: customSystemPrompt || undefined,
    });
    res.json({ success: true, chatbot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Get Chatbots
testRouter.get('/chatbots', async (req: Request, res: Response) => {
  try {
    const chatbots = await ChatBot.findAll({
      include: [{ model: Business, as: 'business' }]
    });
    res.json({ success: true, chatbots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Ingest Knowledge
testRouter.post('/knowledge/ingest', async (req: Request, res: Response) => {
  try {
    const { chatbotId, businessId, documentText, maxChunkSize, overlap } = req.body;
    if (!chatbotId || !businessId || !documentText) {
      return res.status(400).json({ success: false, error: 'Missing parameters: "chatbotId", "businessId", and "documentText" are required.' });
    }
    const result = await knowledgeService.ingestDocument({
      chatbotId: Number(chatbotId),
      businessId: Number(businessId),
      documentText,
      maxChunkSize: maxChunkSize ? Number(maxChunkSize) : undefined,
      overlap: overlap ? Number(overlap) : undefined
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Simulate Telegram Message Webhook
testRouter.post('/simulate-message', async (req: Request, res: Response) => {
  try {
    const { chatbotId, senderId, text } = req.body;
    if (!chatbotId || !senderId || !text) {
      return res.status(400).json({ success: false, error: 'Missing parameters: "chatbotId", "senderId", and "text" are required.' });
    }

    const payload = {
      update_id: Math.floor(Math.random() * 100000) + 10000,
      message: {
        message_id: Math.floor(Math.random() * 1000) + 1,
        from: { id: String(senderId), username: 'simulated_user' },
        chat: { id: String(senderId), type: 'private' },
        text: text,
        date: Math.floor(Date.now() / 1000)
      }
    };

    const result = await webhookController.handleTelegramWebhook(Number(chatbotId), payload);
    res.json({ success: result.success, replyText: result.replyText });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. Direct DeepSeek LLM Message Completion
testRouter.post('/deepseek/direct', async (req: Request, res: Response) => {
  try {
    const { messages, systemPrompt, temperature } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid parameter: "messages" must be an array.' });
    }

    const responseText = await llmService.generateCompletion(messages, {
      systemPrompt,
      temperature: temperature !== undefined ? Number(temperature) : undefined
    });

    res.json({ success: true, response: responseText });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 12. Get Chat Messages
testRouter.get('/messages', async (req: Request, res: Response) => {
  try {
    const { chatbotId, senderId } = req.query;
    const filter: any = {};
    if (chatbotId) filter.chatbot_id = Number(chatbotId);
    if (senderId) filter.sender_id = Number(senderId);

    const messages = await Messages.findAll({
      where: filter,
      order: [['sent_date', 'ASC']]
    });
    res.json({ success: true, messages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. Get Summaries
testRouter.get('/summaries', async (req: Request, res: Response) => {
  try {
    const { chatbotId, senderId } = req.query;
    const filter: any = {};
    if (chatbotId) filter.chatbot_id = Number(chatbotId);
    if (senderId) filter.sender_id = Number(senderId);

    const summaries = await SummerizeMessages.findAll({
      where: filter,
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, summaries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 14. Myanmar Chunker Test
testRouter.post('/myanmar-chunker', async (req: Request, res: Response) => {
  try {
    const { text, chunkSize, overlap } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid parameter: "text" is required.' });
    }

    const chunks = chunkMyanmarText(
      text,
      chunkSize !== undefined ? Number(chunkSize) : 60,
      overlap !== undefined ? Number(overlap) : 10
    );

    res.json({ success: true, chunks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Telegram Webhook Management ─────────────────────────────────────────────

// 15. Register Telegram Webhook
// Reads chatbot token from DB, gets ngrok public URL, calls Telegram setWebhook.
// Required params (body): businessId, chatbotId
testRouter.post('/chatbot/register-webhook', async (req: Request, res: Response) => {
  try {
    const { businessId, chatbotId } = req.body;
    if (!businessId || !chatbotId) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters: "businessId" and "chatbotId" are required.',
      });
    }

    const result = await chatbotWebhookService.registerWebhook(
      Number(businessId),
      Number(chatbotId)
    );

    res.json({
      success: true,
      webhookUrl: result.webhookUrl,
      telegram: result.telegramResponse,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 16. Get Telegram Webhook Info
// Returns the current webhook configuration registered with Telegram.
// Required query param: chatbotId
testRouter.get('/chatbot/webhook-info', async (req: Request, res: Response) => {
  try {
    const { chatbotId } = req.query;
    if (!chatbotId) {
      return res.status(400).json({
        success: false,
        error: 'Missing query parameter: "chatbotId".',
      });
    }

    const info = await chatbotWebhookService.getWebhookInfo(Number(chatbotId));
    res.json({ success: true, webhookInfo: info.result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 17. Delete Telegram Webhook
// Unregisters the webhook from Telegram for the given chatbot.
// Required body param: chatbotId
testRouter.delete('/chatbot/webhook', async (req: Request, res: Response) => {
  try {
    const { chatbotId } = req.body;
    if (!chatbotId) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameter: "chatbotId".',
      });
    }

    const result = await chatbotWebhookService.deleteWebhook(Number(chatbotId));
    res.json({ success: true, telegram: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 18. Get Cloudflare Tunnel Public URL (for debugging)
testRouter.get('/ngrok/url', (_req: Request, res: Response) => {
  const url = tunnelService.getPublicUrl();
  if (!url) {
    return res.status(503).json({
      success: false,
      error: 'Cloudflare tunnel is not running. Start the server with npm run dev.',
    });
  }
  res.json({ success: true, publicUrl: url });
});

// 19. Get Business Credits & Plan Info
testRouter.get('/business/:id/credits', async (req: Request, res: Response) => {
  try {
    const businessId = Number(req.params.id);
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Invalid business ID.' });
    }
    const planInfo = await subscriptionService.getBusinessPlan(businessId);
    res.json({ success: true, ...planInfo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 20. Get Top-Up History
testRouter.get('/business/:id/topup-history', async (req: Request, res: Response) => {
  try {
    const businessId = Number(req.params.id);
    const history = await subscriptionService.getTopUpHistory(businessId);
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default testRouter;

