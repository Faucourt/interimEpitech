# CleanMatch — Automatisations n8n

Deux workflows n8n, notifications sur **Discord** (webhook), exports importables dans `workflows/`.

| Fichier | Déclencheur | Ce qu'il fait |
| --- | --- | --- |
| `workflows/01-notification-matching.json` | Webhook appelé par le backend à la publication d'une mission | Un message Discord par agent dont le score de matching dépasse **70/100** |
| `workflows/02-relance-missions-non-pourvues.json` | Planifié, tous les jours à **9h** (Europe/Paris) | Interroge l'API, poste une relance groupée des missions **OUVERTE depuis plus de 3 jours sans candidature acceptée** |

Aucun secret dans les JSON : l'URL du webhook Discord et la clé d'API sont des **credentials n8n**,
l'URL de l'API est une **variable d'environnement**.

## 1. Lancer n8n en local

```bash
docker run -it --rm --name n8n -p 5678:5678 \
  -e CLEANMATCH_API_URL=http://host.docker.internal:3000 \
  -e GENERIC_TIMEZONE=Europe/Paris \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

Puis ouvrir <http://localhost:5678> et créer le compte propriétaire (local, aucune inscription en ligne).

`host.docker.internal` désigne la machine hôte depuis le conteneur : c'est là que tourne l'API
(`cd back && npm run dev`, port 3000). Sans Docker (`npx n8n`), utiliser `http://localhost:3000`.

## 2. Créer les credentials (noms exacts)

Menu **Credentials > Add credential**. Les workflows référencent les credentials **par nom** :
si le nom correspond, n8n les rattache tout seul à l'import ; sinon il suffit de les sélectionner
dans les nœuds concernés (bandeau d'avertissement).

| Nom | Type n8n | Contenu |
| --- | --- | --- |
| `CleanMatch Discord` | **Discord Webhook** | URL du webhook Discord (serveur Discord > paramètres du salon > Intégrations > Webhooks > Nouveau webhook > Copier l'URL) |
| `CleanMatch API Key` | **Header Auth** | Name : `X-Api-Key` — Value : un secret partagé avec le backend (`openssl rand -hex 32`) |

`CleanMatch API Key` sert dans les deux sens : n8n **vérifie** ce header sur le webhook entrant
(workflow 1) et **l'envoie** à l'API (workflow 2). Le backend le lit dans sa variable `N8N_API_KEY`.

## 3. Importer et activer

1. **Workflows > ⋯ > Import from File**, sélectionner `01-notification-matching.json`. Répéter pour `02-…`.
2. Ouvrir chaque workflow, vérifier que les nœuds Discord / Webhook / HTTP Request pointent bien vers les credentials ci-dessus.
3. Passer chaque workflow sur **Active** (interrupteur en haut à droite).

URL du webhook une fois le workflow 1 actif : `http://localhost:5678/webhook/cleanmatch/mission-publiee`
(en mode test, bouton *Test workflow* : `/webhook-test/…`, valable une seule requête).

## 4. Workflow 1 — contrat du webhook (à respecter côté backend)

`POST http://localhost:5678/webhook/cleanmatch/mission-publiee`
Headers : `Content-Type: application/json`, `X-Api-Key: <N8N_API_KEY>`

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

- Obligatoires : `mission.id`, `mission.intitule`, `agents[]` (peut être vide). Le reste est affiché si présent (`url` optionnelle : lien vers la fiche mission).
- Dates au format `YYYY-MM-DD` ou ISO 8601 ; `remuneration` en €/h brut ; `creneau` parmi `MATIN`, `JOURNEE`, `SOIREE`, `NUIT`, `WEEKEND`.
- n8n **re-filtre** sur `score > 70` (strict) : le backend peut envoyer tous les agents scorés ou seulement ceux au-dessus du seuil.
- `email` n'est **jamais** affiché sur Discord (donnée personnelle) ; il est prévu pour une éventuelle extension e-mail.
- Réponse : `200` immédiat (`responseMode: onReceived`), l'envoi Discord se fait ensuite. Le backend doit appeler ce webhook **sans bloquer** la création de mission : si n8n est éteint, logger l'erreur et continuer.

Test manuel :

```bash
curl -X POST http://localhost:5678/webhook/cleanmatch/mission-publiee \
  -H "Content-Type: application/json" -H "X-Api-Key: $N8N_API_KEY" \
  -d '{"mission":{"id":"demo-1","intitule":"Agent d'"'"'entretien bureaux","ville":"Lyon","codePostal":"69003","dateDebut":"2026-09-21","dateFin":"2026-10-03","creneau":"SOIREE","remuneration":13.5},"agents":[{"id":"a1","prenom":"Fatou","nom":"Diallo","score":87},{"id":"a2","prenom":"Marc","nom":"Petit","score":64}]}'
```

Résultat attendu : un seul message Discord (Marc, 64/100, est sous le seuil).

Nœuds : `Webhook mission publiée` (POST, Header Auth) → `Préparer les notifications` (Code : filtre score > 70,
formate un message par agent) → `Boucle sur les agents` (Loop Over Items, 1 par 1) → `Envoyer sur Discord` → retour boucle → `Terminé`.

## 5. Workflow 2 — contrat de l'API (à exposer côté backend)

`GET {CLEANMATCH_API_URL}/api/internal/missions/non-pourvues?jours=3`
Header envoyé : `X-Api-Key: <N8N_API_KEY>` — le backend renvoie `401` si le header ne correspond pas à `process.env.N8N_API_KEY`.

Réponse attendue :

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

- Idéalement le backend filtre déjà (`statut = 'OUVERTE'`, `created_at < now() - jours`, aucune candidature `ACCEPTEE`). n8n **re-filtre** de toute façon sur ces trois critères, donc une route qui renvoie toutes les missions ouvertes avec ces champs fonctionne aussi.
- `entreprise` est optionnel (affiché entre parenthèses si présent). Un tableau nu à la racine est accepté.
- Message Discord : une ligne par mission (intitulé, ville, date de publication, ancienneté, nombre de candidatures), les plus anciennes en premier, découpé en plusieurs messages au-delà de 2000 caractères. Si rien à relancer : branche `Rien à relancer`, aucun message.

Nœuds : `Tous les jours à 9h` (cron `0 9 * * *`) → `Récupérer les missions ouvertes` (HTTP Request, Header Auth) →
`Filtrer et formater la relance` (Code) → `Des missions à relancer ?` (IF `count > 0`) → `Poster la relance sur Discord` / `Rien à relancer`.

Test manuel : bouton **Test workflow** (exécute immédiatement sans attendre 9h).

## 6. Côté backend — variables à ajouter dans `back/.env`

```bash
N8N_WEBHOOK_URL=http://localhost:5678/webhook/cleanmatch/mission-publiee
N8N_API_KEY=<le même secret que la credential "CleanMatch API Key">
```

## 7. Points à vérifier à l'import

Les workflows ont été construits et validés hors instance n8n (JSON, connexions, logique des nœuds Code simulée). À contrôler au premier import :

- **Versions de nœuds** : `webhook` v2, `code` v2, `splitInBatches` v3, `discord` v2, `httpRequest` v4.2, `if` v2.2, `scheduleTrigger` v1.2. Une instance plus ancienne (< 1.20) peut demander de recréer un nœud dans sa version disponible.
- **Nœud Discord** : mode de connexion *Webhook* et credential `CleanMatch Discord` sélectionnés.
- **`$env.CLEANMATCH_API_URL`** (workflow 2) : nécessite l'accès aux variables d'environnement, autorisé par défaut en auto-hébergé (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`). Sur n8n Cloud, remplacer l'expression par l'URL directement dans le nœud HTTP Request ou par une variable n8n (`$vars`).
- **Cadence Discord** : un webhook Discord accepte environ 30 messages par minute. Au-delà d'une trentaine d'agents notifiés d'un coup, ajouter un nœud *Wait* (1 s) dans la boucle du workflow 1.
- Les messages du workflow 1 sont postés dans **un salon commun** en nommant l'agent (pas de message privé Discord : cela demanderait l'identifiant Discord de chaque agent, hors périmètre du POC).

## Captures

`screenshots/` : captures des deux workflows et d'une exécution réussie, à ajouter après le premier import (livrable « export ou capture des scénarios n8n »).
