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
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
};
