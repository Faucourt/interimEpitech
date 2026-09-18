import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Chargement des variables : data/.env d'abord, puis back/.env en secours. Les identifiants
// Supabase sont identiques des deux côtés, inutile de les dupliquer. dotenv n'écrase jamais une
// variable déjà définie : la première source qui la fournit gagne.
const dataDir = path.resolve(__dirname, '..');
loadEnv({ path: path.join(dataDir, '.env'), quiet: true });
loadEnv({ path: path.join(dataDir, '..', 'back', '.env'), quiet: true });

/** Erreur de configuration : le message est affiché tel quel à l'utilisateur, sortie en code 1. */
export class ConfigError extends Error {}

export const config = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  franceTravailClientId: process.env.FRANCE_TRAVAIL_CLIENT_ID ?? '',
  franceTravailClientSecret: process.env.FRANCE_TRAVAIL_CLIENT_SECRET ?? '',
};
