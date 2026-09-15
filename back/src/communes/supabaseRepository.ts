import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommuneRepository } from './repository';

interface CommuneRow {
  code_postal: string;
  nom: string;
  latitude: number;
  longitude: number;
}

export function createSupabaseCommuneRepository(supabase: SupabaseClient): CommuneRepository {
  return {
    async findByCodePostal(codePostal) {
      const { data } = await supabase
        .from('communes')
        .select('*')
        .eq('code_postal', codePostal)
        .order('nom')
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const row = data as CommuneRow;
      return { codePostal: row.code_postal, nom: row.nom, latitude: row.latitude, longitude: row.longitude };
    },
  };
}
