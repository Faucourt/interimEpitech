import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { signToken } from '../src/auth/token';
import { createMemoryUserRepository } from '../src/users/memoryRepository';

const app = createApp(createMemoryUserRepository());

const entreprise = {
  email: 'contact@acme.fr',
  password: 'motdepasse',
  role: 'ENTREPRISE',
  raisonSociale: 'ACME',
  siret: '12345678901234',
};

const interimaire = {
  email: 'jean.dupont@mail.fr',
  password: 'motdepasse',
  role: 'INTERIMAIRE',
  prenom: 'Jean',
  nom: 'Dupont',
};

let tokenEntreprise = '';
let tokenInterimaire = '';

describe('GET /health', () => {
  it('répond ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/auth/register', () => {
  it('inscrit une entreprise', async () => {
    const res = await request(app).post('/api/auth/register').send(entreprise);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: entreprise.email, role: 'ENTREPRISE', raisonSociale: 'ACME' });
    expect(res.body.user.passwordHash).toBeUndefined();
    tokenEntreprise = res.body.token;
  });

  it('inscrit un intérimaire', async () => {
    const res = await request(app).post('/api/auth/register').send(interimaire);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'INTERIMAIRE', prenom: 'Jean', nom: 'Dupont' });
    tokenInterimaire = res.body.token;
  });

  it('refuse un email déjà pris', async () => {
    const res = await request(app).post('/api/auth/register').send(entreprise);
    expect(res.status).toBe(409);
  });

  it('refuse un corps invalide', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'pas-un-email', password: '123', role: 'ENTREPRISE' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte un utilisateur avec le bon mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: entreprise.email, password: entreprise.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.email).toBe(entreprise.email);
  });

  it('renvoie la même erreur 401 pour un mauvais mot de passe et pour un email inconnu', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: entreprise.email, password: 'mauvais-mdp' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@mail.fr', password: 'motdepasse' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe('GET /api/auth/me', () => {
  it('refuse sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it("renvoie l'utilisateur courant avec un token", async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenEntreprise}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(entreprise.email);
  });

  it("refuse un token valide dont le compte n'existe plus", async () => {
    const token = signToken({ sub: 'compte-supprime', email: 'ex@mail.fr', role: 'INTERIMAIRE' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/entreprise/dashboard', () => {
  it('refuse un compte intérimaire', async () => {
    const res = await request(app)
      .get('/api/entreprise/dashboard')
      .set('Authorization', `Bearer ${tokenInterimaire}`);
    expect(res.status).toBe(403);
  });

  it('accepte un compte entreprise', async () => {
    const res = await request(app)
      .get('/api/entreprise/dashboard')
      .set('Authorization', `Bearer ${tokenEntreprise}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('gestion des erreurs', () => {
  it('renvoie 400 sur un JSON mal formé', async () => {
    const res = await request(app).post('/api/auth/login').type('json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Requête invalide' });
  });

  it("renvoie 500 sans exposer le détail d'une erreur interne", async () => {
    const broken = createApp({
      ...createMemoryUserRepository(),
      findByEmail: async () => {
        throw new Error('connexion base perdue');
      },
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(broken).post('/api/auth/login').send({ email: 'a@b.fr', password: 'motdepasse' });
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne' });
  });
});
