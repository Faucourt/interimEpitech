import type { Role, User } from '../types';

export interface NewUser {
  email: string;
  passwordHash: string;
  role: Role;
  raisonSociale?: string | null;
  siret?: string | null;
  prenom?: string | null;
  nom?: string | null;
}

/**
 * Toute la persistance passe par cette interface. Le reste du code ne connaît
 * pas Supabase : c'est ce qui permet de tester l'API sans base de données.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: NewUser): Promise<User>;
}
