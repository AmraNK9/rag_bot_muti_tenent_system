import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Business, ChatBot, ChatbotAdmin } from '../../infrastructure/db/models';

declare const process: { env: { JWT_SECRET?: string } };

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRY = '24h';
const SALT_ROUNDS = 10;

export interface ChatbotAdminTokenPayload {
  adminId: number;
  chatbotId: number | null;
  name: string;
  isStandalone: boolean;
  canManageKnowledge: boolean;
  canManageSystemPrompt: boolean;
}

export class ChatbotAdminAuthService {
  /**
   * Register a standalone ChatbotAdmin along with a new Business.
   * Bot creation is deferred until they enter the app dashboard.
   */
  async registerStandalone(params: {
    name: string;
    email: string;
    password: string;
    referredByResellerId?: number | null;
  }): Promise<{ admin: ChatbotAdmin; token: string }> {
    // Check if email already taken
    const existing = await ChatbotAdmin.findOne({ where: { email: params.email } });
    if (existing) {
      throw new Error(`Email "${params.email}" is already registered.`);
    }

    const hashedPassword = await bcrypt.hash(params.password, SALT_ROUNDS);

    // 1. Create a business representing the standalone account (for credits)
    const business = await Business.create({
      name: `Standalone_${params.email}`,
      detail_info: `Standalone account for ${params.name}`,
      password: hashedPassword, // bcrypt hashed
      plan: 'free',
      active_messages_count: 100, // 100 free credits
      total_chatbots: 1,
      referred_by_reseller_id: params.referredByResellerId || null,
    });

    // 2. Create the chatbot admin pointing to NO chatbot initially (null)
    const admin = await ChatbotAdmin.create({
      chatbot_id: null,
      name: params.name,
      email: params.email,
      password: hashedPassword,
      is_standalone: true,
      can_manage_knowledge: true,
      can_manage_system_prompt: true,
    });

    const token = this.generateToken(admin);
    return { admin, token };
  }

  /**
   * Login with admin email and password.
   */
  async login(email: string, password: string): Promise<{ admin: ChatbotAdmin; token: string }> {
    const admin = await ChatbotAdmin.findOne({ where: { email } });
    if (!admin) {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const token = this.generateToken(admin);
    return { admin, token };
  }

  /**
   * Verify token and return payload.
   */
  verifyToken(token: string): ChatbotAdminTokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as ChatbotAdminTokenPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired authentication token.');
    }
  }

  private generateToken(admin: ChatbotAdmin): string {
    const payload: ChatbotAdminTokenPayload = {
      adminId: admin.id,
      chatbotId: admin.chatbot_id,
      name: admin.name,
      isStandalone: admin.is_standalone,
      canManageKnowledge: admin.can_manage_knowledge,
      canManageSystemPrompt: admin.can_manage_system_prompt,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }
}
