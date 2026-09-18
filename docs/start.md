# Lancer CleanMatch en local

Guide de démarrage pour l'équipe. Ce document est mis à jour **à chaque fois qu'un nouveau
bloc doit être lancé** — voir le journal en bas de page.

## Vue d'ensemble

Tout tourne en local, sur chaque poste :

| Brique | Où | À lancer ? | Port |
| --- | --- | --- | --- |
| **Frontend** | `front/` | oui | 5173 |
| **Backend** | `back/` | oui | 3000 |
| **n8n** | global | oui, pour les automatisations | 5678 |
| **PostgreSQL** | Docker (`docker-compose.yml`) | oui | 5432 |
| **MongoDB** | local | oui, pour les logs de matching | 27017 |
| **CLI données** | `back/src/cli/` | non, ponctuel | — |

Chacun a **sa propre base PostgreSQL**, dans un conteneur Docker. Elle se crée en quatre
commandes (section 2 bis) : tables, compte admin, communes.

## Prérequis

- Node.js 20 ou plus (`node -v`)
- npm
- Docker (Docker Desktop ou OrbStack), lancé
- Un compte Discord avec accès au serveur de l'équipe (pour n8n uniquement)

---

## 1. Installation (une seule fois)

```bash
git clone <url-du-depot>
cd interimEpitech

cd front && npm install && cd ..
cd back  && npm install && cd ..
```

## 2. Configuration

Le fichier `back/.env` n'est **pas** versionné : chacun crée le sien.

```bash
cp back/.env.example back/.env
```

Puis renseigner :

| Variable | Valeur | Où la trouver |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://cleanmatch:cleanmatch@localhost:5432/cleanmatch` | déjà dans `.env.example` (base Docker locale) |
| `ADMIN_EMAIL` | `admin@cleanmatch.fr` | compte créé par `npm run db:seed` |
| `ADMIN_PASSWORD` | au choix | vide = généré et affiché une seule fois par le seed |
| `JWT_SECRET` | une chaîne aléatoire longue | à générer, propre à chaque poste |
| `JWT_EXPIRES_IN` | `24h` | — |
| `PORT` | `3000` | — |
| `CORS_ORIGIN` | `http://localhost:5173` | — |
| `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/cleanmatch/mission-publiee` | après installation de n8n |
| `N8N_API_KEY` | une chaîne aléatoire | **la même** que dans la credential n8n |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | après installation de MongoDB |
| `MONGODB_DB` | `cleanmatch` | — |
| `FRANCE_TRAVAIL_CLIENT_ID` / `_SECRET` | vides par défaut | [francetravail.io](https://francetravail.io), pour le CLI uniquement |

Générer un secret :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> ⚠️ Les secrets (`JWT_SECRET`, `N8N_API_KEY`, identifiants France Travail) ne vont **que**
> dans `back/.env`. Jamais dans `front/`, jamais dans un commit : Vite publie toute variable
> `VITE_*` dans le bundle envoyé au navigateur.

**Sans n8n**, laisser `N8N_WEBHOOK_URL` vide : les notifications sont alors désactivées
silencieusement et le reste de l'application fonctionne normalement. Idem pour `MONGODB_URI` :
vide, la journalisation des scores est désactivée sans rien casser.

## 2 bis. Base de données (une seule fois)

Depuis la racine du dépôt, Docker lancé :

```bash
docker compose up -d                    # démarre PostgreSQL (port 5432)
cd back
npm run db:migrate                      # crée les tables (fichiers back/sql/)
npm run db:seed                         # crée le compte ADMIN (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run import:communes                 # ~39 000 communes, pour le critère de distance
```

Les données sont conservées dans un volume Docker : un redémarrage de la machine ne perd rien.

---

## 3. Lancement quotidien

Docker lancé, la base redémarre toute seule (sinon `docker compose up -d`). Puis :

```bash
# Terminal 1 — backend, http://localhost:3000
cd back && npm run dev

# Terminal 2 — frontend, http://localhost:5173
cd front && npm run dev

# Terminal 3 — n8n, http://localhost:5678  (facultatif)
CLEANMATCH_API_URL=http://localhost:3000 n8n start

# Terminal 4 — MongoDB  (facultatif)
~/mongodb/mongod --dbpath ~/mongodb-data --port 27017 --bind_ip 127.0.0.1
```

Vérifier que le back répond :

```bash
curl http://localhost:3000/health     # {"status":"ok"}
```

---

## 4. n8n — installation (une seule fois par poste)

n8n stocke sa configuration dans `~/.n8n`, **local à chaque machine** : chacun refait cette
étape chez soi.

### 4.1 Installer

```bash
npm install -g n8n
```

### 4.2 Créer les credentials

Créer un fichier temporaire **hors du dépôt** (il contient des secrets) :

```bash
cat > /tmp/cm_creds.json <<'JSON'
[
  {
    "id": "cleanmatchDiscord01",
    "name": "CleanMatch Discord",
    "type": "discordWebhookApi",
    "data": { "webhookUri": "<URL DU WEBHOOK DISCORD>" }
  },
  {
    "id": "cleanmatchApiKey01",
    "name": "CleanMatch API Key",
    "type": "httpHeaderAuth",
    "data": { "name": "X-Api-Key", "value": "<LA MEME VALEUR QUE N8N_API_KEY>" }
  }
]
JSON

n8n import:credentials --input=/tmp/cm_creds.json
rm /tmp/cm_creds.json
```

L'URL du webhook Discord se récupère dans le salon : **Paramètres → Intégrations → Webhooks**.
Elle est **secrète** : qui l'a peut poster dans le salon.

Les `id` sont obligatoires : sans eux, l'import échoue avec
`SQLITE_CONSTRAINT: NOT NULL constraint failed`.

### 4.3 Importer et activer les workflows

Les fichiers du dépôt référencent les credentials par nom mais sans identifiant. Il faut les
relier avant l'import :

```bash
cd n8n/workflows
mkdir -p /tmp/cm_wf
python3 - <<'PY'
import json, glob, os
ids = {"discordWebhookApi": "cleanmatchDiscord01", "httpHeaderAuth": "cleanmatchApiKey01"}
wf  = {"01-notification-matching.json": "cleanmatchWf01",
       "02-relance-missions-non-pourvues.json": "cleanmatchWf02"}
for f in sorted(glob.glob('*.json')):
    d = json.load(open(f, encoding='utf-8'))
    d['id'] = wf[f]; d['active'] = True
    for n in d['nodes']:
        for t, c in (n.get('credentials') or {}).items():
            if t in ids: c['id'] = ids[t]
    json.dump(d, open(os.path.join('/tmp/cm_wf', f), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
PY

n8n import:workflow --separate --input=/tmp/cm_wf
n8n update:workflow --id=cleanmatchWf01 --active=true
n8n update:workflow --id=cleanmatchWf02 --active=true
rm -rf /tmp/cm_wf
```

> L'activation ne prend effet qu'au **démarrage suivant** de n8n. Si n8n tourne, l'arrêter
> (`pkill -f "n8n start"`) avant d'activer.

### 4.4 Vérifier

```bash
CLEANMATCH_API_URL=http://localhost:3000 n8n start &

# doit répondre 403 (clé absente)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:5678/webhook/cleanmatch/mission-publiee \
  -H 'Content-Type: application/json' -d '{}'

# doit répondre 200 et poster sur Discord
curl -X POST http://localhost:5678/webhook/cleanmatch/mission-publiee \
  -H 'Content-Type: application/json' -H "X-Api-Key: <N8N_API_KEY>" \
  -d '{"mission":{"id":"test","intitule":"Test","ville":"Paris","codePostal":"75012",
                  "dateDebut":"2026-09-21","dateFin":"2026-10-21","creneau":"SOIREE",
                  "remuneration":13.5},
       "agents":[{"id":"a1","prenom":"Test","nom":"Agent","email":"t@example.com","score":87}]}'
```

L'interface `http://localhost:5678` permet de voir les exécutions et leurs erreurs
(onglet **Executions**).

---

## 4 bis. MongoDB — installation (une seule fois par poste)

MongoDB porte les **logs de matching** : c'est la base non relationnelle exigée par le sujet,
en complément de PostgreSQL.

Homebrew échoue sur les postes dont les Command Line Tools sont anciens. La méthode qui marche
dans tous les cas est le binaire officiel, sans compilation :

```bash
mkdir -p ~/mongodb ~/mongodb-data
cd /tmp
curl -sL -o mongo.tgz https://fastdl.mongodb.org/osx/mongodb-macos-arm64-8.3.11.tgz
tar -xzf mongo.tgz
cp mongodb-macos-arm64-8.3.11/bin/* ~/mongodb/
rm -rf mongo.tgz mongodb-macos-arm64-8.3.11
~/mongodb/mongod --version
```

Lancer le serveur :

```bash
~/mongodb/mongod --dbpath ~/mongodb-data --port 27017 --bind_ip 127.0.0.1
```

Puis dans `back/.env` :

```
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=cleanmatch
```

> Sur un Mac Intel, remplacer `arm64` par `x86_64` dans l'URL de téléchargement.

---

## 4 ter. Import des données publiques

Le CLI (`back/src/cli/`) remplit les tables alimentées par les sources publiques. L'import des
communes fait partie de l'initialisation de la base (section 2 bis) ; à relancer seulement si la
table `communes` est vide :

```bash
cd back
npm run import:communes -- --dry-run   # simule, n'écrit rien
npm run import:communes                # importe réellement
```

Il fait partie du backend : même `npm install`, même `back/.env` que l'API.

Ces coordonnées servent au **critère de localisation du matching** (25 points sur 100). Sans
elles, ce critère ne fonctionne pas.

La commande `france-travail` exige des identifiants OAuth à demander sur
[francetravail.io](https://francetravail.io) (`FRANCE_TRAVAIL_CLIENT_ID` et
`FRANCE_TRAVAIL_CLIENT_SECRET`). Sans eux, elle s'arrête avec la marche à suivre.
Voir le `README.md`, section « Données publiques — CLI ».

---

## 5. Tests

```bash
cd back
npm test              # unitaires + fonctionnels, nettoyage des données publiques inclus — 139 tests
npm run test:coverage # rapport de couverture — livrable noté
npm run lint
npm run build
```

Les tests **ne nécessitent ni base de données, ni n8n, ni configuration** : la persistance passe par
une implémentation en mémoire et les appels réseau sont mockés.

---

## 6. Base de données

Le schéma vit dans `back/sql/`. `npm run db:migrate` applique dans l'ordre les fichiers pas
encore passés et les note dans la table `schema_migrations` : le relancer ne refait rien.

| Fichier | Contenu |
| --- | --- |
| `001_users.sql` | comptes et rôles |
| `002_domain.sql` | profils, expériences, missions, candidatures, communes |
| `003_competences_donnees_publiques.sql` | compétences qualifiées, données France Travail |

**Règle d'équipe** : toute évolution du schéma passe par un nouveau fichier `00X_*.sql`
commité, jamais par une modification à la main — sinon les 4 bases divergent. Après un pull
qui ajoute un fichier : `npm run db:migrate`.

Repartir d'une base vide :

```bash
docker compose down -v && docker compose up -d
cd back && npm run db:migrate && npm run db:seed && npm run import:communes
```

Consulter la base : `docker exec -it cleanmatch-postgres psql -U cleanmatch`.

## 7. Comptes de démonstration

Le compte **administrateur** est créé par `npm run db:seed`, avec `ADMIN_EMAIL` et
`ADMIN_PASSWORD` de `back/.env`.

Les comptes **intérimaires** se créent librement via `POST /api/auth/register`.
Les comptes **entreprise** ne peuvent être créés que par l'admin, via
`POST /api/admin/entreprises`.

---

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| Le back refuse de démarrer | `JWT_SECRET` ou `DATABASE_URL` absent de `back/.env` — c'est volontaire |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL arrêté : lancer Docker, puis `docker compose up -d` |
| `relation "users" does not exist` | tables pas créées : `cd back && npm run db:migrate` |
| Connexion admin refusée | `npm run db:seed` pas lancé, ou mot de passe différent de `ADMIN_PASSWORD` |
| `401` sur toutes les routes protégées | token absent, expiré, ou `JWT_SECRET` différent de celui qui a signé |
| Webhook n8n en `404` | workflow non **activé**, ou n8n redémarré sans l'activation |
| Webhook n8n en `403` | en-tête `X-Api-Key` absent ou différent de la credential |
| `/api/internal/...` en `503` | `N8N_API_KEY` absente de `back/.env` — la route se ferme au lieu de s'ouvrir |
| n8n ne joint pas le back (Docker) | utiliser `http://host.docker.internal:3000`, pas `localhost` |
| Aucun log de matching enregistré | `MONGODB_URI` absente de `back/.env`, ou `mongod` arrêté |
| Aucun message Discord | vérifier l'onglet *Executions* de n8n : l'erreur y est détaillée |

---

## Journal des mises à jour

| Date | Ajout |
| --- | --- |
| 2026-09-15 | Création du document : front, back, n8n, Supabase, tests |
| 2026-09-15 | Ajout de **MongoDB** (logs de matching, base non relationnelle) |
| 2026-09-15 | Ajout du **CLI `data/`** et import des 35 493 communes |
| 2026-09-18 | CLI déplacé dans **`back/src/cli/`** : plus de dossier `data/` ni de second `.env` |
| 2026-09-18 | **Supabase remplacé par PostgreSQL en Docker** : `docker compose up -d`, `db:migrate`, `db:seed` |

> **À faire évoluer** dès qu'une nouvelle brique doit être lancée.
