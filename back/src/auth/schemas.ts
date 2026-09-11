import { z } from 'zod';

export const registerSchema = z.discriminatedUnion('role', [
  z.object({
    email: z.email(),
    password: z.string().min(8),
    role: z.literal('ENTREPRISE'),
    raisonSociale: z.string().min(1),
    siret: z.string().regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres'),
  }),
  z.object({
    email: z.email(),
    password: z.string().min(8),
    role: z.literal('INTERIMAIRE'),
    prenom: z.string().min(1),
    nom: z.string().min(1),
  }),
]);

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
