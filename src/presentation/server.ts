import express from 'express';
import path from 'path';
import testRouter from './testing/routes';
import apiRouter from './api/routes';
import { WebhookController } from '../modules/chat/controllers/webhook.controller';
import { RetrievalGenerationService } from '../modules/chat/services/retrieval-generation.service';
import { ChatMemoryService } from '../modules/chat/services/chat-memory.service';
import { DeepSeekService } from '../infrastructure/llm/deepseek.service';
import { VoyageEmbeddingService } from '../infrastructure/embeddings/voyage.service';
import { PgVectorStoreService } from '../infrastructure/vectorstore/pgvector.service';
import { ToolCallingRegistry } from '../infrastructure/registry/tool-calling.registry';
import { SystemPromptFactory } from '../infrastructure/prompt/prompt.factory';
import { QueryExtractionTool } from '../modules/chat/tools/query-extraction.tool';
import { RequestHumanAgentTool } from '../modules/chat/tools/request-human-agent.tool';
import { UpdateUserProfileTool } from '../modules/chat/tools/update-user-profile.tool';
import { FetchProductsTool } from '../modules/chat/tools/fetch-products.tool';
import { SocketService } from '../infrastructure/socket/socket.service';
import { redisService } from '../infrastructure/redis/redis.service';
import { SubscriptionService } from '../modules/subscription/subscription.service';
import cron from 'node-cron';
import { Request, Response } from 'express';

declare const process: {
  env: {
    NODE_ENV?: string;
    CORS_ORIGIN?: string;
    USE_TOOL_CALLING_EXTRACTION?: string;
    USE_HYBRID_SEARCH?: string;
    DEBUG_MODE?: string;
  };
};


const app = express();

app.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

import fs from 'fs';
const uploadsDir = path.join(__dirname, '../../uploads/receipts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));


// ─── Environment-gated Testing UI & Routes ───────────────────────────────────
// Test routes and the testing dashboard UI are ONLY available in non-production.
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/api/test', testRouter);
  console.log('[Config] Testing UI and /api/test routes ENABLED (non-production mode)');
} else {
  console.log('[Config] Testing UI and /api/test routes DISABLED (production mode)');
}

// ─── Production API Routes ───────────────────────────────────────────────────
// Always available — JWT-protected endpoints at /api/v1/*
app.use('/api/v1', apiRouter);

// ─── Webhook Services Initialization ─────────────────────────────────────────
// Services are instantiated once here and reused for all incoming webhook calls.
const _llmService = new DeepSeekService();
const _embeddingService = new VoyageEmbeddingService();
const _vectorStore = new PgVectorStoreService();
const _promptFactory = new SystemPromptFactory();
const _toolRegistry = new ToolCallingRegistry();
_toolRegistry.registerTool(new QueryExtractionTool());
_toolRegistry.registerTool(new RequestHumanAgentTool());
_toolRegistry.registerTool(new UpdateUserProfileTool());
_toolRegistry.registerTool(new FetchProductsTool());
const _chatMemoryService = new ChatMemoryService(_llmService);

// Keyword extraction: local (default, fast) or tool-calling (LLM-based, slower but more accurate)
const _useToolCallingExtraction = process.env.USE_TOOL_CALLING_EXTRACTION === 'true';
// Search mode: pure vector (default) or hybrid (vector + keyword fusion)
const _useHybridSearch = process.env.USE_HYBRID_SEARCH === 'true';
console.log(`[Config] Keyword extraction mode: ${_useToolCallingExtraction ? 'LLM Tool Calling' : 'Local (fast)'}`);
console.log(`[Config] Search mode: ${_useHybridSearch ? 'Hybrid (vector + keyword)' : 'Vector (cosine similarity)'}`);
console.log(`[Config] Debug mode: ${process.env.DEBUG_MODE === 'true' ? 'ENABLED' : 'disabled'}`);

const _retrievalGenService = new RetrievalGenerationService(
  _llmService,
  _embeddingService,
  _vectorStore,
  _toolRegistry,
  _promptFactory,
  _chatMemoryService,
  _useToolCallingExtraction,
  _useHybridSearch
);
const _webhookController = new WebhookController(_retrievalGenService, _chatMemoryService);

// ─── Telegram Webhook Endpoint ───────────────────────────────────────────────
app.post(
  '/webhook/:businessId/:chatbotId',
  async (req: Request, res: Response) => {
    const chatbotId = Number(req.params.chatbotId);
    const businessId = Number(req.params.businessId);
    
    // Always respond 200 immediately — Telegram retries on non-2xx responses
    res.sendStatus(200);

    if (!chatbotId || !businessId) {
      console.warn('[Webhook] Invalid businessId or chatbotId in URL params.');
      return;
    }

    try {
      await _webhookController.handleTelegramWebhook(chatbotId, req.body);
    } catch (error) {
      console.error(
        `[Webhook] Unhandled error for Business ${businessId} / ChatBot ${chatbotId}:`,
        error
      );
    }
  }
);

// Start Server helper
export function startServer(port: number) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Connect to Redis asyncly, don't block server startup
  redisService.connect().catch(err => console.error('[Redis] Startup connect error', err));

  // Initialize DB Sync Cron Job (runs every 15 minutes)
  const subscriptionService = new SubscriptionService();
  cron.schedule('*/15 * * * *', () => {
    void subscriptionService.syncCreditsToDB();
  });
  console.log('[Config] Credit DB Sync Cron Job scheduled (every 15 minutes)');

  const server = app.listen(port, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 Chatbot Management Prototype Server Running!`);
    console.log(`🔧 Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    if (!isProduction) {
      console.log(`🌐 Dashboard UI:        http://localhost:${port}`);
      console.log(`⚙️  Test REST APIs:      http://localhost:${port}/api/test/*`);
    }
    console.log(`🔐 Production APIs:     http://localhost:${port}/api/v1/*`);
    console.log(`📡 Webhook endpoint:    /webhook/:businessId/:chatbotId`);
    console.log(`============================================================\n`);
  });

  SocketService.init(server);
  return server;
}
