import type { Pool } from 'pg';
import { errorMessage } from '../db/pool';
import type { NiveauCompetence, ProfilCompetence } from '../types';
import type { CompetenceRepository } from './repository';

interface CompetenceRow {
  id: string;
  nom: string;
  description: string | null;
}

/** Ligne de `interimaire_competences` jointe au référentiel pour récupérer le nom. */
interface ProfilCompetenceRow {
  competence_id: string;
  nom: string;
  niveau: NiveauCompetence;
  annees_experience: number | null;
  validee_le: string | null;
}

const PROFIL_COMPETENCE_SELECT = `
  select ic.competence_id, c.nom, ic.niveau, ic.annees_experience, ic.validee_le
  from interimaire_competences ic
  join competences c on c.id = ic.competence_id
  where ic.profil_id = $1`;

function toProfilCompetence(row: ProfilCompetenceRow): ProfilCompetence {
  return {
    competenceId: row.competence_id,
    nom: row.nom,
    niveau: row.niveau,
    anneesExperience: row.annees_experience,
    valideeLe: row.validee_le,
  };
}

export function createPgCompetenceRepository(pool: Pool): CompetenceRepository {
  async function listByProfil(profilId: string): Promise<ProfilCompetence[]> {
    const { rows } = await pool.query<ProfilCompetenceRow>(PROFIL_COMPETENCE_SELECT, [profilId]);
    return rows.map(toProfilCompetence);
  }

  return {
    async listAll() {
      const { rows } = await pool.query<CompetenceRow>('select id, nom, description from competences order by nom');
      return rows.map((row) => ({ id: row.id, nom: row.nom, description: row.description }));
    },

    listByProfil,

    // Remplacement en deux temps (suppression puis insertion) dans une même transaction : si une
    // insertion échoue, les anciennes lignes de l'agent sont conservées.
    async replaceForProfil(profilId, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query('delete from interimaire_competences where profil_id = $1', [profilId]);
        for (const item of input) {
          await client.query(
            `insert into interimaire_competences (profil_id, competence_id, niveau, annees_experience)
             values ($1, $2, $3, $4)`,
            [profilId, item.competenceId, item.niveau, item.anneesExperience ?? null],
          );
        }
        await client.query('commit');
      } catch (err) {
        await client.query('rollback').catch(() => undefined);
        throw new Error(`Remplacement des compétences impossible : ${errorMessage(err)}`, { cause: err });
      } finally {
        client.release();
      }
      return listByProfil(profilId);
    },
  };
}
