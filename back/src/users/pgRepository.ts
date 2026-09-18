import type { Pool } from 'pg';
import { errorMessage, isUuid } from '../db/pool';
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

export function createPgUserRepository(pool: Pool): UserRepository {
  return {
    async findByEmail(email) {
      const { rows } = await pool.query<UserRow>('select * from users where email = $1', [email.toLowerCase()]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    async findById(id) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query<UserRow>('select * from users where id = $1', [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    async findByIds(ids) {
      if (ids.length === 0) return [];
      const { rows } = await pool.query<UserRow>('select * from users where id = any($1::uuid[])', [ids]);
      return rows.map(toUser);
    },

    async create(input: NewUser) {
      try {
        const { rows } = await pool.query<UserRow>(
          `insert into users
             (email, password_hash, role, raison_sociale, siret, prenom, nom, telephone, must_change_password)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           returning *`,
          [
            input.email.toLowerCase(),
            input.passwordHash,
            input.role,
            input.raisonSociale ?? null,
            input.siret ?? null,
            input.prenom ?? null,
            input.nom ?? null,
            input.telephone ?? null,
            input.mustChangePassword ?? false,
          ],
        );
        return toUser(rows[0]);
      } catch (err) {
        throw new Error(`Création de l'utilisateur impossible : ${errorMessage(err)}`, { cause: err });
      }
    },

    async update(id, patch: UserPatch) {
      // Seules les clés présentes dans le patch sont écrites ; updated_at l'est toujours.
      const row: Record<string, unknown> = {};
      if (patch.passwordHash !== undefined) row.password_hash = patch.passwordHash;
      if (patch.mustChangePassword !== undefined) row.must_change_password = patch.mustChangePassword;
      if (patch.isActive !== undefined) row.is_active = patch.isActive;

      const columns = Object.keys(row);
      const values = [...Object.values(row), id];
      const sets = ['updated_at = now()', ...columns.map((column, i) => `${column} = $${i + 1}`)];

      let rows: UserRow[];
      try {
        ({ rows } = await pool.query<UserRow>(
          `update users set ${sets.join(', ')} where id = $${values.length} returning *`,
          values,
        ));
      } catch (err) {
        throw new Error(`Mise à jour de l'utilisateur impossible : ${errorMessage(err)}`, { cause: err });
      }
      if (!rows[0]) throw new Error("Mise à jour de l'utilisateur impossible : utilisateur introuvable");
      return toUser(rows[0]);
    },
  };
}
