import type { SupabaseClient } from '@supabase/supabase-js';
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

export function createSupabaseTendanceRepository(supabase: SupabaseClient): TendanceRepository {
  return {
    async list(filters) {
      let query = supabase.from('donnees_france_travail').select('*');
      if (filters.annee !== undefined) query = query.eq('annee', filters.annee);
      if (filters.codeRome !== undefined) query = query.eq('code_rome', filters.codeRome);
      const { data } = await query.order('projets_recrutement', { ascending: false, nullsFirst: false });
      return ((data ?? []) as TendanceRow[]).map(toTendance);
    },
  };
}
