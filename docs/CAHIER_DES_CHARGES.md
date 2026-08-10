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

- Génération d'une vidéo longue (~17 min) de blind test, format fixe : **60 morceaux** par épisode (~17s/morceau : 12s timer + 5s révélation), plus une intro (~12s, règles du jeu + rappel abonnement) et une outro (~6s, rappel abonnement) — ajustable via config. Durée et nombre de morceaux alignés sur l'observation concurrentielle (12s/morceau, vidéos de 15-20 min).
- **Publication quotidienne** (1 vidéo/jour) avec **rotation de 7 thèmes musicaux, un par jour de la semaine** (voir section 5bis) — chaque thème a sa propre playlist YouTube et un titre de vidéo explicite sur son contenu. Ce mécanisme de rotation par config est volontairement générique : une future chaîne mono-thème spécialisée (autre langue/genre) réutilisera le même code avec une liste d'un seul thème répété tous les jours.
- **Visibilité progressive** : tant que le pipeline n'est pas validé de bout en bout, les vidéos sont uploadées en **privé** (visibilité YouTube `private`) — bascule manuelle vers `public` une fois la qualité confirmée sur plusieurs runs. Paramètre de config, pas de logique de bascule automatique en v1.
- Sélection des morceaux via l'API Spotify (recherche par liste d'artistes curatée par thème, voir section 3bis), avec exclusion des morceaux déjà utilisés sur la chaîne (historique en base, tous thèmes confondus) et **maximum 2 morceaux du même artiste par épisode, jamais consécutifs**.
- Récupération de l'extrait audio réel via l'API publique iTunes Search d'Apple (`previewUrl`, ~30s, sans authentification), matché par titre+artiste depuis les métadonnées Spotify — voir section 3ter pour le changement de fournisseur (Deezer initialement prévu, bloqué en pratique).
- Rendu vidéo via **Remotion** (TypeScript/React) : intro (règles + rappel abonnement), compte à rebours 12s par morceau (cercle de progression + chiffres, police Baloo2, glow pulsé), numéro du morceau affiché en haut à gauche, révélation animée sur 5s (flash + zoom sur la pochette avec glow), outro (rappel abonnement), musique de fond libre de droits sur l'intro/outro.
- Upload automatique sur YouTube via YouTube Data API v3 (OAuth), avec titre/description/tags générés depuis un template par thème, puis ajout de la vidéo à la playlist YouTube du thème correspondant.
- Une seule chaîne pilote, nom générique temporaire (ex. **« BlindTest FR »**, à renommer avant lancement public réel), en **français** — choix motivé par la capacité à contrôler soi-même la qualité du matching audio/métadonnées et la justesse des textes générés ; l'espagnol est envisagé comme deuxième chaîne de croissance une fois le pipeline validé (bassin d'audience YouTube parmi les plus grands au monde, niche moins saturée que l'anglais sur ce format).
- Exécution déclenchée localement sur le Mac (launchd/cron, une exécution par jour) — pas encore de vrai "hébergement cloud" en v1.
- Base de données locale (SQLite) : configuration de chaîne et de ses thèmes, historique des morceaux utilisés, historique des runs/vidéos publiées.

**Explicitement hors v1** (mais prévu dans l'architecture) :

- Multi-chaînes actives simultanément (l'architecture le permet — c'est même le même mécanisme que la rotation de thèmes — mais on ne lance qu'une chaîne pilote).
- Format shorts (~1 min).
- Publication sur TikTok/Instagram/Facebook/Snapchat.
- Hébergement cloud / exécution indépendante du Mac.
- Gestion active des réclamations Content ID.
- Bascule automatique privé → public (reste manuelle en v1).

## 3. Stack technique

- **Langage** : TypeScript / Node.js (monorepo).
- **Moteur vidéo** : [Remotion](https://www.remotion.dev/) — vidéos générées comme des compositions React, rendu via `@remotion/renderer` (headless Chromium).
- **Base de données** : SQLite (via `better-sqlite3` ou Prisma) — suffisant en local, migrable vers Postgres si passage au cloud.
- **Intégrations externes** :
  - Spotify Web API (recherche par artiste, métadonnées) — OAuth Client Credentials (pas besoin d'un compte utilisateur, juste d'une app développeur Spotify). Voir section 3bis : plusieurs endpoints (recommandations, morceaux de playlist, top titres d'artiste) sont verrouillés pour les nouvelles apps, la recherche par artiste est la seule voie fiable restante.
  - iTunes Search API d'Apple (extraits audio) — pas d'authentification requise. Deezer était initialement prévu mais bloque tout accès programmatique (voir section 3ter).
  - YouTube Data API v3 (upload vidéo) — OAuth 2.0 avec compte Google + projet Google Cloud.
- **Automatisation locale** : `launchd` (macOS) déclenchant un script Node à intervalle régulier.

### Structure de repo envisagée (monorepo)

```
BlindTestGenerator/
├── packages/
│   ├── core/            # logique métier : sélection morceaux, anti-repeat, config chaîne
│   ├── integrations/
│   │   ├── spotify/     # client API Spotify (recherche, métadonnées)
│   │   ├── itunes/      # client API iTunes Search (résolution des previews audio)
│   │   └── youtube/     # upload via googleapis
│   ├── video-renderer/  # projet Remotion : compositions (timer, reveal, habillage)
│   └── db/              # schéma + accès SQLite (historique, config)
├── apps/
│   └── pipeline/        # orchestrateur : point d'entrée exécuté par launchd
├── channels/            # un fichier de config par chaîne (langue, branding, credentials, liste de thèmes)
└── docs/
```

Exemple de config de chaîne (`channels/blindtest-fr.json`, simplifié) :

```json
{
  "id": "blindtest-fr",
  "name": "BlindTest FR",
  "language": "fr",
  "visibility": "private",
  "themes": [
    {
      "day": "monday",
      "id": "annees-80",
      "label": "Années 80",
      "seedArtists": ["Jean-Jacques Goldman", "France Gall", "Indochine"],
      "youtubePlaylistId": null
    }
  ]
}
```

(liste complète des 7 thèmes et de leurs artistes dans `channels/blindtest-fr.json`)

`youtubePlaylistId` est `null` au départ et rempli automatiquement au premier upload de chaque thème (la playlist YouTube est créée par le pipeline si elle n'existe pas encore, puis son id est persisté).

Cette séparation en packages est ce qui permet la scalabilité : ajouter une chaîne = ajouter un fichier de config, ajouter une plateforme = ajouter un module dans `integrations/` qui implémente une interface `Publisher` commune, ajouter un format = ajouter une composition Remotion qui réutilise les mêmes briques (timer, reveal, données).

### 3bis. Constat empirique sur l'API Spotify (testé le 2026-08-07, app développeur réelle)

Une fois l'app développeur Spotify créée, des tests en direct ont confirmé et étendu les restrictions déjà pressenties :

| Endpoint                                           | Statut constaté                                                                                                                               | Conséquence                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `preview_url` sur un morceau                       | toujours `undefined`                                                                                                                          | Confirme qu'il faut une source audio externe (voir section 3ter)               |
| `/recommendations` (seed_genres...)                | `404`                                                                                                                                         | Totalement supprimé pour les nouvelles apps                                    |
| `/playlists/{id}/tracks` (morceaux d'une playlist) | `403 Forbidden`                                                                                                                               | Impossible de piocher dans une playlist éditoriale, même publique              |
| `/artists/{id}/top-tracks`                         | `403 Forbidden`                                                                                                                               | Impossible de demander directement les titres les plus populaires d'un artiste |
| `/search?q=genre:"..."&type=track`                 | `200 OK` mais résultats peu qualitatifs (versions live/instrumentales, artistes obscurs)                                                      | Utilisable mais pas fiable pour des titres reconnaissables                     |
| `/search?q=artist:"Nom"&type=track`                | `200 OK`, bon classement par pertinence (les titres les plus connus de l'artiste ressortent en premier, même sans score de popularité exposé) | **Solution retenue**                                                           |
| `/search` avec `limit` > 10                        | `400 "Invalid limit"` — documenté à 50, mais recherche binaire en direct confirme 10 comme plafond réel pour une nouvelle app                 | `@blindtest/spotify` plafonne `limit` à 10 côté client                         |

**Décision** : chaque thème est désormais défini par une **liste d'artistes curatée** (`seedArtists`) plutôt que par un genre Spotify. Le client Spotify (`@blindtest/spotify`) recherche par `artist:"Nom"`, filtre les versions non originales (remix/live/instrumental/edit...) par correspondance sur le titre, et dé-doublonne par titre normalisé. C'est une heuristique imparfaite (peut exclure à tort un titre contenant légitimement un de ces mots, ou laisser passer une version peu connue) mais c'est la voie la plus fiable disponible pour une app sans accès étendu.

Limite connue : le thème "Génériques dessins animés/films" se prête moins bien à une recherche par artiste (interprètes multiples, génériques mal crédités) — voir section 3octies pour l'élargissement de sa liste d'artistes (vérifiée en direct, 32 artistes exploitables).

### 3ter. Deezer abandonné au profit d'iTunes Search (testé le 2026-08-07)

Deezer était le choix initial pour l'audio (extraits publics, sans auth). En pratique, `api.deezer.com` — et même la page d'accueil `deezer.com` — renvoie un **403 "Access Denied" (Akamai)** de façon systématique, vérifié depuis trois vantage points différents : ce terminal sandboxé (`fetch` Node et navigateur automatisé) et le Mac de l'utilisateur en conditions réelles (`curl` et le script `pnpm`). Cohérent avec une protection anti-bot basée sur l'empreinte TLS/comportementale plutôt qu'un blocage de plage IP isolé — inutilisable pour un pipeline automatisé, quelle que soit la machine qui l'exécute.

**Remplacement retenu : l'API iTunes Search d'Apple** (`https://itunes.apple.com/search?term=...&entity=song`), publique, sans authentification, avec un champ `previewUrl` équivalent (format `.m4a`/AAC au lieu de `.mp3` — sans incidence, FFmpeg gère les deux nativement). Vérifiée fonctionnelle en direct depuis ce terminal.

Différence importante avec Deezer : iTunes fait une recherche floue en texte libre et renvoie toujours des résultats, même pour une requête qui n'existe pas — le filtrage par correspondance titre+artiste (déjà en place pour Deezer) n'est donc plus une simple sécurité, il est indispensable pour éviter d'associer un morceau au mauvais extrait.

Limite constatée : la couverture du catalogue iTunes n'est pas totale (ex: "Formidable" de Stromae n'est ressorti dans aucune recherche testée, même en forçant le store français avec `country=FR` — uniquement des covers/karaokés) — le filtrage anti-cover a correctement renvoyé "aucun match" plutôt que de se rabattre sur une mauvaise version, ce qui déclenche normalement le mécanisme de remplacement déjà prévu à l'étape 2 du pipeline.

### 3quater. Pipeline validé de bout en bout en conditions réelles (2026-08-07)

Premier run complet réel, sans mock : sélection Spotify (40 morceaux, thème "Variété actuelle") → résolution audio iTunes → rendu Remotion (vidéo de 10 min, 18 000 frames) → upload YouTube (`private`) → création de la playlist du thème → enregistrement des 40 morceaux en base. Résultat : [https://youtu.be/cCXG72AXfxs](https://youtu.be/cCXG72AXfxs).

Deux ajustements nécessaires découverts par ce run réel (au-delà des restrictions déjà documentées ci-dessus) :

- Le rendu Remotion nécessite `chromiumOptions.gl = "swiftshader"` (rendu logiciel) et un timeout allongé (120s) dans un environnement sans GPU — sinon "Timeout exceeded rendering the component initially" au démarrage.
- Premier lancement uniquement : téléchargement de Chrome Headless Shell par Remotion (~93 Mo), à prévoir dans le temps du tout premier run.

### 3quinquies. Retours après visionnage du premier épisode réel (2026-08-07)

Suite au visionnage de la vidéo produite en 3quater, ajustements v1.1 :

- **Durée/format** : passage à 12s de son par morceau (au lieu de 10s) et 60 morceaux par épisode (au lieu de 40), pour se rapprocher de la concurrence observée (12s/morceau, vidéos 15-20 min) — voir calcul en section 2.
- **Diversité des artistes** : les 40 premiers morceaux réels contenaient des répétitions d'artiste trop rapprochées. Ajout d'un plafond strict de 2 morceaux par artiste par épisode, et d'un réordonnancement (`spreadOutArtists` dans `@blindtest/pipeline`) qui garantit qu'ils ne sont jamais consécutifs.
- **Conséquence directe** : avec ce plafond, il faut au moins 30 artistes distincts par thème pour atteindre 60 morceaux. Les listes `seedArtists` de `channels/blindtest-fr.json` ont été étendues à ~30 artistes pour 6 des 7 thèmes. Le thème "Génériques dessins animés/films" ne compte que 18 artistes (~36 morceaux max) — **insuffisant pour 60**, à enrichir avant le premier dimanche (voir section 11).
- **Intro/outro ajoutées** : intro de 12s (règles du jeu : nombre de morceaux, durée du chrono, barème de points — +1 titre / +1 bonus artiste — puis rappel d'abonnement) et outro de 6s (rappel d'abonnement + teaser du thème du lendemain), toutes deux avec une musique de fond libre de droits ("Success - Opening Show Loop" par MusicInMedia, licence Pixabay Content License, `packages/video-renderer/public/audio/intro-outro-music.mp3`).
- **Numéro de morceau** : badge "N / 60" affiché en haut à gauche pendant tout le segment (compte à rebours + reveal).
- **Style du compte à rebours** : police Baloo2 (plus ronde/engageante que la police système par défaut) + glow radial pulsé derrière l'anneau, pour un rendu jugé "trop vide" auparavant.
- **Description YouTube** : liste numérotée "titre — artiste" de tous les morceaux ajoutée en fin de description, comme geste minimal de protection/attribution des droits (voir section 7).

### 3sexies. Génération hebdomadaire par lot + publication programmée (2026-08-08)

Alternative au run quotidien : `apps/pipeline/src/pipeline.ts` expose `runWeeklyBatch()` (déclenché via `node dist/index.js <config> --week`), qui génère et publie en un seul passage les 7 épisodes de la semaine à venir, chacun programmé via `publishAt` (YouTube Data API) pour sa prochaine occurrence calendaire — la vidéo reste `private` jusqu'à cette date puis bascule automatiquement en public, sans dépendre d'une exécution quotidienne sur le Mac (un seul run par semaine suffit).

- **Isolation des échecs** : un thème qui échoue (upload, quota, etc.) n'interrompt pas le lot — les 6 autres sont quand même tentés, puis une erreur récapitulative liste les échecs à la fin.
- **Coût quota concret** : chaque upload coûte 1600 unités sur les 10 000/jour par défaut (risque déjà identifié section 10) — un lot de 7 dépasse ce budget en un seul run (~11 200 unités). Non bloquant pour la v1 (chaîne encore en `private`), mais **à corriger avant bascule en public** : soit demander une augmentation de quota à Google, soit étaler le lot sur 2 jours.
- **La programmation ne s'active que si `channel.visibility === "public"`** — tant que la chaîne pilote reste `private` (cas actuel), les épisodes du lot sont uploadés immédiatement comme avant, sans `publishAt`, pour ne pas dépendre d'un mécanisme qu'on ne peut pas encore observer en conditions réelles.

**Anti-repeat inter-semaines** : la contrainte historique « un morceau n'est jamais rejoué, jamais » ne tient pas dans la durée — le vivier `seedArtists` d'un thème est fixe et un run hebdomadaire l'épuise vite (risque déjà noté section 10 pour "Génériques", mais valable pour tous les thèmes à terme). Remplacé par un modèle à cooldown :

- Un morceau utilisé il y a moins de `REUSE_COOLDOWN_DAYS` (14 jours, soit 2 cycles hebdomadaires du même thème) est exclu, point final.
- Passé ce délai, il redevient éligible mais seulement en dernier recours (si le vivier de morceaux jamais utilisés ne suffit plus) et plafonné à 2 réutilisations par épisode de 60 — la variété reste la priorité, la réutilisation n'est qu'une marge d'erreur tolérée, pas un objectif.
- Nécessite que `tracks_used` puisse contenir plusieurs lignes pour un même `(channel_id, spotify_track_id)` — l'ancienne clé primaire composite l'interdisait. Remplacée par un id auto-incrémenté + un index sur `(channel_id, spotify_track_id)` pour garder les requêtes d'historique rapides. Migration automatique au premier `openDatabase()` sur une base existante (rebuild de la table, aucune perte de données — vérifié sur la base réelle du pilote).

**Ouverture de l'épisode (`apps/pipeline/src/opening-hook.ts`)** : les 5 premiers morceaux sont ceux qui décident si le spectateur reste — Spotify ne renvoie plus le score `popularity` réel pour les nouvelles apps (section 3bis), donc à défaut on utilise le rang de chaque morceau dans les résultats de recherche _par artiste_ (`Track.popularityRank`, 0 = premier résultat) comme proxy de notoriété : c'est une heuristique, pas une vraie mesure d'écoute, mais c'est ce que l'API expose encore. Le morceau `popularityRank === 0` de chaque artiste est prioritairement placé dans les 5 premières positions (dans la limite du nombre de morceaux "signature" réellement disponibles), le reste de l'épisode suit dans son ordre habituel anti-répétition.

**Priorité actuelle (2026-08-08)** : le lot hebdomadaire fonctionne et est validé sur un run réel des 7 thèmes, mais reste mis de côté pour l'instant sur décision utilisateur — trop de surface à faire mûrir en même temps (quota, programmation, cooldown) alors que la sélection elle-même avait encore des trous (section 3septies). La version de base (run quotidien, `runPipeline()`) reste la voie principale ; le lot hebdomadaire est repris plus tard une fois la base solide.

### 3septies. Sécurisation de la sélection morceaux/artistes — le cœur du projet (2026-08-08)

Deux bugs réels trouvés en conditions réelles sur l'épisode "Génériques dessins animés/films" (le même artiste apparu 3 fois d'affilée, et hors-sujet manifeste) :

1. **Le plafond/l'espacement par artiste comparaient la chaîne d'affichage jointe, pas les artistes individuels.** `"Dorothée Pousséo, Aldebert"` et `"Mortelle Adèle, Dorothée Pousséo"` sont deux chaînes différentes, donc traitées comme deux artistes différents par l'ancien code — alors qu'il s'agit du même featuring ("Dorothée Pousséo") sur les deux morceaux, qui pouvait ainsi apparaître sur presque tous les morceaux de l'épisode sans jamais franchir le plafond de 2. **Correctif** : `Track` porte désormais `artistNames: readonly string[]` (les artistes individuels crédités) en plus de `artist` (chaîne d'affichage) ; `MAX_TRACKS_PER_ARTIST` et `spreadOutArtists` (`apps/pipeline/src/diversify-artists.ts`) vérifient/espacent chaque nom individuel, pas la chaîne jointe.
2. **Le filtre `artist:"X"` de Spotify est une recherche texte approximative, pas un filtre exact.** Vérifié en direct : chercher `artist:"Dorothée"` (present dans `seedArtists` du thème) ne renvoie **aucun** morceau de la véritable Dorothée, seulement des morceaux crédités à "Dorothée Pousséo" (comédienne de doublage sans rapport) voire un morceau qui ne cite personne nommé Dorothée du tout. **Correctif** : `packages/integrations/spotify/src/client.ts` rejette désormais tout résultat dont aucun artiste crédité ne correspond exactement (insensible à la casse/aux accents) au nom recherché.

**Conséquence directe mesurée** : après ce correctif, une vérification en direct sur les 18 `seedArtists` de "Génériques dessins animés/films" ne remonte plus que ~95 morceaux candidats sur 12 artistes exploitables (contre un vivier apparemment plus large avant, gonflé par les faux positifs hors-sujet) — soit ~24 morceaux maximum avec le plafond de 2/artiste, **très en dessous des 60 requis**. Ce thème échouera avec `InsufficientTracksError` à sa prochaine exécution (dimanche) tant que `seedArtists` n'est pas enrichi ; c'était déjà un risque documenté (section 10) mais il devient immédiat plutôt qu'à terme.

### 3octies. Élargissement des `seedArtists` de tous les thèmes, vérifié en direct (2026-08-08)

Chaque nom candidat a été vérifié un par un via `searchTracksByArtist` (le client Spotify corrigé, section 3septies) avant d'être ajouté — exactement la leçon de 3septies : un nom qui "semble" correct sur le papier peut renvoyer zéro résultat exploitable une fois le matching exact appliqué (~15% des candidats testés ont été écartés pour cette raison, ex. "Peter and Sloane", "Ariane Carletti", "Fishbach").

Pour "Génériques dessins animés/films" spécifiquement : les 6 entrées mortes (Dorothée, Hélène, AB Kids, Dorothée et les Musclés, Cordy, Chèvrefeuille — 0 résultat chacune) ont été retirées, et 20 nouveaux artistes vérifiés ajoutés, dont une bonne part de compositeurs de musiques de films français (Vladimir Cosma, Francis Lai, Michel Legrand, Georges Delerue, Bruno Coulais, etc.) — un vivier jusque-là inexploité, alors que c'est littéralement le sens de "générique de film".

Effectif final par thème (`seedArtists`, tous vérifiés à retourner ≥1 résultat) :

| Thème               | Avant                | Après |
| ------------------- | -------------------- | ----- |
| Années 80           | 30                   | 44    |
| Années 90           | 29                   | 39    |
| Années 2000         | 30                   | 44    |
| Rap FR              | 30                   | 44    |
| Variété actuelle    | 30                   | 44    |
| Chansons classiques | 30                   | 45    |
| Génériques          | 18 (12 exploitables) | 32    |

Génériques passe ainsi d'un maximum réel de ~24 morceaux à ~64 (32 artistes × 2), au-dessus des 60 requis — le risque d'`InsufficientTracksError` documenté en 3septies est levé pour ce dimanche. Les autres thèmes gagnent une marge confortable pour absorber la réutilisation après cooldown (section 3sexies) sur plusieurs mois sans s'épuiser aussi vite.

### 3nonies. Automatisation réelle via launchd (2026-08-08)

Jusqu'ici chaque épisode a été généré par une invocation manuelle du CLI — l'automatisation quotidienne prévue dès la v1 (section 2) n'était pas encore branchée. Mise en place :

- `scripts/run-daily-pipeline.sh` : wrapper bash qui fixe `PATH` (launchd ne charge aucun profil shell), se place dans `apps/pipeline`, et lance `node --env-file=.env dist/index.js channels/blindtest-fr.json` — le run quotidien de base (`runPipeline()`), pas le lot hebdomadaire (section 3sexies, volontairement laissé de côté pour l'instant).
- `scripts/com.blindtestgenerator.dailypipeline.plist` : agent launchd déclenché tous les jours à 6h00 heure locale, sortie standard/erreur redirigée vers `data/logs/launchd-{stdout,stderr}.log`. Installé dans `~/Library/LaunchAgents/` et chargé via `launchctl load`.
- Chemins absolus spécifiques à cette machine (`/Users/lucaslordon/...`) — à ajuster si le projet est un jour installé ailleurs, comme pour `channels/*.json`.
- **Limite connue** : un agent utilisateur (`LaunchAgent`, pas `LaunchDaemon`) ne se déclenche que si une session utilisateur est ouverte. Si le Mac est endormi à l'heure prévue, launchd rattrape l'exécution manquée dès le réveil (tant que la session reste ouverte) — mais rien ne se passe si le Mac est complètement éteint. Pas de réveil automatique programmé (`pmset repeat wakeorpoweron`) — nécessiterait `sudo`, à faire par l'utilisateur si le déclenchement garanti à heure fixe devient nécessaire.
- Pas de mécanisme de nouvelle tentative en cas d'échec (ex. `InsufficientTracksError`, hoquet iTunes) — un jour manqué n'est pas critique pour une v1 ; à revoir si le volume augmente.

**Deux problèmes réels trouvés sur les deux premiers déclenchements automatiques** :

1. **2026-08-09, 6h00** : échec immédiat, `/bin/bash: .../run-daily-pipeline.sh: Operation not permitted`. Cause : `~/Documents` est un dossier protégé par TCC (Transparency, Consent and Control) sur macOS — un agent lancé en arrière-plan (sans session Terminal interactive) s'y voit refuser l'accès même avec les bonnes permissions Unix sur le fichier, alors que la même commande fonctionne normalement en interactif. **Correctif** : accès complet au disque accordé à `/bin/bash` (Réglages Système → Confidentialité et sécurité → Accès complet au disque) — validé en re-déclenchant l'agent manuellement (`launchctl kickstart -k`), épisode "Génériques" généré et publié avec succès (https://youtu.be/eIjtZhQ9MPw), aucune répétition d'artiste adjacente.
2. **2026-08-10, 6h00** : le correctif TCC tient (le script s'exécute, résout bien le thème "Années 80"), mais crash immédiat sur `TypeError: fetch failed` / `getaddrinfo ENOTFOUND accounts.spotify.com`. Cause : le Mac se réveille pile à l'heure du déclenchement et le Wi-Fi n'a pas encore eu le temps de se reconnecter. **Correctif** : `run-daily-pipeline.sh` attend maintenant que `https://accounts.spotify.com` réponde (jusqu'à 2 minutes, par tranches de 5s) avant de lancer le pipeline, plutôt que de supposer le réseau disponible immédiatement.

## 4. Pipeline de génération (par run, exécuté une fois par jour)

0. **Détermination du thème du jour** : lire le jour de la semaine courant, résoudre le thème correspondant dans la config de la chaîne.
1. **Sélection** : pour chaque artiste de `seedArtists` du thème du jour, rechercher ses morceaux via Spotify (voir section 3bis), regrouper les candidats, exclure les `track_id` déjà présents dans l'historique de cette chaîne (tous thèmes confondus) et plafonner à 2 morceaux par artiste, retenir 60 morceaux, puis les réordonner pour qu'aucun artiste ne se retrouve deux fois de suite.
2. **Résolution audio** : pour chaque morceau, chercher le `previewUrl` correspondant via iTunes Search (voir section 3ter, match titre + artiste), échouer proprement et piocher un remplaçant si aucun match fiable.
3. **Rendu vidéo** : appeler Remotion avec la liste des 60 morceaux (audio + métadonnées + pochette) → génère un `.mp4` avec intro, puis pour chaque morceau 12s timer + 5s reveal animé, puis outro.
4. **Génération de la miniature** (thumbnail) : image statique générée (probablement une frame Remotion dédiée), incluant le nom du thème du jour.
5. **Publication YouTube** : upload du fichier avec titre/description (incluant la liste des morceaux)/tags templatés selon le thème du jour, visibilité lue depuis la config de la chaîne (`private` tant que le pipeline n'est pas validé, `public` une fois basculé manuellement).
6. **Playlist** : créer la playlist YouTube du thème si elle n'existe pas encore (id persisté en base, pas dans le JSON de config), puis y ajouter la vidéo.
7. **Enregistrement** : écrire en base les 60 morceaux utilisés (liés à la chaîne + au thème) + les métadonnées du run (date, thème, id vidéo YouTube, statut, visibilité).

## 5. Format vidéo — détail

Intro (~12s) : règles du jeu (nombre de morceaux, durée du chrono, barème de points) puis rappel d'abonnement, musique de fond libre de droits.

Par morceau (~17s) :

- 0–12s : minuteur visible (cercle + chiffres, police Baloo2, glow pulsé), extrait audio en lecture, numéro du morceau affiché en haut à gauche — le spectateur doit deviner.
- 12–17s : révélation animée — pochette de l'album, nom de l'artiste, titre du morceau, effet de transition/particules pour rendre ça "satisfaisant".

Outro (~6s) : rappel d'abonnement + teaser du thème du lendemain, même musique de fond.

Décidé :

- animation du compte à rebours : **cercle de progression (ring) combiné à des chiffres qui défilent**, police **Baloo2** (Google Fonts via `@remotion/google-fonts`), glow radial pulsé derrière l'anneau à chaque seconde.
- transition de révélation : **flash lumineux bref + zoom sur la pochette avec glow coloré**, texte artiste/titre en fondu juste après — effet d'impact fort adapté au rythme du format.
- musique d'intro/outro : "Success - Opening Show Loop" par MusicInMedia (Pixabay, licence gratuite y compris usage commercial, enregistrée YouTube Content ID par Pixabay).

Point à figer avec le rendu Remotion (à itérer visuellement une fois le pipeline technique validé) :

- habillage sonore pendant le compte à rebours lui-même (tic-tac ? sting à la révélation ?) — à définir, distinct de la musique d'intro/outro déjà en place.

### Thèmes de la chaîne pilote et templates YouTube

Rotation par défaut (modifiable en config, un thème par jour de la semaine) :

| Jour     | Thème                           |
| -------- | ------------------------------- |
| Lundi    | Années 80                       |
| Mardi    | Années 90                       |
| Mercredi | Années 2000                     |
| Jeudi    | Rap FR                          |
| Vendredi | Variété actuelle                |
| Samedi   | Chansons françaises classiques  |
| Dimanche | Génériques dessins animés/films |

Template titre/description implémenté dans `apps/pipeline/src/youtube-metadata.ts` :

- **Titre** : `BLIND TEST {ThemeLabel} 🎧 | Devine {N} chansons en 12 secondes ! (Ép. {n})`
- **Description** :
  ```
  🎵 Blind Test spécial {ThemeLabel} — {N} extraits à deviner en 12 secondes chrono !
  Combien as-tu trouvé ? Dis ton score en commentaire 👇

  🔔 Abonne-toi pour ne rater aucun épisode — un nouveau thème chaque jour !

  #blindtest #quizmusical #{themeHashtag}

  🎶 Morceaux de l'épisode :
  1. {Titre} — {Artiste}
  2. {Titre} — {Artiste}
  ...
  ```
  La liste numérotée de tous les morceaux est un geste minimal de protection/attribution des droits (section 7).
- **Tags** : `blind test`, `quiz musical`, `{theme label}`, `devine la chanson`.

## 6. Modèle de données (SQLite)

- `channels` : id, nom, langue, config de branding, identifiants OAuth YouTube (référence sécurisée, pas en clair dans le repo), visibilité courante (`private`/`unlisted`/`public`).
- `channel_themes` : id, channel_id, day (lundi..dimanche), label, youtube_playlist_id (nullable, rempli au premier upload). `seedArtists` n'est pas dupliqué en base : il vit uniquement dans le JSON de config, relu à chaque run.
- `tracks_used` : id (surrogate), channel_id, theme_id, spotify_track_id, titre, artiste, date d'utilisation, video_id (FK). Un même morceau peut apparaître plusieurs fois dans le temps (réutilisation contrôlée après cooldown, section 3sexies) — l'anti-repeat n'est plus une contrainte d'unicité en base mais une règle applicative (`apps/pipeline/src/build-episode-tracks.ts` : exclusion stricte sous 14 jours, réutilisation plafonnée à 2/épisode au-delà).
- `videos` : id, channel_id, theme_id, date de génération, chemin fichier, youtube_video_id, statut (draft/uploaded/failed), visibilité effective au moment de l'upload, format (long/short).

Ce modèle est ce qui garantit qu'on ne rejoue jamais deux fois le même morceau sur une même chaîne, et qu'on peut suivre l'historique par chaîne et par thème indépendamment.

## 7. Droits d'auteur & stratégie Content ID

Objectif affiché : chaînes publiques sérieuses avec monétisation visée à terme. Ce qui en découle pour la conception :

- Les extraits doivent rester courts et clairement transformatifs (montage, minuteur, effets, habillage) — le format blind test est un usage établi sur YouTube, mais des réclamations Content ID resteront probables (généralement une monétisation reversée à l'ayant droit plutôt qu'un strike, tant qu'on respecte les policies YouTube).
- Le champ `format`/`duration` par morceau doit être un paramètre de config facilement ajustable — si on constate trop de réclamations bloquantes, on doit pouvoir réduire la durée d'extrait sans réécrire le pipeline.
- Prévoir dans le modèle un champ de suivi de statut Content ID par vidéo, pour pouvoir monitorer plus tard (hors v1, mais la colonne peut être prévue dans `videos`).
- Ne pas viser l'esquive de la détection (hors-scope, contraire à la politique YouTube) — uniquement une conception qui minimise le risque via un usage transformatif légitime.

## 8. Prérequis côté utilisateur (à faire par toi, hors code)

- [x] App développeur Spotify (spotify.com/dashboard) → `client_id`/`client_secret` — fait le 2026-08-07.
- [x] Projet Google Cloud, "YouTube Data API v3" activée, écran de consentement OAuth (Google Auth Platform), identifiants OAuth Desktop app — fait le 2026-08-07.
- [x] Chaîne YouTube "BlindTest FR" créée et liée au compte autorisé — fait le 2026-08-07.
- Aucun compte requis côté iTunes Search (API publique en lecture) — rien à faire.

Identifiants stockés dans `.env` local (gitignored, jamais commité) — voir `.env.example` pour la liste des variables attendues. Le refresh token YouTube a été obtenu via `packages/integrations/youtube/scripts/authorize.ts` (flow OAuth interactif à usage unique, serveur loopback local).

## 9. Roadmap (au-delà de la v1)

- **v1.1** — Multi-chaînes : plusieurs fichiers de config actifs simultanément, scheduler par chaîne.
- **v1.2** — Format shorts (~1 min, moins de morceaux, montage plus punchy).
- **v1.3** — Passage à un hébergement cloud (VPS ou serverless) pour une automatisation indépendante du Mac.
- **v2** — Multi-plateformes : interface `Publisher` commune, implémentations TikTok (Content Posting API, review d'app requise), Meta Graph API (Instagram/Facebook), Snapchat (API de publication très limitée, à valider si seulement possible manuellement).
- **v2.x** — Monitoring actif des réclamations Content ID, dashboard de suivi multi-chaînes.

## 10. Risques identifiés

| Risque                                                                                                                                                                                                                                                                                             | Impact                                                                                                           | Mitigation prévue                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iTunes Search ne retourne pas de preview fiable pour un morceau (catalogue incomplet, que des covers)                                                                                                                                                                                              | Morceau à écarter                                                                                                | Fallback : piocher un autre candidat dans la sélection (déjà observé en test, voir section 3ter)                                                          |
| Quota YouTube Data API (10 000 unités/jour, upload = 1600)                                                                                                                                                                                                                                         | Limite ~6 uploads/jour/projet GCP                                                                                | Non bloquant pour du hebdo multi-chaînes en v1 ; à surveiller si scale fort                                                                               |
| Réclamation Content ID                                                                                                                                                                                                                                                                             | Vidéo monétisée au profit de l'ayant droit, parfois blocage régional                                             | Extraits courts, montage transformatif, config de durée ajustable                                                                                         |
| Rendu Remotion trop lent pour 60 segments                                                                                                                                                                                                                                                          | Temps de génération long                                                                                         | Mesuré en réel sur 40 segments (section 3quater) ; optimiser (rendu parallèle Remotion) si besoin au-delà                                                 |
| API TikTok/Snapchat peu ouvertes pour publication auto                                                                                                                                                                                                                                             | Bloquant pour le multi-plateforme v2                                                                             | À valider au moment venu ; publication manuelle possible en repli                                                                                         |
| 7 thèmes = catalogues Spotify/iTunes de tailles très inégales (ex: génériques dessins animés a un vivier plus restreint que variété actuelle)                                                                                                                                                      | Un thème s'épuise plus vite (répétitions ou plus assez de candidats après filtrage anti-repeat)                  | Vivier de secours plus large par thème en config, alerte si le nombre de candidats restants passe sous un seuil                                           |
| iTunes Search est un service Apple non contractuel pour cet usage (pas d'accord officiel ni de SLA)                                                                                                                                                                                                | Pourrait se fermer ou se durcir comme Deezer/Spotify                                                             | Le client est isolé dans `@blindtest/itunes` derrière la même interface `findPreviewByTitleAndArtist` — remplacer le fournisseur ne touche que ce package |
| Filtrage heuristique des versions non originales (regex sur le titre, section 3bis) trop strict ou trop laxiste                                                                                                                                                                                    | Faux positifs (titre légitime exclu) ou faux négatifs (remix qui passe)                                          | Ajuster la regex au fil de l'usage réel ; pas de solution parfaite sans les endpoints désormais fermés                                                    |
| Publication quotidienne dès la v1 (vs hebdo initialement prévu)                                                                                                                                                                                                                                    | Plus d'occasions de détecter un bug en prod, plus de volume à corriger si un run échoue plusieurs jours de suite | Visibilité `private` tant que non validé (déjà prévu) ; ajouter un contrôle simple avant bascule en public (ex: vérifier N runs consécutifs sans erreur)  |
| ~~Thème "Génériques dessins animés/films" n'avait que 12 des 18 artistes curatés qui remontaient un résultat exploitable sur Spotify (~24 morceaux max), sous les 60 requis~~ — **résolu le 2026-08-08** (section 3octies) : liste élargie à 32 artistes tous vérifiés en direct, ~64 morceaux max | ~~`InsufficientTracksError` au premier dimanche~~                                                                | —                                                                                                                                                         |
| Musique d'intro/outro Pixabay enregistrée YouTube Content ID                                                                                                                                                                                                                                       | Réclamation Content ID possible malgré la licence gratuite (comportement normal de Pixabay/Content ID)           | Attendu et accepté (section 7) ; changer de piste si le comportement réel diffère                                                                         |

## 11. Points encore ouverts

- Habillage sonore pendant le compte à rebours (tic-tac, sting de révélation) — distinct de la musique d'intro/outro déjà en place.
- Seuil exact de validation avant bascule automatique-privé → public (ex: "N jours consécutifs sans erreur" — nombre à définir).
- Nom définitif de la chaîne pilote (le placeholder « BlindTest FR » sera utilisé jusque-là).
- Vérifier en conditions réelles si la musique Pixabay déclenche effectivement une réclamation Content ID sur la vidéo, et son impact (blocage vs monétisation partagée).
- ~~Mettre en place l'automatisation réelle (launchd/cron)~~ — **fait le 2026-08-08**, deux vrais bugs de déclenchement trouvés et corrigés le 09 et le 10 (section 3nonies : accès TCC, réseau pas encore prêt au réveil). Reste à observer un déclenchement 6h00 entièrement autonome de bout en bout (les deux jours testés ont nécessité soit un re-déclenchement manuel, soit ont échoué avant correctif) avant de considérer l'automatisation pleinement fiable.
- Demander une augmentation de quota YouTube Data API (ou étaler sur 2 jours) avant d'utiliser `runWeeklyBatch()` en production — un lot de 7 dépasse le quota par défaut (section 3sexies).
