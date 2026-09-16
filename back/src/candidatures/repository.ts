import type { Candidature, CandidatureStatut } from '../types';

export interface NewCandidature {
  missionId: string;
  interimaireId: string;
  score: number;
}

export interface CandidatureRepository {
  create(input: NewCandidature): Promise<Candidature>;
  findById(id: string): Promise<Candidature | null>;
  findByMissionAndInterimaire(missionId: string, interimaireId: string): Promise<Candidature | null>;
  listByInterimaire(interimaireId: string): Promise<Candidature[]>;
  /** Candidatures reçues sur un ensemble de missions (celles d'une entreprise). */
  listByMissions(missionIds: string[]): Promise<Candidature[]>;
  updateStatut(id: string, statut: CandidatureStatut, justificatifRefus: string | null): Promise<Candidature>;
}
