/**
 * Tests du nettoyage des communes (geo.api.gouv.fr) : fonctions pures de src/cli/communes/clean.ts.
 * Les fixtures reprennent la forme exacte renvoyée par l'API avec `fields=nom,codesPostaux,centre`.
 */
import { describe, expect, it } from 'vitest';
import {
  cleanCommune,
  cleanCommunes,
  dedupeRows,
  mergeArrondissements,
  normalizeCodePostal,
  normalizeName,
  parentCityName,
  type CommuneRow,
  type RawCommune,
} from '../../src/cli/communes/clean';

// Réponses réelles de l'API (septembre 2025), tronquées aux champs utiles.
const PARIS: RawCommune = {
  nom: 'Paris',
  code: '75056',
  codesPostaux: ['75001', '75002', '75003', '75004', '75005', '75006', '75007', '75008', '75009', '75010', '75011',
    '75012', '75013', '75014', '75015', '75016', '75017', '75018', '75019', '75020', '75116'],
  centre: { type: 'Point', coordinates: [2.347, 48.8589] },
};
const PARIS_12: RawCommune = {
  nom: 'Paris 12e Arrondissement',
  code: '75112',
  codesPostaux: ['75012'],
  centre: { type: 'Point', coordinates: [2.4173, 48.8342] },
};
const VINCENNES: RawCommune = {
  nom: 'Vincennes',
  code: '94080',
  codesPostaux: ['94300'],
  centre: { type: 'Point', coordinates: [2.4383, 48.8471] },
};

const row = (code_postal: string, nom: string, latitude = 48, longitude = 2): CommuneRow => ({
  code_postal, nom, latitude, longitude,
});

describe('normalizeName', () => {
  it('normalise les espaces et la forme Unicode', () => {
    expect(normalizeName('  Saint   Denis ')).toBe('Saint Denis');
    expect(normalizeName('Orléans')).toBe('Orléans');
  });

  it('remet en casse française un nom tout en majuscules, particules comprises', () => {
    expect(normalizeName('SAINT-DENIS')).toBe('Saint-Denis');
    expect(normalizeName("L'ABERGEMENT-DE-VAREY")).toBe("L'Abergement-de-Varey");
  });

  it('ne touche ni aux noms déjà propres ni aux noms d’une lettre', () => {
    expect(normalizeName('Paris 12e Arrondissement')).toBe('Paris 12e Arrondissement');
    expect(normalizeName('Y')).toBe('Y');
    expect(normalizeName(null)).toBe('');
  });
});

describe('normalizeCodePostal', () => {
  it('accepte 5 chiffres et restaure le zéro initial perdu', () => {
    expect(normalizeCodePostal('75012')).toBe('75012');
    expect(normalizeCodePostal('1400')).toBe('01400');
    expect(normalizeCodePostal(1400)).toBe('01400');
  });

  it('rejette les valeurs inexploitables', () => {
    expect(normalizeCodePostal('ABCDE')).toBeNull();
    expect(normalizeCodePostal('750')).toBeNull();
    expect(normalizeCodePostal('')).toBeNull();
    expect(normalizeCodePostal(null)).toBeNull();
  });
});

describe('cleanCommune', () => {
  it('éclate une commune à plusieurs codes postaux en une ligne par couple (code postal, nom)', () => {
    const { rows, reason } = cleanCommune(PARIS);
    expect(reason).toBeNull();
    expect(rows).toHaveLength(21);
    expect(rows.map((r) => r.code_postal)).toEqual(PARIS.codesPostaux);
    expect(new Set(rows.map((r) => r.nom))).toEqual(new Set(['Paris']));
  });

  it('convertit le GeoJSON [longitude, latitude] en colonnes latitude / longitude', () => {
    const { rows } = cleanCommune(VINCENNES);
    expect(rows[0]).toEqual({ code_postal: '94300', nom: 'Vincennes', latitude: 48.8471, longitude: 2.4383 });
  });

  it('dédoublonne et normalise les codes postaux d’une même commune', () => {
    const { rows } = cleanCommune({ ...VINCENNES, codesPostaux: ['94300', '94300', 'xxxxx'] });
    expect(rows.map((r) => r.code_postal)).toEqual(['94300']);
  });

  it('écarte les entrées sans nom, sans code postal ou sans coordonnées', () => {
    expect(cleanCommune({ ...VINCENNES, nom: '   ' })).toEqual({ rows: [], reason: 'sans_nom' });
    expect(cleanCommune({ ...VINCENNES, codesPostaux: [] })).toEqual({ rows: [], reason: 'sans_code_postal' });
    expect(cleanCommune({ ...VINCENNES, codesPostaux: null })).toEqual({ rows: [], reason: 'sans_code_postal' });
    expect(cleanCommune({ ...VINCENNES, centre: null })).toEqual({ rows: [], reason: 'sans_coordonnees' });
    expect(cleanCommune({ ...VINCENNES, centre: { type: 'Point', coordinates: [2.4383] } })).toEqual({
      rows: [], reason: 'sans_coordonnees',
    });
  });

  it('écarte les coordonnées non numériques ou hors plage', () => {
    expect(cleanCommune({ ...VINCENNES, centre: { coordinates: ['2.4383', '48.8471'] } }).reason).toBe('coordonnees_invalides');
    // Une inversion lon/lat sur une longitude > 90 est détectée par la borne de latitude.
    expect(cleanCommune({ ...VINCENNES, centre: { coordinates: [48.8471, 120] } }).reason).toBe('coordonnees_invalides');
    expect(cleanCommune({ ...VINCENNES, centre: { coordinates: [200, 48.8471] } }).reason).toBe('coordonnees_invalides');
    expect(cleanCommune({ ...VINCENNES, centre: { coordinates: [Number.NaN, 48.8471] } }).reason).toBe('coordonnees_invalides');
  });
});

describe('dedupeRows', () => {
  it('garde la première occurrence de chaque couple (code_postal, nom)', () => {
    const first = row('94300', 'Vincennes', 48.8471, 2.4383);
    const duplicate = row('94300', 'Vincennes', 0, 0);
    const { rows, removed } = dedupeRows([first, row('75012', 'Paris'), duplicate]);
    expect(removed).toBe(1);
    expect(rows).toEqual([first, row('75012', 'Paris')]);
  });

  it('distingue deux communes qui partagent un code postal', () => {
    const { rows, removed } = dedupeRows([row('01400', 'Châtillon-sur-Chalaronne'), row('01400', "L'Abergement-Clémenciat")]);
    expect(removed).toBe(0);
    expect(rows).toHaveLength(2);
  });
});

describe('parentCityName', () => {
  it('retrouve la commune globale d’un arrondissement municipal', () => {
    expect(parentCityName('Paris 12e Arrondissement')).toBe('Paris');
    expect(parentCityName('Lyon 1er Arrondissement')).toBe('Lyon');
    expect(parentCityName('Marseille 16e Arrondissement')).toBe('Marseille');
  });

  it('renvoie null pour une commune ordinaire', () => {
    expect(parentCityName('Vincennes')).toBeNull();
    expect(parentCityName('Paris')).toBeNull();
  });
});

describe('mergeArrondissements', () => {
  it('retire la commune globale uniquement sur les codes postaux couverts par un arrondissement', () => {
    const communes = [row('75012', 'Paris'), row('75001', 'Paris'), row('94300', 'Vincennes'), row('75012', 'Autre')];
    const paris12 = row('75012', 'Paris 12e Arrondissement', 48.8342, 2.4173);
    const { rows, overridden } = mergeArrondissements(communes, [paris12]);
    expect(overridden).toBe(1);
    expect(rows).toEqual([row('75001', 'Paris'), row('94300', 'Vincennes'), row('75012', 'Autre'), paris12]);
  });

  it('laisse tout en place sans arrondissement', () => {
    const communes = [row('75012', 'Paris'), row('94300', 'Vincennes')];
    expect(mergeArrondissements(communes, [])).toEqual({ rows: communes, overridden: 0 });
  });
});

describe('cleanCommunes (chaîne complète)', () => {
  it('donne « Paris 12e Arrondissement » pour 75012, avec ses propres coordonnées', () => {
    const report = cleanCommunes([PARIS, VINCENNES], [PARIS_12]);
    const at75012 = report.rows.filter((r) => r.code_postal === '75012');
    expect(at75012).toEqual([
      { code_postal: '75012', nom: 'Paris 12e Arrondissement', latitude: 48.8342, longitude: 2.4173 },
    ]);
    // Même requête que le back : première commune du code postal par ordre alphabétique.
    const [firstByName] = [...at75012].sort((a, b) => a.nom.localeCompare(b.nom));
    expect(firstByName.nom).toBe('Paris 12e Arrondissement');
    // Le centre de Paris 12e est bien distinct de celui de Vincennes (distance non nulle attendue).
    const vincennes = report.rows.find((r) => r.code_postal === '94300');
    expect(vincennes?.latitude).not.toBe(firstByName.latitude);
  });

  it('conserve les autres codes postaux de Paris et renseigne le rapport', () => {
    const report = cleanCommunes([PARIS, VINCENNES], [PARIS_12]);
    expect(report.rows).toHaveLength(22); // 21 Paris + 1 Vincennes − 1 remplacé + 1 arrondissement
    expect(report.rows.filter((r) => r.nom === 'Paris')).toHaveLength(20);
    expect(report.exploded).toBe(23);
    expect(report.overriddenByArrondissement).toBe(1);
    expect(report.duplicatesRemoved).toBe(0);
    expect(report.rejected).toEqual([]);
  });

  it('compte les rejets par motif et dédoublonne les entrées répétées', () => {
    const report = cleanCommunes([VINCENNES, VINCENNES, { ...PARIS, centre: null }, { nom: '', codesPostaux: ['75001'] }]);
    expect(report.rows).toEqual([{ code_postal: '94300', nom: 'Vincennes', latitude: 48.8471, longitude: 2.4383 }]);
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.rejectedByReason).toEqual({ sans_nom: 1, sans_code_postal: 0, sans_coordonnees: 1, coordonnees_invalides: 0 });
    expect(report.rejected.map((r) => [r.code, r.reason])).toEqual([['75056', 'sans_coordonnees'], [undefined, 'sans_nom']]);
  });
});
