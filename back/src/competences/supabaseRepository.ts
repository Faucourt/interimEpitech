import type { SupabaseClient } from '@supabase/supabase-js';
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
  niveau: NiveauCompetence;
  annees_experience: number | null;
  validee_le: string | null;
  competences: { nom: string } | null;
}

const PROFIL_COMPETENCE_SELECT = 'competence_id, niveau, annees_experience, validee_le, competences(nom)';

function toProfilCompetence(row: ProfilCompetenceRow): ProfilCompetence {
  return {
    competenceId: row.competence_id,
    nom: row.competences?.nom ?? '',
    niveau: row.niveau,
    anneesExperience: row.annees_experience,
    valideeLe: row.validee_le,
  };
}

export function createSupabaseCompetenceRepository(supabase: SupabaseClient): CompetenceRepository {
  async function listByProfil(profilId: string): Promise<ProfilCompetence[]> {
    const { data } = await supabase
      .from('interimaire_competences')
      .select(PROFIL_COMPETENCE_SELECT)
      .eq('profil_id', profilId);
    return ((data ?? []) as unknown as ProfilCompetenceRow[]).map(toProfilCompetence);
  }

  return {
    async listAll() {
      const { data } = await supabase.from('competences').select('*').order('nom');
      return ((data ?? []) as CompetenceRow[]).map((row) => ({
        id: row.id,
        nom: row.nom,
        description: row.description,
      }));
    },

    listByProfil,

    // Remplacement en deux temps (suppression puis insertion) : suffisant pour un POC, l'agent
    // est le seul à écrire sur ses propres lignes.
    async replaceForProfil(profilId, input) {
      const { error: deleteError } = await supabase.from('interimaire_competences').delete().eq('profil_id', profilId);
      if (deleteError) {
        throw new Error(`Remplacement des compétences impossible : ${deleteError.message}`);
      }
      if (input.length > 0) {
        const { error } = await supabase.from('interimaire_competences').insert(
          input.map((item) => ({
            profil_id: profilId,
            competence_id: item.competenceId,
            niveau: item.niveau,
            annees_experience: item.anneesExperience ?? null,
          })),
        );
        if (error) {
          throw new Error(`Remplacement des compétences impossible : ${error.message}`);
        }
      }
      return listByProfil(profilId);
    },
  };
}
