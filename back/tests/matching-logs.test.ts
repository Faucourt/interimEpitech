/**
 * Base non relationnelle : chaque score de matching calculé est journalisé (collection
 * `matching_logs`, conservée 6 mois côté MongoDB) et consultable par l'admin.
 * Ici le dépôt est en mémoire : aucune instance MongoDB n'est nécessaire.
 */
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDisabledMatchingLogRepository } from '../src/matchingLogs/repository';
import type { MissionInput } from '../src/missions/repository';
import type { ProfileInput } from '../src/profils/repository';
import type { MatchingLog } from '../src/types';
import { createTestApp, login, seedUser } from './helpers';

const { app, repos } = createTestApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const ROUTE = '/api/admin/logs-matching';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const missionInput: MissionInput = {
  intitule: 'Agent de propreté bureaux',
  typeNettoyage: 'Bureaux',
  description: 'Entretien quotidien de bureaux en open space',
  motif: 'Accroissement temporaire d’activité',
  dateDebut: '2026-10-01',
  dateFin: '2026-10-31',
  heureDebut: '18:00',
  heureFin: '21:00',
  jours: ['LUNDI', 'MARDI'],
  creneau: 'SOIREE',
  adresse: null,
  codePostal: '75001',
  ville: 'Paris',
  competencesRequises: ['vitres', 'autolaveuse'],
  remuneration: 12.5,
  nbAgents: 1,
};

const profilSofia: ProfileInput = {
  competences: ['vitres', 'autolaveuse'],
  typesNettoyage: ['bureaux'],
  codePostal: '92100',
  ville: 'Boulogne-Billancourt',
  rayonKm: 15,
  joursDisponibles: ['LUNDI', 'MARDI', 'MERCREDI'],
  creneaux: ['SOIREE', 'NUIT'],
  disponible: true,
};

let adminToken = '';
let entrepriseToken = '';
let sofiaToken = '';
let karimToken = '';
let sofiaId = '';
let karimId = '';
let missionId = '';
let autreMissionId = '';

const logsFor = (filters: { missionId?: string; interimaireId?: string }) =>
  repos.matchingLogs.list({ ...filters, limit: 1000 });

beforeAll(async () => {
  await seedUser(repos, { email: 'admin@cleanmatch.fr', password: 'admin-secret', role: 'ADMIN' });
  adminToken = await login(app, 'admin@cleanmatch.fr', 'admin-secret');

  const entreprise = await seedUser(repos, {
    email: 'rh@proprenet.fr',
    password: 'secret-entreprise',
    role: 'ENTREPRISE',
    raisonSociale: 'PropreNet',
  });
  entrepriseToken = await login(app, 'rh@proprenet.fr', 'secret-entreprise');

  const sofia = await seedUser(repos, { email: 'sofia@mail.fr', password: 'motdepasse', role: 'INTERIMAIRE', prenom: 'Sofia', nom: 'Diallo' });
  sofiaId = sofia.id;
  sofiaToken = await login(app, 'sofia@mail.fr', 'motdepasse');
  await repos.profiles.upsert(sofia.id, profilSofia);

  // Karim n'est pas disponible le mardi : il est éliminé avant tout calcul de score.
  const karim = await seedUser(repos, { email: 'karim@mail.fr', password: 'motdepasse', role: 'INTERIMAIRE', prenom: 'Karim', nom: 'Benali' });
  karimId = karim.id;
  karimToken = await login(app, 'karim@mail.fr', 'motdepasse');
  await repos.profiles.upsert(karim.id, { ...profilSofia, joursDisponibles: ['LUNDI'] });

  missionId = (await repos.missions.create(entreprise.id, missionInput)).id;
  autreMissionId = (await repos.missions.create(entreprise.id, { ...missionInput, intitule: 'Remise en état' })).id;
});

describe('journalisation des scores calculés', () => {
  it('GET /api/missions/:id/candidats journalise un document par candidat, fidèle au score renvoyé', async () => {
    const res = await request(app).get(`/api/missions/${missionId}/candidats`).set(auth(entrepriseToken));
    expect(res.status).toBe(200);
    expect(res.body.candidats).toHaveLength(1);
    const { score } = res.body.candidats[0];

    const logs = await logsFor({ missionId });
    expect(logs).toEqual([
      {
        missionId,
        interimaireId: sofiaId,
        scoreTotal: score.total,
        scoreMotsCles: score.details.motsCles,
        scoreDernieresMissions: score.details.experiences,
        scoreLocalisation: score.details.localisation,
        disponibiliteCompatible: true,
        calculeLe: expect.stringMatching(ISO_DATE),
      },
    ]);
    // Karim a été filtré par la disponibilité : aucun score calculé, donc aucun document.
    expect(await logsFor({ interimaireId: karimId })).toEqual([]);
  });

  it('GET /api/missions/recommandees journalise un document par mission recommandée', async () => {
    const before = (await logsFor({ interimaireId: sofiaId })).length;
    const res = await request(app).get('/api/missions/recommandees').set(auth(sofiaToken));
    expect(res.status).toBe(200);
    expect(res.body.recommandations).toHaveLength(2);

    const logs = await logsFor({ interimaireId: sofiaId });
    expect(logs).toHaveLength(before + 2);
    for (const { mission, score } of res.body.recommandations) {
      expect(logs.slice(0, 2)).toContainEqual(expect.objectContaining({ missionId: mission.id, scoreTotal: score.total }));
    }
  });

  it('POST /api/missions/:id/candidatures journalise le score figé sur la candidature', async () => {
    const res = await request(app).post(`/api/missions/${autreMissionId}/candidatures`).set(auth(sofiaToken));
    expect(res.status).toBe(201);
    expect(res.body.candidature.score).toBe(res.body.score.total);

    const [latest] = await logsFor({ missionId: autreMissionId, interimaireId: sofiaId });
    expect(latest).toMatchObject({ scoreTotal: res.body.candidature.score, disponibiliteCompatible: true });
  });

  it('n’écrit rien quand aucun score n’est calculé (agent indisponible)', async () => {
    const res = await request(app).post(`/api/missions/${missionId}/candidatures`).set(auth(karimToken));
    expect(res.status).toBe(409);
    expect(await logsFor({ interimaireId: karimId })).toEqual([]);
  });
});

describe('GET /api/admin/logs-matching', () => {
  it('est réservée au rôle ADMIN', async () => {
    expect((await request(app).get(ROUTE)).status).toBe(401);
    expect((await request(app).get(ROUTE).set(auth(entrepriseToken))).status).toBe(403);
    expect((await request(app).get(ROUTE).set(auth(sofiaToken))).status).toBe(403);
  });

  it('renvoie les plus récents d’abord, avec la forme du document', async () => {
    // Une entrée antidatée d'une heure, insérée en dernier : elle doit sortir en fin de liste.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() - 60 * 60 * 1000);
    await repos.matchingLogs.insert({
      missionId: 'mission-ancienne',
      interimaireId: 'agent-ancien',
      scoreTotal: 10,
      scoreMotsCles: 10,
      scoreDernieresMissions: 0,
      scoreLocalisation: 0,
      disponibiliteCompatible: true,
    });
    vi.useRealTimers();

    const res = await request(app).get(ROUTE).set(auth(adminToken));
    expect(res.status).toBe(200);
    const logs = res.body.logs as MatchingLog[];
    expect(logs.length).toBeGreaterThanOrEqual(5);
    expect(logs.at(-1)).toMatchObject({ missionId: 'mission-ancienne', interimaireId: 'agent-ancien' });
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i - 1].calculeLe >= logs[i].calculeLe).toBe(true);
    }
    expect(Object.keys(logs[0]).sort()).toEqual(
      ['calculeLe', 'disponibiliteCompatible', 'interimaireId', 'missionId', 'scoreDernieresMissions', 'scoreLocalisation', 'scoreMotsCles', 'scoreTotal'],
    );
  });

  it('filtre par mission, par intérimaire, et par les deux', async () => {
    const parMission = await request(app).get(ROUTE).query({ missionId }).set(auth(adminToken));
    expect(parMission.status).toBe(200);
    expect(parMission.body.logs.length).toBe((await logsFor({ missionId })).length);
    expect(parMission.body.logs.every((l: MatchingLog) => l.missionId === missionId)).toBe(true);

    const parAgent = await request(app).get(ROUTE).query({ interimaireId: sofiaId }).set(auth(adminToken));
    expect(parAgent.body.logs.length).toBeGreaterThan(0);
    expect(parAgent.body.logs.every((l: MatchingLog) => l.interimaireId === sofiaId)).toBe(true);

    const croise = await request(app).get(ROUTE).query({ missionId: autreMissionId, interimaireId: sofiaId }).set(auth(adminToken));
    expect(croise.body.logs.length).toBeGreaterThan(0);
    expect(croise.body.logs.every((l: MatchingLog) => l.missionId === autreMissionId && l.interimaireId === sofiaId)).toBe(true);

    const aucun = await request(app).get(ROUTE).query({ interimaireId: karimId }).set(auth(adminToken));
    expect(aucun.body.logs).toEqual([]);
  });

  it('limite à 100 entrées par défaut, respecte ?limit= et refuse une limite invalide', async () => {
    for (let i = 0; i < 105; i++) {
      await repos.matchingLogs.insert({
        missionId: 'mission-volume',
        interimaireId: `agent-${i}`,
        scoreTotal: 50,
        scoreMotsCles: 25,
        scoreDernieresMissions: 0,
        scoreLocalisation: 25,
        disponibiliteCompatible: true,
      });
    }
    const defaut = await request(app).get(ROUTE).set(auth(adminToken));
    expect(defaut.body.logs).toHaveLength(100);

    const un = await request(app).get(ROUTE).query({ limit: 1 }).set(auth(adminToken));
    expect(un.body.logs).toHaveLength(1);

    expect((await request(app).get(ROUTE).query({ limit: 0 }).set(auth(adminToken))).status).toBe(400);
    expect((await request(app).get(ROUTE).query({ limit: 'abc' }).set(auth(adminToken))).status).toBe(400);
  });
});

describe('résilience : la journalisation ne bloque jamais la réponse', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('une erreur d’écriture est loguée et les trois routes répondent exactement comme avant', async () => {
    const candidatsAvant = await request(app).get(`/api/missions/${missionId}/candidats`).set(auth(entrepriseToken));
    const recommandeesAvant = await request(app).get('/api/missions/recommandees').set(auth(sofiaToken));
    const nbLogsAvant = (await logsFor({})).length;

    vi.spyOn(repos.matchingLogs, 'insert').mockRejectedValue(new Error('MongoDB injoignable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const candidats = await request(app).get(`/api/missions/${missionId}/candidats`).set(auth(entrepriseToken));
    expect(candidats.status).toBe(200);
    expect(candidats.body).toEqual(candidatsAvant.body);

    const recommandees = await request(app).get('/api/missions/recommandees').set(auth(sofiaToken));
    expect(recommandees.status).toBe(200);
    expect(recommandees.body).toEqual(recommandeesAvant.body);

    const candidature = await request(app).post(`/api/missions/${missionId}/candidatures`).set(auth(sofiaToken));
    expect(candidature.status).toBe(201);
    expect(Object.keys(candidature.body).sort()).toEqual(['candidature', 'score']);
    expect(candidature.body.candidature.score).toBe(candidatsAvant.body.candidats[0].score.total);

    // 1 candidat + 2 recommandations + 1 candidature : quatre écritures tentées, quatre échecs logués, zéro document.
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledTimes(4));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[matching]'), expect.any(Error));
    expect((await logsFor({})).length).toBe(nbLogsAvant);
  });

  it('le dépôt inerte (MONGODB_URI vide) n’enregistre rien et renvoie un historique vide', async () => {
    const disabled = createDisabledMatchingLogRepository();
    await disabled.insert({
      missionId: 'm',
      interimaireId: 'a',
      scoreTotal: 0,
      scoreMotsCles: 0,
      scoreDernieresMissions: 0,
      scoreLocalisation: 0,
      disponibiliteCompatible: true,
    });
    expect(await disabled.list({ limit: 10 })).toEqual([]);
  });
});
