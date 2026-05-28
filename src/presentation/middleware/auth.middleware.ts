import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../modules/auth/auth.service';

export interface AuthenticatedRequest extends Request {
  business: {
    id: number;
    name: string;
  };
}

const authService = new AuthService();

/**
 * Express middleware that verifies JWT from Authorization header.
 * On success, attaches `req.business` with { id, name }.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a Bearer token in the Authorization header.',
    });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    const payload = authService.verifyToken(token);
    (req as AuthenticatedRequest).business = {
      id: payload.businessId,
      name: payload.name,
    };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed.',
    });
  }
}
