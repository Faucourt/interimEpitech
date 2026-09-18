/**
 * Intégration n8n (contrat : README.md, section « Automatisations n8n ») : la route interne des missions non pourvues
 * (workflow 2) et le webhook sortant à la publication d'une mission (workflow 1).
 * Aucun appel réseau réel : `fetch` est remplacé par un mock.
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import type { MissionInput } from '../src/missions/repository';
import type { MissionPublishedPayload } from '../src/n8n/client';
import type { ProfileInput } from '../src/profils/repository';
import { createTestApp, login, seedUser } from './helpers';

const { app, repos } = createTestApp();
const API_KEY = 'cle-de-test-n8n';
const DAY_MS = 24 * 60 * 60 * 1000;
const ROUTE = '/api/internal/missions/non-pourvues';

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

// Même profil que le parcours principal (tests/missions.test.ts) : score 80 sur la mission ci-dessus.
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

let entrepriseId = '';
let entrepriseToken = '';
let sofiaId = '';
const auth = () => ({ Authorization: `Bearer ${entrepriseToken}` });

beforeAll(async () => {
  const entreprise = await seedUser(repos, {
    email: 'rh@proprenet.fr',
    password: 'secret-entreprise',
    role: 'ENTREPRISE',
    raisonSociale: 'PropreNet',
  });
  entrepriseId = entreprise.id;
  entrepriseToken = await login(app, 'rh@proprenet.fr', 'secret-entreprise');

  const sofia = await seedUser(repos, { email: 'sofia@mail.fr', password: 'motdepasse', role: 'INTERIMAIRE', prenom: 'Sofia', nom: 'Diallo' });
  sofiaId = sofia.id;
  await repos.profiles.upsert(sofia.id, profilSofia);
  await repos.profiles.addExperience({
    userId: sofia.id,
    intitule: 'Agent de propreté bureaux',
    typeNettoyage: 'Bureaux',
    dateDebut: '2026-01-05',
    dateFin: '2026-06-30',
  });

  // Marc : mêmes compétences mais à Lyon et sans expérience → score très en dessous de 70.
  const marc = await seedUser(repos, { email: 'marc@mail.fr', password: 'motdepasse', role: 'INTERIMAIRE', prenom: 'Marc', nom: 'Petit' });
  await repos.profiles.upsert(marc.id, { ...profilSofia, codePostal: '69001', ville: 'Lyon' });
});

afterAll(() => {
  config.n8nApiKey = '';
  config.n8nWebhookUrl = '';
});

describe('GET /api/internal/missions/non-pourvues (workflow 2)', () => {
  let sansCandidatureId = '';
  let enAttenteId = '';

  beforeAll(async () => {
    // Missions « anciennes » : on recule l'horloge de 6 jours le temps de les créer.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() - 6 * DAY_MS);
    const sansCandidature = await repos.missions.create(entrepriseId, { ...missionInput, intitule: 'Sans candidature' });
    const enAttente = await repos.missions.create(entrepriseId, { ...missionInput, intitule: 'Candidature en attente' });
    const acceptee = await repos.missions.create(entrepriseId, { ...missionInput, intitule: 'Candidature acceptée', nbAgents: 2 });
    const pourvue = await repos.missions.create(entrepriseId, { ...missionInput, intitule: 'Pourvue' });
    vi.useRealTimers();
    // Mission publiée aujourd'hui : trop récente pour être relancée.
    await repos.missions.create(entrepriseId, { ...missionInput, intitule: 'Toute fraîche' });

    sansCandidatureId = sansCandidature.id;
    enAttenteId = enAttente.id;
    await repos.candidatures.create({ missionId: enAttente.id, interimaireId: sofiaId, score: 80 });
    // Une candidature acceptée sur une mission encore OUVERTE (2 agents recherchés) : plus à relancer.
    const cand = await repos.candidatures.create({ missionId: acceptee.id, interimaireId: sofiaId, score: 80 });
    await repos.candidatures.updateStatut(cand.id, 'ACCEPTEE', null);
    await repos.missions.update(pourvue.id, { statut: 'POURVUE' });
  });

  beforeEach(() => {
    config.n8nApiKey = API_KEY;
  });

  it('répond 401 sans clé ou avec une mauvaise clé', async () => {
    expect((await request(app).get(ROUTE)).status).toBe(401);
    expect((await request(app).get(ROUTE).set('X-Api-Key', 'mauvaise-cle')).status).toBe(401);
  });

  it('répond 503 quand N8N_API_KEY n’est pas configurée, même avec une clé vide côté client', async () => {
    config.n8nApiKey = '';
    const res = await request(app).get(ROUTE).set('X-Api-Key', '');
    expect(res.status).toBe(503);
  });

  it('renvoie les missions ouvertes depuis plus de 3 jours sans candidature acceptée, dans la forme du contrat', async () => {
    const res = await request(app).get(ROUTE).query({ jours: 3 }).set('X-Api-Key', API_KEY);
    expect(res.status).toBe(200);

    const ids = res.body.missions.map((m: { id: string }) => m.id);
    expect([...ids].sort()).toEqual([sansCandidatureId, enAttenteId].sort());

    const enAttente = res.body.missions.find((m: { id: string }) => m.id === enAttenteId);
    expect(enAttente).toEqual({
      id: enAttenteId,
      intitule: 'Candidature en attente',
      ville: 'Paris',
      codePostal: '75001',
      statut: 'OUVERTE',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      nbCandidatures: 1,
      nbCandidaturesAcceptees: 0,
      entreprise: { raisonSociale: 'PropreNet' },
    });
    expect(new Date(enAttente.createdAt).getTime()).toBeLessThan(Date.now() - 3 * DAY_MS);
  });

  it('utilise 3 jours par défaut et respecte un seuil plus large', async () => {
    const defaut = await request(app).get(ROUTE).set('X-Api-Key', API_KEY);
    expect(defaut.body.missions).toHaveLength(2);

    const dixJours = await request(app).get(ROUTE).query({ jours: 10 }).set('X-Api-Key', API_KEY);
    expect(dixJours.status).toBe(200);
    expect(dixJours.body.missions).toEqual([]);
  });

  it('refuse un paramètre jours invalide', async () => {
    const res = await request(app).get(ROUTE).query({ jours: 'abc' }).set('X-Api-Key', API_KEY);
    expect(res.status).toBe(400);
  });
});

describe('webhook n8n à la publication d’une mission (workflow 1)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    // Les échecs attendus sont logués : on garde la sortie des tests propre.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    config.n8nWebhookUrl = 'http://n8n.test/webhook/cleanmatch/mission-publiee';
    config.n8nApiKey = API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('envoie le payload du contrat, avec les seuls agents dont le score dépasse 70', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const res = await request(app).post('/api/missions').set(auth()).send(missionInput);
    expect(res.status).toBe(201);
    const missionId = res.body.mission.id as string;

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://n8n.test/webhook/cleanmatch/mission-publiee');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', 'X-Api-Key': API_KEY });
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    const payload = JSON.parse(init?.body as string) as MissionPublishedPayload;
    expect(payload.mission).toEqual({
      id: missionId,
      intitule: 'Agent de propreté bureaux',
      ville: 'Paris',
      codePostal: '75001',
      dateDebut: '2026-10-01',
      dateFin: '2026-10-31',
      creneau: 'SOIREE',
      remuneration: 12.5,
      url: `${config.corsOrigin}/missions/${missionId}`,
    });
    // Sofia (80) est notifiée, Marc (à Lyon, sans expérience) reste sous le seuil.
    expect(payload.agents).toEqual([{ id: sofiaId, prenom: 'Sofia', nom: 'Diallo', email: 'sofia@mail.fr', score: 80 }]);
  });

  it('la création réussit même si le webhook échoue, avec la même réponse', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app).post('/api/missions').set(auth()).send(missionInput);
    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['mission']);
    expect(res.body.mission).toMatchObject({ statut: 'OUVERTE', entrepriseId, intitule: missionInput.intitule });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[n8n]'), expect.any(Error)));
  });

  it('logue aussi une réponse non 2xx de n8n sans impacter la création', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const res = await request(app).post('/api/missions').set(auth()).send(missionInput);
    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.stringContaining('réponse 500')));
  });

  it('n’appelle rien quand N8N_WEBHOOK_URL est vide', async () => {
    config.n8nWebhookUrl = '';
    const res = await request(app).post('/api/missions').set(auth()).send(missionInput);
    expect(res.status).toBe(201);
    // Laisse passer un tour de boucle : la notification tourne en arrière-plan après la réponse.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
