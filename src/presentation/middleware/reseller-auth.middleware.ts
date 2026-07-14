import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare const process: { env: { JWT_SECRET?: string } };
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

export interface ResellerRequest extends Request {
  reseller: {
    resellerId: number;
    name: string;
    email: string;
  };
}

/**
 * Express middleware that verifies Reseller JWT from Authorization header.
 * On success, attaches `req.reseller` with token payload.
 */
export function resellerAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a Reseller Bearer token in the Authorization header.',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as ResellerRequest).reseller = {
      resellerId: decoded.resellerId,
      name: decoded.name,
      email: decoded.email,
    };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired reseller token.',
    });
  }
}
