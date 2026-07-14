import { ChatbotAdmin, ChatBot } from './src/infrastructure/db/models';
import { db } from './src/infrastructure/db/connection';

async function run() {
  await db.authenticate();
  const admins = await ChatbotAdmin.findAll();
  console.log('Admins:');
  admins.forEach(a => console.log(`ID: ${a.id}, Email: ${a.email}, ChatbotID: ${a.chatbot_id}`));
  
  const bots = await ChatBot.findAll();
  console.log('\nBots:');
  bots.forEach(b => console.log(`ID: ${b.id}, Name: ${b.name}, BusinessID: ${b.business_id}`));
  
  process.exit(0);
}

run();
