import type { Competence, ProfilCompetence } from '../types';
import type { CompetenceRepository } from './repository';

/** Implémentation en mémoire, utilisée par les tests avec un référentiel fourni. */
export function createMemoryCompetenceRepository(referentiel: Competence[] = []): CompetenceRepository {
  const byProfil = new Map<string, ProfilCompetence[]>();

  return {
    async listAll() {
      return [...referentiel];
    },

    async listByProfil(profilId) {
      return [...(byProfil.get(profilId) ?? [])];
    },

    async replaceForProfil(profilId, input) {
      const rows = input.map((item) => ({
        competenceId: item.competenceId,
        nom: referentiel.find((c) => c.id === item.competenceId)?.nom ?? '',
        niveau: item.niveau,
        anneesExperience: item.anneesExperience ?? null,
        valideeLe: null,
      }));
      byProfil.set(profilId, rows);
      return [...rows];
    },
  };
}
