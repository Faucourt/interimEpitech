import { Router } from 'express';
import { z } from 'zod';
import type { Repositories } from '../repositories';
import { requireApiKey } from './middleware';

const DAY_MS = 24 * 60 * 60 * 1000;

const nonPourvuesQuerySchema = z.object({
  // Ancienneté minimale en jours ; 3 par défaut, comme le workflow 2.
  jours: z.coerce.number().int().min(1).default(3),
});

/**
 * Routes internes consommées par les workflows n8n (contrat : README.md, section « Automatisations n8n »).
 * Protégées par la clé d'API partagée, jamais par le JWT des utilisateurs.
 */
export function createInternalRouter(repos: Repositories): Router {
  const { users, missions, candidatures } = repos;
  const router = Router();
  router.use(requireApiKey);

  // Workflow 2 : missions OUVERTE publiées depuis plus de `jours` jours et sans candidature acceptée.
  router.get('/missions/non-pourvues', async (req, res) => {
    const { jours } = nonPourvuesQuerySchema.parse(req.query);
    const cutoff = Date.now() - jours * DAY_MS;
    const stale = (await missions.listOpen({})).filter((m) => new Date(m.createdAt).getTime() < cutoff);
    const received = await candidatures.listByMissions(stale.map((m) => m.id));
    const entreprises = await users.findByIds([...new Set(stale.map((m) => m.entrepriseId))]);

    const items = stale
      .map((m) => {
        const own = received.filter((c) => c.missionId === m.id);
        const entreprise = entreprises.find((u) => u.id === m.entrepriseId);
        return {
          id: m.id,
          intitule: m.intitule,
          ville: m.ville,
          codePostal: m.codePostal,
          statut: m.statut,
          createdAt: m.createdAt,
          nbCandidatures: own.length,
          nbCandidaturesAcceptees: own.filter((c) => c.statut === 'ACCEPTEE').length,
          entreprise: { raisonSociale: entreprise?.raisonSociale ?? null },
        };
      })
      .filter((m) => m.nbCandidaturesAcceptees === 0)
      // Les plus anciennes en premier : ce sont les plus urgentes à relancer.
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    res.json({ missions: items });
  });

  return router;
}
