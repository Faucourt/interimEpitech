import type { Db, Filter } from 'mongodb';
import type { MatchingLog } from '../types';
import type { MatchingLogRepository } from './repository';

const COLLECTION = 'matching_logs';

/** Durée de conservation des logs de matching annoncée au titre du RGPD (cahier des charges, §6.2) : 6 mois. */
const RETENTION_DAYS = 183;

/** Document stocké : le type métier, sauf `calculeLe` en Date BSON, indispensable à l'index TTL. */
interface MatchingLogDocument extends Omit<MatchingLog, 'calculeLe'> {
  calculeLe: Date;
}

function toMatchingLog(doc: MatchingLogDocument): MatchingLog {
  // Liste explicite : le `_id` Mongo ne sort pas de l'API.
  return {
    missionId: doc.missionId,
    interimaireId: doc.interimaireId,
    scoreTotal: doc.scoreTotal,
    scoreMotsCles: doc.scoreMotsCles,
    scoreDernieresMissions: doc.scoreDernieresMissions,
    scoreLocalisation: doc.scoreLocalisation,
    disponibiliteCompatible: doc.disponibiliteCompatible,
    calculeLe: doc.calculeLe.toISOString(),
  };
}

/**
 * Dépôt MongoDB. Crée au démarrage l'index TTL qui fait expirer chaque document 6 mois après
 * `calculeLe` : la purge est assurée par la base elle-même, sans tâche planifiée à maintenir.
 */
export async function createMongoMatchingLogRepository(db: Db): Promise<MatchingLogRepository> {
  const collection = db.collection<MatchingLogDocument>(COLLECTION);
  await collection.createIndex({ calculeLe: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

  return {
    async insert(entry) {
      await collection.insertOne({ ...entry, calculeLe: new Date() });
    },

    async list(filters) {
      const filter: Filter<MatchingLogDocument> = {};
      if (filters.missionId !== undefined) filter.missionId = filters.missionId;
      if (filters.interimaireId !== undefined) filter.interimaireId = filters.interimaireId;
      const docs = await collection.find(filter).sort({ calculeLe: -1 }).limit(filters.limit).toArray();
      return docs.map(toMatchingLog);
    },
  };
}
