import { Request, Response, NextFunction } from 'express';

export const adminSecretAuth = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== (process.env.ADMIN_SECRET || 'dev-admin-secret')) {
    return res.status(403).json({ success: false, error: 'Forbidden: admin privilege required.' });
  }
  next();
};
