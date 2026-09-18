# Collection Postman — CleanMatch

Scénario de démonstration complet de l'API, sans frontend. Utile pour développer, et pour
**dérouler la démo en direct devant le jury**.

## Import dans Postman

`File → Import` → sélectionner `CleanMatch.postman_collection.json`.

Puis, dans l'onglet **Variables** de la collection, renseigner `adminPassword`
(volontairement laissé vide ici : le fichier est commité — demander à l'équipe).

## Avant de lancer

```bash
cd back && npm run dev     # http://localhost:3000
```

Facultatif, pour la démo complète : lancer aussi MongoDB (logs de matching) et n8n
(notification Discord). Voir `docs/start.md`.

## Ordre des dossiers

Les dossiers sont numérotés et **doivent être déroulés dans l'ordre** : chaque requête
alimente la suivante (jetons, identifiants de mission et de candidature se propagent
automatiquement, aucune valeur à recopier).

| Dossier | Ce qu'il démontre |
| --- | --- |
| 0 — Santé | l'API répond |
| 1 — Admin | l'admin crée le compte entreprise et son mot de passe temporaire |
| 2 — Entreprise | changement du mot de passe imposé, puis publication d'une mission |
| 3 — Intérimaire | inscription libre, profil, compétences qualifiées, **score de matching**, candidature |
| 4 — Entreprise | candidats triés par score, refus motivé obligatoire, acceptation |
| 5 — Admin | logs de matching (MongoDB) et tendances marché |
| 6 — Public | pages publiques et contrôle d'accès |

## Le scénario

Il rejoue l'exemple de référence du cahier des charges : une mission **Paris 12e**, en
**soirée**, nettoyage de bureaux avec autolaveuse — et un agent basé à **Vincennes**,
disponible en soirée, expérimenté sur les bureaux.

Résultat attendu : un score de l'ordre de **88/100**, avec le détail des trois critères
(mots-clés, dernières missions, localisation).

## Les cas d'échec sont volontaires

Quatre requêtes vérifient que l'API **refuse** ce qu'elle doit refuser. Elles sont vertes
quand elles échouent côté API :

- mission sans `motif` → **400** (mention obligatoire du contrat de mission)
- inscription publique d'une entreprise → **400** (passage par l'admin obligatoire)
- refus de candidature sans justificatif → **400** (règle métier)
- accès admin par un intérimaire → **403**, et `/api/profil` sans jeton → **401**

C'est souvent ce que le jury demande à voir.

## Tout lancer d'un coup

Dans Postman : bouton **Run** de la collection.

En ligne de commande :

```bash
npm install -g newman
newman run postman/CleanMatch.postman_collection.json --env-var adminPassword=LE_MOT_DE_PASSE
```

Attendu : **28 requêtes, 41 assertions, 0 échec**.

## Attention

Chaque exécution **crée des données réelles** dans la base Supabase partagée : un compte
entreprise, un agent, une mission. Les emails sont horodatés pour éviter les collisions, mais
pensez à faire le ménage après plusieurs passages, sinon la liste des candidats se remplit de
doublons.
