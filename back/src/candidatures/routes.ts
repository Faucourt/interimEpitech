import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import type { Repositories } from '../repositories';
import { toPublicUser } from '../types';

const decisionSchema = z
  .object({
    statut: z.enum(['ACCEPTEE', 'REFUSEE']),
    justificatif: z.string().min(1).optional(),
  })
  // Règle métier : un refus doit toujours être motivé.
  .refine((d) => d.statut !== 'REFUSEE' || d.justificatif, {
    path: ['justificatif'],
    message: 'Un justificatif est obligatoire en cas de refus',
  });

export function createCandidatureRouter(repos: Repositories): Router {
  const { users, missions, candidatures } = repos;
  const router = Router();
  router.use(requireAuth);

  // Chacun voit les siennes : l'agent ses candidatures (avec la mission), l'entreprise celles
  // reçues sur ses missions (avec l'agent). Filtre optionnel `?missionId=` pour l'entreprise.
  router.get('/', async (req, res) => {
    if (req.user!.role === 'INTERIMAIRE') {
      const list = await candidatures.listByInterimaire(req.user!.sub);
      const items = await Promise.all(list.map(async (c) => ({ ...c, mission: await missions.findById(c.missionId) })));
      res.json({ candidatures: items });
      return;
    }
    if (req.user!.role !== 'ENTREPRISE') {
      res.status(403).json({ error: 'Accès réservé aux entreprises et aux intérimaires' });
      return;
    }
    const mine = await missions.listByEntreprise(req.user!.sub);
    const missionId = typeof req.query.missionId === 'string' ? req.query.missionId : null;
    const ids = mine.map((m) => m.id).filter((id) => missionId === null || id === missionId);
    const list = await candidatures.listByMissions(ids);
    const agents = await users.findByIds(list.map((c) => c.interimaireId));
    const items = list.map((c) => {
      const agent = agents.find((u) => u.id === c.interimaireId);
      return { ...c, interimaire: agent ? toPublicUser(agent) : null };
    });
    res.json({ candidatures: items });
  });

  router.patch('/:id', async (req, res) => {
    if (req.user!.role !== 'ENTREPRISE') {
      res.status(403).json({ error: 'Accès réservé au rôle ENTREPRISE' });
      return;
    }
    const decision = decisionSchema.parse(req.body);
    const candidature = await candidatures.findById(req.params.id);
    const mission = candidature ? await missions.findById(candidature.missionId) : null;
    if (!candidature || !mission || mission.entrepriseId !== req.user!.sub) {
      res.status(404).json({ error: 'Candidature introuvable' });
      return;
    }
    if (candidature.statut !== 'EN_ATTENTE') {
      res.status(409).json({ error: 'Cette candidature a déjà été traitée' });
      return;
    }
    if (decision.statut === 'ACCEPTEE' && mission.statut !== 'OUVERTE') {
      res.status(409).json({ error: 'La mission n’est plus ouverte' });
      return;
    }

    const updated = await candidatures.updateStatut(
      candidature.id,
      decision.statut,
      decision.statut === 'REFUSEE' ? decision.justificatif! : null,
    );

    // Quand le nombre d'agents recherchés est atteint, la mission passe à POURVUE.
    let missionAfter = mission;
    if (decision.statut === 'ACCEPTEE') {
      const accepted = (await candidatures.listByMissions([mission.id])).filter((c) => c.statut === 'ACCEPTEE');
      if (accepted.length >= mission.nbAgents) {
        missionAfter = await missions.update(mission.id, { statut: 'POURVUE' });
      }
    }
    res.json({ candidature: updated, mission: missionAfter });
  });

  return router;
}
