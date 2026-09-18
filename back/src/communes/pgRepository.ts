import type { Pool } from 'pg';
import type { CommuneRepository } from './repository';

interface CommuneRow {
  code_postal: string;
  nom: string;
  latitude: number;
  longitude: number;
}

export function createPgCommuneRepository(pool: Pool): CommuneRepository {
  return {
    async findByCodePostal(codePostal) {
      const { rows } = await pool.query<CommuneRow>(
        'select code_postal, nom, latitude, longitude from communes where code_postal = $1 order by nom limit 1',
        [codePostal],
      );
      const row = rows[0];
      if (!row) return null;
      return { codePostal: row.code_postal, nom: row.nom, latitude: row.latitude, longitude: row.longitude };
    },
  };
}
