import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { Role, User } from '../types';
import type { NewUser, UserRepository } from './repository';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  raison_sociale: string | null;
  siret: string | null;
  prenom: string | null;
  nom: string | null;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    raisonSociale: row.raison_sociale,
    siret: row.siret,
    prenom: row.prenom,
    nom: row.nom,
    createdAt: row.created_at,
  };
}

export function createSupabaseUserRepository(): UserRepository {
  // Clé service_role : elle contourne le RLS, elle ne doit JAMAIS quitter le serveur.
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

  return {
    async findByEmail(email) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      return data ? toUser(data as UserRow) : null;
    },

    async findById(id) {
      const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      return data ? toUser(data as UserRow) : null;
    },

    async create(input: NewUser) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: input.email.toLowerCase(),
          password_hash: input.passwordHash,
          role: input.role,
          raison_sociale: input.raisonSociale ?? null,
          siret: input.siret ?? null,
          prenom: input.prenom ?? null,
          nom: input.nom ?? null,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(`Création de l'utilisateur impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toUser(data as UserRow);
    },
  };
}
