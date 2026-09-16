import type { Competence, NiveauCompetence, ProfilCompetence } from '../types';

export interface ProfilCompetenceInput {
  competenceId: string;
  niveau: NiveauCompetence;
  anneesExperience?: number | null;
}

/** Référentiel de compétences du secteur et compétences qualifiées (niveau + ancienneté) de chaque agent. */
export interface CompetenceRepository {
  listAll(): Promise<Competence[]>;
  listByProfil(profilId: string): Promise<ProfilCompetence[]>;
  /** Remplace l'ensemble des compétences qualifiées de l'agent par celles fournies. */
  replaceForProfil(profilId: string, input: ProfilCompetenceInput[]): Promise<ProfilCompetence[]>;
}
