import { Router } from 'express';
import type { CompetenceRepository } from './repository';

/** Référentiel public des compétences : alimente les formulaires de profil et de mission. */
export function createCompetenceRouter(competences: CompetenceRepository): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ competences: await competences.listAll() });
  });

  return router;
}
