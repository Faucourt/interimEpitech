import axios from 'axios';
import apiClient, { clearToken, setToken } from './client';

// Ce fichier reflète le contrat de back/src/auth/{routes,schemas}.ts et back/src/types.ts.
// Toute évolution du back (nouveau champ, nouvelle règle de validation) doit être répercutée ici.

export type Role = 'ENTREPRISE' | 'INTERIMAIRE';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  raisonSociale: string | null;
  siret: string | null;
  prenom: string | null;
  nom: string | null;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: PublicUser;
}

export interface RegisterEntreprisePayload {
  email: string;
  password: string;
  role: 'ENTREPRISE';
  raisonSociale: string;
  siret: string;
}

export interface RegisterInterimairePayload {
  email: string;
  password: string;
  role: 'INTERIMAIRE';
  prenom: string;
  nom: string;
}

export type RegisterPayload = RegisterEntreprisePayload | RegisterInterimairePayload;

export interface LoginPayload {
  email: string;
  password: string;
}

interface ApiErrorResponse {
  error: string;
  details?: { path: string; message: string }[];
}

export async function register(payload: RegisterPayload): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>('/api/auth/register', payload);
  setToken(data.token);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>('/api/auth/login', payload);
  setToken(data.token);
  return data;
}

export async function fetchCurrentUser(): Promise<PublicUser> {
  const { data } = await apiClient.get<{ user: PublicUser }>('/api/auth/me');
  return data.user;
}

export function logout(): void {
  clearToken();
}

// Extrait le message d'erreur renvoyé par l'API (ex: "Email ou mot de passe incorrect"),
// ou retombe sur un message générique pour les erreurs réseau / inattendues.
export function getApiErrorMessage(error: unknown, fallback = 'Une erreur est survenue'): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data.error ?? fallback;
  }
  return fallback;
}
