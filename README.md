# BlindTestGenerator

Générateur et publieur automatique de vidéos de blind test musical. Voir le
[cahier des charges](docs/CAHIER_DES_CHARGES.md) pour la vision, l'architecture et les décisions produit.

## Prérequis

- Node.js 24 (voir `.nvmrc`)
- pnpm, via [Corepack](https://nodejs.org/api/corepack.html) (`corepack enable` puis `corepack prepare pnpm@9.15.0 --activate`)

## Installation

```bash
pnpm install
```

## Commandes courantes

```bash
pnpm build       # build tous les packages (via Turborepo, avec cache)
pnpm lint        # ESLint sur tout le monorepo
pnpm typecheck   # vérification des types sur tout le monorepo
pnpm test        # tests unitaires (Vitest) sur tout le monorepo
pnpm format      # formatage Prettier
```

Un hook pre-commit (Husky + lint-staged) lance automatiquement le lint, le typecheck et les
tests avant chaque commit. La CI GitHub Actions (`.github/workflows/ci.yml`) rejoue les mêmes
vérifications sur chaque push/PR, comme filet de sécurité si le hook local est contourné.

## Structure

```
packages/
  core/                 # logique métier (sélection des morceaux, rotation des thèmes)
  db/                   # schéma et accès SQLite
  integrations/
    spotify/            # métadonnées des morceaux
    deezer/             # extraits audio
    youtube/            # upload et playlists
  video-renderer/       # composition Remotion (rendu vidéo)
apps/
  pipeline/             # orchestrateur exécuté par la tâche planifiée locale
channels/               # un fichier de config JSON par chaîne
docs/                   # cahier des charges et documentation
```
