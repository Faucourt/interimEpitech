import { createClient } from '@supabase/supabase-js';
import { createApp } from './app';
import { createSupabaseCandidatureRepository } from './candidatures/supabaseRepository';
import { createSupabaseCommuneRepository } from './communes/supabaseRepository';
import { createSupabaseCompetenceRepository } from './competences/supabaseRepository';
import { config } from './config';
import { createMongoMatchingLogRepository } from './matchingLogs/mongoRepository';
import { createDisabledMatchingLogRepository } from './matchingLogs/repository';
import { createSupabaseMissionRepository } from './missions/supabaseRepository';
import { connectMongo } from './mongo';
import { createSupabaseProfileRepository } from './profils/supabaseRepository';
import { createSupabaseTendanceRepository } from './tendances/supabaseRepository';
import { createSupabaseUserRepository } from './users/supabaseRepository';

async function main(): Promise<void> {
  // Clé service_role : elle contourne le RLS, elle ne doit JAMAIS quitter le serveur.
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  // Base non relationnelle (logs de matching) : un seul client partagé, null si MONGODB_URI est vide.
  const mongo = await connectMongo();

  const app = createApp({
    users: createSupabaseUserRepository(supabase),
    profiles: createSupabaseProfileRepository(supabase),
    missions: createSupabaseMissionRepository(supabase),
    candidatures: createSupabaseCandidatureRepository(supabase),
    communes: createSupabaseCommuneRepository(supabase),
    competences: createSupabaseCompetenceRepository(supabase),
    tendances: createSupabaseTendanceRepository(supabase),
    matchingLogs: mongo
      ? await createMongoMatchingLogRepository(mongo.db(config.mongodbDb))
      : createDisabledMatchingLogRepository(),
  });

  const server = app.listen(config.port, () => {
    console.log(`API démarrée sur http://localhost:${config.port}`);
  });

  // Arrêt propre (Ctrl+C, docker stop) : on cesse d'accepter des connexions, puis on ferme MongoDB.
  async function shutdown(): Promise<void> {
    server.close();
    await mongo?.close();
    process.exit(0);
  }
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('Démarrage impossible :', err);
  process.exit(1);
});
