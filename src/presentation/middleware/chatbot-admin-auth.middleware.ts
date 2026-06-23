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
export function chatbotAdminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
    (req as ChatbotAdminRequest).chatbotAdmin = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed.',
    });
  }
}
