import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Business } from '../../infrastructure/db/models';

declare const process: { env: { JWT_SECRET?: string } };

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRY = '24h';
const SALT_ROUNDS = 10;

export interface AuthTokenPayload {
  businessId: number;
  name: string;
}

export class AuthService {
  /**
   * Register a new business with hashed password.
   * Returns the created business and a JWT token.
   */
  async register(name: string, detailInfo: string, password: string): Promise<{ business: Business; token: string }> {
    // Check if name already taken
    const existing = await Business.findOne({ where: { name } });
    if (existing) {
      throw new Error(`Business name "${name}" is already registered.`);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const business = await Business.create({
      name,
      detail_info: detailInfo,
      password: hashedPassword,
      plan: 'free',
      active_messages_count: 50,
      total_chatbots: 1,
    });

    const token = this.generateToken(business);
    return { business, token };
  }

  /**
   * Login with business name and password.
   * Returns a JWT token on success.
   */
  async login(name: string, password: string): Promise<{ business: Business; token: string }> {
    const business = await Business.findOne({ where: { name } });
    if (!business) {
      throw new Error('Invalid business name or password.');
    }

    const isMatch = await bcrypt.compare(password, business.password);
    if (!isMatch) {
      throw new Error('Invalid business name or password.');
    }

    const token = this.generateToken(business);
    return { business, token };
  }

  /**
   * Verify a JWT token and return the payload.
   */
  verifyToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired authentication token.');
    }
  }

  private generateToken(business: Business): string {
    const payload: AuthTokenPayload = {
      businessId: business.id,
      name: business.name,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }
}
