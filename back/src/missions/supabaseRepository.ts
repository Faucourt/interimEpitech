import type { SupabaseClient } from '@supabase/supabase-js';
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
  remuneration: number | string | null;
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
    // PostgREST peut renvoyer un numeric sous forme de chaîne.
    remuneration: row.remuneration === null ? null : Number(row.remuneration),
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

export function createSupabaseMissionRepository(supabase: SupabaseClient): MissionRepository {
  // Toutes les lectures ignorent les missions supprimées (justificatif renseigné).
  const alive = () => supabase.from('missions').select('*').is('justificatif_suppression', null);

  return {
    async create(entrepriseId, input) {
      const { data, error } = await supabase
        .from('missions')
        .insert({ ...toRow(input), entreprise_id: entrepriseId })
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(`Création de la mission impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toMission(data as MissionRow);
    },

    async findById(id) {
      const { data } = await alive().eq('id', id).maybeSingle();
      return data ? toMission(data as MissionRow) : null;
    },

    async listByEntreprise(entrepriseId) {
      const { data } = await alive().eq('entreprise_id', entrepriseId).order('date_debut');
      return ((data ?? []) as MissionRow[]).map(toMission);
    },

    async listOpen(filters) {
      let query = alive().eq('statut', 'OUVERTE');
      if (filters.typeNettoyage) query = query.ilike('type_nettoyage', `%${filters.typeNettoyage}%`);
      if (filters.codePostal) query = query.like('code_postal', `${filters.codePostal}%`);
      if (filters.dateDebut) query = query.gte('date_debut', filters.dateDebut);
      if (filters.dateFin) query = query.lte('date_fin', filters.dateFin);
      const { data } = await query.order('date_debut');
      return ((data ?? []) as MissionRow[]).map(toMission);
    },

    async update(id, patch) {
      const { data, error } = await supabase
        .from('missions')
        .update({ ...toRow(patch), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(`Mise à jour de la mission impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toMission(data as MissionRow);
    },

    async softDelete(id, justificatif) {
      const { error } = await supabase
        .from('missions')
        .update({ justificatif_suppression: justificatif, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(`Suppression de la mission impossible : ${error.message}`);
    },
  };
}
