import type { Mission, MissionStatut } from '../types';

export type MissionInput = Omit<Mission, 'id' | 'entrepriseId' | 'statut' | 'createdAt' | 'updatedAt'>;
export type MissionPatch = Partial<MissionInput & { statut: MissionStatut }>;

export interface MissionFilters {
  typeNettoyage?: string;
  /** Code postal complet ou préfixe (« 75 » pour tout Paris). */
  codePostal?: string;
  /** Missions commençant à partir de cette date. */
  dateDebut?: string;
  /** Missions finissant au plus tard à cette date. */
  dateFin?: string;
}

/**
 * La suppression est logique : la ligne reste en base avec son justificatif (exigé par les
 * règles métier) et disparaît de toutes les lectures.
 */
export interface MissionRepository {
  create(entrepriseId: string, input: MissionInput): Promise<Mission>;
  findById(id: string): Promise<Mission | null>;
  listByEntreprise(entrepriseId: string): Promise<Mission[]>;
  /** Missions OUVERTE, filtrées, triées par date de début. */
  listOpen(filters: MissionFilters): Promise<Mission[]>;
  update(id: string, patch: MissionPatch): Promise<Mission>;
  softDelete(id: string, justificatif: string): Promise<void>;
}
