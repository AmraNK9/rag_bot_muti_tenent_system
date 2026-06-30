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

// ─── 41. POST /reseller/auth/register ────────────────────────────────────────────
router.post('/reseller/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, kpay_no, kpay_name } = req.body;
    if (!name || !email || !password || !kpay_no || !kpay_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const existing = await Reseller.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const reseller = await Reseller.create({
      name,
      email,
      password: hashedPassword,
      commission_percentage: 30.00, // 30% default
      balance: 5000.00, // Welcome Bonus
      can_collect_payments: false, // Prepaid default
      reliability_score: 100,
      total_collected: 0.00,
      kpay_no,
      kpay_name,
    });

    const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const token = jwt.sign({ resellerId: reseller.id, name: reseller.name, email: reseller.email }, secret, { expiresIn: '24h' });

    return res.json({
      success: true,
      token,
      reseller: { id: reseller.id, name: reseller.name, email: reseller.email, kpay_no: reseller.kpay_no },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 42. POST /reseller/auth/login ───────────────────────────────────────────────
router.post('/reseller/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Missing email or password.' });
    }

    const reseller = await Reseller.findOne({ where: { email } });
    if (!reseller) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, reseller.password);
    if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const token = jwt.sign({ resellerId: reseller.id, name: reseller.name, email: reseller.email }, secret, { expiresIn: '24h' });

    return res.json({
      success: true,
      token,
      reseller: { id: reseller.id, name: reseller.name, email: reseller.email, kpay_no: reseller.kpay_no },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 43. GET /reseller/dashboard — Reseller dashboard statistics ─────────────────
router.get('/reseller/dashboard', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const reseller = await Reseller.findByPk(resReq.reseller.resellerId);
    if (!reseller) return res.status(404).json({ success: false, error: 'Reseller not found.' });

    const referredCount = await Business.count({ where: { referred_by_reseller_id: reseller.id } });

    const settings = await SystemSetting.findOne();
    const defaultFirstRate = settings ? Number(settings.referrer_first_month_rate) : 30.00;
    const defaultRecRate = settings ? Number(settings.referrer_recurring_rate) : 10.00;
    const defaultAppRate = settings ? Number(settings.approver_fee_rate) : 10.00;

    const approverRate = reseller.custom_approver_rate !== null ? Number(reseller.custom_approver_rate) : defaultAppRate;
    const referrerFirstRate = reseller.custom_referrer_first_rate !== null ? Number(reseller.custom_referrer_first_rate) : defaultFirstRate;
    const referrerRecRate = reseller.custom_referrer_recurring_rate !== null ? Number(reseller.custom_referrer_recurring_rate) : defaultRecRate;

    return res.json({
      success: true,
      stats: {
        id: reseller.id,
        name: reseller.name,
        balance: reseller.balance,
        prepaid_balance: reseller.prepaid_balance,
        pending_debt: reseller.pending_debt,
        postpaid_limit: reseller.postpaid_limit,
        can_sell: reseller.can_sell,
        totalCollected: reseller.total_collected,
        commissionPercentage: reseller.commission_percentage,
        reliabilityScore: reseller.reliability_score,
        referredCount,
        can_collect_payments: reseller.can_collect_payments,
        approverRate,
        referrerFirstRate,
        referrerRecRate,
        trustScoreFactor: Number(reseller.trust_score_factor),
        telegram_chat_id: reseller.telegram_chat_id,
        telegram_username: reseller.telegram_username,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 44. GET /reseller/requests — Get pending referred requests ──────────────────
router.get('/reseller/requests', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const requests = await PlanRequest.findAll({
      where: { reseller_id: resReq.reseller.resellerId, status: 'pending' },
      include: [{ model: Business, as: 'business', attributes: ['name', 'detail_info'] }],
    });
    return res.json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 44.5 GET /reseller/requests/history — Get handled requests history ────────
router.get('/reseller/requests/history', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const { Op } = require('sequelize');
    const requests = await PlanRequest.findAll({
      where: { 
        reseller_id: resReq.reseller.resellerId, 
        status: { [Op.ne]: 'pending' } 
      },
      include: [{ model: Business, as: 'business', attributes: ['name', 'detail_info'] }],
      order: [['created_at', 'DESC']]
    });
    return res.json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
// ─── 45. POST /reseller/requests/:id/approve — Reseller approve payment request ───
router.post('/reseller/requests/:id/approve', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const requestId = Number(req.params.id);
    
    const { ResellerService } = await import('../../../modules/reseller/reseller.service');
    const resellerService = new ResellerService();
    await resellerService.processPlanRequestApproval(requestId, resReq.reseller.resellerId);

    return res.json({ success: true, message: `Approved plan request ${requestId}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46. POST /reseller/requests/:id/reject — Reseller reject payment request ─────
router.post('/reseller/requests/:id/reject', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const requestId = Number(req.params.id);

    const { ResellerService } = await import('../../../modules/reseller/reseller.service');
    const resellerService = new ResellerService();
    await resellerService.processPlanRequestRejection(requestId, resReq.reseller.resellerId);

    return res.json({ success: true, message: 'Request rejected.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46a. POST /reseller/topup — Reseller submit prepaid wallet top-up ────────────
router.post('/reseller/topup', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const { amount_paid, credit_amount, type, screenshotBase64 } = req.body;
    const amtPaidNum = Number(amount_paid);
    const crtAmtNum = Number(credit_amount);
    const topupType = type === 'postpaid_settlement' ? 'postpaid_settlement' : 'prepaid_topup';

    if (!screenshotBase64) return res.status(400).json({ success: false, error: 'Receipt image is required.' });
    if (isNaN(amtPaidNum) || amtPaidNum <= 0) return res.status(400).json({ success: false, error: 'Valid amount_paid is required.' });
    if (isNaN(crtAmtNum) || crtAmtNum <= 0) return res.status(400).json({ success: false, error: 'Valid credit_amount is required.' });

    // Decode and save base64 receipt to disk
    const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `receipt_topup_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    const filepath = path.join(__dirname, '../../../uploads/receipts', filename);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, buffer);
    const fileUrl = `/uploads/receipts/${filename}`;

    const topup = await ResellerTopUp.create({
      reseller_id: resReq.reseller.resellerId,
      amount_paid: amtPaidNum,
      credit_amount: crtAmtNum,
      type: topupType,
      screenshot_url: fileUrl,
      status: 'pending',
    });
    return res.json({ success: true, topup });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46b. GET /reseller/topups — Get top-up history ──────────────────────────────────
router.get('/reseller/topups', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const topups = await ResellerTopUp.findAll({
      where: { reseller_id: resReq.reseller.resellerId },
      order: [['created_at', 'DESC']],
    });
    return res.json({ success: true, topups });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
// ─── 46c. GET /reseller/p2p-verify/:topup_id — Verify business topup ID ──────────────────
router.get('/reseller/p2p-verify/:topup_id', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { topup_id } = req.params;
    const business = await Business.findOne({ where: { topup_id } });
    if (!business) return res.status(404).json({ success: false, error: 'User not found.' });
    
    // Mask name: Show first 2 chars, then ***, then last 2 chars
    const name = business.name;
    const maskedName = name.length > 4 
      ? `${name.substring(0, 2)}***${name.substring(name.length - 2)}`
      : `${name.substring(0, 1)}***`;

    return res.json({ success: true, maskedName });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46d. POST /reseller/p2p-topup — Execute P2P Direct Top-Up ───────────────────────
router.post('/reseller/p2p-topup', resellerAuthMiddleware, async (req: Request, res: Response) => {
  const sequelize = SequelizeService.getClient();
  const t = await sequelize.transaction();
  try {
    const resReq = req as ResellerRequest;
    const resellerId = resReq.reseller.resellerId;
    const { topup_id, package_price, credit_amount } = req.body;

    if (!topup_id || !package_price || !credit_amount) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    // 1. Lock Reseller
    const reseller = await Reseller.findByPk(resellerId, { transaction: t, lock: true });
    if (!reseller) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'Reseller not found.' });
    }

    if (!reseller.can_sell) {
      await t.rollback();
      return res.status(403).json({ success: false, error: 'Account suspended.' });
    }

    // 2. Lock Business
    const business = await Business.findOne({ where: { topup_id }, transaction: t, lock: true });
    if (!business) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // 3. Calculate financial details
    const commissionRate = reseller.commission_percentage || 0;
    const commissionEarned = package_price * (commissionRate / 100);
    const netDeduction = package_price - commissionEarned;

    // 4. Verify balance/limits
    const isPrepaid = !reseller.can_collect_payments;
    if (isPrepaid) {
      if (Number(reseller.prepaid_balance || 0) < package_price) {
        await t.rollback();
        return res.status(400).json({ success: false, error: `Insufficient prepaid balance. Required: ${package_price}` });
      }
      
      await reseller.update({
        prepaid_balance: Number(reseller.prepaid_balance) - package_price,
        balance: Number(reseller.balance) + commissionEarned,
        total_collected: Number(reseller.total_collected || 0) + package_price,
      }, { transaction: t });

    } else {
      // Postpaid Check (Checking Net Price)
      const netDebtIncrease = package_price - commissionEarned;
      if (Number(reseller.pending_debt || 0) + netDebtIncrease > Number(reseller.postpaid_limit || 0)) {
        await t.rollback();
        return res.status(400).json({ success: false, error: `Postpaid limit exceeded. Required Net: ${netDebtIncrease}` });
      }

      await reseller.update({
        pending_debt: Number(reseller.pending_debt) + netDebtIncrease,
        balance: Number(reseller.balance) + commissionEarned,
        total_collected: Number(reseller.total_collected || 0) + package_price,
      }, { transaction: t });
    }

    // 5. Add Credits to Business
    await business.update({
      active_messages_count: Number(business.active_messages_count || 0) + Number(credit_amount)
    }, { transaction: t });

    // 6. Log Transaction
    await P2PTopupTransaction.create({
      reseller_id: resellerId,
      business_id: business.id,
      package_price,
      credit_amount,
      commission_earned: commissionEarned,
      net_deducted: netDeduction,
    }, { transaction: t });

    await t.commit();
    return res.json({ success: true, message: 'Top-up successful.', commissionEarned });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ─── 46e. GET /reseller/p2p-history — Get P2P Direct Top-Up History ──────────────────
router.get('/reseller/p2p-history', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const resellerId = resReq.reseller.resellerId;
    const transactions = await P2PTopupTransaction.findAll({
      where: { reseller_id: resellerId },
      include: [{ model: Business, as: 'business', attributes: ['name', 'topup_id'] }],
      order: [['created_at', 'DESC']],
    });
    return res.json({ success: true, history: transactions });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TOTAL (SUPER) ADMIN APIS
// ═══════════════════════════════════════════════════════════════════════════

// Simple admin key auth helper

// ─── 68. PUT /reseller/profile/telegram — Reseller update telegram account ─────────
router.put('/reseller/profile/telegram', resellerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const resReq = req as ResellerRequest;
    const reseller = await Reseller.findByPk(resReq.reseller.resellerId);
    if (!reseller) return res.status(404).json({ success: false, error: 'Reseller not found.' });

    const { telegram_chat_id, telegram_username } = req.body;
    await reseller.update({
      telegram_chat_id: telegram_chat_id !== undefined ? telegram_chat_id : reseller.telegram_chat_id,
      telegram_username: telegram_username !== undefined ? telegram_username : reseller.telegram_username,
    });
    return res.json({ success: true, reseller });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;

export { router };
