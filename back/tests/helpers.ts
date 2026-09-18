import request from 'supertest';
import { createApp } from '../src/app';
import { hashPassword } from '../src/auth/password';
import { createMemoryCandidatureRepository } from '../src/candidatures/memoryRepository';
import { createMemoryCommuneRepository } from '../src/communes/memoryRepository';
import { createMemoryCompetenceRepository } from '../src/competences/memoryRepository';
import { createMemoryMatchingLogRepository } from '../src/matchingLogs/memoryRepository';
import { createMemoryMissionRepository } from '../src/missions/memoryRepository';
import { createMemoryProfileRepository } from '../src/profils/memoryRepository';
import type { Repositories } from '../src/repositories';
import { createMemoryTendanceRepository } from '../src/tendances/memoryRepository';
import type { Commune, Competence, Role, TendanceMarche, User } from '../src/types';
import { createMemoryUserRepository } from '../src/users/memoryRepository';

/** Quelques communes d'Île-de-France (et Lyon, hors zone) pour le critère de localisation. */
export const COMMUNES: Commune[] = [
  { codePostal: '75001', nom: 'Paris 1er', latitude: 48.8626, longitude: 2.3364 },
  { codePostal: '92100', nom: 'Boulogne-Billancourt', latitude: 48.8352, longitude: 2.241 }, // ~7,6 km
  { codePostal: '78000', nom: 'Versailles', latitude: 48.8049, longitude: 2.1204 }, // ~17 km
  { codePostal: '77000', nom: 'Melun', latitude: 48.5395, longitude: 2.6606 }, // ~43 km
  { codePostal: '69001', nom: 'Lyon 1er', latitude: 45.7676, longitude: 4.8345 }, // ~392 km
];

/** Référentiel de compétences, identique au seed de `sql/003_competences_donnees_publiques.sql`. */
export const COMPETENCES: Competence[] = [
  'vitrerie', 'nettoyage industriel', 'autolaveuse', 'désinfection',
  'remise en état', 'nettoyage de bureaux', 'parties communes', 'propreté urbaine',
].map((nom, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, nom, description: null }));

/** Extrait de données France Travail (métiers de la propreté) pour le tableau de tendances. */
export const TENDANCES: TendanceMarche[] = [
  { id: 't1', codeRome: 'K2204', libelleMetier: 'Nettoyage de locaux', region: 'Île-de-France', bassinEmploi: 'Paris', projetsRecrutement: 12000, difficulteRecrutement: 0.62, annee: 2025, importeLe: '2026-09-01T00:00:00Z' },
  { id: 't2', codeRome: 'K2204', libelleMetier: 'Nettoyage de locaux', region: 'Auvergne-Rhône-Alpes', bassinEmploi: 'Lyon', projetsRecrutement: 4500, difficulteRecrutement: 0.55, annee: 2025, importeLe: '2026-09-01T00:00:00Z' },
  { id: 't3', codeRome: 'K2303', libelleMetier: 'Nettoyage des espaces urbains', region: 'Île-de-France', bassinEmploi: 'Paris', projetsRecrutement: 800, difficulteRecrutement: 0.4, annee: 2025, importeLe: '2026-09-01T00:00:00Z' },
  { id: 't4', codeRome: 'K2204', libelleMetier: 'Nettoyage de locaux', region: 'Île-de-France', bassinEmploi: 'Paris', projetsRecrutement: 11000, difficulteRecrutement: 0.6, annee: 2024, importeLe: '2026-09-01T00:00:00Z' },
];

export function createTestApp() {
  const repos: Repositories = {
    users: createMemoryUserRepository(),
    profiles: createMemoryProfileRepository(),
    missions: createMemoryMissionRepository(),
    candidatures: createMemoryCandidatureRepository(),
    communes: createMemoryCommuneRepository(COMMUNES),
    competences: createMemoryCompetenceRepository(COMPETENCES),
    tendances: createMemoryTendanceRepository(TENDANCES),
    matchingLogs: createMemoryMatchingLogRepository(),
  };
  return { app: createApp(repos), repos };
}

/** Insère un compte directement dans le dépôt (équivalent du seed admin en base). */
export async function seedUser(
  repos: Repositories,
  input: { email: string; password: string; role: Role; prenom?: string; nom?: string; raisonSociale?: string; siret?: string },
): Promise<User> {
  const { password, ...rest } = input;
  return repos.users.create({ ...rest, passwordHash: await hashPassword(password) });
}

export async function login(app: ReturnType<typeof createApp>, email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Connexion impossible pour ${email} : ${res.status}`);
  return res.body.token as string;
}
