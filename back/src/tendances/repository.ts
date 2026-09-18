import type { TendanceMarche } from '../types';

export interface TendanceFilters {
  annee?: number;
  codeRome?: string;
}

/** Données publiques France Travail : tension de recrutement par métier et territoire. */
export interface TendanceRepository {
  /** Lignes filtrées, triées par nombre de projets de recrutement décroissant. */
  list(filters: TendanceFilters): Promise<TendanceMarche[]>;
}
