import { createApp } from './app';
import { createPgCandidatureRepository } from './candidatures/pgRepository';
import { createPgCommuneRepository } from './communes/pgRepository';
import { createPgCompetenceRepository } from './competences/pgRepository';
import { config } from './config';
import { pool } from './db/pool';
import { createMongoMatchingLogRepository } from './matchingLogs/mongoRepository';
import { createDisabledMatchingLogRepository } from './matchingLogs/repository';
import { createPgMissionRepository } from './missions/pgRepository';
import { connectMongo } from './mongo';
import { createPgProfileRepository } from './profils/pgRepository';
import { createPgTendanceRepository } from './tendances/pgRepository';
import { createPgUserRepository } from './users/pgRepository';

async function main(): Promise<void> {
  // Base relationnelle : on vérifie la connexion au démarrage plutôt qu'à la première requête HTTP.
  await pool.query('select 1');
  // Base non relationnelle (logs de matching) : un seul client partagé, null si MONGODB_URI est vide.
  const mongo = await connectMongo();

  const app = createApp({
    users: createPgUserRepository(pool),
    profiles: createPgProfileRepository(pool),
    missions: createPgMissionRepository(pool),
    candidatures: createPgCandidatureRepository(pool),
    communes: createPgCommuneRepository(pool),
    competences: createPgCompetenceRepository(pool),
    tendances: createPgTendanceRepository(pool),
    matchingLogs: mongo
      ? await createMongoMatchingLogRepository(mongo.db(config.mongodbDb))
      : createDisabledMatchingLogRepository(),
  });

  const server = app.listen(config.port, () => {
    console.log(`API démarrée sur http://localhost:${config.port}`);
  });

  // Arrêt propre (Ctrl+C, docker stop) : on cesse d'accepter des connexions, puis on ferme les bases.
  async function shutdown(): Promise<void> {
    server.close();
    await Promise.all([pool.end(), mongo?.close()]);
    process.exit(0);
  }
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('Démarrage impossible :', err);
  process.exit(1);
});
