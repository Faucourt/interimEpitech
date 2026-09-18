/**
 * Parcours fonctionnel complet : l'admin crée une entreprise → elle change son mot de passe et
 * publie une mission → un agent renseigne son profil, est matché, candidate → l'entreprise accepte
 * et la mission passe à POURVUE.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, seedUser } from './helpers';

const { app, repos } = createTestApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let adminToken = '';
let entrepriseToken = '';
let entrepriseId = '';
let temporaryPassword = '';
let agentToken = '';
let agentIndisponibleToken = '';
let missionId = '';
let candidatureId = '';
let scoreAtApplication = 0;

const entreprise = { email: 'rh@proprenet.fr', raisonSociale: 'PropreNet', siret: '12345678901234', telephone: '0102030405' };

const mission = {
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
  codePostal: '75001',
  ville: 'Paris',
  competencesRequises: ['vitres', 'autolaveuse'],
  remuneration: 12.5,
  nbAgents: 1,
};

const profil = {
  competences: ['vitres', 'autolaveuse'],
  typesNettoyage: ['bureaux'],
  codePostal: '92100',
  ville: 'Boulogne-Billancourt',
  rayonKm: 15,
  joursDisponibles: ['LUNDI', 'MARDI', 'MERCREDI'],
  creneaux: ['SOIREE', 'NUIT'],
  disponible: true,
};

async function registerAgent(email: string, prenom: string): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'motdepasse', prenom, nom: 'Test' });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

beforeAll(async () => {
  await seedUser(repos, { email: 'admin@cleanmatch.fr', password: 'admin-secret', role: 'ADMIN' });
  adminToken = await login(app, 'admin@cleanmatch.fr', 'admin-secret');
  agentToken = await registerAgent('sofia@mail.fr', 'Sofia');
  agentIndisponibleToken = await registerAgent('karim@mail.fr', 'Karim');
});

describe('P1 — comptes entreprise créés par l’admin', () => {
  it('l’admin crée un compte entreprise et reçoit un mot de passe temporaire, une seule fois', async () => {
    const res = await request(app).post('/api/admin/entreprises').set(auth(adminToken)).send(entreprise);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'ENTREPRISE', raisonSociale: 'PropreNet', mustChangePassword: true });
    expect(res.body.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{12}$/);
    entrepriseId = res.body.user.id;
    temporaryPassword = res.body.temporaryPassword;
  });

  it('refuse la création à un non-admin', async () => {
    const res = await request(app).post('/api/admin/entreprises').set(auth(agentToken)).send(entreprise);
    expect(res.status).toBe(403);
  });

  it('l’entreprise se connecte avec le mot de passe temporaire et doit le changer', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: entreprise.email, password: temporaryPassword });
    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(true);
    entrepriseToken = res.body.token;
  });

  it('change le mot de passe après vérification de l’ancien', async () => {
    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set(auth(entrepriseToken))
      .send({ currentPassword: 'faux', newPassword: 'nouveau-mdp-solide' });
    expect(wrong.status).toBe(401);

    const ok = await request(app)
      .post('/api/auth/change-password')
      .set(auth(entrepriseToken))
      .send({ currentPassword: temporaryPassword, newPassword: 'nouveau-mdp-solide' });
    expect(ok.status).toBe(204);

    const relogin = await request(app).post('/api/auth/login').send({ email: entreprise.email, password: 'nouveau-mdp-solide' });
    expect(relogin.status).toBe(200);
    expect(relogin.body.mustChangePassword).toBe(false);
    entrepriseToken = relogin.body.token;
  });

  it('un compte désactivé par l’admin ne peut plus se connecter', async () => {
    const off = await request(app).patch(`/api/admin/users/${entrepriseId}`).set(auth(adminToken)).send({ isActive: false });
    expect(off.status).toBe(200);
    const denied = await request(app).post('/api/auth/login').send({ email: entreprise.email, password: 'nouveau-mdp-solide' });
    expect(denied.status).toBe(403);
    const on = await request(app).patch(`/api/admin/users/${entrepriseId}`).set(auth(adminToken)).send({ isActive: true });
    expect(on.body.user.isActive).toBe(true);
  });
});

describe('P2 — missions', () => {
  it('refuse une mission sans motif (mention légale obligatoire)', async () => {
    const res = await request(app).post('/api/missions').set(auth(entrepriseToken)).send({ ...mission, motif: undefined });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toContain('motif');
  });

  it('refuse une mission de plus de 18 mois', async () => {
    const res = await request(app)
      .post('/api/missions')
      .set(auth(entrepriseToken))
      .send({ ...mission, dateDebut: '2026-01-01', dateFin: '2027-08-01' });
    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatchObject({ path: 'dateFin' });
  });

  it('refuse la création à un intérimaire', async () => {
    const res = await request(app).post('/api/missions').set(auth(agentToken)).send(mission);
    expect(res.status).toBe(403);
  });

  it('crée une mission ouverte', async () => {
    const res = await request(app).post('/api/missions').set(auth(entrepriseToken)).send(mission);
    expect(res.status).toBe(201);
    expect(res.body.mission).toMatchObject({ statut: 'OUVERTE', entrepriseId, motif: mission.motif });
    missionId = res.body.mission.id;
  });

  it('expose la mission dans la liste publique, avec filtres', async () => {
    const all = await request(app).get('/api/missions');
    expect(all.status).toBe(200);
    expect(all.body.missions.map((m: { id: string }) => m.id)).toEqual([missionId]);

    const parType = await request(app).get('/api/missions').query({ type: 'bureau', codePostal: '75' });
    expect(parType.body.missions).toHaveLength(1);

    const horsZone = await request(app).get('/api/missions').query({ codePostal: '69' });
    expect(horsZone.body.missions).toHaveLength(0);

    const detail = await request(app).get(`/api/missions/${missionId}`);
    expect(detail.body.mission.intitule).toBe(mission.intitule);
  });

  it('l’entreprise liste et modifie ses missions', async () => {
    const mine = await request(app).get('/api/missions/mine').set(auth(entrepriseToken));
    expect(mine.body.missions).toHaveLength(1);

    const res = await request(app)
      .put(`/api/missions/${missionId}`)
      .set(auth(entrepriseToken))
      .send({ ...mission, intitule: 'Agent de propreté bureaux (soir)' });
    expect(res.status).toBe(200);
    expect(res.body.mission.intitule).toBe('Agent de propreté bureaux (soir)');
  });

  it('exige un justificatif pour supprimer une mission', async () => {
    const res = await request(app).delete(`/api/missions/${missionId}`).set(auth(entrepriseToken)).send({});
    expect(res.status).toBe(400);
  });
});

describe('P2 — profil intérimaire', () => {
  it('renvoie un profil vide avant saisie', async () => {
    const res = await request(app).get('/api/profil').set(auth(agentToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ profil: null, experiences: [] });
  });

  it('enregistre le profil et les expériences de l’agent', async () => {
    const saved = await request(app).put('/api/profil').set(auth(agentToken)).send(profil);
    expect(saved.status).toBe(200);
    expect(saved.body.profil).toMatchObject({ competences: ['vitres', 'autolaveuse'], rayonKm: 15 });

    const exp = await request(app)
      .post('/api/profil/experiences')
      .set(auth(agentToken))
      .send({ intitule: 'Agent de propreté bureaux', typeNettoyage: 'Bureaux', dateDebut: '2026-01-05', dateFin: '2026-06-30' });
    expect(exp.status).toBe(201);

    const read = await request(app).get('/api/profil').set(auth(agentToken));
    expect(read.body.experiences).toHaveLength(1);
  });

  it('supprime une expérience, et seulement la sienne', async () => {
    const added = await request(app).post('/api/profil/experiences').set(auth(agentToken)).send({ intitule: 'Test' });
    const id = added.body.experience.id;
    const notMine = await request(app).delete(`/api/profil/experiences/${id}`).set(auth(agentIndisponibleToken));
    expect(notMine.status).toBe(404);
    const mine = await request(app).delete(`/api/profil/experiences/${id}`).set(auth(agentToken));
    expect(mine.status).toBe(204);
  });

  it('refuse un rayon hors bornes', async () => {
    const res = await request(app).put('/api/profil').set(auth(agentToken)).send({ ...profil, rayonKm: 500 });
    expect(res.status).toBe(400);
  });

  it('un second agent, disponible uniquement le samedi, renseigne son profil', async () => {
    const res = await request(app)
      .put('/api/profil')
      .set(auth(agentIndisponibleToken))
      .send({ ...profil, joursDisponibles: ['SAMEDI'] });
    expect(res.status).toBe(200);
  });
});

describe('P3 — matching et candidatures', () => {
  it('l’entreprise voit les candidats compatibles triés par score, sans l’agent indisponible', async () => {
    const res = await request(app).get(`/api/missions/${missionId}/candidats`).set(auth(entrepriseToken));
    expect(res.status).toBe(200);
    expect(res.body.candidats).toHaveLength(1);
    const [candidat] = res.body.candidats;
    expect(candidat.interimaire.prenom).toBe('Sofia');
    expect(candidat.interimaire.passwordHash).toBeUndefined();
    // vitres + autolaveuse + bureau = 6/10 mots-clés → 30 ; expérience récente même type → 25 ; Boulogne dans le rayon → 25.
    expect(candidat.score.details).toMatchObject({ motsCles: 30, experiences: 25, localisation: 25 });
    expect(candidat.score.total).toBe(80);
  });

  it('l’agent voit les missions recommandées avec leur score', async () => {
    const res = await request(app).get('/api/missions/recommandees').set(auth(agentToken));
    expect(res.status).toBe(200);
    expect(res.body.recommandations[0]).toMatchObject({ mission: { id: missionId }, score: { total: 80 } });

    const rien = await request(app).get('/api/missions/recommandees').set(auth(agentIndisponibleToken));
    expect(rien.body.recommandations).toHaveLength(0);
  });

  it('un agent indisponible ne peut pas candidater', async () => {
    const res = await request(app).post(`/api/missions/${missionId}/candidatures`).set(auth(agentIndisponibleToken));
    expect(res.status).toBe(409);
  });

  it('l’agent candidate et son score est figé ; une seconde candidature est refusée', async () => {
    const res = await request(app).post(`/api/missions/${missionId}/candidatures`).set(auth(agentToken));
    expect(res.status).toBe(201);
    expect(res.body.candidature).toMatchObject({ statut: 'EN_ATTENTE', score: 80 });
    candidatureId = res.body.candidature.id;
    scoreAtApplication = res.body.candidature.score;

    const again = await request(app).post(`/api/missions/${missionId}/candidatures`).set(auth(agentToken));
    expect(again.status).toBe(409);
  });

  it('chacun voit ses candidatures : l’agent avec la mission, l’entreprise avec l’agent', async () => {
    const agent = await request(app).get('/api/candidatures').set(auth(agentToken));
    expect(agent.body.candidatures).toHaveLength(1);
    expect(agent.body.candidatures[0].mission.id).toBe(missionId);

    const ent = await request(app).get('/api/candidatures').set(auth(entrepriseToken)).query({ missionId });
    expect(ent.body.candidatures).toHaveLength(1);
    expect(ent.body.candidatures[0].interimaire.prenom).toBe('Sofia');

    const autre = await request(app).get('/api/candidatures').set(auth(agentIndisponibleToken));
    expect(autre.body.candidatures).toHaveLength(0);
  });

  it('exige un justificatif pour refuser une candidature', async () => {
    const res = await request(app).patch(`/api/candidatures/${candidatureId}`).set(auth(entrepriseToken)).send({ statut: 'REFUSEE' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('justificatif');
  });

  it('l’agent ne peut pas traiter une candidature', async () => {
    const res = await request(app).patch(`/api/candidatures/${candidatureId}`).set(auth(agentToken)).send({ statut: 'ACCEPTEE' });
    expect(res.status).toBe(403);
  });

  it('accepte la candidature : le nombre d’agents est atteint, la mission passe à POURVUE', async () => {
    const res = await request(app).patch(`/api/candidatures/${candidatureId}`).set(auth(entrepriseToken)).send({ statut: 'ACCEPTEE' });
    expect(res.status).toBe(200);
    expect(res.body.candidature).toMatchObject({ statut: 'ACCEPTEE', score: scoreAtApplication });
    expect(res.body.mission.statut).toBe('POURVUE');

    const open = await request(app).get('/api/missions');
    expect(open.body.missions).toHaveLength(0);
  });

  it('refuse de traiter deux fois la même candidature', async () => {
    const res = await request(app)
      .patch(`/api/candidatures/${candidatureId}`)
      .set(auth(entrepriseToken))
      .send({ statut: 'REFUSEE', justificatif: 'Changement d’avis' });
    expect(res.status).toBe(409);
  });

  it('supprime la mission avec un justificatif ; elle disparaît des lectures', async () => {
    const res = await request(app)
      .delete(`/api/missions/${missionId}`)
      .set(auth(entrepriseToken))
      .send({ justificatif: 'Chantier annulé par le client' });
    expect(res.status).toBe(204);
    const gone = await request(app).get(`/api/missions/${missionId}`);
    expect(gone.status).toBe(404);
  });
});

describe('cas limites', () => {
  let mission2Id = '';
  let candSofiaId = '';
  let candKarimId = '';
  let sansProfilToken = '';

  it('l’admin ne peut pas créer deux entreprises avec le même email, ni activer un compte inconnu', async () => {
    const dup = await request(app).post('/api/admin/entreprises').set(auth(adminToken)).send(entreprise);
    expect(dup.status).toBe(409);
    const unknown = await request(app).patch('/api/admin/users/inconnu').set(auth(adminToken)).send({ isActive: false });
    expect(unknown.status).toBe(404);
  });

  it('renvoie 404 pour une mission inconnue ou qui n’appartient pas à l’entreprise', async () => {
    expect((await request(app).get('/api/missions/inconnue/candidats').set(auth(entrepriseToken))).status).toBe(404);
    expect((await request(app).post('/api/missions/inconnue/candidatures').set(auth(agentToken))).status).toBe(404);
    expect((await request(app).patch('/api/candidatures/inconnue').set(auth(entrepriseToken)).send({ statut: 'ACCEPTEE' })).status).toBe(404);
    expect((await request(app).get('/api/missions').query({ type: 'hopital' })).body.missions).toHaveLength(0);
  });

  it('un agent sans profil n’a pas de recommandations et ne peut pas candidater', async () => {
    sansProfilToken = await registerAgent('lea@mail.fr', 'Léa');
    const reco = await request(app).get('/api/missions/recommandees').set(auth(sansProfilToken));
    expect(reco.body.recommandations).toHaveLength(0);
    expect(reco.body.message).toMatch(/profil/);

    const created = await request(app).post('/api/missions').set(auth(entrepriseToken)).send({ ...mission, jours: [] });
    mission2Id = created.body.mission.id;
    const apply = await request(app).post(`/api/missions/${mission2Id}/candidatures`).set(auth(sansProfilToken));
    expect(apply.status).toBe(409);
  });

  it('l’admin n’a pas accès aux candidatures', async () => {
    expect((await request(app).get('/api/candidatures').set(auth(adminToken))).status).toBe(403);
  });

  it('une fois la mission pourvue, on ne peut plus accepter, seulement refuser avec justificatif', async () => {
    candSofiaId = (await request(app).post(`/api/missions/${mission2Id}/candidatures`).set(auth(agentToken))).body.candidature.id;
    // Karim n'est disponible que le samedi : la mission 2 n'impose pas de jour, il peut candidater.
    candKarimId = (await request(app).post(`/api/missions/${mission2Id}/candidatures`).set(auth(agentIndisponibleToken))).body.candidature.id;
    expect(candKarimId).toBeTypeOf('string');

    const accept = await request(app).patch(`/api/candidatures/${candSofiaId}`).set(auth(entrepriseToken)).send({ statut: 'ACCEPTEE' });
    expect(accept.body.mission.statut).toBe('POURVUE');

    const tooLate = await request(app).patch(`/api/candidatures/${candKarimId}`).set(auth(entrepriseToken)).send({ statut: 'ACCEPTEE' });
    expect(tooLate.status).toBe(409);

    const refused = await request(app)
      .patch(`/api/candidatures/${candKarimId}`)
      .set(auth(entrepriseToken))
      .send({ statut: 'REFUSEE', justificatif: 'Poste pourvu' });
    expect(refused.status).toBe(200);
    expect(refused.body.candidature).toMatchObject({ statut: 'REFUSEE', justificatifRefus: 'Poste pourvu' });
  });
});
