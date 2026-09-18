import type { Pool } from 'pg';
import { errorMessage, isUuid } from '../db/pool';
import type { Creneau, Jour, Mission, MissionStatut } from '../types';
import type { MissionPatch, MissionRepository } from './repository';

interface MissionRow {
  id: string;
  entreprise_id: string;
  intitule: string;
  type_nettoyage: string;
  description: string | null;
  motif: string;
  date_debut: string;
  date_fin: string;
  heure_debut: string | null;
  heure_fin: string | null;
  jours: Jour[];
  creneau: Creneau | null;
  adresse: string | null;
  code_postal: string;
  ville: string;
  competences_requises: string[];
  // numeric(10, 2) : converti en nombre par le type parser de db/pool.ts.
  remuneration: number | null;
  nb_agents: number;
  statut: MissionStatut;
  created_at: string;
  updated_at: string;
}

function toMission(row: MissionRow): Mission {
  return {
    id: row.id,
    entrepriseId: row.entreprise_id,
    intitule: row.intitule,
    typeNettoyage: row.type_nettoyage,
    description: row.description,
    motif: row.motif,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    heureDebut: row.heure_debut,
    heureFin: row.heure_fin,
    jours: row.jours,
    creneau: row.creneau,
    adresse: row.adresse,
    codePostal: row.code_postal,
    ville: row.ville,
    competencesRequises: row.competences_requises,
    remuneration: row.remuneration,
    nbAgents: row.nb_agents,
    statut: row.statut,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// camelCase (API) → snake_case (base). Seules les clés présentes dans le patch sont écrites.
const COLUMNS: Record<keyof MissionPatch, string> = {
  intitule: 'intitule',
  typeNettoyage: 'type_nettoyage',
  description: 'description',
  motif: 'motif',
  dateDebut: 'date_debut',
  dateFin: 'date_fin',
  heureDebut: 'heure_debut',
  heureFin: 'heure_fin',
  jours: 'jours',
  creneau: 'creneau',
  adresse: 'adresse',
  codePostal: 'code_postal',
  ville: 'ville',
  competencesRequises: 'competences_requises',
  remuneration: 'remuneration',
  nbAgents: 'nb_agents',
  statut: 'statut',
};

function toRow(patch: MissionPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(COLUMNS) as [keyof MissionPatch, string][]) {
    if (patch[key] !== undefined) row[column] = patch[key];
  }
  return row;
}

// Toutes les lectures ignorent les missions supprimées (justificatif renseigné).
const ALIVE = 'select * from missions where justificatif_suppression is null';

export function createPgMissionRepository(pool: Pool): MissionRepository {
  return {
    async create(entrepriseId, input) {
      const row = { ...toRow(input), entreprise_id: entrepriseId };
      const columns = Object.keys(row);
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      try {
        const { rows } = await pool.query<MissionRow>(
          `insert into missions (${columns.join(', ')}) values (${placeholders.join(', ')}) returning *`,
          Object.values(row),
        );
        return toMission(rows[0]);
      } catch (err) {
        throw new Error(`Création de la mission impossible : ${errorMessage(err)}`, { cause: err });
      }
    },

    async findById(id) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query<MissionRow>(`${ALIVE} and id = $1`, [id]);
      return rows[0] ? toMission(rows[0]) : null;
    },

    async listByEntreprise(entrepriseId) {
      const { rows } = await pool.query<MissionRow>(`${ALIVE} and entreprise_id = $1 order by date_debut`, [
        entrepriseId,
      ]);
      return rows.map(toMission);
    },

    async listOpen(filters) {
      const where = ["statut = 'OUVERTE'"];
      const values: unknown[] = [];
      if (filters.typeNettoyage) {
        values.push(`%${filters.typeNettoyage}%`);
        where.push(`type_nettoyage ilike $${values.length}`);
      }
      if (filters.codePostal) {
        values.push(`${filters.codePostal}%`);
        where.push(`code_postal like $${values.length}`);
      }
      if (filters.dateDebut) {
        values.push(filters.dateDebut);
        where.push(`date_debut >= $${values.length}`);
      }
      if (filters.dateFin) {
        values.push(filters.dateFin);
        where.push(`date_fin <= $${values.length}`);
      }
      const { rows } = await pool.query<MissionRow>(`${ALIVE} and ${where.join(' and ')} order by date_debut`, values);
      return rows.map(toMission);
    },

    async update(id, patch) {
      const row = toRow(patch);
      const columns = Object.keys(row);
      const values = [...Object.values(row), id];
      const sets = ['updated_at = now()', ...columns.map((column, i) => `${column} = $${i + 1}`)];

      let rows: MissionRow[];
      try {
        ({ rows } = await pool.query<MissionRow>(
          `update missions set ${sets.join(', ')} where id = $${values.length} returning *`,
          values,
        ));
      } catch (err) {
        throw new Error(`Mise à jour de la mission impossible : ${errorMessage(err)}`, { cause: err });
      }
      if (!rows[0]) throw new Error('Mise à jour de la mission impossible : mission introuvable');
      return toMission(rows[0]);
    },

    async softDelete(id, justificatif) {
      try {
        await pool.query('update missions set justificatif_suppression = $1, updated_at = now() where id = $2', [
          justificatif,
          id,
        ]);
      } catch (err) {
        throw new Error(`Suppression de la mission impossible : ${errorMessage(err)}`, { cause: err });
      }
    },
  };
}
