import 'dotenv/config';
import { SequelizeService } from './src/infrastructure/db/sequelize.service';
import { Business, ChatBot } from './src/infrastructure/db/models';
import { SmartItemService } from './src/modules/knowledge/smart-item.service';
import { VoyageEmbeddingService } from './src/infrastructure/embeddings/voyage.service';
import { PgVectorStoreService } from './src/infrastructure/vectorstore/pgvector.service';
import { RetrievalGenerationService } from './src/modules/chat/retrieval-generation.service';
import { DeepSeekService } from './src/infrastructure/llm/deepseek.service';

async function runTest() {
  await SequelizeService.connect();

  const vectorStore = new PgVectorStoreService();
  const embeddingService = new VoyageEmbeddingService();
  const smartItemService = new SmartItemService(embeddingService, vectorStore);
  
// Simple vector search test without full LLM dependencies
  
  try {
    // 1. Get or Create Dummy Business and Chatbot
    let business = await Business.findOne();
    if (!business) {
      business = await Business.create({ name: 'Test Shop', password: 'hash', plan: 'free', detail_info: 'test' });
    }
    
    let chatbot = await ChatBot.findOne({ where: { business_id: business.id } });
    if (!chatbot) {
      chatbot = await ChatBot.create({ 
        business_id: business.id, 
        name: 'Test Bot', 
        token: 'dummy', 
        type: 'telegram', 
        bot_role: 'sales' 
      });
    }

    const chatbotId = chatbot.id;
    console.log(`Using Chatbot ID: ${chatbotId}, Business ID: ${business.id}`);

    // 2. Insert Test Data
    console.log('Inserting test products...');
    
    // Clear old data for clean test
    await vectorStore.deleteCollection(`business_${business.id}`);

    await smartItemService.createSmartItem(chatbotId, {
      item_type: 'product',
      title: 'iPhone 15 Pro Max',
      content: 'Apple ရဲ့ နောက်ဆုံးပေါ် Titanium ကိုယ်ထည်နဲ့ ဖုန်း။ ကင်မရာ အရမ်းမိုက်တယ်။',
      price: 3500000,
      stock_count: 10,
      auto_track_stock: true
    });

    await smartItemService.createSmartItem(chatbotId, {
      item_type: 'product',
      title: 'Samsung Galaxy S24 Ultra',
      content: 'AI features အစုံအလင်နဲ့ Android ရဲ့ အကောင်းဆုံး ဖုန်း။ S-Pen ပါဝင်ပါတယ်။',
      price: 3200000,
      stock_count: 5,
      auto_track_stock: true
    });

    await smartItemService.createSmartItem(chatbotId, {
      item_type: 'info',
      title: 'Delivery Policy',
      content: 'ရန်ကုန်မြို့တွင်း ပို့ခ ၃၀၀၀ ကျပ်ပါ။ နယ်ဆိုရင် ကားဂိတ်ကနေ တင်ပေးပါတယ်။ ၂ ရက်အတွင်း ရောက်ပါတယ်။',
    });
    
    console.log('Inserted 3 items successfully.');
    
    // 3. Test Search 1
    const query1 = 'ဆမ်ဆောင်းဖုန်း ဈေးဘယ်လောက်လဲ?';
    console.log(`\n🔍 Searching for: "${query1}"`);
    const q1Embed = await embeddingService.embedQuery(query1);
    const results1 = await vectorStore.search(`business_${business.id}`, q1Embed, { chatbot_id: chatbotId }, 2);
    console.log(JSON.stringify(results1.map(r => ({ text: r.text.slice(0, 50), score: r.score })), null, 2));

    // 4. Test Search 2
    const query2 = 'နယ်ကို ဘယ်လိုပို့ပေးလဲ';
    console.log(`\n🔍 Searching for: "${query2}"`);
    const q2Embed = await embeddingService.embedQuery(query2);
    const results2 = await vectorStore.search(`business_${business.id}`, q2Embed, { chatbot_id: chatbotId }, 2);
    console.log(JSON.stringify(results2.map(r => ({ text: r.text.slice(0, 50), score: r.score })), null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await SequelizeService.disconnect();
    process.exit(0);
  }
}

runTest();
