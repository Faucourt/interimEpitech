import type { MatchingLog } from '../types';

/** Entrée à journaliser : le dépôt horodate lui-même (`calculeLe`). */
export type NewMatchingLog = Omit<MatchingLog, 'calculeLe'>;

export interface MatchingLogFilters {
  missionId?: string;
  interimaireId?: string;
  /** Nombre maximal d'entrées renvoyées. */
  limit: number;
}

/**
 * Journal des scores de matching, porté par la base non relationnelle (MongoDB en prod) :
 * historique du matching et matière des notifications n8n. Conservé 6 mois (cahier des charges, §6.2).
 */
export interface MatchingLogRepository {
  /** Enregistre un score calculé. Appelé hors du chemin critique : voir `matching/service.ts`. */
  insert(entry: NewMatchingLog): Promise<void>;
  /** Entrées filtrées, les plus récentes d'abord. */
  list(filters: MatchingLogFilters): Promise<MatchingLog[]>;
}

/** Dépôt inerte : sans `MONGODB_URI`, rien n'est journalisé et l'historique reste vide. */
export function createDisabledMatchingLogRepository(): MatchingLogRepository {
  return {
    async insert() {
      // Journalisation désactivée.
    },
    async list() {
      return [];
    },
  };
}
