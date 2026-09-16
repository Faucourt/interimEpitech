import { z } from 'zod';

const entrepriseOnlyByAdmin =
  "L'inscription publique est réservée aux intérimaires ; les comptes entreprise sont créés par l'administrateur";

// Seuls les intérimaires s'inscrivent librement. Le champ `role` reste accepté pour
// compatibilité avec le front, mais toute autre valeur qu'INTERIMAIRE est refusée.
export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  role: z.literal('INTERIMAIRE', { error: entrepriseOnlyByAdmin }).default('INTERIMAIRE'),
  prenom: z.string().min(1),
  nom: z.string().min(1),
  telephone: z.string().min(6).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
