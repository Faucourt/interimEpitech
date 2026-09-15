import { Router, type Request, type Response } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import type { MatchingService } from '../matching/service';
import { notifyMissionPublished } from '../n8n/client';
import type { Repositories } from '../repositories';
import type { Mission } from '../types';
import { justificatifSchema, missionFiltersSchema, missionSchema } from './schemas';

export function createMissionRouter(repos: Repositories, matching: MatchingService): Router {
  const { missions, profiles, candidatures } = repos;
  const router = Router();

  /** Mission de l'entreprise connectée, ou répond 404 (on ne révèle pas l'existence des missions des autres). */
  async function ownMission(req: Request<{ id: string }>, res: Response): Promise<Mission | null> {
    const mission = await missions.findById(req.params.id);
    if (!mission || mission.entrepriseId !== req.user!.sub) {
      res.status(404).json({ error: 'Mission introuvable' });
      return null;
    }
    return mission;
  }

  // Liste publique des missions ouvertes : alimente les pages d'annonces (SEO).
  router.get('/', async (req, res) => {
    const { type, ...filters } = missionFiltersSchema.parse(req.query);
    res.json({ missions: await missions.listOpen({ typeNettoyage: type, ...filters }) });
  });

  router.get('/mine', requireAuth, requireRole('ENTREPRISE'), async (req, res) => {
    res.json({ missions: await missions.listByEntreprise(req.user!.sub) });
  });

  // Déclarée avant `/:id` pour ne pas être capturée comme un identifiant.
  router.get('/recommandees', requireAuth, requireRole('INTERIMAIRE'), async (req, res) => {
    const profile = await profiles.findByUserId(req.user!.sub);
    if (!profile) {
      res.json({ recommandations: [], message: 'Renseignez votre profil pour recevoir des recommandations' });
      return;
    }
    const open = await missions.listOpen({});
    res.json({ recommandations: await matching.recommendationsFor(profile, open) });
  });

  router.post('/', requireAuth, requireRole('ENTREPRISE'), async (req, res) => {
    const mission = await missions.create(req.user!.sub, missionSchema.parse(req.body));
    res.status(201).json({ mission });
    // Notification n8n en arrière-plan, une fois la réponse partie : elle ne peut ni retarder
    // ni faire échouer la création (la fonction ne lève jamais, elle logue).
    void notifyMissionPublished(mission, matching);
  });

  router.get<{ id: string }>('/:id', async (req, res) => {
    const mission = await missions.findById(req.params.id);
    if (!mission) {
      res.status(404).json({ error: 'Mission introuvable' });
      return;
    }
    res.json({ mission });
  });

  router.put<{ id: string }>('/:id', requireAuth, requireRole('ENTREPRISE'), async (req, res) => {
    const input = missionSchema.parse(req.body);
    if (!(await ownMission(req, res))) return;
    res.json({ mission: await missions.update(req.params.id, input) });
  });

  router.delete<{ id: string }>('/:id', requireAuth, requireRole('ENTREPRISE'), async (req, res) => {
    const { justificatif } = justificatifSchema.parse(req.body);
    if (!(await ownMission(req, res))) return;
    await missions.softDelete(req.params.id, justificatif);
    res.status(204).end();
  });

  router.get<{ id: string }>('/:id/candidats', requireAuth, requireRole('ENTREPRISE'), async (req, res) => {
    const mission = await ownMission(req, res);
    if (!mission) return;
    res.json({ candidats: await matching.candidatesFor(mission) });
  });

  router.post<{ id: string }>('/:id/candidatures', requireAuth, requireRole('INTERIMAIRE'), async (req, res) => {
    const interimaireId = req.user!.sub;
    const mission = await missions.findById(req.params.id);
    if (!mission || mission.statut !== 'OUVERTE') {
      res.status(404).json({ error: 'Mission introuvable ou déjà pourvue' });
      return;
    }
    const profile = await profiles.findByUserId(interimaireId);
    if (!profile) {
      res.status(409).json({ error: 'Renseignez votre profil avant de candidater' });
      return;
    }
    if (await candidatures.findByMissionAndInterimaire(mission.id, interimaireId)) {
      res.status(409).json({ error: 'Vous avez déjà candidaté à cette mission' });
      return;
    }
    // Filtre éliminatoire : un agent indisponible sur les jours ou le créneau ne peut pas candidater.
    const score = await matching.scoreFor(mission, profile);
    if (!score) {
      res.status(409).json({ error: 'Vous n’êtes pas disponible sur les jours ou le créneau de cette mission' });
      return;
    }
    // Le score est figé à la candidature : le profil peut évoluer ensuite, l'historique reste fidèle.
    const candidature = await candidatures.create({ missionId: mission.id, interimaireId, score: score.total });
    res.status(201).json({ candidature, score });
  });

  return router;
}
