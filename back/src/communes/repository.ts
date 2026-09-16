import type { Commune } from '../types';

/** Coordonnées des communes : sert au critère de localisation du matching (25 pts). */
export interface CommuneRepository {
  /** Plusieurs communes peuvent partager un code postal : on prend la première, elles sont voisines. */
  findByCodePostal(codePostal: string): Promise<Commune | null>;
}
