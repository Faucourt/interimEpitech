import 'dotenv/config';

const isTest = process.env.NODE_ENV === 'test';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // En test on tolère un secret bidon pour que `npm test` tourne sans configuration.
  // En dev et en prod, l'absence de JWT_SECRET fait volontairement planter le démarrage.
  jwtSecret: process.env.JWT_SECRET ?? (isTest ? 'test-secret' : required('JWT_SECRET')),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  // Base relationnelle (PostgreSQL, voir src/db/pool.ts). Obligatoire hors test : en test, les dépôts
  // mémoire remplacent la base et aucune connexion n'est ouverte.
  databaseUrl: process.env.DATABASE_URL ?? (isTest ? 'postgres://test' : required('DATABASE_URL')),
  // Intégration n8n (contrat : README.md, section « Automatisations n8n »). Les deux sont optionnelles : sans URL, la
  // notification sortante est désactivée ; sans clé, la route interne répond 503.
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL ?? '',
  n8nApiKey: process.env.N8N_API_KEY ?? '',
  // Base non relationnelle (logs de matching, voir src/mongo.ts). Optionnelle : sans URI, la
  // journalisation est désactivée et l'API fonctionne normalement.
  mongodbUri: process.env.MONGODB_URI ?? '',
  mongodbDb: process.env.MONGODB_DB ?? 'cleanmatch',
};
