/**
 * Référentiel de compétences, compétences qualifiées de l'agent (niveau + ancienneté), leur
 * prise en compte dans le matching et le tableau de tendances marché de l'admin.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { computeScore, type MissionForScore, type ProfileForScore } from '../src/matching/score';
import { COMPETENCES, createTestApp, login, seedUser } from './helpers';

const { app, repos } = createTestApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const idOf = (nom: string) => COMPETENCES.find((c) => c.nom === nom)!.id;

let adminToken = '';
let agentToken = '';
let entrepriseToken = '';

const profil = {
  competences: [],
  typesNettoyage: [],
  codePostal: '75001',
  ville: 'Paris',
  rayonKm: 15,
  joursDisponibles: ['LUNDI', 'MARDI'],
  creneaux: ['SOIREE'],
  disponible: true,
};

const mission = {
  intitule: 'Agent de propreté',
  typeNettoyage: 'Bureaux',
  description: null,
  motif: 'Accroissement temporaire d’activité',
  dateDebut: '2026-10-01',
  dateFin: '2026-10-31',
  jours: ['LUNDI', 'MARDI'],
  creneau: 'SOIREE',
  codePostal: '75001',
  ville: 'Paris',
  competencesRequises: ['autolaveuse'],
  nbAgents: 1,
};

beforeAll(async () => {
  await seedUser(repos, { email: 'admin@cleanmatch.fr', password: 'admin-secret', role: 'ADMIN' });
  await seedUser(repos, { email: 'rh@proprenet.fr', password: 'entreprise-secret', role: 'ENTREPRISE', raisonSociale: 'PropreNet', siret: '12345678901234' });
  adminToken = await login(app, 'admin@cleanmatch.fr', 'admin-secret');
  entrepriseToken = await login(app, 'rh@proprenet.fr', 'entreprise-secret');
  const res = await request(app).post('/api/auth/register').send({ email: 'sofia@mail.fr', password: 'motdepasse', prenom: 'Sofia', nom: 'Test' });
  agentToken = res.body.token;
});

describe('GET /api/competences — référentiel public', () => {
  it('renvoie les compétences du secteur sans authentification', async () => {
    const res = await request(app).get('/api/competences');
    expect(res.status).toBe(200);
    expect(res.body.competences).toHaveLength(8);
    expect(res.body.competences.map((c: { nom: string }) => c.nom)).toContain('autolaveuse');
  });
});

describe('/api/profil/competences — compétences qualifiées de l’agent', () => {
  it('est réservé au rôle INTERIMAIRE', async () => {
    expect((await request(app).get('/api/profil/competences')).status).toBe(401);
    expect((await request(app).get('/api/profil/competences').set(auth(adminToken))).status).toBe(403);
    expect((await request(app).put('/api/profil/competences').set(auth(entrepriseToken)).send({ competences: [] })).status).toBe(403);
  });

  it('commence vide', async () => {
    const res = await request(app).get('/api/profil/competences').set(auth(agentToken));
    expect(res.status).toBe(200);
    expect(res.body.competences).toEqual([]);
  });

  it('exige un profil existant avant de qualifier des compétences', async () => {
    const res = await request(app)
      .put('/api/profil/competences')
      .set(auth(agentToken))
      .send({ competences: [{ competenceId: idOf('autolaveuse'), niveau: 'EXPERT' }] });
    expect(res.status).toBe(409);
    expect((await request(app).put('/api/profil').set(auth(agentToken)).send(profil)).status).toBe(200);
  });

  it('refuse un competenceId inconnu du référentiel (400)', async () => {
    const res = await request(app)
      .put('/api/profil/competences')
      .set(auth(agentToken))
      .send({ competences: [{ competenceId: 'inconnue', niveau: 'EXPERT' }] });
    expect(res.status).toBe(400);
    expect(res.body.competenceIds).toEqual(['inconnue']);
  });

  it('refuse un niveau hors liste et une compétence en double (400)', async () => {
    const niveau = await request(app)
      .put('/api/profil/competences')
      .set(auth(agentToken))
      .send({ competences: [{ competenceId: idOf('autolaveuse'), niveau: 'GOUROU' }] });
    expect(niveau.status).toBe(400);
    const doublon = await request(app)
      .put('/api/profil/competences')
      .set(auth(agentToken))
      .send({
        competences: [
          { competenceId: idOf('autolaveuse'), niveau: 'EXPERT' },
          { competenceId: idOf('autolaveuse'), niveau: 'DEBUTANT' },
        ],
      });
    expect(doublon.status).toBe(400);
  });

  it('remplace l’ensemble des compétences qualifiées', async () => {
    const first = await request(app)
      .put('/api/profil/competences')
      .set(auth(agentToken))
      .send({
        competences: [
          { competenceId: idOf('autolaveuse'), niveau: 'EXPERT', anneesExperience: 8 },
          { competenceId: idOf('vitrerie'), niveau: 'DEBUTANT' },
        ],
      });
    expect(first.status).toBe(200);
    expect(first.body.competences).toHaveLength(2);
    expect(first.body.competences[0]).toMatchObject({ competenceId: idOf('autolaveuse'), nom: 'autolaveuse', niveau: 'EXPERT', anneesExperience: 8, valideeLe: null });
    expect(first.body.competences[1]).toMatchObject({ nom: 'vitrerie', niveau: 'DEBUTANT', anneesExperience: null });

    const second = await request(app)
      .put('/api/profil/competences')
      .set(auth(agentToken))
      .send({ competences: [{ competenceId: idOf('désinfection'), niveau: 'CONFIRME', anneesExperience: 3 }] });
    expect(second.status).toBe(200);
    expect(second.body.competences.map((c: { nom: string }) => c.nom)).toEqual(['désinfection']);

    const read = await request(app).get('/api/profil/competences').set(auth(agentToken));
    expect(read.body.competences).toEqual(second.body.competences);
  });

  it('alimente le matching : un agent sans texte libre est matché grâce à ses compétences qualifiées', async () => {
    const created = await request(app).post('/api/missions').set(auth(entrepriseToken)).send(mission);
    expect(created.status).toBe(201);

    const before = await request(app).get('/api/missions/recommandees').set(auth(agentToken));
    expect(before.body.recommandations[0].score.details.motsCles).toBe(0); // désinfection ≠ autolaveuse

    await request(app)
      .put('/api/profil/competences')
      .set(auth(agentToken))
      .send({ competences: [{ competenceId: idOf('autolaveuse'), niveau: 'EXPERT' }] });
    const after = await request(app).get('/api/missions/recommandees').set(auth(agentToken));
    // Requis : autolaveuse (2) + type « Bureaux » (2). L'agent couvre autolaveuse → 2/4 des 50 points.
    expect(after.body.recommandations[0].score.details.motsCles).toBe(25);
  });
});

describe('computeScore — compétences qualifiées dans les 50 points de mots-clés', () => {
  // Mots-clés requis : nettoyage, vitre, autolaveuse, bureau (poids 2) + entretien, quotidien, open, space (poids 1) → 12.
  const scoredMission: MissionForScore = {
    typeNettoyage: 'Bureaux',
    description: 'Entretien quotidien de bureaux en open space',
    competencesRequises: ['Nettoyage des vitres', 'Autolaveuse'],
    jours: [],
    creneau: null,
    codePostal: '75001',
  };
  const base: ProfileForScore = {
    competences: [],
    typesNettoyage: [],
    joursDisponibles: [],
    creneaux: [],
    disponible: true,
    rayonKm: 15,
    codePostal: '99999',
  };
  const motsCles = (profile: Partial<ProfileForScore>) =>
    computeScore({ mission: scoredMission, missionCommune: null, profile: { ...base, ...profile }, profileCommune: null, experiences: [] })
      .details.motsCles;

  it('ne change rien à un profil sans compétences qualifiées (comportement de repli)', () => {
    const texteLibre = { competences: ['nettoyage vitres', 'autolaveuse', 'entretien quotidien', 'open space'], typesNettoyage: ['bureaux'] };
    expect(motsCles(texteLibre)).toBe(50);
    expect(motsCles({ ...texteLibre, competencesQualifiees: [] })).toBe(50);
    expect(motsCles({ competences: ['autolaveuse'] })).toBe(8); // 2/12
  });

  it('fait compter un EXPERT plus qu’un DEBUTANT', () => {
    // autolaveuse pèse 2/12 : EXPERT 100 % → 8, CONFIRME 85 % → 7, INTERMEDIAIRE 70 % → 6, DEBUTANT 50 % → 4.
    expect(motsCles({ competencesQualifiees: [{ nom: 'autolaveuse', niveau: 'EXPERT' }] })).toBe(8);
    expect(motsCles({ competencesQualifiees: [{ nom: 'autolaveuse', niveau: 'CONFIRME' }] })).toBe(7);
    expect(motsCles({ competencesQualifiees: [{ nom: 'autolaveuse', niveau: 'INTERMEDIAIRE' }] })).toBe(6);
    expect(motsCles({ competencesQualifiees: [{ nom: 'autolaveuse', niveau: 'DEBUTANT' }] })).toBe(4);
  });

  it('cumule texte libre et compétences qualifiées sans jamais dépasser 50', () => {
    // nettoyage de bureaux → nettoyage (2) + bureau (2) = 4/12 → 17.
    expect(motsCles({ competencesQualifiees: [{ nom: 'nettoyage de bureaux', niveau: 'EXPERT' }] })).toBe(17);
    // Le texte libre garde son poids plein même si la même compétence est qualifiée DEBUTANT.
    expect(motsCles({ competences: ['autolaveuse'], competencesQualifiees: [{ nom: 'autolaveuse', niveau: 'DEBUTANT' }] })).toBe(8);
    const tout = {
      competences: ['nettoyage vitres', 'autolaveuse', 'entretien quotidien', 'open space'],
      typesNettoyage: ['bureaux'],
      competencesQualifiees: COMPETENCES.map((c) => ({ nom: c.nom, niveau: 'EXPERT' as const })),
    };
    expect(motsCles(tout)).toBe(50);
  });
});

describe('GET /api/admin/tendances — données France Travail', () => {
  it('est réservé au rôle ADMIN', async () => {
    expect((await request(app).get('/api/admin/tendances')).status).toBe(401);
    expect((await request(app).get('/api/admin/tendances').set(auth(agentToken))).status).toBe(403);
    expect((await request(app).get('/api/admin/tendances').set(auth(entrepriseToken))).status).toBe(403);
  });

  it('renvoie les lignes triées par projets de recrutement décroissants', async () => {
    const res = await request(app).get('/api/admin/tendances').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.tendances.map((t: { projetsRecrutement: number }) => t.projetsRecrutement)).toEqual([12000, 11000, 4500, 800]);
  });

  it('filtre par année et par code ROME', async () => {
    const annee = await request(app).get('/api/admin/tendances?annee=2024').set(auth(adminToken));
    expect(annee.body.tendances.map((t: { id: string }) => t.id)).toEqual(['t4']);
    const rome = await request(app).get('/api/admin/tendances?codeRome=K2303&annee=2025').set(auth(adminToken));
    expect(rome.body.tendances.map((t: { id: string }) => t.id)).toEqual(['t3']);
    expect((await request(app).get('/api/admin/tendances?annee=abc').set(auth(adminToken))).status).toBe(400);
  });
});
