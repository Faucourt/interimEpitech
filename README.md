# CleanMatch

Plateforme d'intermédiation spécialisée dans les métiers de la **propreté et du nettoyage
professionnel** : elle met en relation les entreprises de propreté et les agents intérimaires
grâce à un matching sur les compétences, les disponibilités, l'expérience et la localisation.

Projet Epitech D-WEB-901 — POC réalisé en 11 jours par Titouan BRUNET, Alexandre FAUCOURT,
Boudiab ISRAE et Glenn TCHAMAGAM.

- [Structure du dépôt](#structure-du-dépôt)
- [Démarrage rapide](#démarrage-rapide)
- [Tests](#tests)
- [Backend — API](#backend--api)
- [Données publiques — CLI](#données-publiques--cli)
- [Automatisations n8n](#automatisations-n8n)
- [Démo de l'API — Postman](#démo-de-lapi--postman)
- [Frontend — Design System](#frontend--design-system)

Guide de lancement pas à pas (n8n, MongoDB, dépannage) : [`docs/start.md`](docs/start.md).

## Structure du dépôt

```
.
├── front/      Application web — React + Vite + TypeScript
├── back/       API — Express 5 + TypeScript, et CLI d'import des données publiques (src/cli/)
├── n8n/        Workflows d'automatisation (exports JSON + captures)
├── postman/    Collection de démonstration de l'API
└── docs/       Cahier des charges, étude de marché, guide de lancement
```

Chaque partie a son propre `package.json` : les dépendances s'installent séparément dans
`front/` et `back/`.

## Démarrage rapide

Prérequis : Node.js 20+, npm, Docker (Docker Desktop ou OrbStack).

```bash
git clone <url-du-depot>
cd interimEpitech

cd front && npm install && cd ..
cd back  && npm install && cd ..

cp back/.env.example back/.env              # puis renseigner les valeurs
cp front/.env.example front/.env.local

docker compose up -d                        # PostgreSQL local, port 5432
cd back
npm run db:migrate                          # crée les tables (back/sql/)
npm run db:seed                             # crée le compte ADMIN
npm run import:communes                     # communes, pour le critère de distance
cd ..
```

Les fichiers `.env` ne sont **jamais** commités. En cas de doute sur une variable, demander à
l'équipe plutôt que de pousser une valeur en clair.

```bash
cd back  && npm run dev     # API — http://localhost:3000
cd front && npm run dev     # application — http://localhost:5173
```

## Tests

```bash
cd back
npm test                # unitaires + fonctionnels (139 tests)
npm run test:coverage   # + rapport de couverture dans coverage/ (livrable)
npm run lint
npm run build
```

Les tests tournent sans base de données, sans n8n et sans configuration : l'API reçoit des dépôts
en mémoire (`src/*/memoryRepository.ts`, assemblés dans `tests/helpers.ts`) et les appels réseau
sont mockés.

---

## Backend — API

Express 5 + TypeScript. Authentification par email / mot de passe (argon2id + JWT), trois rôles :
`INTERIMAIRE`, `ENTREPRISE`, `ADMIN`. Deux bases, comme l'impose le sujet : **PostgreSQL**
(relationnelle, driver `pg`, SQL paramétré) pour les données métier, **MongoDB** (non
relationnelle) pour les logs de matching.

Chaque module suit le même schéma : `repository.ts` (interface), `memoryRepository.ts` (tests),
`pgRepository.ts` (prod) — ou `mongoRepository.ts` pour les logs de matching.

```bash
npm run dev     # développement, rechargement à chaud
npm run build   # compile dans dist/
npm start       # lance dist/index.js
```

### Configuration

Un seul fichier, `back/.env` (modèle : `back/.env.example`), lu par l'API (`src/config.ts`) et par
le CLI (`src/cli/config.ts`).

| Variable | Rôle |
| --- | --- |
| `PORT` | Port HTTP (3000 par défaut) |
| `CORS_ORIGIN` | Origine du front autorisée par le CORS |
| `JWT_SECRET` | Secret de signature des tokens (obligatoire hors test) |
| `JWT_EXPIRES_IN` | Durée de vie d'un token (`24h` par défaut) |
| `DATABASE_URL` | URL PostgreSQL (obligatoire hors test) ; la base Docker locale par défaut |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte ADMIN créé par `npm run db:seed` ; mot de passe vide = généré et affiché |
| `N8N_WEBHOOK_URL` | Optionnel. Webhook n8n appelé à la publication d'une mission ; vide = notification désactivée |
| `N8N_API_KEY` | Optionnel. Secret partagé avec n8n (header `X-Api-Key`) ; vide = route interne fermée (503) |
| `MONGODB_URI` | Optionnel. URI MongoDB (`mongodb://127.0.0.1:27017` en local) ; vide = logs de matching désactivés |
| `MONGODB_DB` | Nom de la base MongoDB (`cleanmatch` par défaut) |
| `FRANCE_TRAVAIL_CLIENT_ID` / `_SECRET` | CLI uniquement. Identifiants OAuth2 pour `import:france-travail` |

### Base de données

PostgreSQL 17 tourne en Docker (`docker-compose.yml` à la racine, données dans un volume). Le
schéma est versionné dans `back/sql/` (`001` → `003`) :

```bash
npm run db:migrate   # applique les fichiers pas encore passés (suivi dans schema_migrations)
npm run db:seed      # crée le compte ADMIN s'il n'existe pas
```

Toute évolution du schéma passe par un nouveau fichier `00X_*.sql` commité.

### Routes

Authentification : header `Authorization: Bearer <token>`. `INTERIMAIRE` s'inscrit librement,
`ENTREPRISE` est créée par l'admin (mot de passe temporaire à changer), `ADMIN` est seedé.

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | public | `{ status: "ok" }` |
| `POST` | `/api/auth/register` | public | Inscription **intérimaire** → `201 { token, user, mustChangePassword }` ; `409` si l'email existe ; `400` si `role: ENTREPRISE` |
| `POST` | `/api/auth/login` | public | Connexion → `200 { token, user, mustChangePassword }` ; `401` sinon ; `403` compte désactivé |
| `GET` | `/api/auth/me` | token | Utilisateur courant → `{ user }` |
| `POST` | `/api/auth/change-password` | token | `{ currentPassword, newPassword }` → `204`, remet `mustChangePassword` à false |
| `POST` | `/api/admin/entreprises` | `ADMIN` | Crée un compte entreprise → `201 { user, temporaryPassword }` (renvoyé une seule fois) |
| `PATCH` | `/api/admin/users/:id` | `ADMIN` | `{ isActive }` active / désactive un compte |
| `GET` | `/api/admin/tendances` | `ADMIN` | Tendances marché (données France Travail) → `{ tendances }` ; filtres `?annee=&codeRome=` |
| `GET` | `/api/admin/logs-matching` | `ADMIN` | Historique des scores (MongoDB), plus récents d'abord → `{ logs }` ; filtres `?missionId=&interimaireId=&limit=` (100 par défaut) ; `[]` sans MongoDB |
| `GET` | `/api/competences` | public | Référentiel des compétences → `{ competences }` |
| `GET` | `/api/profil` | `INTERIMAIRE` | `{ profil, experiences }` (`profil: null` avant saisie) |
| `PUT` | `/api/profil` | `INTERIMAIRE` | Crée ou remplace le profil (compétences, types de nettoyage, code postal, rayon, jours, créneaux, disponible) |
| `GET` | `/api/profil/competences` | `INTERIMAIRE` | Compétences qualifiées → `{ competences }` |
| `PUT` | `/api/profil/competences` | `INTERIMAIRE` | `{ competences: [{ competenceId, niveau, anneesExperience? }] }` ; `409` sans profil, `400` compétence inconnue |
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
| `GET` | `/api/internal/missions/non-pourvues?jours=3` | header `X-Api-Key` | Pour n8n, voir [Automatisations n8n](#automatisations-n8n) ; `401` clé absente ou fausse, `503` si `N8N_API_KEY` n'est pas configurée |

Erreurs : toujours du JSON `{ error: "…" }` ; les erreurs de validation renvoient `400` avec un
tableau `details`. Un score est un objet `{ total, details }`.

### Matching

`src/matching/score.ts` est une fonction pure (testée dans `tests/score.test.ts`) :

```
Score /100 = mots-clés (50) + dernières missions (25) + localisation (25)
```

- **Mots-clés** : normalisation (minuscules, accents, pluriels, mots vides) puis taux de
  recouvrement pondéré ; les compétences requises et le type de nettoyage pèsent 2, les mots de la
  description 1. Les compétences qualifiées comptent selon leur niveau (débutant 0,5 → expert 1).
- **Dernières missions** : sur les 5 expériences les plus récentes, +15 si même type, +10 si
  mots-clés communs ; la plus récente compte à 100 %, puis 80 %, 60 %…
- **Localisation** : distance haversine entre communes (table `communes`) ; 25 pts dans le rayon,
  dégressif, 0 au-delà du double du rayon.
- **Disponibilité** : filtre éliminatoire, aucun point. Un agent indisponible n'apparaît pas et ne
  peut pas candidater.

### Base non relationnelle (MongoDB)

Le sujet impose une seconde base, non relationnelle : elle porte les **logs de matching**
(collection `matching_logs`, base `cleanmatch`). Chaque score calculé — candidats d'une mission,
missions recommandées, candidature — y est journalisé par `src/matching/service.ts` en arrière-plan :
l'écriture n'est jamais attendue et un incident Mongo est logué sans faire échouer la requête.
Un **index TTL de 6 mois** sur `calculeLe` applique la durée de conservation annoncée au titre du
RGPD. Sans `MONGODB_URI`, la journalisation est désactivée et le reste de l'API est inchangé.

---

## Données publiques — CLI

CLI TypeScript ([commander](https://github.com/tj/commander.js)) intégré au backend
(`back/src/cli/`) : il récupère des données ouvertes, les **nettoie et reformate** (libellés,
doublons, dates, lieux), puis alimente des tables PostgreSQL utilisées par le produit. Même
`npm install` et même `back/.env` que l'API.

| Commande | Source | Table alimentée | Fonctionnalité servie |
| --- | --- | --- | --- |
| `communes` | [geo.api.gouv.fr](https://geo.api.gouv.fr/decoupage-administratif/communes) (ouverte, sans clé) | `communes` | critère de distance du matching |
| `france-travail` | [API Offres d'emploi v2](https://francetravail.io/data/api/offres-emploi) (OAuth2) | `donnees_france_travail` | tableau de tendances marché (espace admin) |

Depuis `back/` :

```bash
npm run cli -- --help                                   # aide générale
npm run import:communes -- --dry-run                    # récupère, nettoie, affiche, n'écrit rien
npm run import:communes                                 # import complet (≈ 39 000 lignes)
npm run import:communes -- --limit 500                  # test rapide
npm run import:france-travail -- --dry-run              # ROME K2204 (nettoyage de locaux) par défaut
npm run import:france-travail -- --code-rome K2203      # autre code ROME
```

`--dry-run` fait tout sauf écrire en base. Les écritures sont des **upserts** : relancer un import
ne crée aucun doublon.

**Identifiants France Travail** (gratuits) : créer un compte sur <https://francetravail.io>,
**Mes applications** → **Créer une application**, onglet **Catalogue** → souscrire à l'API
**Offres d'emploi v2**, puis copier l'identifiant client et la clé secrète dans `back/.env`.

Nettoyage des communes (`src/cli/communes/clean.ts`, fonctions pures testées) :

- une commune à plusieurs codes postaux devient **une ligne par couple (code postal, commune)** ;
- le centre GeoJSON `[longitude, latitude]` est converti en colonnes `latitude` / `longitude` ;
- noms : espaces normalisés, noms tout en majuscules remis en casse française ;
- codes postaux recadrés sur 5 chiffres, entrées sans nom / code postal / coordonnées écartées ;
- **arrondissements municipaux prioritaires** : l'API renvoie Paris comme une seule commune à 21
  codes postaux ; on la remplace par les 45 arrondissements de Paris, Lyon et Marseille
  (`75012` → « Paris 12e Arrondissement ») ;
- dédoublonnage sur la clé primaire `(code_postal, nom)`.

Nettoyage des offres France Travail (`src/cli/franceTravail/clean.ts`, fonctions pures testées) :

- intitulés débarrassés des mentions « (H/F) », espaces et casse normalisés ;
- dates ISO 8601 ou `JJ/MM/AAAA` converties, invalides écartées ;
- lieux : code postal, code INSEE ou libellé « 75 - PARIS 12 » → département → région (Corse et
  outre-mer gérés) ;
- dédoublonnage par identifiant puis par empreinte (republications) ;
- agrégation par (code ROME, région, département, année) ; `difficulte_recrutement` = part des
  offres en ligne depuis plus de 30 jours (proxy de tension). L'API plafonne une recherche à
  3 150 offres.

---

## Automatisations n8n

Deux workflows, notifications sur **Discord** (webhook), exports importables dans
`n8n/workflows/`. Installation, credentials et activation : [`docs/start.md`](docs/start.md),
section 4.

| Fichier | Déclencheur | Ce qu'il fait |
| --- | --- | --- |
| `01-notification-matching.json` | Webhook appelé par le backend à la publication d'une mission | Un message Discord par agent dont le score de matching dépasse **70/100** |
| `02-relance-missions-non-pourvues.json` | Planifié, tous les jours à **9h** (Europe/Paris) | Relance groupée des missions **OUVERTE depuis plus de 3 jours sans candidature acceptée** |

Aucun secret dans les JSON : l'URL du webhook Discord et la clé d'API sont des **credentials n8n**
(`CleanMatch Discord`, type Discord Webhook ; `CleanMatch API Key`, type Header Auth, name
`X-Api-Key`), l'URL de l'API est la variable d'environnement `CLEANMATCH_API_URL`. La clé d'API sert
dans les deux sens : n8n la **vérifie** sur le webhook entrant et **l'envoie** à l'API ; le backend
la lit dans `N8N_API_KEY`.

### Workflow 1 — webhook appelé par le backend

`POST http://localhost:5678/webhook/cleanmatch/mission-publiee`, headers
`Content-Type: application/json` et `X-Api-Key: <N8N_API_KEY>`.

```json
{
  "mission": {
    "id": "uuid",
    "intitule": "Agent d'entretien bureaux",
    "ville": "Lyon",
    "codePostal": "69003",
    "dateDebut": "2026-09-21",
    "dateFin": "2026-10-03",
    "creneau": "SOIREE",
    "remuneration": 13.5,
    "url": "https://cleanmatch.example/missions/uuid"
  },
  "agents": [
    { "id": "uuid", "prenom": "Fatou", "nom": "Diallo", "email": "fatou@example.fr", "score": 87 }
  ]
}
```

- Obligatoires : `mission.id`, `mission.intitule`, `agents[]` (peut être vide).
- n8n **re-filtre** sur `score > 70` (strict). `email` n'est **jamais** affiché sur Discord.
- Réponse `200` immédiate. Le backend appelle ce webhook **sans bloquer** la création de mission
  (`src/n8n/client.ts`, timeout 3 s) : si n8n est éteint, l'erreur est loguée et la création réussit.

### Workflow 2 — route appelée par n8n

`GET {CLEANMATCH_API_URL}/api/internal/missions/non-pourvues?jours=3`, header
`X-Api-Key: <N8N_API_KEY>` (protégée par `src/n8n/middleware.ts`, pas par le JWT).

```json
{
  "missions": [
    {
      "id": "uuid",
      "intitule": "Nettoyage fin de chantier",
      "ville": "Villeurbanne",
      "codePostal": "69100",
      "statut": "OUVERTE",
      "createdAt": "2026-09-08T08:00:00.000Z",
      "nbCandidatures": 2,
      "nbCandidaturesAcceptees": 0,
      "entreprise": { "raisonSociale": "Propreté Rhône" }
    }
  ]
}
```

Le message Discord liste une ligne par mission, les plus anciennes en premier ; rien n'est posté
s'il n'y a rien à relancer.

Captures des workflows : `n8n/screenshots/` (livrable « export ou capture des scénarios n8n »).

---

## Démo de l'API — Postman

`postman/CleanMatch.postman_collection.json` déroule le parcours complet sans frontend, utile pour
la **démo en direct devant le jury**. Import : `File → Import`, puis renseigner `adminPassword`
dans l'onglet **Variables** de la collection (laissé vide dans le fichier commité — demander à
l'équipe).

Les dossiers se déroulent **dans l'ordre** : jetons et identifiants se propagent tout seuls.

| Dossier | Ce qu'il démontre |
| --- | --- |
| 0 — Santé | l'API répond |
| 1 — Admin | l'admin crée le compte entreprise et son mot de passe temporaire |
| 2 — Entreprise | changement du mot de passe imposé, puis publication d'une mission |
| 3 — Intérimaire | inscription libre, profil, compétences qualifiées, **score de matching**, candidature |
| 4 — Entreprise | candidats triés par score, refus motivé obligatoire, acceptation |
| 5 — Admin | logs de matching (MongoDB) et tendances marché |
| 6 — Public | pages publiques et contrôle d'accès |

Scénario : une mission **Paris 12e** en soirée (bureaux, autolaveuse) et un agent basé à
**Vincennes** → score attendu de l'ordre de **88/100**. Quatre requêtes vérifient des **refus
volontaires** (mission sans `motif` → 400, inscription publique d'une entreprise → 400, refus sans
justificatif → 400, accès admin par un intérimaire → 403).

```bash
npm install -g newman
newman run postman/CleanMatch.postman_collection.json --env-var adminPassword=LE_MOT_DE_PASSE
```

Attendu : **28 requêtes, 41 assertions, 0 échec**. ⚠️ Chaque exécution crée des données réelles
dans votre base locale (emails horodatés) : faire le ménage après plusieurs passages.

---

## Frontend — Design System

Bibliothèque UI React/TypeScript construite avec Tailwind CSS, dans `front/src/designSystem/`. Elle
contient uniquement les tokens, composants et primitives réutilisables de l'application.

```text
front/src/designSystem/
├── tokens/       couleurs, typographie, spacing, radius, shadows
├── components/   composants UI typés et composables
├── images/       actifs visuels du Design System
├── layout/       Container, Stack, Section
└── index.ts      API publique du Design System
```

Le catalogue de démonstration est séparé dans `front/designSystemShowcase/`, avec sa propre entrée
HTML : `front/design-system.html`.

```bash
cd front
npm run dev                 # application : http://localhost:5173/
npm run dev:design-system   # catalogue : http://localhost:5173/design-system.html
npm run build
npm run lint
```

### Utiliser

Importer depuis l'export central. Les composants sont indépendants de la logique métier et
n'appellent ni API ni backend.

```tsx
import { Button, Card, Input } from "./designSystem";
```

Règle de composition : `composant + taille + variante/couleur + état`.

```tsx
<Button variant="primary" size="2">
  Enregistrer
</Button>

<ButtonCard
  color="secondary"
  size="2"
  title="Choisir une option"
  description="Description facultative"
  selected
/>

<Card variant="outlined" size="md">
  <Heading as="h2" size="md">Profil</Heading>
  <Text muted>Informations personnelles</Text>
</Card>

<FormField id="email" label="Adresse e-mail" error="Format invalide">
  <Input id="email" aria-invalid="true" />
</FormField>
```

Composants disponibles :

- **Actions** : `Button`, `ButtonCard`
- **Marque** : `Logo` (`size="1"` à `size="4"`)
- **Contenu** : `Card`, `Text`, `Heading`
- **Formulaires** : `Input`, `Select`, `Textarea`, `FormField`
- **Feedback** : `Badge`, `Status`, `EmptyState`
- **Utilitaire** : `SearchBar`
- **Layout** : `Container`, `Stack`, `Section`

### Ajouter un composant

1. Créer un dossier dans `src/designSystem/components/`.
2. Ajouter `Component.tsx` et `index.ts`.
3. Typer les props et centraliser les variantes dans des maps.
4. Utiliser les classes Tailwind et tokens existants.
5. Exporter le composant dans `components/index.ts`.
6. Ajouter sa présentation dans `front/designSystemShowcase/` si nécessaire.

Ne pas ajouter de logique métier, de couleurs arbitraires ou de doublon hors `src/designSystem/`.

Principes : mobile-first, responsive et utilisable au clavier ; focus visible, labels associés et
messages d'erreur accessibles ; HTML sémantique et zones tactiles confortables ; variantes simples,
typées et réutilisables ; aucune librairie UI externe.
