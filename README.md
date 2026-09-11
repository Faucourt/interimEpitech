# INTERIMATCH

Plateforme de mise en relation entre entreprises et intérimaires.

Projet Epitech D-WEB-901 — POC réalisé en 11 jours par un groupe de 4.

## Structure du dépôt

```
.
├── front/      Application web — React + Vite + TypeScript
├── back/       API — Node + TypeScript
├── data/       CLI d'import et de nettoyage des données publiques
├── n8n/        Workflows d'automatisation (exports JSON + captures)
└── docs/       Cahier des charges, étude de marché, chiffrage
```

Chaque partie a son propre `package.json` : les dépendances s'installent
séparément dans `front/`, `back/` et `data/`.

## Prérequis

- Node.js 20+
- npm
- Un projet Supabase (base PostgreSQL)

## Installation

```bash
git clone <url-du-depot>
cd interimEpitech

# Frontend
cd front && npm install && cd ..

# Backend
cd back && npm install && cd ..
```

## Configuration

Copier les fichiers d'exemple et renseigner les valeurs :

```bash
cp back/.env.example back/.env
cp front/.env.example front/.env
```

Les fichiers `.env` ne sont **jamais** commités. En cas de doute sur une
variable, demander à l'équipe plutôt que de pousser une valeur en clair.

## Lancement

```bash
# Frontend — http://localhost:5173
cd front && npm run dev

# Backend
cd back && npm run dev
```

## Tests

```bash
cd back && npm test              # tests unitaires et fonctionnels
cd back && npm run test:coverage # rapport de couverture
```

## Données publiques

Le script d'import et de nettoyage se trouve dans `data/`. Il récupère les
données, les normalise (libellés de poste, dédoublonnage, formats de dates et
de lieux) puis les charge en base.

## Automatisations n8n

Les workflows exportés sont dans `n8n/workflows/`. Pour les rejouer : importer
le JSON dans une instance n8n, puis reconfigurer les credentials (elles ne sont
pas incluses dans les exports).
