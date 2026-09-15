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

    async findByIds(ids) {
      return ids.map((id) => users.get(id)).filter((user): user is User => user !== undefined);
    },

    async create(input: NewUser) {
      const now = new Date().toISOString();
      const user: User = {
        id: randomUUID(),
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        role: input.role,
        raisonSociale: input.raisonSociale ?? null,
        siret: input.siret ?? null,
        prenom: input.prenom ?? null,
        nom: input.nom ?? null,
        telephone: input.telephone ?? null,
        isActive: true,
        mustChangePassword: input.mustChangePassword ?? false,
        createdAt: now,
        updatedAt: now,
      };
      users.set(user.id, user);
      return user;
    },

    async update(id, patch) {
      const current = users.get(id);
      if (!current) throw new Error(`Utilisateur introuvable : ${id}`);
      const updated: User = { ...current, ...patch, updatedAt: new Date().toISOString() };
      users.set(id, updated);
      return updated;
    },
  };
}
