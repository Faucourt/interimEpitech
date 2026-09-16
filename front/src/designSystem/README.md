# CleanMatch Design System

Bibliothèque UI React/TypeScript construite avec Tailwind CSS. Elle contient uniquement les tokens, composants et primitives réutilisables de l'application.

## Architecture

```text
src/designSystem/
├── tokens/       couleurs, typographie, spacing, radius, shadows
├── components/   composants UI typés et composables
├── images/       actifs visuels du Design System
├── layout/       Container, Stack, Section
└── index.ts      API publique du Design System
```

Le catalogue de démonstration est séparé dans `front/designSystemShowcase/`. Il ne fait pas partie de la bibliothèque et possède sa propre entrée HTML : `front/design-system.html`.

## Importer

Utiliser l'export central :

```tsx
import { Button, Card, Input } from "./designSystem";
```

Les composants sont indépendants de la logique métier et n'appellent ni API ni backend.

## Composer

Le système suit la règle :

```text
composant + taille + variante/couleur + état
```

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
```

Exemples de composition :

```tsx
<Card variant="outlined" size="md">
  <Heading as="h2" size="md">Profil</Heading>
  <Text muted>Informations personnelles</Text>
</Card>

<FormField id="email" label="Adresse e-mail" error="Format invalide">
  <Input id="email" aria-invalid="true" />
</FormField>
```

## Composants

- **Actions** : `Button`, `ButtonCard`
- **Marque** : `Logo` (`size="1"` à `size="4"`)
- **Contenu** : `Card`, `Text`, `Heading`
- **Formulaires** : `Input`, `Select`, `Textarea`, `FormField`
- **Feedback** : `Badge`, `Status`, `EmptyState`
- **Utilitaire** : `SearchBar`
- **Layout** : `Container`, `Stack`, `Section`

## Ajouter un composant

1. Créer un dossier dans `src/designSystem/components/`.
2. Ajouter `Component.tsx` et `index.ts`.
3. Typer les props et centraliser les variantes dans des maps.
4. Utiliser les classes Tailwind et tokens existants.
5. Exporter le composant dans `components/index.ts`.
6. Ajouter sa présentation dans `front/designSystemShowcase/` si nécessaire.

Ne pas ajouter de logique métier, de couleurs arbitraires ou de doublon hors `src/designSystem/`.

## Principes

- mobile-first, responsive et utilisable au clavier ;
- focus visible, labels associés et messages d'erreur accessibles ;
- HTML sémantique et zones tactiles confortables ;
- variantes simples, typées et réutilisables ;
- aucune librairie UI externe.

## Vérifier

Depuis `front/` :

```bash
npm run build
npm run lint
```

## Lancer

```bash
npm run dev                 # application : http://localhost:5173/
npm run dev:design-system   # catalogue : http://localhost:5173/design-system.html
```

Les deux entrées utilisent Vite et le HMR : les modifications des composants et des styles sont visibles en temps réel dans le catalogue.
