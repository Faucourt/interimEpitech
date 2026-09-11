export type Role = 'ENTREPRISE' | 'INTERIMAIRE';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  raisonSociale: string | null;
  siret: string | null;
  prenom: string | null;
  nom: string | null;
  createdAt: string;
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
    createdAt: user.createdAt,
  };
}
