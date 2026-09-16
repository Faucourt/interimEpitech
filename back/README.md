# INTERIMATCH — API

Express 5 + TypeScript. Authentification par email / mot de passe (argon2id + JWT), trois rôles : `INTERIMAIRE`, `ENTREPRISE`, `ADMIN`. Bases de données : Supabase (PostgreSQL) pour les données métier, MongoDB (optionnel) pour les logs de matching. Profils, missions, candidatures et matching par score.

## Installation

```bash
npm install
cp .env.example .env   # puis renseigner les valeurs
```

## Configuration

Toutes les variables sont dans `.env.example`, lues par `src/config.ts` :

| Variable | Rôle |
| --- | --- |
| `PORT` | Port HTTP (3000 par défaut) |
| `CORS_ORIGIN` | Origine du front autorisée par le CORS |
| `JWT_SECRET` | Secret de signature des tokens (obligatoire hors test) |
| `JWT_EXPIRES_IN` | Durée de vie d'un token (`24h` par défaut) |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur Supabase — jamais côté front |
| `N8N_WEBHOOK_URL` | Optionnel. Webhook n8n appelé à la publication d'une mission ; vide = notification désactivée |
| `N8N_API_KEY` | Optionnel. Secret partagé avec n8n (header `X-Api-Key`) ; vide = route interne fermée (503) |
| `MONGODB_URI` | Optionnel. URI MongoDB (`mongodb://127.0.0.1:27017` en local) ; vide = logs de matching désactivés |
| `MONGODB_DB` | Nom de la base MongoDB (`cleanmatch` par défaut) |

Base de données : exécuter `sql/001_users.sql` puis `sql/002_domain.sql` dans Supabase > SQL Editor. Le compte `ADMIN` est seedé en base (insert manuel d'un utilisateur avec `role = 'ADMIN'` et un hash argon2id).

## Lancement

```bash
npm run dev     # développement, rechargement à chaud
npm run build   # compile dans dist/
npm start       # lance dist/index.js
```

## Tests

```bash
npm test                # vitest
npm run test:coverage   # + rapport de couverture dans coverage/
```

Les tests tournent sans base de données : l'API reçoit des dépôts en mémoire (`src/*/memoryRepository.ts`, assemblés dans `tests/helpers.ts`). Chaque module suit le même schéma : `repository.ts` (interface), `memoryRepository.ts` (tests), `supabaseRepository.ts` (prod) — ou `mongoRepository.ts` pour les logs de matching.

## Routes

Authentification : header `Authorization: Bearer <token>`. Trois rôles : `INTERIMAIRE` (inscription libre), `ENTREPRISE` (créée par l'admin, mot de passe temporaire à changer), `ADMIN` (seedé en base).

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | public | `{ status: "ok" }` |
| `POST` | `/api/auth/register` | public | Inscription **intérimaire** → `201 { token, user, mustChangePassword }` ; `409` si l'email existe ; `400` si `role: ENTREPRISE` |
| `POST` | `/api/auth/login` | public | Connexion → `200 { token, user, mustChangePassword }` ; `401` sinon ; `403` compte désactivé |
| `GET` | `/api/auth/me` | token | Utilisateur courant → `{ user }` |
| `POST` | `/api/auth/change-password` | token | `{ currentPassword, newPassword }` → `204`, remet `mustChangePassword` à false |
| `POST` | `/api/admin/entreprises` | `ADMIN` | Crée un compte entreprise → `201 { user, temporaryPassword }` (renvoyé une seule fois) |
| `PATCH` | `/api/admin/users/:id` | `ADMIN` | `{ isActive }` active / désactive un compte |
| `GET` | `/api/admin/logs-matching` | `ADMIN` | Historique des scores de matching (MongoDB), les plus récents d'abord → `{ logs: [{ missionId, interimaireId, scoreTotal, scoreMotsCles, scoreDernieresMissions, scoreLocalisation, disponibiliteCompatible, calculeLe }] }` ; filtres `?missionId=&interimaireId=&limit=` (100 par défaut) ; `[]` si MongoDB n'est pas configuré |
| `GET` | `/api/profil` | `INTERIMAIRE` | `{ profil, experiences }` (`profil: null` avant saisie) |
| `PUT` | `/api/profil` | `INTERIMAIRE` | Crée ou remplace le profil (compétences, types de nettoyage, code postal, rayon, jours, créneaux, disponible) |
| `POST` | `/api/profil/experiences` | `INTERIMAIRE` | Ajoute une expérience → `201 { experience }` |
| `DELETE` | `/api/profil/experiences/:id` | `INTERIMAIRE` | `204` ; `404` si ce n'est pas la sienne |
| `GET` | `/api/missions` | public | Missions ouvertes ; filtres `?type=&codePostal=&dateDebut=&dateFin=` |
| `GET` | `/api/missions/:id` | public | Détail d'une mission |
| `GET` | `/api/missions/mine` | `ENTREPRISE` | Ses missions |
| `GET` | `/api/missions/recommandees` | `INTERIMAIRE` | Missions compatibles triées par score → `{ recommandations: [{ mission, score }] }` |
| `POST` | `/api/missions` | `ENTREPRISE` | Crée une mission (`motif` obligatoire, durée ≤ 18 mois) → `201 { mission }` |
| `PUT` | `/api/missions/:id` | `ENTREPRISE` | Remplace sa mission |
| `DELETE` | `/api/missions/:id` | `ENTREPRISE` | `{ justificatif }` obligatoire → `204` (suppression logique) |
| `GET` | `/api/missions/:id/candidats` | `ENTREPRISE` | Agents disponibles triés par score → `{ candidats: [{ interimaire, profil, score }] }` |
| `POST` | `/api/missions/:id/candidatures` | `INTERIMAIRE` | Candidate → `201 { candidature, score }` ; `409` si indisponible, sans profil ou déjà candidat |
| `GET` | `/api/candidatures` | `INTERIMAIRE` / `ENTREPRISE` | Les siennes (avec la mission) / celles reçues (avec l'agent, filtre `?missionId=`) |
| `PATCH` | `/api/candidatures/:id` | `ENTREPRISE` | `{ statut: ACCEPTEE \| REFUSEE, justificatif? }` — justificatif obligatoire en cas de refus ; la mission passe à `POURVUE` quand `nbAgents` est atteint |
| `GET` | `/api/entreprise/dashboard` | `ENTREPRISE` | Démo de contrôle de rôle → `{ ok: true }` |
| `GET` | `/api/internal/missions/non-pourvues?jours=3` | header `X-Api-Key` | Pour n8n : missions `OUVERTE` depuis plus de `jours` jours sans candidature acceptée → `{ missions: [{ id, intitule, ville, codePostal, statut, createdAt, nbCandidatures, nbCandidaturesAcceptees, entreprise: { raisonSociale } }] }` ; `401` clé absente ou fausse, `503` si `N8N_API_KEY` n'est pas configurée |

Erreurs : toujours du JSON `{ error: "…" }` ; les erreurs de validation renvoient `400` avec un tableau `details`.

## Intégration n8n

Contrat complet dans `../n8n/README.md`. Deux points de contact, tous deux inactifs tant que les variables `N8N_*` sont vides :

- **Sortant** (`src/n8n/client.ts`) : à chaque `POST /api/missions`, l'API envoie au webhook n8n la mission et les agents dont le score de matching dépasse strictement 70. L'appel part après la réponse HTTP, avec un timeout de 3 s ; un échec (n8n éteint, réseau) est logué et n'affecte jamais la création.
- **Entrant** (`src/n8n/routes.ts`) : la route `/api/internal/missions/non-pourvues` est protégée par la clé partagée (`src/n8n/middleware.ts`), pas par le JWT.

## Base non relationnelle (MongoDB)

Le sujet impose une seconde base, non relationnelle : elle porte les **logs de matching** (collection `matching_logs`, base `cleanmatch`). Chaque score calculé — `GET /api/missions/:id/candidats`, `GET /api/missions/recommandees`, `POST /api/missions/:id/candidatures` — y est journalisé par `src/matching/service.ts` en arrière-plan : l'écriture n'est jamais attendue et un incident Mongo est logué sans faire échouer la requête. Un **index TTL de 6 mois** sur `calculeLe`, créé au démarrage (`src/matchingLogs/mongoRepository.ts`), applique la durée de conservation annoncée au titre du RGPD. Sans `MONGODB_URI`, la journalisation est désactivée et le reste de l'API est inchangé.

## Matching

`src/matching/score.ts` est une fonction pure (testée dans `tests/score.test.ts`) :

```
Score /100 = mots-clés (50) + dernières missions (25) + localisation (25)
```

- **Mots-clés** : normalisation (minuscules, accents, pluriels, mots vides) puis taux de recouvrement pondéré ; les `competencesRequises` et le type de nettoyage pèsent 2, les mots de la description 1.
- **Dernières missions** : sur les 5 expériences les plus récentes, +15 si même type, +10 si mots-clés communs ; la plus récente compte à 100 %, puis 80 %, 60 %…
- **Localisation** : distance haversine entre communes (table `communes`) ; 25 pts dans le rayon, dégressif, 0 au-delà du double du rayon.
- **Disponibilité** : filtre éliminatoire (`isAvailable`), aucun point. Un agent indisponible n'apparaît pas et ne peut pas candidater.
