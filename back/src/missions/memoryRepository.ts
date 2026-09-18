import { randomUUID } from 'node:crypto';
import type { Mission } from '../types';
import type { MissionFilters, MissionRepository } from './repository';

/** Implémentation en mémoire, utilisée par les tests. */
export function createMemoryMissionRepository(): MissionRepository {
  const missions = new Map<string, Mission>();
  const deleted = new Map<string, string>(); // id → justificatif

  const alive = () => [...missions.values()].filter((m) => !deleted.has(m.id));

  function matches(mission: Mission, filters: MissionFilters): boolean {
    if (filters.typeNettoyage && !mission.typeNettoyage.toLowerCase().includes(filters.typeNettoyage.toLowerCase())) {
      return false;
    }
    if (filters.codePostal && !mission.codePostal.startsWith(filters.codePostal)) return false;
    if (filters.dateDebut && mission.dateDebut < filters.dateDebut) return false;
    if (filters.dateFin && mission.dateFin > filters.dateFin) return false;
    return true;
  }

  return {
    async create(entrepriseId, input) {
      const now = new Date().toISOString();
      const mission: Mission = { ...input, id: randomUUID(), entrepriseId, statut: 'OUVERTE', createdAt: now, updatedAt: now };
      missions.set(mission.id, mission);
      return mission;
    },

    async findById(id) {
      return deleted.has(id) ? null : (missions.get(id) ?? null);
    },

    async listByEntreprise(entrepriseId) {
      return alive().filter((m) => m.entrepriseId === entrepriseId);
    },

    async listOpen(filters) {
      return alive()
        .filter((m) => m.statut === 'OUVERTE' && matches(m, filters))
        .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
    },

    async update(id, patch) {
      const current = missions.get(id);
      if (!current) throw new Error(`Mission introuvable : ${id}`);
      const updated: Mission = { ...current, ...patch, updatedAt: new Date().toISOString() };
      missions.set(id, updated);
      return updated;
    },

    async softDelete(id, justificatif) {
      deleted.set(id, justificatif);
    },
  };
}
