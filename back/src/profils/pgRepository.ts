import type { Pool } from 'pg';
import { errorMessage, isUuid } from '../db/pool';
import type { Creneau, Experience, Jour, Profile } from '../types';
import type { ProfileRepository } from './repository';

interface ProfileRow {
  user_id: string;
  competences: string[];
  types_nettoyage: string[];
  code_postal: string | null;
  ville: string | null;
  rayon_km: number;
  jours_disponibles: Jour[];
  creneaux: Creneau[];
  disponible: boolean;
  created_at: string;
  updated_at: string;
}

interface ExperienceRow {
  id: string;
  user_id: string;
  intitule: string;
  type_nettoyage: string | null;
  entreprise: string | null;
  ville: string | null;
  date_debut: string | null;
  date_fin: string | null;
  source: Experience['source'];
  created_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    competences: row.competences,
    typesNettoyage: row.types_nettoyage,
    codePostal: row.code_postal,
    ville: row.ville,
    rayonKm: row.rayon_km,
    joursDisponibles: row.jours_disponibles,
    creneaux: row.creneaux,
    disponible: row.disponible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toExperience(row: ExperienceRow): Experience {
  return {
    id: row.id,
    userId: row.user_id,
    intitule: row.intitule,
    typeNettoyage: row.type_nettoyage,
    entreprise: row.entreprise,
    ville: row.ville,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function createPgProfileRepository(pool: Pool): ProfileRepository {
  return {
    async findByUserId(userId) {
      const { rows } = await pool.query<ProfileRow>('select * from interimaire_profiles where user_id = $1', [userId]);
      return rows[0] ? toProfile(rows[0]) : null;
    },

    // Création ou remplacement en une requête : la clé primaire user_id porte le conflit.
    async upsert(userId, input) {
      try {
        const { rows } = await pool.query<ProfileRow>(
          `insert into interimaire_profiles
             (user_id, competences, types_nettoyage, code_postal, ville, rayon_km, jours_disponibles, creneaux, disponible)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (user_id) do update set
             competences = excluded.competences,
             types_nettoyage = excluded.types_nettoyage,
             code_postal = excluded.code_postal,
             ville = excluded.ville,
             rayon_km = excluded.rayon_km,
             jours_disponibles = excluded.jours_disponibles,
             creneaux = excluded.creneaux,
             disponible = excluded.disponible,
             updated_at = now()
           returning *`,
          [
            userId,
            input.competences,
            input.typesNettoyage,
            input.codePostal,
            input.ville,
            input.rayonKm,
            input.joursDisponibles,
            input.creneaux,
            input.disponible,
          ],
        );
        return toProfile(rows[0]);
      } catch (err) {
        throw new Error(`Enregistrement du profil impossible : ${errorMessage(err)}`, { cause: err });
      }
    },

    async listAvailable() {
      const { rows } = await pool.query<ProfileRow>('select * from interimaire_profiles where disponible = true');
      return rows.map(toProfile);
    },

    async listExperiences(userId) {
      const { rows } = await pool.query<ExperienceRow>(
        'select * from experiences where user_id = $1 order by date_fin desc nulls first',
        [userId],
      );
      return rows.map(toExperience);
    },

    async addExperience(input) {
      try {
        const { rows } = await pool.query<ExperienceRow>(
          `insert into experiences (user_id, intitule, type_nettoyage, entreprise, ville, date_debut, date_fin, source)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning *`,
          [
            input.userId,
            input.intitule,
            input.typeNettoyage ?? null,
            input.entreprise ?? null,
            input.ville ?? null,
            input.dateDebut ?? null,
            input.dateFin ?? null,
            input.source ?? 'DECLAREE',
          ],
        );
        return toExperience(rows[0]);
      } catch (err) {
        throw new Error(`Ajout de l'expérience impossible : ${errorMessage(err)}`, { cause: err });
      }
    },

    async deleteExperience(id, userId) {
      if (!isUuid(id)) return false;
      const { rowCount } = await pool.query('delete from experiences where id = $1 and user_id = $2', [id, userId]);
      return (rowCount ?? 0) > 0;
    },
  };
}
