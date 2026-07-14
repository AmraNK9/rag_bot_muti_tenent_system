import { Request, Response, NextFunction } from 'express';
import { ChatbotAdminAuthService, ChatbotAdminTokenPayload } from '../../modules/auth/chatbot-admin-auth.service';

export interface ChatbotAdminRequest extends Request {
  chatbotAdmin: ChatbotAdminTokenPayload;
}

const authService = new ChatbotAdminAuthService();

/**
 * Express middleware that verifies ChatbotAdmin JWT from Authorization header.
 * On success, attaches `req.chatbotAdmin` with token payload.
 */
import { ChatbotAdmin } from '../../infrastructure/db/models';

export async function chatbotAdminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a ChatbotAdmin Bearer token in the Authorization header.',
    });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    const payload = authService.verifyToken(token);
    
    // Fetch latest admin from DB to ensure chatbotId is up-to-date even for old tokens
    const admin = await ChatbotAdmin.findByPk(payload.adminId);
    if (admin && admin.chatbot_id) {
      payload.chatbotId = admin.chatbot_id;
    }

    (req as ChatbotAdminRequest).chatbotAdmin = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed.',
    });
  }
}
