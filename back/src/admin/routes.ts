import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/middleware';
import { generateTemporaryPassword, hashPassword } from '../auth/password';
import type { MatchingLogRepository } from '../matchingLogs/repository';
import type { TendanceRepository } from '../tendances/repository';
import { toPublicUser } from '../types';
import type { UserRepository } from '../users/repository';

const createEntrepriseSchema = z.object({
  email: z.email(),
  raisonSociale: z.string().min(1),
  siret: z.string().regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres'),
  telephone: z.string().min(6).optional(),
});

const activationSchema = z.object({ isActive: z.boolean() });

const tendancesQuerySchema = z.object({
  annee: z.coerce.number().int().optional(),
  codeRome: z.string().min(1).optional(),
});

const logsMatchingQuerySchema = z.object({
  missionId: z.string().min(1).optional(),
  interimaireId: z.string().min(1).optional(),
  // 100 par défaut, plafonné : on ne renvoie pas 6 mois d'historique d'un coup.
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

/** Espace admin : les comptes entreprise ne se créent que par ici, jamais par inscription publique. */
export function createAdminRouter(
  users: UserRepository,
  tendances: TendanceRepository,
  matchingLogs: MatchingLogRepository,
): Router {
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));

  router.post('/entreprises', async (req, res) => {
    const input = createEntrepriseSchema.parse(req.body);
    if (await users.findByEmail(input.email)) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      return;
    }
    // Le mot de passe temporaire n'est jamais stocké en clair : il est renvoyé une seule fois,
    // à l'admin, qui le transmet à l'entreprise. Celle-ci doit le changer à sa première connexion.
    const temporaryPassword = generateTemporaryPassword();
    const user = await users.create({
      ...input,
      role: 'ENTREPRISE',
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    });
    res.status(201).json({ user: toPublicUser(user), temporaryPassword });
  });

  // Désactivation sans suppression : les missions et candidatures de l'entreprise restent en base.
  router.patch('/users/:id', async (req, res) => {
    const { isActive } = activationSchema.parse(req.body);
    if (!(await users.findById(req.params.id))) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    const user = await users.update(req.params.id, { isActive });
    res.json({ user: toPublicUser(user) });
  });

  // Tableau de tendances marché : données publiques France Travail, du métier le plus demandé au moins demandé.
  router.get('/tendances', async (req, res) => {
    res.json({ tendances: await tendances.list(tendancesQuerySchema.parse(req.query)) });
  });

  // Historique du matching (base non relationnelle) : quel score, pour qui, quand. Les plus récents d'abord.
  router.get('/logs-matching', async (req, res) => {
    res.json({ logs: await matchingLogs.list(logsMatchingQuerySchema.parse(req.query)) });
  });

  return router;
}
