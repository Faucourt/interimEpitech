import type { MatchingLog } from '../types';
import type { MatchingLogRepository } from './repository';

/** Implémentation en mémoire, utilisée par les tests. */
export function createMemoryMatchingLogRepository(): MatchingLogRepository {
  const logs: MatchingLog[] = [];

  return {
    async insert(entry) {
      logs.push({ ...entry, calculeLe: new Date().toISOString() });
    },

    async list(filters) {
      // Les plus récents d'abord ; à date égale (même milliseconde), le dernier inséré passe devant.
      return [...logs]
        .reverse()
        .sort((a, b) => b.calculeLe.localeCompare(a.calculeLe))
        .filter((log) => filters.missionId === undefined || log.missionId === filters.missionId)
        .filter((log) => filters.interimaireId === undefined || log.interimaireId === filters.interimaireId)
        .slice(0, filters.limit);
    },
  };
}
