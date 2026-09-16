import type { SupabaseClient } from '@supabase/supabase-js';
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

export function createSupabaseCandidatureRepository(supabase: SupabaseClient): CandidatureRepository {
  return {
    async create(input) {
      const { data, error } = await supabase
        .from('candidatures')
        .insert({ mission_id: input.missionId, interimaire_id: input.interimaireId, score: input.score })
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(`Création de la candidature impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toCandidature(data as CandidatureRow);
    },

    async findById(id) {
      const { data } = await supabase.from('candidatures').select('*').eq('id', id).maybeSingle();
      return data ? toCandidature(data as CandidatureRow) : null;
    },

    async findByMissionAndInterimaire(missionId, interimaireId) {
      const { data } = await supabase
        .from('candidatures')
        .select('*')
        .eq('mission_id', missionId)
        .eq('interimaire_id', interimaireId)
        .maybeSingle();
      return data ? toCandidature(data as CandidatureRow) : null;
    },

    async listByInterimaire(interimaireId) {
      const { data } = await supabase
        .from('candidatures')
        .select('*')
        .eq('interimaire_id', interimaireId)
        .order('created_at', { ascending: false });
      return ((data ?? []) as CandidatureRow[]).map(toCandidature);
    },

    async listByMissions(missionIds) {
      if (missionIds.length === 0) return [];
      const { data } = await supabase
        .from('candidatures')
        .select('*')
        .in('mission_id', missionIds)
        .order('created_at', { ascending: false });
      return ((data ?? []) as CandidatureRow[]).map(toCandidature);
    },

    async updateStatut(id, statut, justificatifRefus) {
      const { data, error } = await supabase
        .from('candidatures')
        .update({ statut, justificatif_refus: justificatifRefus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(`Mise à jour de la candidature impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toCandidature(data as CandidatureRow);
    },
  };
}
