import { randomUUID } from 'node:crypto';
import type { Experience, Profile } from '../types';
import type { ProfileRepository } from './repository';

/** Implémentation en mémoire, utilisée par les tests. */
export function createMemoryProfileRepository(): ProfileRepository {
  const profiles = new Map<string, Profile>();
  const experiences = new Map<string, Experience>();

  return {
    async findByUserId(userId) {
      return profiles.get(userId) ?? null;
    },

    async upsert(userId, input) {
      const now = new Date().toISOString();
      const profile: Profile = {
        ...input,
        userId,
        createdAt: profiles.get(userId)?.createdAt ?? now,
        updatedAt: now,
      };
      profiles.set(userId, profile);
      return profile;
    },

    async listAvailable() {
      return [...profiles.values()].filter((p) => p.disponible);
    },

    async listExperiences(userId) {
      return [...experiences.values()].filter((e) => e.userId === userId);
    },

    async addExperience(input) {
      const experience: Experience = {
        id: randomUUID(),
        userId: input.userId,
        intitule: input.intitule,
        typeNettoyage: input.typeNettoyage ?? null,
        entreprise: input.entreprise ?? null,
        ville: input.ville ?? null,
        dateDebut: input.dateDebut ?? null,
        dateFin: input.dateFin ?? null,
        source: input.source ?? 'DECLAREE',
        createdAt: new Date().toISOString(),
      };
      experiences.set(experience.id, experience);
      return experience;
    },

    async deleteExperience(id, userId) {
      const experience = experiences.get(id);
      if (!experience || experience.userId !== userId) return false;
      experiences.delete(id);
      return true;
    },
  };
}
