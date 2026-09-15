import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

/** Comparaison en temps constant : le temps de réponse ne renseigne pas sur les caractères justes. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Authentification machine à machine des routes appelées par n8n : un secret partagé dans le
 * header `X-Api-Key`, pas de JWT utilisateur. Sans N8N_API_KEY configurée, la route est fermée
 * (503) plutôt qu'ouverte à tous.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.n8nApiKey) {
    res.status(503).json({ error: 'Intégration n8n non configurée' });
    return;
  }
  const provided = req.header('x-api-key');
  if (!provided || !safeEqual(provided, config.n8nApiKey)) {
    res.status(401).json({ error: 'Clé d’API invalide' });
    return;
  }
  next();
}
