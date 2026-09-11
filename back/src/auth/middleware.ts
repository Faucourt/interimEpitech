import type { NextFunction, Request, Response } from 'express';
import type { JwtPayload, Role } from '../types';
import { verifyToken } from './token';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  const payload = scheme === 'Bearer' && token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }
  req.user = payload;
  next();
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // À placer après requireAuth : sans req.user, on refuse aussi.
    if (req.user?.role !== role) {
      res.status(403).json({ error: `Accès réservé au rôle ${role}` });
      return;
    }
    next();
  };
}
