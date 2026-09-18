import { randomUUID } from 'node:crypto';
import type { Candidature } from '../types';
import type { CandidatureRepository } from './repository';

/** Implémentation en mémoire, utilisée par les tests. */
export function createMemoryCandidatureRepository(): CandidatureRepository {
  const candidatures = new Map<string, Candidature>();

  return {
    async create(input) {
      const now = new Date().toISOString();
      const candidature: Candidature = {
        id: randomUUID(),
        ...input,
        statut: 'EN_ATTENTE',
        justificatifRefus: null,
        createdAt: now,
        updatedAt: now,
      };
      candidatures.set(candidature.id, candidature);
      return candidature;
    },

    async findById(id) {
      return candidatures.get(id) ?? null;
    },

    async findByMissionAndInterimaire(missionId, interimaireId) {
      return (
        [...candidatures.values()].find((c) => c.missionId === missionId && c.interimaireId === interimaireId) ?? null
      );
    },

    async listByInterimaire(interimaireId) {
      return [...candidatures.values()].filter((c) => c.interimaireId === interimaireId);
    },

    async listByMissions(missionIds) {
      return [...candidatures.values()].filter((c) => missionIds.includes(c.missionId));
    },

    async updateStatut(id, statut, justificatifRefus) {
      const current = candidatures.get(id);
      if (!current) throw new Error(`Candidature introuvable : ${id}`);
      const updated: Candidature = { ...current, statut, justificatifRefus, updatedAt: new Date().toISOString() };
      candidatures.set(id, updated);
      return updated;
    },
  };
}
