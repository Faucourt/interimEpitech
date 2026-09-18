import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Même fichier que l'API : back/.env. Chemin résolu depuis ce fichier (src/cli/ ou dist/cli/) pour
// que le CLI trouve sa configuration quel que soit le dossier d'où il est lancé.
loadEnv({ path: path.resolve(__dirname, '..', '..', '.env'), quiet: true });

/** Erreur de configuration : le message est affiché tel quel à l'utilisateur, sortie en code 1. */
export class ConfigError extends Error {}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  franceTravailClientId: process.env.FRANCE_TRAVAIL_CLIENT_ID ?? '',
  franceTravailClientSecret: process.env.FRANCE_TRAVAIL_CLIENT_SECRET ?? '',
};
