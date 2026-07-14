const fs = require('fs');

const routesContent = fs.readFileSync('./src/presentation/api/routes.ts', 'utf-8');

// Split the content by the comment block that looks like: // ─── 1. POST /auth/register ─────
// We use a positive lookahead so that the comment block is kept with the chunk that follows it.
const blocks = routesContent.split(/(?=\/\/\s+───\s+\d+[a-z]?\.\s+[A-Z]+\s+\/.*)/g);

console.log("Found blocks:", blocks.length);

const header = blocks[0]; // Imports, service init, etc.
const routes = blocks.slice(1);

const totalAdminRoutes = [];
const chatbotAdminRoutes = [];
const resellerRoutes = [];
const subscriptionRoutes = [];
const systemRoutes = [];

routes.forEach(route => {
  const match = route.match(/\/\/\s+───\s+\d+[a-z]?\.\s+[A-Z]+\s+(\/.*?)\s+(?:—|──|-)/);
  if (!match) {
    console.log("Could not parse path for:", route.substring(0, 50));
    // Let's just try to fallback matching apiRouter.method('/path')
    const fallbackMatch = route.match(/apiRouter\.[a-z]+\(['"](\/.*?)['"]/);
    if (fallbackMatch) {
      const path = fallbackMatch[1];
      if (path.startsWith('/chatbot-admin')) chatbotAdminRoutes.push(route);
      else if (path.startsWith('/reseller')) resellerRoutes.push(route);
      else if (path.startsWith('/subscription') || path.startsWith('/plans')) subscriptionRoutes.push(route);
      else if (path.startsWith('/system-bot') || path.startsWith('/webhook') || path.includes('/telegram-webhook')) systemRoutes.push(route);
      else totalAdminRoutes.push(route);
    }
    return;
  }
  const path = match[1];

  if (path.startsWith('/chatbot-admin')) {
    chatbotAdminRoutes.push(route);
  } else if (path.startsWith('/reseller')) {
    resellerRoutes.push(route);
  } else if (path.startsWith('/subscription') || path.startsWith('/plans')) {
    subscriptionRoutes.push(route);
  } else if (path.startsWith('/system-bot') || path.startsWith('/webhook') || path.includes('/telegram-webhook')) {
    systemRoutes.push(route);
  } else {
    // All other things like /auth, /profile, /chatbots, /knowledge, /credits, /topup, /total-admin
    totalAdminRoutes.push(route);
  }
});

console.log(`Total Admin: ${totalAdminRoutes.length}`);
console.log(`Chatbot Admin: ${chatbotAdminRoutes.length}`);
console.log(`Reseller: ${resellerRoutes.length}`);
console.log(`Subscription: ${subscriptionRoutes.length}`);
console.log(`System: ${systemRoutes.length}`);

function generateFileContent(routesArray) {
  let content = `import { Router, Request, Response } from 'express';\n`;
  content += `import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware';\n`;
  content += `import { chatbotAdminAuthMiddleware, ChatbotAdminRequest } from '../../middleware/chatbot-admin-auth.middleware';\n`;
  content += `import { resellerAuthMiddleware, ResellerRequest } from '../../middleware/reseller-auth.middleware';\n`;
  content += `import { adminSecretAuth } from '../../middleware/admin-secret-auth.middleware';\n`;
  content += `import { ChatBot, Messages, ChatbotAdmin, Business, Reseller, PlanRequest, ChatbotActivity, ResellerTopUp, Plan, SystemSetting, AuditLog, P2PTopupTransaction, SystemBotConfig, SystemBotFaq } from '../../../infrastructure/db/models';\n`;
  content += `import { QueryTypes } from 'sequelize';\n`;
  content += `import { SequelizeService } from '../../../infrastructure/db/sequelize.service';\n`;
  content += `import bcrypt from 'bcryptjs';\n`;
  content += `import jwt from 'jsonwebtoken';\n`;
  content += `import fs from 'fs';\n`;
  content += `import path from 'path';\n`;
  content += `import { SystemPromptFactory } from '../../../infrastructure/prompt/prompt.factory';\n`;
  content += `import { SocketService } from '../../../infrastructure/socket/socket.service';\n`;
  content += `import { calculateCommissions } from '../../../modules/subscription/commission.utils';\n`;
  content += `import { PaymentRoutingService } from '../../../modules/subscription/payment-routing.service';\n`;
  content += `import { TelegramService } from '../../../infrastructure/telegram/telegram.service';\n`;
  content += `import { authService, subscriptionService, businessService, knowledgeService, smartItemService, telegramService, chatbotWebhookService, chatbotAdminAuthService, systemBotService, vectorStore, embeddingService, tunnelService } from '../container';\n\n`;
  content += `const router = Router();\n\n`;

  // Include verifyChatbotOwnership if it's used
  content += `async function verifyChatbotOwnership(chatbotId: number, businessId: number): Promise<ChatBot | null> {\n`;
  content += `  return ChatBot.findOne({ where: { id: chatbotId, business_id: businessId } });\n`;
  content += `}\n\n`;

  routesArray.forEach(r => {
    // replace apiRouter with router
    let updatedRoute = r.replace(/apiRouter/g, 'router');
    // replace dynamic imports
    updatedRoute = updatedRoute.replace(/..\/..\/modules\/reseller\/reseller\.service/g, '../../../modules/reseller/reseller.service');
    // remove the inline adminSecretAuth definition if it exists
    updatedRoute = updatedRoute.replace(/const adminSecretAuth = \([\s\S]*?next\(\);\r?\n\};\r?\n?/g, '');
    content += updatedRoute;
  });

  content += `\nexport { router };\n`;
  return content;
}

if (!fs.existsSync('./src/presentation/api/routes')) {
  fs.mkdirSync('./src/presentation/api/routes');
}

fs.writeFileSync('./src/presentation/api/routes/total-admin.routes.ts', generateFileContent(totalAdminRoutes));
fs.writeFileSync('./src/presentation/api/routes/chatbot-admin.routes.ts', generateFileContent(chatbotAdminRoutes));
fs.writeFileSync('./src/presentation/api/routes/reseller.routes.ts', generateFileContent(resellerRoutes));
fs.writeFileSync('./src/presentation/api/routes/subscription.routes.ts', generateFileContent(subscriptionRoutes));
fs.writeFileSync('./src/presentation/api/routes/system.routes.ts', generateFileContent(systemRoutes));

console.log("Wrote 5 route files.");
