import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/middleware';
import type { CompetenceRepository } from '../competences/repository';
import { CRENEAUX, JOURS, NIVEAUX_COMPETENCE } from '../types';
import type { ProfileRepository } from './repository';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
const codePostal = z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres');

const profileSchema = z.object({
  competences: z.array(z.string().min(1)).default([]),
  typesNettoyage: z.array(z.string().min(1)).default([]),
  codePostal: codePostal.nullable().default(null),
  ville: z.string().min(1).nullable().default(null),
  rayonKm: z.number().int().min(1).max(200).default(15),
  joursDisponibles: z.array(z.enum(JOURS)).default([]),
  creneaux: z.array(z.enum(CRENEAUX)).default([]),
  disponible: z.boolean().default(true),
});

const experienceSchema = z.object({
  intitule: z.string().min(1),
  typeNettoyage: z.string().min(1).optional(),
  entreprise: z.string().min(1).optional(),
  ville: z.string().min(1).optional(),
  dateDebut: isoDate.optional(),
  dateFin: isoDate.optional(),
});

/** Remplacement complet des compétences qualifiées : chaque compétence du référentiel au plus une fois. */
const profilCompetencesSchema = z.object({
  competences: z
    .array(
      z.object({
        competenceId: z.string().min(1),
        niveau: z.enum(NIVEAUX_COMPETENCE),
        anneesExperience: z.number().int().min(0).max(60).optional(),
      }),
    )
    .refine((items) => new Set(items.map((c) => c.competenceId)).size === items.length, {
      message: 'Une compétence ne peut apparaître qu’une seule fois',
    }),
});

/** Profil de l'agent connecté : chaque intérimaire ne voit et ne modifie que le sien. */
export function createProfilRouter(profiles: ProfileRepository, competences: CompetenceRepository): Router {
  const router = Router();
  router.use(requireAuth, requireRole('INTERIMAIRE'));

  router.get('/', async (req, res) => {
    const userId = req.user!.sub;
    const [profil, experiences] = await Promise.all([
      profiles.findByUserId(userId),
      profiles.listExperiences(userId),
    ]);
    res.json({ profil, experiences });
  });

  router.put('/', async (req, res) => {
    const profil = await profiles.upsert(req.user!.sub, profileSchema.parse(req.body));
    res.json({ profil });
  });

  router.get('/competences', async (req, res) => {
    res.json({ competences: await competences.listByProfil(req.user!.sub) });
  });

  router.put('/competences', async (req, res) => {
    const userId = req.user!.sub;
    const input = profilCompetencesSchema.parse(req.body).competences;
    // La table des compétences qualifiées référence le profil : il doit exister avant.
    if (!(await profiles.findByUserId(userId))) {
      res.status(409).json({ error: 'Renseignez votre profil avant de qualifier vos compétences' });
      return;
    }
    const known = new Set((await competences.listAll()).map((c) => c.id));
    const unknown = input.map((c) => c.competenceId).filter((id) => !known.has(id));
    if (unknown.length > 0) {
      res.status(400).json({ error: 'Compétence inconnue du référentiel', competenceIds: unknown });
      return;
    }
    res.json({ competences: await competences.replaceForProfil(userId, input) });
  });

  router.post('/experiences', async (req, res) => {
    const experience = await profiles.addExperience({ userId: req.user!.sub, ...experienceSchema.parse(req.body) });
    res.status(201).json({ experience });
  });

  router.delete('/experiences/:id', async (req, res) => {
    const deleted = await profiles.deleteExperience(req.params.id, req.user!.sub);
    if (!deleted) {
      res.status(404).json({ error: 'Expérience introuvable' });
      return;
    }
    res.status(204).end();
  });

  return router;
}
