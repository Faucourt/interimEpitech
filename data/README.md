# `data/` — import et nettoyage des données publiques

CLI TypeScript ([commander](https://github.com/tj/commander.js)) qui récupère des données ouvertes,
les **nettoie et reformate** (libellés, doublons, dates, lieux), puis alimente des tables Supabase
utilisées par le produit. Chaque commande accepte `--dry-run` pour tout faire sauf écrire en base.

| Commande | Source | Table alimentée | Fonctionnalité servie |
| --- | --- | --- | --- |
| `communes` | [geo.api.gouv.fr](https://geo.api.gouv.fr/decoupage-administratif/communes) (ouverte, sans clé) | `communes` | critère de distance du matching |
| `france-travail` | [API Offres d'emploi v2](https://francetravail.io/data/api/offres-emploi) (OAuth2) | `donnees_france_travail` | tableau de tendances marché (espace admin) |

## Installation et commandes

```bash
cd data
npm install
npm run dev -- --help                 # aide générale
npm run dev -- communes --help        # aide d'une commande

npm test                              # tests unitaires du nettoyage (vitest)
npm run typecheck                     # tsc --noEmit
npm run build                         # compile dans dist/
npm start -- communes --dry-run       # version compilée
```

## Configuration

Copier `.env.example` en `.env` et renseigner les valeurs. Si `data/.env` n'existe pas, le CLI lit
`back/.env` en secours : les deux variables Supabase y sont identiques, inutile de les dupliquer.

| Variable | Requise pour | Où la trouver |
| --- | --- | --- |
| `SUPABASE_URL` | toute écriture en base | Supabase > Project Settings > API > Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | toute écriture en base | Supabase > Project Settings > API > `service_role` (secret, jamais côté front) |
| `FRANCE_TRAVAIL_CLIENT_ID` | `france-travail` | voir ci-dessous |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | `france-travail` | voir ci-dessous |

Sans identifiants Supabase, seul `--dry-run` fonctionne. Les `.env` sont ignorés par Git.

### Obtenir les identifiants France Travail

Gratuit, quelques minutes :

1. Créer un compte sur <https://francetravail.io>.
2. Menu **Mes applications** → **Créer une application** (nom libre, ex. CleanMatch).
3. Dans l'application, onglet **Catalogue** → souscrire à l'API **Offres d'emploi v2**.
4. Copier l'**identifiant client** et la **clé secrète** dans `data/.env`.

Sans eux, la commande s'arrête avec cette marche à suivre.

## `communes` — communes françaises

```bash
npm run dev -- communes --dry-run        # récupère, nettoie, affiche, n'écrit rien
npm run dev -- communes                  # import complet (≈ 35 000 communes, ≈ 39 000 lignes)
npm run dev -- communes --limit 500      # n'importe que les 500 premières communes (test rapide)
```

Nettoyage appliqué (`src/communes/clean.ts`, fonctions pures testées) :

- une commune à plusieurs codes postaux devient **une ligne par couple (code postal, commune)** ;
- le centre GeoJSON `[longitude, latitude]` est converti en colonnes `latitude` / `longitude` ;
- noms : espaces normalisés, noms tout en majuscules remis en casse française ;
- codes postaux recadrés sur 5 chiffres, entrées sans nom / code postal / coordonnées écartées ;
- **arrondissements municipaux prioritaires** : l'API renvoie Paris comme une seule commune à 21 codes
  postaux et un centre unique ; on le remplace par les 45 arrondissements de Paris, Lyon et Marseille
  (`75012` → « Paris 12e Arrondissement », pas « Paris ») ;
- dédoublonnage sur la clé primaire `(code_postal, nom)`.

L'écriture est un **upsert** sur `(code_postal, nom)` : relancer l'import ne crée aucun doublon.
La commande affiche un contrôle sur `75012` avant et après écriture.

## `france-travail` — offres d'emploi

```bash
npm run dev -- france-travail --dry-run              # ROME K2204 (nettoyage de locaux) par défaut
npm run dev -- france-travail --limit 300 --dry-run  # n'interroge que les 300 premières offres
npm run dev -- france-travail --code-rome K2203      # autre code ROME
```

Nettoyage appliqué (`src/franceTravail/clean.ts`, fonctions pures testées) :

- intitulés débarrassés des mentions « (H/F) », espaces et casse normalisés ;
- dates ISO 8601 ou `JJ/MM/AAAA` converties, invalides écartées ;
- lieux : code postal, code INSEE ou libellé « 75 - PARIS 12 » → département → région
  (Corse et outre-mer gérés) ;
- dédoublonnage par identifiant puis par empreinte (republications) ;
- agrégation par (code ROME, région, département, année), `difficulte_recrutement` = part des offres en
  ligne depuis plus de 30 jours (proxy de tension).

Upsert sur `(code_rome, region, bassin_emploi, annee)`. L'API plafonne une recherche à 3 150 offres.

## Structure

```
src/cli.ts                    point d'entrée commander
src/config.ts                 variables d'environnement (data/.env puis back/.env)
src/supabase.ts               client service_role + upsert par lots
src/format.ts                 affichage
src/communes/                 fetch (geo.api.gouv.fr), clean (pur), command
src/franceTravail/            fetch (OAuth2 + pagination), clean (pur), departements, command
tests/                        tests unitaires des fonctions de nettoyage
```
