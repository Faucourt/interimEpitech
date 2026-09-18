import { MongoClient } from 'mongodb';
import { config } from './config';

/** Sans serveur joignable dans ce délai, on abandonne : l'API démarre quand même, sans journalisation. */
const SERVER_SELECTION_TIMEOUT_MS = 5000;

/**
 * Ouvre le client MongoDB partagé (base non relationnelle : logs de matching).
 * Ne lève jamais : sans MONGODB_URI la journalisation est désactivée silencieusement, et un
 * serveur injoignable est seulement logué. Même principe que l'intégration n8n (`n8n/client.ts`) :
 * l'API ne dépend pas de cette base pour fonctionner.
 */
export async function connectMongo(): Promise<MongoClient | null> {
  if (!config.mongodbUri) return null;
  const client = new MongoClient(config.mongodbUri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  try {
    await client.connect();
    console.log(`[mongo] Connecté, base « ${config.mongodbDb} »`);
    return client;
  } catch (err) {
    console.error('[mongo] Connexion impossible, journalisation du matching désactivée :', err);
    await client.close().catch(() => undefined);
    return null;
  }
}
