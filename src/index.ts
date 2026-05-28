import 'dotenv/config';
import { SequelizeService } from './infrastructure/db/sequelize.service';
import { DeepSeekService } from './infrastructure/llm/deepseek.service';
import { VoyageEmbeddingService } from './infrastructure/embeddings/voyage.service';
import { ChromaVectorStoreService } from './infrastructure/vectorstore/chroma.service';
import { ToolCallingRegistry } from './infrastructure/registry/tool-calling.registry';
import { SystemPromptFactory } from './infrastructure/prompt/prompt.factory';
import { QueryExtractionTool } from './modules/chat/query-extraction.tool';
import { BusinessService } from './modules/business/business.service';
import { KnowledgeService } from './modules/knowledge/knowledge.service';
import { ChatMemoryService } from './modules/chat/chat-memory.service';
import { Business, ChatBot } from './infrastructure/db/models';
import { chunkMyanmarText } from './modules/knowledge/myanmar-chunker';
import { startServer } from './presentation/server';
import { tunnelService } from './infrastructure/tunnel/tunnel.service';

declare const process: {
  env: {
    NODE_ENV?: string;
    DATABASE_URL?: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_BASE_URL?: string;
    VOYAGE_API_KEY?: string;
    CHROMA_URL?: string;
    PORT?: string;
    TELEGRAM_BOT_TOKEN?: string;
  };
};

async function bootstrap() {
  console.log('=== SaaS Chatbot Platform MVP Backend (Sequelize & Express Web Server) ===\n');

  // 1. Verify Myanmar Chunker
  const sampleMyanmarText = `ပထမစာပိုဒ်။ ဤသည်မှာ မြန်မာဘာသာစကားအတွက် စမ်းသပ်ထားသော စာသားဖြစ်သည်။\n\nဒုတိယစာပိုဒ်။ ဤနေရာတွင် RAG စနစ်၏ လုပ်ဆောင်ပုံကို ရှင်းပြထားပါသည်။ Vector Database တွင် သိမ်းဆည်းရန်အတွက် ဖြစ်သည်။`;
  console.log('[1] Testing Myanmar Text Chunker:');
  const chunks = chunkMyanmarText(sampleMyanmarText, 60, 10);
  chunks.forEach((chunk, i) => console.log(`  Chunk ${i + 1}: "${chunk}"`));

  // 2. Instantiate Services for Seeding check
  const embeddingService = new VoyageEmbeddingService();
  const vectorStore = new ChromaVectorStoreService();
  const businessService = new BusinessService(vectorStore);
  const knowledgeService = new KnowledgeService(embeddingService, vectorStore);
  
  // 3. Connect DB and run integration onboarding check
  console.log('\n[2] Connecting DB & Running Onboarding + Ingestion Seeding check:');
  try {
    await SequelizeService.connect();
    console.log('    Database initialized and schema synchronized.');

    // Seed default Business if none exists
    // let business = await Business.findOne({ where: { name: 'SmartGadgets' } });
    // if (!business) {
    //   business = await businessService.signupBusiness(
    //     'SmartGadgets', 
    //     'SmartGadgets sells electronic items. Specializes in smartwatches and mobile phones. Located in Yangon.',
    //     'admin123' // Default seed password
    //   );
    //   console.log(`    Seeded Business: "${business.name}" (ID: ${business.id})`);
    // } else {
    //   console.log(`    Using existing Business: "${business.name}" (ID: ${business.id})`);
    // }

    // // Seed default Chatbot if none exists
    // let chatbot = await ChatBot.findOne({ where: { name: 'SalesAgent', business_id: business.id } });
    // if (!chatbot) {
    //   chatbot = await businessService.createChatBot({
    //     businessId: business.id,
    //     name: 'SalesAgent',
    //     token: process.env.TELEGRAM_BOT_TOKEN || 'mock-telegram-token',
    //     type: 'telegram',
    //     botRole: 'sales',
    //   });
    //   console.log(`    Seeded Telegram Bot: "${chatbot.name}" (ID: ${chatbot.id})`);

    //   // Ingest default knowledge base documents
    //   const ingestion = await knowledgeService.ingestDocument({
    //     chatbotId: chatbot.id,
    //     businessId: business.id,
    //     documentText: 'Samsung s24 Ultra ဖုန်းသည် ကင်မရာကောင်းမွန်ပြီး စွမ်းဆောင်ရည်မြင့်မားသည်။ ဈေးနှုန်းမှာ ငါးသိန်းကျပ်ဖြစ်သည်။\n\nApple iPhone 15 Pro Max သည် မြန်ဆန်ပြီး ကင်မရာစနစ်အသစ် ပါဝင်သည်။ ဈေးနှုန်းမှာ ခြောက်သိန်းကျပ်ဖြစ်သည်။'
    //   });
    //   console.log(`    Knowledge base ingestion completed: Stored ${ingestion.chunkCount} chunks.`);
    // } else {
    //   console.log(`    Using existing Telegram Bot: "${chatbot.name}" (ID: ${chatbot.id})`);
    // }

  } catch (error) {
    console.error('Error during DB execution seeding check:', error);
  }

  // 4. Start ngrok tunnel to expose local server over HTTPS
  // Telegram requires HTTPS — ngrok creates a stable public HTTPS URL.
  // Requires NGROK_AUTHTOKEN in .env and VPN when connecting from Myanmar.
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  try {
    const publicUrl = await tunnelService.startTunnel(port);
    console.log(`\n[3] ngrok tunnel active:`);
    console.log(`    📡 Public URL  : ${publicUrl}`);
    console.log(`    🔗 Webhook URL : ${publicUrl}/webhook/<businessId>/<chatbotId>`);
    console.log(`    ℹ️  Call POST /api/test/chatbot/register-webhook to bind to Telegram.`);
  } catch (err) {
    console.warn(`\n[3] ⚠️  ngrok tunnel failed to start:`, err);
    console.warn(`    Server will run locally only — real Telegram webhooks will not work.`);
  }
  
  // 5. Start the Express Presentation Server
  startServer(port);
}

bootstrap().catch(console.error);

