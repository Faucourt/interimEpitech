import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role, User } from '../types';
import type { NewUser, UserPatch, UserRepository } from './repository';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  raison_sociale: string | null;
  siret: string | null;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
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
    telephone: row.telephone,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseUserRepository(supabase: SupabaseClient): UserRepository {
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

    async findByIds(ids) {
      if (ids.length === 0) return [];
      const { data } = await supabase.from('users').select('*').in('id', ids);
      return ((data ?? []) as UserRow[]).map(toUser);
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
          telephone: input.telephone ?? null,
          must_change_password: input.mustChangePassword ?? false,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(`Création de l'utilisateur impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toUser(data as UserRow);
    },

    async update(id, patch: UserPatch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.passwordHash !== undefined) row.password_hash = patch.passwordHash;
      if (patch.mustChangePassword !== undefined) row.must_change_password = patch.mustChangePassword;
      if (patch.isActive !== undefined) row.is_active = patch.isActive;

      const { data, error } = await supabase.from('users').update(row).eq('id', id).select('*').single();
      if (error || !data) {
        throw new Error(`Mise à jour de l'utilisateur impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toUser(data as UserRow);
    },
  };
}
