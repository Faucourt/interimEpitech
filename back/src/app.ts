import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { createAdminRouter } from './admin/routes';
import { requireAuth, requireRole } from './auth/middleware';
import { createAuthRouter } from './auth/routes';
import { createCandidatureRouter } from './candidatures/routes';
import { createCompetenceRouter } from './competences/routes';
import { config } from './config';
import { createMatchingService } from './matching/service';
import { createMissionRouter } from './missions/routes';
import { createInternalRouter } from './n8n/routes';
import { createProfilRouter } from './profils/routes';
import type { Repositories } from './repositories';

export function createApp(repos: Repositories) {
  const app = express();
  const matching = createMatchingService(repos);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // Freine le brute force des mots de passe : 20 tentatives par IP et par quart d'heure.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
  });
  app.use(['/api/auth/register', '/api/auth/login'], authLimiter);
  app.use('/api/auth', createAuthRouter(repos.users));
  app.use('/api/admin', createAdminRouter(repos.users, repos.tendances, repos.matchingLogs));
  app.use('/api/profil', createProfilRouter(repos.profiles, repos.competences));
  app.use('/api/competences', createCompetenceRouter(repos.competences));
  app.use('/api/missions', createMissionRouter(repos, matching));
  app.use('/api/candidatures', createCandidatureRouter(repos));
  // Routes machine à machine pour n8n : clé d'API partagée, pas de JWT.
  app.use('/api/internal', createInternalRouter(repos));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/entreprise/dashboard', requireAuth, requireRole('ENTREPRISE'), (_req, res) => {
    res.json({ ok: true });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: err.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      });
      return;
    }
    // express.json() attache un statut 400 aux corps JSON mal formés ; tout le reste est une
    // erreur interne dont on ne renvoie jamais le détail au client (stack, message SQL…).
    const status = (err as { status?: number }).status ?? 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Erreur interne' : 'Requête invalide' });
  });

  return app;
}
