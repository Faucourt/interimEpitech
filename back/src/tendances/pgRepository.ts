import type { Pool } from 'pg';
import type { TendanceMarche } from '../types';
import type { TendanceRepository } from './repository';

interface TendanceRow {
  id: string;
  code_rome: string;
  libelle_metier: string;
  region: string | null;
  bassin_emploi: string | null;
  projets_recrutement: number | null;
  difficulte_recrutement: number | null;
  annee: number;
  importe_le: string;
}

function toTendance(row: TendanceRow): TendanceMarche {
  return {
    id: row.id,
    codeRome: row.code_rome,
    libelleMetier: row.libelle_metier,
    region: row.region,
    bassinEmploi: row.bassin_emploi,
    projetsRecrutement: row.projets_recrutement,
    difficulteRecrutement: row.difficulte_recrutement,
    annee: row.annee,
    importeLe: row.importe_le,
  };
}

export function createPgTendanceRepository(pool: Pool): TendanceRepository {
  return {
    async list(filters) {
      const where: string[] = [];
      const values: unknown[] = [];
      if (filters.annee !== undefined) {
        values.push(filters.annee);
        where.push(`annee = $${values.length}`);
      }
      if (filters.codeRome !== undefined) {
        values.push(filters.codeRome);
        where.push(`code_rome = $${values.length}`);
      }
      const { rows } = await pool.query<TendanceRow>(
        `select * from donnees_france_travail
         ${where.length > 0 ? `where ${where.join(' and ')}` : ''}
         order by projets_recrutement desc nulls last`,
        values,
      );
      return rows.map(toTendance);
    },
  };
}
