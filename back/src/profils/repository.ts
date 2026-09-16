import type { Experience, Profile } from '../types';

export type ProfileInput = Omit<Profile, 'userId' | 'createdAt' | 'updatedAt'>;

export interface NewExperience {
  userId: string;
  intitule: string;
  typeNettoyage?: string | null;
  entreprise?: string | null;
  ville?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  source?: Experience['source'];
}

export interface ProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>;
  /** Crée le profil s'il n'existe pas, le remplace sinon. */
  upsert(userId: string, input: ProfileInput): Promise<Profile>;
  /** Profils marqués disponibles : le premier filtre du matching. */
  listAvailable(): Promise<Profile[]>;
  listExperiences(userId: string): Promise<Experience[]>;
  addExperience(input: NewExperience): Promise<Experience>;
  /** Renvoie false si l'expérience n'existe pas ou n'appartient pas à l'agent. */
  deleteExperience(id: string, userId: string): Promise<boolean>;
}
