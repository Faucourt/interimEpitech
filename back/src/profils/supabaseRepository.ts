import type { SupabaseClient } from '@supabase/supabase-js';
import type { Creneau, Experience, Jour, Profile } from '../types';
import type { ProfileInput, ProfileRepository } from './repository';

interface ProfileRow {
  user_id: string;
  competences: string[];
  types_nettoyage: string[];
  code_postal: string | null;
  ville: string | null;
  rayon_km: number;
  jours_disponibles: Jour[];
  creneaux: Creneau[];
  disponible: boolean;
  created_at: string;
  updated_at: string;
}

interface ExperienceRow {
  id: string;
  user_id: string;
  intitule: string;
  type_nettoyage: string | null;
  entreprise: string | null;
  ville: string | null;
  date_debut: string | null;
  date_fin: string | null;
  source: Experience['source'];
  created_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    competences: row.competences,
    typesNettoyage: row.types_nettoyage,
    codePostal: row.code_postal,
    ville: row.ville,
    rayonKm: row.rayon_km,
    joursDisponibles: row.jours_disponibles,
    creneaux: row.creneaux,
    disponible: row.disponible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProfileRow(userId: string, input: ProfileInput) {
  return {
    user_id: userId,
    competences: input.competences,
    types_nettoyage: input.typesNettoyage,
    code_postal: input.codePostal,
    ville: input.ville,
    rayon_km: input.rayonKm,
    jours_disponibles: input.joursDisponibles,
    creneaux: input.creneaux,
    disponible: input.disponible,
    updated_at: new Date().toISOString(),
  };
}

function toExperience(row: ExperienceRow): Experience {
  return {
    id: row.id,
    userId: row.user_id,
    intitule: row.intitule,
    typeNettoyage: row.type_nettoyage,
    entreprise: row.entreprise,
    ville: row.ville,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function createSupabaseProfileRepository(supabase: SupabaseClient): ProfileRepository {
  return {
    async findByUserId(userId) {
      const { data } = await supabase
        .from('interimaire_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return data ? toProfile(data as ProfileRow) : null;
    },

    async upsert(userId, input) {
      const { data, error } = await supabase
        .from('interimaire_profiles')
        .upsert(toProfileRow(userId, input), { onConflict: 'user_id' })
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(`Enregistrement du profil impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toProfile(data as ProfileRow);
    },

    async listAvailable() {
      const { data } = await supabase.from('interimaire_profiles').select('*').eq('disponible', true);
      return ((data ?? []) as ProfileRow[]).map(toProfile);
    },

    async listExperiences(userId) {
      const { data } = await supabase
        .from('experiences')
        .select('*')
        .eq('user_id', userId)
        .order('date_fin', { ascending: false, nullsFirst: true });
      return ((data ?? []) as ExperienceRow[]).map(toExperience);
    },

    async addExperience(input) {
      const { data, error } = await supabase
        .from('experiences')
        .insert({
          user_id: input.userId,
          intitule: input.intitule,
          type_nettoyage: input.typeNettoyage ?? null,
          entreprise: input.entreprise ?? null,
          ville: input.ville ?? null,
          date_debut: input.dateDebut ?? null,
          date_fin: input.dateFin ?? null,
          source: input.source ?? 'DECLAREE',
        })
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(`Ajout de l'expérience impossible : ${error?.message ?? 'inconnue'}`);
      }
      return toExperience(data as ExperienceRow);
    },

    async deleteExperience(id, userId) {
      const { data } = await supabase
        .from('experiences')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id');
      return (data ?? []).length > 0;
    },
  };
}
