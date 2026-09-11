import { randomUUID } from 'node:crypto';
import type { User } from '../types';
import type { NewUser, UserRepository } from './repository';

/** Implémentation en mémoire, utilisée par les tests. */
export function createMemoryUserRepository(): UserRepository {
  const users = new Map<string, User>();

  return {
    async findByEmail(email) {
      for (const user of users.values()) {
        if (user.email === email.toLowerCase()) return user;
      }
      return null;
    },

    async findById(id) {
      return users.get(id) ?? null;
    },

    async create(input: NewUser) {
      const user: User = {
        id: randomUUID(),
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        role: input.role,
        raisonSociale: input.raisonSociale ?? null,
        siret: input.siret ?? null,
        prenom: input.prenom ?? null,
        nom: input.nom ?? null,
        createdAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      return user;
    },
  };
}
