# Cahier des charges — BlindTestGenerator

Version 0.1 — brouillon de travail, à valider/amender ensemble avant le début du développement.

## 1. Vision

Un système qui génère et publie automatiquement des vidéos de blind test musical sur YouTube, conçu dès le départ pour scaler vers :
- plusieurs chaînes en parallèle (langues/genres musicaux différents),
- plusieurs formats (vidéo longue 10-15 min, shorts ~1 min),
- plusieurs plateformes (YouTube d'abord, puis TikTok/Instagram/Facebook/Snapchat),
- une publication récurrente automatisée (hebdomadaire) sans repasser les mêmes morceaux sur une même chaîne.

## 2. Périmètre v1

**Inclus :**
- Génération d'une vidéo longue (10-15 min) de blind test, format fixe : **40 morceaux** par épisode (~15s/morceau : 10s timer + 5s révélation), ajustable via config.
- Sélection des morceaux via l'API Spotify (recherche/playlist/genre en config), avec exclusion des morceaux déjà utilisés sur la chaîne (historique en base).
- Récupération de l'extrait audio réel via l'API publique Deezer (`preview_url`, ~30s, sans authentification), matché par titre+artiste depuis les métadonnées Spotify.
- Rendu vidéo via **Remotion** (TypeScript/React) : compte à rebours 10s, révélation animée (pochette, titre, artiste) sur 5s, habillage visuel générique/neutre pour la v1 (waveform, transitions, typographie).
- Upload automatique sur YouTube via YouTube Data API v3 (OAuth), avec titre/description/tags générés depuis un template par chaîne.
- Une seule chaîne pilote pour valider le pipeline de bout en bout.
- Exécution déclenchée localement sur le Mac (launchd/cron) — pas encore de vrai "hébergement cloud" en v1.
- Base de données locale (SQLite) : configuration de chaîne, historique des morceaux utilisés, historique des runs/vidéos publiées.

**Explicitement hors v1** (mais prévu dans l'architecture) :
- Multi-chaînes actives simultanément (l'architecture le permet, mais on ne lance qu'une chaîne pilote).
- Format shorts (~1 min).
- Publication sur TikTok/Instagram/Facebook/Snapchat.
- Hébergement cloud / exécution indépendante du Mac.
- Gestion active des réclamations Content ID.

## 3. Stack technique

- **Langage** : TypeScript / Node.js (monorepo).
- **Moteur vidéo** : [Remotion](https://www.remotion.dev/) — vidéos générées comme des compositions React, rendu via `@remotion/renderer` (headless Chromium).
- **Base de données** : SQLite (via `better-sqlite3` ou Prisma) — suffisant en local, migrable vers Postgres si passage au cloud.
- **Intégrations externes** :
  - Spotify Web API (recherche, métadonnées, playlists) — OAuth Client Credentials (pas besoin d'un compte utilisateur, juste d'une app développeur Spotify).
  - Deezer API publique (extraits audio) — pas d'authentification requise.
  - YouTube Data API v3 (upload vidéo) — OAuth 2.0 avec compte Google + projet Google Cloud.
- **Automatisation locale** : `launchd` (macOS) déclenchant un script Node à intervalle régulier.

### Structure de repo envisagée (monorepo)

```
BlindTestGenerator/
├── packages/
│   ├── core/            # logique métier : sélection morceaux, anti-repeat, config chaîne
│   ├── integrations/
│   │   ├── spotify/     # client API Spotify (recherche, métadonnées)
│   │   ├── deezer/      # client API Deezer (résolution des previews audio)
│   │   └── youtube/     # upload via googleapis
│   ├── video-renderer/  # projet Remotion : compositions (timer, reveal, habillage)
│   └── db/              # schéma + accès SQLite (historique, config)
├── apps/
│   └── pipeline/        # orchestrateur : point d'entrée exécuté par launchd
├── channels/            # un fichier de config par chaîne (langue, genre, branding, credentials)
└── docs/
```

Cette séparation en packages est ce qui permet la scalabilité : ajouter une chaîne = ajouter un fichier de config, ajouter une plateforme = ajouter un module dans `integrations/` qui implémente une interface `Publisher` commune, ajouter un format = ajouter une composition Remotion qui réutilise les mêmes briques (timer, reveal, données).

## 4. Pipeline de génération (par run)

1. **Sélection** : charger la config de la chaîne, tirer N candidats depuis Spotify (playlist/genre défini en config), exclure les `track_id` déjà présents dans l'historique de cette chaîne, retenir 40 morceaux.
2. **Résolution audio** : pour chaque morceau, chercher le `preview_url` correspondant sur Deezer (match titre + artiste), échouer proprement et piocher un remplaçant si aucun match fiable.
3. **Rendu vidéo** : appeler Remotion avec la liste des 40 morceaux (audio + métadonnées + pochette) → génère un `.mp4` avec pour chaque morceau : 10s timer + 5s reveal animé.
4. **Génération de la miniature** (thumbnail) : image statique générée (probablement une frame Remotion dédiée).
5. **Publication YouTube** : upload du fichier avec titre/description/tags templatés selon la chaîne + config de confidentialité (public/non répertorié pour les tests).
6. **Enregistrement** : écrire en base les 40 morceaux utilisés (liés à la chaîne) + les métadonnées du run (date, id vidéo YouTube, statut).

## 5. Format vidéo — détail

Par morceau (~15s) :
- 0–10s : minuteur visible, extrait audio en lecture, visuel générique (waveform / arrière-plan animé) — le spectateur doit deviner.
- 10–15s : révélation animée — pochette de l'album, nom de l'artiste, titre du morceau, effet de transition/particules pour rendre ça "satisfaisant".

Décidé :
- animation du compte à rebours : **cercle de progression (ring) combiné à des chiffres qui défilent** — combo jugé le plus satisfaisant visuellement.

Points à figer avec le rendu Remotion (à itérer visuellement une fois le pipeline technique validé) :
- style de transition entre "devine" et "révélation",
- habillage sonore (tic-tac ? sting à la révélation ?) — à définir.

## 6. Modèle de données (SQLite)

- `channels` : id, nom, langue, genre/style musical, config de branding, identifiants OAuth YouTube (référence sécurisée, pas en clair dans le repo), programmation (fréquence).
- `tracks_used` : channel_id, spotify_track_id, titre, artiste, date d'utilisation, video_id (FK).
- `videos` : id, channel_id, date de génération, chemin fichier, youtube_video_id, statut (draft/uploaded/failed), format (long/short).

Ce modèle est ce qui garantit qu'on ne rejoue jamais deux fois le même morceau sur une même chaîne, et qu'on peut suivre l'historique par chaîne indépendamment.

## 7. Droits d'auteur & stratégie Content ID

Objectif affiché : chaînes publiques sérieuses avec monétisation visée à terme. Ce qui en découle pour la conception :
- Les extraits doivent rester courts et clairement transformatifs (montage, minuteur, effets, habillage) — le format blind test est un usage établi sur YouTube, mais des réclamations Content ID resteront probables (généralement une monétisation reversée à l'ayant droit plutôt qu'un strike, tant qu'on respecte les policies YouTube).
- Le champ `format`/`duration` par morceau doit être un paramètre de config facilement ajustable — si on constate trop de réclamations bloquantes, on doit pouvoir réduire la durée d'extrait sans réécrire le pipeline.
- Prévoir dans le modèle un champ de suivi de statut Content ID par vidéo, pour pouvoir monitorer plus tard (hors v1, mais la colonne peut être prévue dans `videos`).
- Ne pas viser l'esquive de la détection (hors-scope, contraire à la politique YouTube) — uniquement une conception qui minimise le risque via un usage transformatif légitime.

## 8. Prérequis côté utilisateur (à faire par toi, hors code)

- Créer une app développeur Spotify (spotify.com/dashboard) → récupérer `client_id`/`client_secret`.
- Créer un projet Google Cloud, activer "YouTube Data API v3", configurer l'écran de consentement OAuth, créer des identifiants OAuth (Desktop app) → fichier `client_secret.json`.
- Créer/désigner une chaîne YouTube de test (peut être une chaîne existante en non répertorié le temps des tests).
- Aucun compte requis côté Deezer (API publique en lecture).

Je pourrai te guider pas à pas pour chacune de ces étapes le moment venu — ce sont des actions à faire toi-même dans ton navigateur (création de compte/projet), je ne peux pas les faire à ta place.

## 9. Roadmap (au-delà de la v1)

- **v1.1** — Multi-chaînes : plusieurs fichiers de config actifs simultanément, scheduler par chaîne.
- **v1.2** — Format shorts (~1 min, moins de morceaux, montage plus punchy).
- **v1.3** — Passage à un hébergement cloud (VPS ou serverless) pour une automatisation indépendante du Mac.
- **v2** — Multi-plateformes : interface `Publisher` commune, implémentations TikTok (Content Posting API, review d'app requise), Meta Graph API (Instagram/Facebook), Snapchat (API de publication très limitée, à valider si seulement possible manuellement).
- **v2.x** — Monitoring actif des réclamations Content ID, dashboard de suivi multi-chaînes.

## 10. Risques identifiés

| Risque | Impact | Mitigation prévue |
|---|---|---|
| Deezer ne retourne pas de preview pour un morceau (catalogue incomplet) | Morceau à écarter | Fallback : piocher un autre candidat dans la sélection |
| Quota YouTube Data API (10 000 unités/jour, upload = 1600) | Limite ~6 uploads/jour/projet GCP | Non bloquant pour du hebdo multi-chaînes en v1 ; à surveiller si scale fort |
| Réclamation Content ID | Vidéo monétisée au profit de l'ayant droit, parfois blocage régional | Extraits courts, montage transformatif, config de durée ajustable |
| Rendu Remotion trop lent pour 40 segments | Temps de génération long | Mesurer dès le prototype, optimiser (rendu parallèle Remotion) si besoin |
| API TikTok/Snapchat peu ouvertes pour publication auto | Bloquant pour le multi-plateforme v2 | À valider au moment venu ; publication manuelle possible en repli |

## 11. Points encore ouverts

- Langue/genre musical de la chaîne pilote — recherche en cours sur le paysage concurrentiel par langue avant décision finale.
- Style précis de la transition reveal (au-delà du timer, déjà figé sur cercle + chiffres) — à itérer visuellement une fois le pipeline technique en place.
- Nom/identité de la chaîne pilote.
- Titre/description/tags exacts du template YouTube pour la chaîne pilote.
