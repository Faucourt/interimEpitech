import type { Commune } from '../types';
import type { CommuneRepository } from './repository';

/** Implémentation en mémoire, utilisée par les tests avec un jeu de communes fourni. */
export function createMemoryCommuneRepository(communes: Commune[] = []): CommuneRepository {
  return {
    async findByCodePostal(codePostal) {
      return communes.find((c) => c.codePostal === codePostal) ?? null;
    },
  };
}
