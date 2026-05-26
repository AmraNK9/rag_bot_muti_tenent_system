import express from 'express';
import path from 'path';
import testRouter from './testing/routes';
import { WebhookController } from '../modules/chat/webhook.controller';
import { RetrievalGenerationService } from '../modules/chat/retrieval-generation.service';
import { ChatMemoryService } from '../modules/chat/chat-memory.service';
import { DeepSeekService } from '../infrastructure/llm/deepseek.service';
import { VoyageEmbeddingService } from '../infrastructure/embeddings/voyage.service';
import { ChromaVectorStoreService } from '../infrastructure/vectorstore/chroma.service';
import { ToolCallingRegistry } from '../infrastructure/registry/tool-calling.registry';
import { SystemPromptFactory } from '../infrastructure/prompt/prompt.factory';
import { QueryExtractionTool } from '../modules/chat/query-extraction.tool';
import { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Serve Static Files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// ─── Register testing routes under /api/test ─────────────────────────────────
app.use('/api/test', testRouter);

// ─── Production Telegram Webhook Endpoint ────────────────────────────────────
// Telegram will POST incoming updates to:
//   POST /webhook/:businessId/:chatbotId
// This route is registered at the top-level (not under /api/test) because
// Telegram requires a clean, public-facing URL with no shared auth token.
//
// Services are instantiated once here and reused for all incoming webhook calls.
const _llmService = new DeepSeekService();
const _embeddingService = new VoyageEmbeddingService();
const _vectorStore = new ChromaVectorStoreService();
const _promptFactory = new SystemPromptFactory();
const _toolRegistry = new ToolCallingRegistry();
_toolRegistry.registerTool(new QueryExtractionTool());
const _chatMemoryService = new ChatMemoryService(_llmService);
const _retrievalGenService = new RetrievalGenerationService(
  _llmService,
  _embeddingService,
  _vectorStore,
  _toolRegistry,
  _promptFactory,
  _chatMemoryService
);
const _webhookController = new WebhookController(_retrievalGenService, _chatMemoryService);

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
  return app.listen(port, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 Chatbot Management Prototype Server Running!`);
    console.log(`🌐 Dashboard UI:        http://localhost:${port}`);
    console.log(`⚙️  Test REST APIs:      http://localhost:${port}/api/test/*`);
    console.log(`📡 Webhook endpoint:    /webhook/:businessId/:chatbotId`);
    console.log(`============================================================\n`);
  });
}
