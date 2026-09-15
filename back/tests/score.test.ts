import { describe, expect, it } from 'vitest';
import {
  computeScore,
  haversineKm,
  isAvailable,
  normalizeKeywords,
  type ExperienceForScore,
  type MissionForScore,
  type ProfileForScore,
} from '../src/matching/score';
import { COMMUNES } from './helpers';

const commune = (cp: string) => COMMUNES.find((c) => c.codePostal === cp)!;

// Mots-clés requis : nettoyage, vitre, autolaveuse, bureau (poids 2 chacun = 8)
// + entretien, quotidien, open, space (poids 1 chacun = 4) → total 12.
const mission: MissionForScore = {
  typeNettoyage: 'Bureaux',
  description: 'Entretien quotidien de bureaux en open space',
  competencesRequises: ['Nettoyage des vitres', 'Autolaveuse'],
  jours: ['LUNDI', 'MARDI'],
  creneau: 'SOIREE',
  codePostal: '75001',
};

const perfectProfile: ProfileForScore = {
  competences: ['nettoyage vitres', 'autolaveuse', 'entretien quotidien', 'open space'],
  typesNettoyage: ['bureaux'],
  joursDisponibles: ['LUNDI', 'MARDI', 'MERCREDI'],
  creneaux: ['SOIREE', 'NUIT'],
  disponible: true,
  rayonKm: 15,
  codePostal: '92100',
};

const recentBureaux: ExperienceForScore = {
  intitule: 'Agent de propreté bureaux',
  typeNettoyage: 'Bureaux',
  dateFin: '2026-06-30',
};

function score(overrides: {
  profile?: Partial<ProfileForScore>;
  experiences?: ExperienceForScore[];
  profileCp?: string | null;
}) {
  const profile = { ...perfectProfile, ...overrides.profile };
  return computeScore({
    mission,
    missionCommune: commune('75001'),
    profile,
    profileCommune: overrides.profileCp === null ? null : commune(overrides.profileCp ?? profile.codePostal!),
    experiences: overrides.experiences ?? [recentBureaux],
  });
}

describe('normalizeKeywords', () => {
  it('met en minuscules, retire accents, ponctuation, mots vides et pluriels simples', () => {
    expect(normalizeKeywords('Nettoyage des Vitres')).toEqual(new Set(['nettoyage', 'vitre']));
    expect(normalizeKeywords(['Propreté', 'Bureaux, locaux'])).toEqual(new Set(['proprete', 'bureau', 'locau']));
  });
});

describe('haversineKm', () => {
  it('donne une distance réaliste entre Paris et Boulogne', () => {
    const d = haversineKm(commune('75001'), commune('92100'));
    expect(d).toBeGreaterThan(7);
    expect(d).toBeLessThan(8.5);
  });
});

describe('computeScore — cas nominal', () => {
  it('donne 100 à un agent qui coche tout : mots-clés, expérience récente du même type, dans le rayon', () => {
    const result = score({});
    expect(result.details).toMatchObject({ motsCles: 50, experiences: 25, localisation: 25 });
    expect(result.total).toBe(100);
    expect(result.details.distanceKm).toBeGreaterThan(7);
  });
});

describe('computeScore — mots-clés (50)', () => {
  it('donne un recouvrement partiel proportionnel', () => {
    // autolaveuse (2) + bureau (2) = 4 sur 12 → 16,7 arrondi à 17.
    const result = score({ profile: { competences: ['autolaveuse'], typesNettoyage: ['bureaux'] } });
    expect(result.details.motsCles).toBe(17);
  });

  it('compte une compétence requise deux fois plus qu’un mot de la description', () => {
    const competence = score({ profile: { competences: ['vitres'], typesNettoyage: [] } });
    const description = score({ profile: { competences: ['entretien'], typesNettoyage: [] } });
    expect(competence.details.motsCles).toBe(8); // 2/12
    expect(description.details.motsCles).toBe(4); // 1/12
  });

  it('donne 0 à un profil vide', () => {
    expect(score({ profile: { competences: [], typesNettoyage: [] } }).details.motsCles).toBe(0);
  });
});

describe('computeScore — dernières missions (25)', () => {
  it('donne 0 sans expérience', () => {
    expect(score({ experiences: [] }).details.experiences).toBe(0);
  });

  it('donne 10 pour des mots-clés communs sans le même type', () => {
    const laveur = { intitule: 'Laveur de vitres', typeNettoyage: 'Vitrerie', dateFin: '2026-06-30' };
    expect(score({ experiences: [laveur] }).details.experiences).toBe(10);
  });

  it('fait peser une expérience ancienne moins qu’une récente', () => {
    const ancienne = [
      { intitule: 'ASH', typeNettoyage: 'Hôpital', dateFin: '2026-05-31' },
      { intitule: 'Agent industriel', typeNettoyage: 'Industrie', dateFin: '2025-12-31' },
      { ...recentBureaux, dateFin: '2024-01-31' }, // 3e plus récente → 60 %
    ];
    expect(score({ experiences: ancienne }).details.experiences).toBe(15);
    expect(score({ experiences: [recentBureaux] }).details.experiences).toBe(25);
  });

  it('considère une expérience sans date de fin comme en cours, donc la plus récente', () => {
    const enCours = { ...recentBureaux, dateFin: null };
    const autre = { intitule: 'ASH', typeNettoyage: 'Hôpital', dateFin: '2026-08-31' };
    expect(score({ experiences: [autre, enCours] }).details.experiences).toBe(25);
  });
});

describe('computeScore — localisation (25)', () => {
  it('donne 25 dans le rayon', () => {
    expect(score({ profile: { codePostal: '92100', rayonKm: 15 } }).details.localisation).toBe(25);
  });

  it('est dégressif entre le rayon et son double', () => {
    // Versailles ≈ 17 km, rayon 15 km → entre 0 et 25 exclus.
    const result = score({ profile: { codePostal: '78000', rayonKm: 15 } });
    expect(result.details.localisation).toBeGreaterThan(0);
    expect(result.details.localisation).toBeLessThan(25);
    expect(result.total).toBeLessThan(100);
  });

  it('donne 0 à un agent hors zone (au-delà du double du rayon)', () => {
    expect(score({ profile: { codePostal: '77000', rayonKm: 15 } }).details.localisation).toBe(0); // Melun ≈ 43 km
    expect(score({ profile: { codePostal: '69001', rayonKm: 50 } }).details.localisation).toBe(0); // Lyon
  });

  it('donne 25 pour un code postal identique même sans coordonnées, sinon 0', () => {
    expect(score({ profile: { codePostal: '75001' }, profileCp: null }).details.localisation).toBe(25);
    const inconnu = score({ profile: { codePostal: '99999' }, profileCp: null });
    expect(inconnu.details.localisation).toBe(0);
    expect(inconnu.details.distanceKm).toBeNull();
  });
});

describe('isAvailable — filtre éliminatoire', () => {
  it('accepte un agent disponible sur les jours et le créneau', () => {
    expect(isAvailable(perfectProfile, mission)).toBe(true);
  });

  it('exclut un agent marqué indisponible', () => {
    expect(isAvailable({ ...perfectProfile, disponible: false }, mission)).toBe(false);
  });

  it('exclut un agent qui ne couvre pas tous les jours ou pas le créneau', () => {
    expect(isAvailable({ ...perfectProfile, joursDisponibles: ['LUNDI'] }, mission)).toBe(false);
    expect(isAvailable({ ...perfectProfile, creneaux: ['MATIN'] }, mission)).toBe(false);
  });

  it('n’exige rien de plus quand la mission ne précise ni jours ni créneau', () => {
    expect(isAvailable({ ...perfectProfile, joursDisponibles: [], creneaux: [] }, { jours: [], creneau: null })).toBe(true);
  });
});
