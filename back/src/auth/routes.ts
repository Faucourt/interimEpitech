import { Router } from 'express';
import { toPublicUser, type User } from '../types';
import type { UserRepository } from '../users/repository';
import { requireAuth } from './middleware';
import { hashPassword, verifyPassword } from './password';
import { loginSchema, registerSchema } from './schemas';
import { signToken } from './token';

function session(user: User) {
  return {
    token: signToken({ sub: user.id, email: user.email, role: user.role }),
    user: toPublicUser(user),
  };
}

export function createAuthRouter(users: UserRepository): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const { password, ...profile } = registerSchema.parse(req.body);
    if (await users.findByEmail(profile.email)) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      return;
    }
    const user = await users.create({ ...profile, passwordHash: await hashPassword(password) });
    res.status(201).json(session(user));
  });

  router.post('/login', async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await users.findByEmail(email);
    // Même réponse pour « email inconnu » et « mot de passe faux » : une réponse différente
    // permettrait de tester des emails un par un pour savoir lesquels ont un compte.
    // (Le temps de réponse diffère encore un peu — pas d'argon2 si l'email est inconnu —,
    // c'est un compromis assumé pour ce POC.)
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    res.json(session(user));
  });

  router.get('/me', requireAuth, async (req, res) => {
    const user = await users.findById(req.user!.sub);
    if (!user) {
      res.status(401).json({ error: 'Compte introuvable' });
      return;
    }
    res.json({ user: toPublicUser(user) });
  });

  return router;
}
