import { z } from 'zod';
import { CRENEAUX, JOURS } from '../types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
const heure = z.string().regex(/^\d{2}:\d{2}$/, 'Heure attendue au format HH:MM');

/** Durée maximale d'un contrat de mission d'intérim, renouvellement inclus (Code du travail). */
const DUREE_MAX_MOIS = 18;

function addMonths(isoDay: string, months: number): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export const missionSchema = z
  .object({
    intitule: z.string().min(1),
    typeNettoyage: z.string().min(1),
    description: z.string().nullable().default(null),
    // Mention obligatoire : sans motif de recours, pas de contrat de mission valide.
    motif: z.string().min(1, 'Le motif de recours à l’intérim est obligatoire'),
    dateDebut: isoDate,
    dateFin: isoDate,
    heureDebut: heure.nullable().default(null),
    heureFin: heure.nullable().default(null),
    jours: z.array(z.enum(JOURS)).default([]),
    creneau: z.enum(CRENEAUX).nullable().default(null),
    adresse: z.string().nullable().default(null),
    codePostal: z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres'),
    ville: z.string().min(1),
    competencesRequises: z.array(z.string().min(1)).default([]),
    remuneration: z.number().positive().nullable().default(null),
    nbAgents: z.number().int().min(1).default(1),
  })
  .refine((m) => m.dateFin >= m.dateDebut, {
    path: ['dateFin'],
    message: 'La date de fin doit être postérieure ou égale à la date de début',
  })
  .refine((m) => m.dateFin <= addMonths(m.dateDebut, DUREE_MAX_MOIS), {
    path: ['dateFin'],
    message: `Une mission d’intérim ne peut pas dépasser ${DUREE_MAX_MOIS} mois`,
  });

export const missionFiltersSchema = z.object({
  type: z.string().min(1).optional(),
  codePostal: z.string().regex(/^\d{2,5}$/).optional(),
  dateDebut: isoDate.optional(),
  dateFin: isoDate.optional(),
});

export const justificatifSchema = z.object({
  justificatif: z.string().min(1, 'Un justificatif est obligatoire'),
});
