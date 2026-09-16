export type Role = 'ENTREPRISE' | 'INTERIMAIRE' | 'ADMIN';

export const JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'] as const;
export type Jour = (typeof JOURS)[number];

// Les horaires décalés sont la norme du secteur : le créneau est un critère à part entière.
export const CRENEAUX = ['MATIN', 'JOURNEE', 'SOIREE', 'NUIT', 'WEEKEND'] as const;
export type Creneau = (typeof CRENEAUX)[number];

export type MissionStatut = 'OUVERTE' | 'POURVUE' | 'TERMINEE';
export type CandidatureStatut = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  raisonSociale: string | null;
  siret: string | null;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Utilisateur tel qu'on le renvoie au client : jamais le hash du mot de passe. */
export type PublicUser = Omit<User, 'passwordHash'>;

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export function toPublicUser(user: User): PublicUser {
  // Liste explicite plutôt qu'un rest : on voit d'un coup d'oeil ce qui sort de l'API,
  // et un champ sensible ajouté plus tard à User ne fuitera pas par inadvertance.
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    raisonSociale: user.raisonSociale,
    siret: user.siret,
    prenom: user.prenom,
    nom: user.nom,
    telephone: user.telephone,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Profil de l'agent de propreté : la matière première du matching. */
export interface Profile {
  userId: string;
  competences: string[];
  typesNettoyage: string[];
  codePostal: string | null;
  ville: string | null;
  rayonKm: number;
  joursDisponibles: Jour[];
  creneaux: Creneau[];
  disponible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Experience {
  id: string;
  userId: string;
  intitule: string;
  typeNettoyage: string | null;
  entreprise: string | null;
  ville: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  source: 'DECLAREE' | 'PLATEFORME';
  createdAt: string;
}

export interface Mission {
  id: string;
  entrepriseId: string;
  intitule: string;
  typeNettoyage: string;
  description: string | null;
  /** Mention obligatoire d'un contrat de mission (Code du travail). */
  motif: string;
  dateDebut: string;
  dateFin: string;
  heureDebut: string | null;
  heureFin: string | null;
  jours: Jour[];
  creneau: Creneau | null;
  adresse: string | null;
  codePostal: string;
  ville: string;
  competencesRequises: string[];
  remuneration: number | null;
  nbAgents: number;
  statut: MissionStatut;
  createdAt: string;
  updatedAt: string;
}

export interface Candidature {
  id: string;
  missionId: string;
  interimaireId: string;
  statut: CandidatureStatut;
  /** Score figé au moment de la candidature. */
  score: number | null;
  justificatifRefus: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Commune issue de la base officielle des codes postaux (data.gouv.fr). */
export interface Commune {
  codePostal: string;
  nom: string;
  latitude: number;
  longitude: number;
}

export const NIVEAUX_COMPETENCE = ['DEBUTANT', 'INTERMEDIAIRE', 'CONFIRME', 'EXPERT'] as const;
export type NiveauCompetence = (typeof NIVEAUX_COMPETENCE)[number];

/** Compétence du référentiel du secteur (table `competences`). */
export interface Competence {
  id: string;
  nom: string;
  description: string | null;
}

/** Compétence qualifiée d'un agent : une entrée du référentiel avec son niveau et son ancienneté. */
export interface ProfilCompetence {
  competenceId: string;
  nom: string;
  niveau: NiveauCompetence;
  anneesExperience: number | null;
  valideeLe: string | null;
}

/**
 * Trace d'un score de matching calculé, dans la base non relationnelle : historique et
 * matière des notifications n8n. Conservée 6 mois (index TTL sur `calculeLe`).
 */
export interface MatchingLog {
  missionId: string;
  interimaireId: string;
  scoreTotal: number;
  scoreMotsCles: number;
  scoreDernieresMissions: number;
  scoreLocalisation: number;
  disponibiliteCompatible: boolean;
  calculeLe: string;
}

/** Donnée publique France Travail : tension de recrutement d'un métier sur un territoire. */
export interface TendanceMarche {
  id: string;
  codeRome: string;
  libelleMetier: string;
  region: string | null;
  bassinEmploi: string | null;
  projetsRecrutement: number | null;
  difficulteRecrutement: number | null;
  annee: number;
  importeLe: string;
}
