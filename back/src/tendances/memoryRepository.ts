import type { TendanceMarche } from '../types';
import type { TendanceRepository } from './repository';

/** Implémentation en mémoire, utilisée par les tests avec un jeu de données fourni. */
export function createMemoryTendanceRepository(rows: TendanceMarche[] = []): TendanceRepository {
  return {
    async list(filters) {
      return rows
        .filter((row) => filters.annee === undefined || row.annee === filters.annee)
        .filter((row) => filters.codeRome === undefined || row.codeRome === filters.codeRome)
        // Les lignes sans volume connu passent en dernier.
        .sort((a, b) => (b.projetsRecrutement ?? -1) - (a.projetsRecrutement ?? -1));
    },
  };
}
