import { generateTemporaryPassword, hashPassword } from '../auth/password';
import { createPgUserRepository } from '../users/pgRepository';
import { errorMessage, pool } from './pool';

/**
 * Crée le compte ADMIN : ce rôle n'a aucun parcours d'inscription, il n'existe que par ce seed.
 * Idempotent : si l'email est déjà pris, on ne touche à rien. Sans ADMIN_PASSWORD, un mot de passe
 * est généré et affiché une seule fois — il n'est stocké que haché.
 */
async function seed(): Promise<void> {
  const email = process.env.ADMIN_EMAIL || 'admin@cleanmatch.fr';
  const users = createPgUserRepository(pool);

  if (await users.findByEmail(email)) {
    console.log(`[seed] Le compte ${email} existe déjà, rien à faire`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD || generateTemporaryPassword();
  await users.create({ email, passwordHash: await hashPassword(password), role: 'ADMIN' });
  console.log(`[seed] Compte ADMIN ${email} créé`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`[seed] Mot de passe généré (affiché une seule fois, à noter) : ${password}`);
  }
}

seed()
  .catch((err) => {
    console.error('[seed]', errorMessage(err));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
