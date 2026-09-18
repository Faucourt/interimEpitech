/**
 * Tests du nettoyage des offres France Travail : fonctions pures de src/franceTravail/clean.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateOffers,
  cleanOffer,
  cleanOffers,
  dedupeOffers,
  departementFromCodeInsee,
  departementFromCodePostal,
  departementFromLibelle,
  normalizeJobTitle,
  parseOfferDate,
  resolveDepartement,
  type CleanOffer,
  type RawOffre,
} from '../src/franceTravail/clean';

// Offre minimale valide, forme de /offres/search.
const RAW: RawOffre = {
  id: '190XYZK',
  intitule: 'Agent de propreté (H/F)',
  dateCreation: '2025-06-25T08:30:00.000Z',
  romeCode: 'K2204',
  romeLibelle: 'Nettoyage de locaux',
  nombrePostes: 2,
  entreprise: { nom: 'CleanCo' },
  lieuTravail: { libelle: '75 - PARIS 12', codePostal: '75012', commune: '75112' },
};

/** Offre nettoyée de référence, surchargeable champ par champ. */
const offer = (overrides: Partial<CleanOffer> = {}): CleanOffer => ({
  id: '1',
  intitule: 'Agent de propreté',
  codeRome: 'K2204',
  libelleMetier: 'Nettoyage de locaux',
  departement: '75',
  bassinEmploi: '75 - Paris',
  region: 'Île-de-France',
  entreprise: 'CleanCo',
  nombrePostes: 1,
  dateCreation: new Date('2025-06-25T08:30:00.000Z'),
  annee: 2025,
  ...overrides,
});

describe('normalizeJobTitle', () => {
  it('retire les mentions de genre sous leurs différentes formes', () => {
    expect(normalizeJobTitle('Agent de propreté (H/F)')).toBe('Agent de propreté');
    expect(normalizeJobTitle("Agent d'entretien H/F")).toBe("Agent d'entretien");
    expect(normalizeJobTitle('F/H - Laveur de vitres')).toBe('Laveur de vitres');
    expect(normalizeJobTitle('Agent de service h-f')).toBe('Agent de service');
  });

  it('normalise les espaces et passe un intitulé tout en majuscules en casse de phrase', () => {
    expect(normalizeJobTitle('  AGENT   DE NETTOYAGE  ')).toBe('Agent de nettoyage');
    expect(normalizeJobTitle('Agent ASP (H/F)')).toBe('Agent ASP');
  });

  it('épargne les mots contenant h, f ou m autour d’un tiret', () => {
    expect(normalizeJobTitle('Chef-fromager')).toBe('Chef-fromager');
  });

  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(normalizeJobTitle('(H/F)')).toBe('');
    expect(normalizeJobTitle(undefined)).toBe('');
  });
});

describe('parseOfferDate', () => {
  it('lit l’ISO 8601 de l’API et le JJ/MM/AAAA des exports tableur', () => {
    expect(parseOfferDate('2025-03-15T10:20:30.000Z')?.toISOString()).toBe('2025-03-15T10:20:30.000Z');
    expect(parseOfferDate('15/03/2025')?.toISOString()).toBe('2025-03-15T00:00:00.000Z');
  });

  it('rejette les dates invalides, y compris un 31 février', () => {
    expect(parseOfferDate('31/02/2025')).toBeNull();
    expect(parseOfferDate('2025-13-45')).toBeNull();
    expect(parseOfferDate('hier')).toBeNull();
    expect(parseOfferDate('')).toBeNull();
    expect(parseOfferDate(undefined)).toBeNull();
  });
});

describe('conversion des lieux en département', () => {
  it('depuis un code postal, Corse et outre-mer compris', () => {
    expect(departementFromCodePostal('75012')).toBe('75');
    expect(departementFromCodePostal('1400')).toBe('01');
    expect(departementFromCodePostal('20000')).toBe('2A');
    expect(departementFromCodePostal('20200')).toBe('2B');
    expect(departementFromCodePostal('97400')).toBe('974');
    expect(departementFromCodePostal('abc')).toBeNull();
  });

  it('depuis un code INSEE', () => {
    expect(departementFromCodeInsee('75112')).toBe('75');
    expect(departementFromCodeInsee('2a004')).toBe('2A');
    expect(departementFromCodeInsee('97101')).toBe('971');
    expect(departementFromCodeInsee('7511')).toBeNull();
  });

  it('depuis le libellé « NN - VILLE »', () => {
    expect(departementFromLibelle('75 - PARIS 12')).toBe('75');
    expect(departementFromLibelle('2A - AJACCIO')).toBe('2A');
    expect(departementFromLibelle('974 - ST DENIS')).toBe('974');
    expect(departementFromLibelle('Paris')).toBeNull();
  });

  it('resolveDepartement : code postal en priorité, puis INSEE, puis libellé, rattaché à sa région', () => {
    expect(resolveDepartement(RAW.lieuTravail)).toEqual({ code: '75', nom: 'Paris', region: 'Île-de-France' });
    expect(resolveDepartement({ commune: '94080' })?.nom).toBe('Val-de-Marne');
    expect(resolveDepartement({ libelle: '94 - VINCENNES' })?.nom).toBe('Val-de-Marne');
    expect(resolveDepartement({ codePostal: '99999' })).toBeNull();
    expect(resolveDepartement(null)).toBeNull();
  });
});

describe('cleanOffer', () => {
  it('produit une offre normalisée (intitulé, code ROME, lieu, date, année)', () => {
    const { offer: cleaned, reason } = cleanOffer({ ...RAW, romeCode: ' k2204 ' });
    expect(reason).toBeNull();
    expect(cleaned).toMatchObject({
      id: '190XYZK',
      intitule: 'Agent de propreté',
      codeRome: 'K2204',
      libelleMetier: 'Nettoyage de locaux',
      departement: '75',
      bassinEmploi: '75 - Paris',
      region: 'Île-de-France',
      entreprise: 'CleanCo',
      nombrePostes: 2,
      annee: 2025,
    });
  });

  it('applique des valeurs par défaut sûres', () => {
    const { offer: cleaned } = cleanOffer({ ...RAW, nombrePostes: undefined, entreprise: null, romeLibelle: undefined });
    expect(cleaned).toMatchObject({ nombrePostes: 1, entreprise: null, libelleMetier: 'Agent de propreté' });
  });

  it('renvoie le motif de rejet adapté', () => {
    expect(cleanOffer({ ...RAW, id: ' ' }).reason).toBe('sans_identifiant');
    expect(cleanOffer({ ...RAW, intitule: '(H/F)' }).reason).toBe('sans_intitule');
    expect(cleanOffer({ ...RAW, romeCode: 'K22' }).reason).toBe('sans_code_rome');
    expect(cleanOffer({ ...RAW, dateCreation: '31/02/2025' }).reason).toBe('date_invalide');
    expect(cleanOffer({ ...RAW, lieuTravail: { libelle: 'France entière' } }).reason).toBe('lieu_inconnu');
  });
});

describe('dedupeOffers', () => {
  it('supprime les doublons d’identifiant', () => {
    const { offers, removed } = dedupeOffers([offer(), offer({ intitule: 'Autre' })]);
    expect(removed).toBe(1);
    expect(offers.map((o) => o.intitule)).toEqual(['Agent de propreté']);
  });

  it('supprime une republication : même intitulé, entreprise, département et jour', () => {
    const republished = offer({ id: '2', intitule: 'AGENT DE PROPRETÉ', dateCreation: new Date('2025-06-25T18:00:00.000Z') });
    const { offers, removed } = dedupeOffers([offer(), republished]);
    expect(removed).toBe(1);
    expect(offers.map((o) => o.id)).toEqual(['1']);
  });

  it('garde deux offres anonymes identiques : deux employeurs distincts sont possibles', () => {
    const { offers, removed } = dedupeOffers([offer({ entreprise: null }), offer({ id: '2', entreprise: null })]);
    expect(removed).toBe(0);
    expect(offers).toHaveLength(2);
  });
});

describe('aggregateOffers', () => {
  const now = new Date('2025-06-30T00:00:00.000Z');

  it('agrège par (code ROME, région, département, année) et calcule la part d’offres anciennes', () => {
    const rows = aggregateOffers(
      [
        offer(),
        offer({ id: '2', nombrePostes: 3, dateCreation: new Date('2025-05-01T00:00:00.000Z') }),
        offer({ id: '3', departement: '94', bassinEmploi: '94 - Val-de-Marne' }),
      ],
      now,
    );
    expect(rows).toEqual([
      {
        code_rome: 'K2204', libelle_metier: 'Nettoyage de locaux', region: 'Île-de-France', bassin_emploi: '75 - Paris',
        projets_recrutement: 4, difficulte_recrutement: 0.5, annee: 2025,
      },
      {
        code_rome: 'K2204', libelle_metier: 'Nettoyage de locaux', region: 'Île-de-France', bassin_emploi: '94 - Val-de-Marne',
        projets_recrutement: 1, difficulte_recrutement: 0, annee: 2025,
      },
    ]);
  });

  it('sépare les années', () => {
    const rows = aggregateOffers([offer(), offer({ id: '2', annee: 2024, dateCreation: new Date('2024-06-25T00:00:00.000Z') })], now);
    expect(rows.map((r) => r.annee).sort()).toEqual([2024, 2025]);
  });
});

describe('cleanOffers (chaîne complète)', () => {
  it('nettoie, dédoublonne, agrège et compte les rejets par motif', () => {
    const report = cleanOffers(
      [RAW, RAW, { ...RAW, id: 'X', dateCreation: 'n/a' }, { ...RAW, id: 'Y', lieuTravail: null }],
      new Date('2025-06-30T00:00:00.000Z'),
    );
    expect(report.offers.map((o) => o.id)).toEqual(['190XYZK']);
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.rejectedByReason).toEqual({
      sans_identifiant: 0, sans_intitule: 0, sans_code_rome: 0, date_invalide: 1, lieu_inconnu: 1,
    });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ bassin_emploi: '75 - Paris', projets_recrutement: 2, annee: 2025 });
  });
});
