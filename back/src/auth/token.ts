import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { JwtPayload } from '../types';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    // Token expiré, signature invalide ou format cassé : dans tous les cas, non authentifié.
    return null;
  }
}
