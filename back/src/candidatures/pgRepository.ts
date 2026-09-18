import type { Pool } from 'pg';
import { errorMessage, isUuid } from '../db/pool';
import type { Candidature, CandidatureStatut } from '../types';
import type { CandidatureRepository } from './repository';

interface CandidatureRow {
  id: string;
  mission_id: string;
  interimaire_id: string;
  statut: CandidatureStatut;
  score: number | null;
  justificatif_refus: string | null;
  created_at: string;
  updated_at: string;
}

function toCandidature(row: CandidatureRow): Candidature {
  return {
    id: row.id,
    missionId: row.mission_id,
    interimaireId: row.interimaire_id,
    statut: row.statut,
    score: row.score,
    justificatifRefus: row.justificatif_refus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPgCandidatureRepository(pool: Pool): CandidatureRepository {
  return {
    async create(input) {
      try {
        const { rows } = await pool.query<CandidatureRow>(
          'insert into candidatures (mission_id, interimaire_id, score) values ($1, $2, $3) returning *',
          [input.missionId, input.interimaireId, input.score],
        );
        return toCandidature(rows[0]);
      } catch (err) {
        throw new Error(`Création de la candidature impossible : ${errorMessage(err)}`, { cause: err });
      }
    },

    async findById(id) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query<CandidatureRow>('select * from candidatures where id = $1', [id]);
      return rows[0] ? toCandidature(rows[0]) : null;
    },

    async findByMissionAndInterimaire(missionId, interimaireId) {
      const { rows } = await pool.query<CandidatureRow>(
        'select * from candidatures where mission_id = $1 and interimaire_id = $2',
        [missionId, interimaireId],
      );
      return rows[0] ? toCandidature(rows[0]) : null;
    },

    async listByInterimaire(interimaireId) {
      const { rows } = await pool.query<CandidatureRow>(
        'select * from candidatures where interimaire_id = $1 order by created_at desc',
        [interimaireId],
      );
      return rows.map(toCandidature);
    },

    async listByMissions(missionIds) {
      if (missionIds.length === 0) return [];
      const { rows } = await pool.query<CandidatureRow>(
        'select * from candidatures where mission_id = any($1::uuid[]) order by created_at desc',
        [missionIds],
      );
      return rows.map(toCandidature);
    },

    async updateStatut(id, statut, justificatifRefus) {
      let rows: CandidatureRow[];
      try {
        ({ rows } = await pool.query<CandidatureRow>(
          `update candidatures set statut = $1, justificatif_refus = $2, updated_at = now()
           where id = $3 returning *`,
          [statut, justificatifRefus, id],
        ));
      } catch (err) {
        throw new Error(`Mise à jour de la candidature impossible : ${errorMessage(err)}`, { cause: err });
      }
      if (!rows[0]) throw new Error('Mise à jour de la candidature impossible : candidature introuvable');
      return toCandidature(rows[0]);
    },
  };
}
