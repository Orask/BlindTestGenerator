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
- **Publication quotidienne** (1 vidéo/jour) avec **rotation de 7 thèmes musicaux, un par jour de la semaine** (voir section 5bis) — chaque thème a sa propre playlist YouTube et un titre de vidéo explicite sur son contenu. Ce mécanisme de rotation par config est volontairement générique : une future chaîne mono-thème spécialisée (autre langue/genre) réutilisera le même code avec une liste d'un seul thème répété tous les jours.
- **Visibilité progressive** : tant que le pipeline n'est pas validé de bout en bout, les vidéos sont uploadées en **privé** (visibilité YouTube `private`) — bascule manuelle vers `public` une fois la qualité confirmée sur plusieurs runs. Paramètre de config, pas de logique de bascule automatique en v1.
- Sélection des morceaux via l'API Spotify (recherche par liste d'artistes curatée par thème, voir section 3bis), avec exclusion des morceaux déjà utilisés sur la chaîne (historique en base, tous thèmes confondus).
- Récupération de l'extrait audio réel via l'API publique iTunes Search d'Apple (`previewUrl`, ~30s, sans authentification), matché par titre+artiste depuis les métadonnées Spotify — voir section 3ter pour le changement de fournisseur (Deezer initialement prévu, bloqué en pratique).
- Rendu vidéo via **Remotion** (TypeScript/React) : compte à rebours 10s (cercle de progression + chiffres), révélation animée sur 5s (flash + zoom sur la pochette avec glow), habillage visuel générique/neutre pour la v1 (waveform, transitions, typographie).
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

**Décision** : chaque thème est désormais défini par une **liste d'artistes curatée** (`seedArtists`) plutôt que par un genre Spotify. Le client Spotify (`@blindtest/spotify`) recherche par `artist:"Nom"`, filtre les versions non originales (remix/live/instrumental/edit...) par correspondance sur le titre, et dé-doublonne par titre normalisé. C'est une heuristique imparfaite (peut exclure à tort un titre contenant légitimement un de ces mots, ou laisser passer une version peu connue) mais c'est la voie la plus fiable disponible pour une app sans accès étendu.

Limite connue : le thème "Génériques dessins animés/films" se prête moins bien à une recherche par artiste (interprètes multiples, génériques mal crédités) — la liste d'artistes de ce thème dans `channels/blindtest-fr.json` est un premier jet à affiner.

### 3ter. Deezer abandonné au profit d'iTunes Search (testé le 2026-08-07)

Deezer était le choix initial pour l'audio (extraits publics, sans auth). En pratique, `api.deezer.com` — et même la page d'accueil `deezer.com` — renvoie un **403 "Access Denied" (Akamai)** de façon systématique, vérifié depuis trois vantage points différents : ce terminal sandboxé (`fetch` Node et navigateur automatisé) et le Mac de l'utilisateur en conditions réelles (`curl` et le script `pnpm`). Cohérent avec une protection anti-bot basée sur l'empreinte TLS/comportementale plutôt qu'un blocage de plage IP isolé — inutilisable pour un pipeline automatisé, quelle que soit la machine qui l'exécute.

**Remplacement retenu : l'API iTunes Search d'Apple** (`https://itunes.apple.com/search?term=...&entity=song`), publique, sans authentification, avec un champ `previewUrl` équivalent (format `.m4a`/AAC au lieu de `.mp3` — sans incidence, FFmpeg gère les deux nativement). Vérifiée fonctionnelle en direct depuis ce terminal.

Différence importante avec Deezer : iTunes fait une recherche floue en texte libre et renvoie toujours des résultats, même pour une requête qui n'existe pas — le filtrage par correspondance titre+artiste (déjà en place pour Deezer) n'est donc plus une simple sécurité, il est indispensable pour éviter d'associer un morceau au mauvais extrait.

Limite constatée : la couverture du catalogue iTunes n'est pas totale (ex: "Formidable" de Stromae n'est ressorti dans aucune recherche testée, même en forçant le store français avec `country=FR` — uniquement des covers/karaokés) — le filtrage anti-cover a correctement renvoyé "aucun match" plutôt que de se rabattre sur une mauvaise version, ce qui déclenche normalement le mécanisme de remplacement déjà prévu à l'étape 2 du pipeline.

## 4. Pipeline de génération (par run, exécuté une fois par jour)

0. **Détermination du thème du jour** : lire le jour de la semaine courant, résoudre le thème correspondant dans la config de la chaîne.
1. **Sélection** : pour chaque artiste de `seedArtists` du thème du jour, rechercher ses morceaux via Spotify (voir section 3bis), regrouper les candidats, exclure les `track_id` déjà présents dans l'historique de cette chaîne (tous thèmes confondus), retenir 40 morceaux.
2. **Résolution audio** : pour chaque morceau, chercher le `previewUrl` correspondant via iTunes Search (voir section 3ter, match titre + artiste), échouer proprement et piocher un remplaçant si aucun match fiable.
3. **Rendu vidéo** : appeler Remotion avec la liste des 40 morceaux (audio + métadonnées + pochette) → génère un `.mp4` avec pour chaque morceau : 10s timer + 5s reveal animé.
4. **Génération de la miniature** (thumbnail) : image statique générée (probablement une frame Remotion dédiée), incluant le nom du thème du jour.
5. **Publication YouTube** : upload du fichier avec titre/description/tags templatés selon le thème du jour, visibilité lue depuis la config de la chaîne (`private` tant que le pipeline n'est pas validé, `public` une fois basculé manuellement).
6. **Playlist** : créer la playlist YouTube du thème si elle n'existe pas encore (et persister son id dans la config), puis y ajouter la vidéo.
7. **Enregistrement** : écrire en base les 40 morceaux utilisés (liés à la chaîne + au thème) + les métadonnées du run (date, thème, id vidéo YouTube, statut, visibilité).

## 5. Format vidéo — détail

Par morceau (~15s) :

- 0–10s : minuteur visible, extrait audio en lecture, visuel générique (waveform / arrière-plan animé) — le spectateur doit deviner.
- 10–15s : révélation animée — pochette de l'album, nom de l'artiste, titre du morceau, effet de transition/particules pour rendre ça "satisfaisant".

Décidé :

- animation du compte à rebours : **cercle de progression (ring) combiné à des chiffres qui défilent** — combo jugé le plus satisfaisant visuellement.
- transition de révélation : **flash lumineux bref + zoom sur la pochette avec glow coloré**, texte artiste/titre en fondu juste après — effet d'impact fort adapté au rythme du format.

Point à figer avec le rendu Remotion (à itérer visuellement une fois le pipeline technique validé) :

- habillage sonore (tic-tac ? sting à la révélation ?) — à définir.

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

Proposition de template titre/description (à valider, ajustable par thème) :

- **Titre** : `BLIND TEST {ThemeLabel} 🎧 | Devine 40 chansons en 10 secondes ! (Ép. {n})`
- **Description** :
  ```
  🎵 Blind Test spécial {ThemeLabel} — 40 extraits à deviner en 10 secondes chrono !
  Combien as-tu trouvé ? Dis ton score en commentaire 👇

  🔔 Abonne-toi pour ne rater aucun épisode — un nouveau thème chaque jour !

  #blindtest #quizmusical #{themeHashtag}
  ```
- **Tags** : `blind test`, `quiz musical`, `{theme label}`, `devine la chanson`, `musique {langue}`.

## 6. Modèle de données (SQLite)

- `channels` : id, nom, langue, config de branding, identifiants OAuth YouTube (référence sécurisée, pas en clair dans le repo), visibilité courante (`private`/`unlisted`/`public`).
- `channel_themes` : id, channel_id, day (lundi..dimanche), label, seed_artists (liste), youtube_playlist_id (nullable, rempli au premier upload).
- `tracks_used` : channel_id, theme_id, spotify_track_id, titre, artiste, date d'utilisation, video_id (FK). L'anti-repeat se fait sur `(channel_id, spotify_track_id)` sans filtrer par thème — un morceau déjà utilisé n'est jamais reproposé sur la chaîne, même dans un thème différent.
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

| Risque                                                                                                                                        | Impact                                                                                                           | Mitigation prévue                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iTunes Search ne retourne pas de preview fiable pour un morceau (catalogue incomplet, que des covers)                                         | Morceau à écarter                                                                                                | Fallback : piocher un autre candidat dans la sélection (déjà observé en test, voir section 3ter)                                                          |
| Quota YouTube Data API (10 000 unités/jour, upload = 1600)                                                                                    | Limite ~6 uploads/jour/projet GCP                                                                                | Non bloquant pour du hebdo multi-chaînes en v1 ; à surveiller si scale fort                                                                               |
| Réclamation Content ID                                                                                                                        | Vidéo monétisée au profit de l'ayant droit, parfois blocage régional                                             | Extraits courts, montage transformatif, config de durée ajustable                                                                                         |
| Rendu Remotion trop lent pour 40 segments                                                                                                     | Temps de génération long                                                                                         | Mesurer dès le prototype, optimiser (rendu parallèle Remotion) si besoin                                                                                  |
| API TikTok/Snapchat peu ouvertes pour publication auto                                                                                        | Bloquant pour le multi-plateforme v2                                                                             | À valider au moment venu ; publication manuelle possible en repli                                                                                         |
| 7 thèmes = catalogues Spotify/iTunes de tailles très inégales (ex: génériques dessins animés a un vivier plus restreint que variété actuelle) | Un thème s'épuise plus vite (répétitions ou plus assez de candidats après filtrage anti-repeat)                  | Vivier de secours plus large par thème en config, alerte si le nombre de candidats restants passe sous un seuil                                           |
| iTunes Search est un service Apple non contractuel pour cet usage (pas d'accord officiel ni de SLA)                                           | Pourrait se fermer ou se durcir comme Deezer/Spotify                                                             | Le client est isolé dans `@blindtest/itunes` derrière la même interface `findPreviewByTitleAndArtist` — remplacer le fournisseur ne touche que ce package |
| Filtrage heuristique des versions non originales (regex sur le titre, section 3bis) trop strict ou trop laxiste                               | Faux positifs (titre légitime exclu) ou faux négatifs (remix qui passe)                                          | Ajuster la regex au fil de l'usage réel ; pas de solution parfaite sans les endpoints désormais fermés                                                    |
| Publication quotidienne dès la v1 (vs hebdo initialement prévu)                                                                               | Plus d'occasions de détecter un bug en prod, plus de volume à corriger si un run échoue plusieurs jours de suite | Visibilité `private` tant que non validé (déjà prévu) ; ajouter un contrôle simple avant bascule en public (ex: vérifier N runs consécutifs sans erreur)  |

## 11. Points encore ouverts

- Confirmer/ajuster le template titre/description/tags proposé en section 5 (texte définitif).
- Habillage sonore (tic-tac, sting de révélation) — à définir.
- Seuil exact de validation avant bascule automatique-privé → public (ex: "N jours consécutifs sans erreur" — nombre à définir).
- Nom définitif de la chaîne pilote (le placeholder « BlindTest FR » sera utilisé jusque-là).
- Liste d'artistes du thème "Génériques dessins animés/films" à affiner (voir section 3bis, cas le moins évident pour une recherche par artiste).
