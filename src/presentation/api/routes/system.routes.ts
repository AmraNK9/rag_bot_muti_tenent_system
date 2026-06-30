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

// ─── 61. POST /webhook/system-bot — System Core Telegram Bot Webhook Receiver ───
router.post('/webhook/system-bot', async (req: Request, res: Response) => {
  try {
    await systemBotService.handleUpdate(req.body);
    return res.json({ success: true });
  } catch (error) {
    console.error('[System Bot Webhook Error]', error);
    return res.status(500).json({ success: false });
  }
});

// ─── 63a. GET /system-bot/info — Public endpoint to get system bot info ───────────
router.get('/system-bot/info', async (req: Request, res: Response) => {
  try {
    const config = await SystemBotConfig.findOne({ where: { is_active: true } });
    if (!config) return res.json({ success: true, username: 'mock_bot' });

    const username = await systemBotService.getBotUsername(config.bot_token);
    return res.json({ success: true, username, bot_name: config.bot_name });
  } catch (error) {
    return res.json({ success: true, username: 'mock_bot' });
  }
});


export { router };
