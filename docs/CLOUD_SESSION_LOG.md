# Journal de session cloud

Journal tenu à jour en continu pendant une session cloud à budget limité. La session peut
s'arrêter sans préavis (budget épuisé) — chaque entrée doit donc être autonome et
committée/poussée immédiatement après la tâche correspondante.

Format : `## [horodatage UTC] Tâche N — titre` puis statut, ce qui a été fait, décisions
arbitraires (et pourquoi), prochain pas concret si incomplet.

---

## [2026-09-27 — début de session] Contexte

Reprise de la session précédente (desktop → cloud). Les 7 améliorations demandées
précédemment (intro/règles, numérotation, style timer, dédup artistes, 12s/morceau,
rappels abonnement, métadonnées description) sont **déjà en place et committées** sur
`main-hpf4qz` — vérifié par lecture du code (`Intro.tsx`, `Outro.tsx`,
`TrackNumberBadge.tsx`, `diversify-artists.ts` existent tous). Rien à refaire dessus.

Note : les scratchpads des agents de la session précédente (listes candidates
curatedTracks brouillons) ne sont **pas accessibles** dans ce nouveau conteneur cloud
(éphémère, recréé à chaque session) — je repars de zéro pour la tâche 1.

Liste de tâches de cette session (ordre de priorité imposé par l'utilisateur) :

1. curatedTracks pour variete-actuelle + classiques-fr (actuellement 0 chacun)
2. Revérifier ~10 morceaux incertains (Rap FR, Années 2000, Années 80)
3. Vérifier le run quotidien de ce matin (Années 80, 3h UTC)
4. Diversifier la vérification Spotify (multi-app / MusicBrainz)
5. Fiabiliser l'heure du run quotidien (déclencheur externe)
6. Recherche croissance abonnés + prototype YouTube Shorts
7. Tests pour scripts CLI à 0% couverture
8. Mise à jour docs/CAHIER_DES_CHARGES.md
9. Itération miniatures pour thèmes pauvres en photos d'artistes
10. Ajout channel_id à blocked_tracks

Garde-fous rappelés : pas d'images de franchises sous copyright pour les miniatures ;
pas de travail sur multi-chaînes/multi-langues/site sponsor (architecture seulement) ;
pas d'agents parallèles tapant la même app Spotify en même temps.

**Blocage important** : ce conteneur cloud n'a **aucune credential** (`.env` absent,
aucune variable `SPOTIFY_*`/`YOUTUBE_*`/`ANTHROPIC_API_KEY` dans l'environnement). Je ne
peux donc pas exécuter le pipeline ni appeler l'API Spotify/iTunes/YouTube directement
depuis cette session. J'utilise les tools GitHub (lecture des runs Actions, logs, DB
sqlite versionnée) pour tout ce qui est diagnostic, et je documente clairement quand une
tâche nécessite une vérification ultérieure (session locale ou prochaine session cloud
avec credentials configurées dans les settings de l'environnement).

---

## [2026-09-27] Tâche 3 — Vérifier le run quotidien du matin — TERMINÉ

**Correction du contexte utilisateur** : le run de ce matin n'était PAS le thème
"Années 80" — 2026-09-27 est un **dimanche**, et `channels/blindtest-fr.json` mappe
`sunday` → `generiques` (Génériques dessins animés/films). Années 80 est `monday`.

**Ce qui s'est passé** (vérifié via GitHub Actions API + `data/blindtest.sqlite`) :

- Run programmé (`schedule`) déclenché à **09:06 UTC** (pas 03:00 UTC — confirme le
  problème de ponctualité du cron natif, cf. tâche 5), run id 36308305422 → **échec**.
- Cause racine : `itunes.findPreviewByTitleAndArtist("Timecrash", "Éric Serra")`
  renvoyait un 404 persistant (page HTML d'erreur Apple), épuisait les 8 tentatives de
  retry de `packages/integrations/itunes/src/client.ts`, puis lançait une exception non
  interceptée qui a fait planter tout le process Node (`build-episode-tracks.js` à ce
  commit n'avait pas encore le wrapper `safeFindPreview` protecteur).
- Ce bug était déjà connu et **corrigé le jour même, avant le début de cette session**,
  par les commits `b6afedf` (retry sur tout statut non-ok, pas seulement 403/429) et le
  wrapper `safeFindPreview` dans `build-episode-tracks.ts` (déjà présent au HEAD actuel,
  attrape maintenant toute exception iTunes et saute le morceau au lieu de planter).
- Un retry manuel (`workflow_dispatch`, run id 36309745867, commit `feb3f0c` qui
  contenait déjà le fix) a réussi à 09:33 UTC.
- Confirmé dans `data/blindtest.sqlite` : épisode `generiques` du 2026-09-27,
  `status='uploaded'`, `visibility='public'`, `youtube_video_id='GwsvBoSjLXM'`.

**Statut** : run du jour finalement publié avec succès, aucune action corrective
nécessaire de ma part — déjà géré. Le code au HEAD actuel (`safeFindPreview` +
retry-sur-tout-statut) est robuste contre une répétition de ce scénario précis.
**Reste un point structurel non résolu** : la ponctualité du cron (09:06 au lieu de
03:00 UTC, un délai de ~6h) — traité dans la tâche 5.

---

## [2026-09-27] Tâche 1 — curatedTracks variete-actuelle + classiques-fr — TERMINÉ (à re-vérifier)

Ajouté `curatedTracks` (37 paires titre/artiste pour `variete-actuelle`, 44 pour
`classiques-fr`) dans `channels/blindtest-fr.json`, une par artiste de `seedArtists`
(hit le plus reconnaissable de chacun), sur le modèle des autres thèmes.

**Décision arbitraire et pourquoi** : ces paires viennent de connaissance générale, pas
d'une recherche Spotify vérifiée (pas de credentials dans ce conteneur, cf. blocage
noté en tête de journal). C'est **sans risque de casse** : `collectCuratedTracks` (déjà
en place) ignore silencieusement toute paire qui ne matche rien sur Spotify (log
warning, pas d'exception) — au pire certaines entrées ne rapportent rien et le thème
retombe sur la recherche par `seedArtists` comme avant. J'ai volontairement laissé de
côté les artistes pour lesquels je n'étais pas sûr à 100% du titre exact (Régine pour
classiques-fr ; Gims, Patrick Fiori, Julien Granel, Pierre Garnier, Santa, Roméo Elvis,
Aloise Sauvage pour variete-actuelle) plutôt que de risquer une paire fausse.
**Vérifié explicitement contre `blocked_tracks`** : n'ai pas repris "Avant toi"
(Vitaa, Slimane) ni "Reine" (Dadju), tous deux bannis définitivement (Content ID) —
pris "À fleur de toi" et "Compliqué" à la place pour ces deux artistes.

**Validation faite** : JSON valide, `pnpm build` OK, `pnpm --filter @blindtest/pipeline
test` → 74/74 tests passent, `prettier --check` OK.

**Prochain pas concret** : à la prochaine session avec credentials Spotify (locale ou
cloud avec `.env`/secrets configurés), lancer une passe de vérification (ex. un petit
script one-off appelant `collectCuratedTracks` sur ces deux thèmes et loguant les
paires non trouvées) pour repérer les éventuels titres inexacts et les corriger ou
compléter les artistes laissés de côté.

---

## [2026-09-27] Tâche 2 — ~10 morceaux non confirmés (Rap FR/2000/80) — BLOQUÉ, outillage préparé

**Constat** : la liste précise des ~10 morceaux signalés comme "variantes de titre à
tester" par la session précédente **n'existe nulle part dans ce repo** — elle vivait
dans le scratchpad éphémère de cette session-là (voir blocage noté en tête de journal),
et je n'ai trouvé aucune trace (commit, fichier, TODO) permettant de la reconstituer
avec certitude. Je n'invente pas cette liste : deviner à quels morceaux exacts
l'utilisateur faisait référence serait plus dangereux qu'utile.

**Ce que j'ai fait à la place** :

1. Relecture manuelle de `curatedTracks` des 3 thèmes visés. Par prudence, je note ici
   4 entrées dont je ne suis PAS sûr à 100 % (`rap-fr`) — à vérifier en priorité :
   - `"Wesh alors"` — Jul (confiance moyenne)
   - `"Tchoin"` — Kaaris (confiance faible — pourrait être attribué au mauvais artiste)
   - `"Macarena"` — Damso (confiance faible)
   - `"Cosmo"` — Soprano (confiance faible)
     Le reste (annees-80, annees-2000, et le reste de rap-fr) me semble correct avec une
     bonne confiance, mais n'a **jamais été vérifié par le code contre Spotify** — ces
     thèmes tournent en prod depuis plusieurs semaines sans erreur `collectCuratedTracks`
     rapportée, ce qui est un signal indirect (une paire qui ne matche rien logue un
     warning mais ne fait pas échouer le run), pas une preuve.
2. Écrit `scripts/export-curated-songs-ndjson.mjs` (nouveau, lecture seule) : extrait
   TOUTES les paires `curatedTracks` de `channels/blindtest-fr.json` (226 artistes,
   tous thèmes confondus, pas seulement les 3 visés) au format NDJSON attendu par
   `apps/pipeline/src/curate-songs-cli.ts` (outil déjà existant, jamais utilisé pour
   auditer les données déjà en prod — seulement pensé jusqu'ici pour de la curation
   neuve). Testé (parsing, 226 lignes générées, format valide).

**Prochain pas concret (dès que des credentials Spotify sont disponibles)** :

```bash
pnpm build   # ou node déjà buildé dans apps/pipeline/dist
node scripts/export-curated-songs-ndjson.mjs channels/blindtest-fr.json > /tmp/curated-audit.ndjson
SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... \
  node apps/pipeline/dist/curate-songs-cli.js /tmp/curated-audit.ndjson /tmp/curated-verified.json
```

La sortie console liste chaque paire rejetée ("introuvable sur Spotify avec ce titre
exact") — c'est la vraie liste "à revérifier/corriger", pour ces 3 thèmes et pour tous
les autres (audit complet plutôt que partiel, autant en profiter). Corriger ensuite
chaque entrée rejetée dans `channels/blindtest-fr.json` à la main (titre exact trouvé
sur Spotify, ou suppression si le morceau n'existe pas sur la plateforme).

**Statut** : outillage prêt et committé, mais la vérification elle-même reste à faire
— nécessite des credentials Spotify absents de ce sandbox cloud.

---

## [2026-09-27] Tâche 4 — Diversifier la vérification Spotify — PARTIEL (multi-app fait, MusicBrainz non)

**Volet multi-app Spotify — TERMINÉ** : ajouté `createRotatingSpotifyClient` dans
`packages/integrations/spotify/src/rotating-client.ts` (+ test, 8 cas, tous passent).
Enveloppe plusieurs `SpotifyClient` (un par app développeur Spotify) et bascule sur le
suivant dès que l'app active lève `SpotifyRateLimitedError` ou
`SpotifyRequestBudgetExceededError` — sticky (reste sur la nouvelle app pour tous les
appels suivants, ne retente jamais celle en cooldown). Câblé de façon 100%
rétrocompatible dans `apps/pipeline/src/create-clients.ts` : lit des variables d'env
optionnelles `SPOTIFY_CLIENT_ID_2`/`SPOTIFY_CLIENT_SECRET_2` (puis `_3`, `_4`, …,
jusqu'à 8), et n'active la rotation que si au moins une app supplémentaire est
configurée — sans elles, comportement exactement identique à avant. Ajouté aussi les
lignes correspondantes (vides par défaut, sans effet) dans `.env.example` et
`.github/workflows/daily-pipeline.yml` (secrets optionnels).

**Décision arbitraire et pourquoi** : le cooldown persistant en base (`spotify-cooldown.ts`,
utilisé pour survivre entre les runs CI qui n'ont pas de disque persistant) reste câblé
uniquement à l'app primaire — les apps supplémentaires repartent avec un budget frais à
chaque run. Simplification volontaire : une migration DB pour stocker un cooldown par
app aurait été disproportionnée pour un mécanisme qui, par construction, ne sert
qu'une fois l'app primaire déjà épuisée — donc rarement actif.

**Prochain pas concret pour activer réellement ce mécanisme** : créer 2-3 apps sur le
[Spotify Developer Dashboard](https://developer.spotify.com/dashboard) (nécessite le
compte Spotify de l'utilisateur, je ne peux pas le faire moi-même), et renseigner
`SPOTIFY_CLIENT_ID_2`/`SPOTIFY_CLIENT_SECRET_2` (etc.) soit dans `.env` en local, soit
comme secrets du repo GitHub pour le workflow quotidien.

**Volet MusicBrainz — NON FAIT, bloqué par la politique réseau de ce sandbox** :
`musicbrainz.org` est refusé par le proxy de cet environnement cloud (`gateway
answered 403 to CONNECT`, confirmé via `$HTTPS_PROXY/__agentproxy/status`) — donc
impossible de tester un vrai appel à son API MusicBrainz depuis cette session, même
sans credentials Spotify (MusicBrainz est public, sans clé). Plutôt que d'écrire un
client à l'aveugle sans jamais avoir pu vérifier la forme réelle des réponses (risque
réel de livrer du code qui a l'air correct mais ne l'est pas), je documente la
proposition sans l'implémenter :

- **Objectif** : utiliser `GET https://musicbrainz.org/ws/2/recording?query=artist:"X"
AND recording:"Y"&fmt=json` comme pré-filtre gratuit et sans limite stricte de quota
  avant d'interroger Spotify — surtout utile pour `verifyCuratedSongs`
  (`apps/pipeline/src/verify-curated-songs.ts`), qui fait déjà une recherche exacte
  titre+artiste par morceau : si MusicBrainz ne trouve rien pour la paire, c'est un
  signal fort (pas une certitude) que la recherche Spotify ne trouvera rien non plus,
  ce qui permettrait de rejeter/flaguer sans consommer de quota Spotify.
  MusicBrainz impose 1 req/s sans clé — largement praticable en pré-filtre séquentiel.
- **Pourquoi un pré-filtre, pas un remplacement** : MusicBrainz n'a pas les URLs de
  prévisualisation audio ni les pochettes utilisées ailleurs dans le pipeline — Spotify
  reste nécessaire pour la donnée finale, MusicBrainz ne fait qu'économiser des appels
  Spotify sur les paires manifestement fausses.
- **Prochain pas concret** : implémenter un module `packages/integrations/musicbrainz`
  calqué sur `packages/integrations/itunes` (même structure : client + normalisation +
  retry), MAIS en le testant réellement contre l'API (au moins quelques appels manuels)
  avant de le committer — depuis un environnement qui a accès réseau à musicbrainz.org
  (local, ou un environnement cloud dont la politique réseau autorise ce host — voir
  paramètres réseau de l'environnement).

---

## [2026-09-27] Tâche 5 — Fiabiliser l'heure du run quotidien — TERMINÉ (code) + reste une étape manuelle

**Ce qui a été fait** :

1. `.github/workflows/daily-pipeline.yml` accepte maintenant un trigger
   `repository_dispatch` (`event_type: daily-pipeline-trigger`) en plus de `schedule`
   (conservé comme filet de sécurité) et `workflow_dispatch`. Un `repository_dispatch`
   s'exécute immédiatement à l'appel API, contrairement à `schedule` qui est mis en
   file d'attente par GitHub sans garantie de ponctualité (confirmé deux fois sur ce
   repo : ~5h puis ~6h de retard, voir tâche 3 et section 3decies du cahier des
   charges).
2. **Idempotence ajoutée** pour que `schedule` + `repository_dispatch` puissent
   désormais se déclencher le même jour sans casse : nouvelle fonction
   `hasUploadedVideoForThemeToday` (`packages/db/src/videos-repository.ts`, 5 tests),
   appelée en tête de `runPipeline` (`apps/pipeline/src/pipeline.ts`) — si un épisode
   du thème du jour est déjà `status='uploaded'` pour aujourd'hui (UTC), le run
   s'arrête immédiatement sans rien regénérer. Un `draft`/`failed` ne bloque jamais un
   nouvel essai (sinon ça aurait cassé les relances manuelles déjà utilisées deux fois
   dans l'historique du projet, dont celle de ce matin même — voir tâche 3).
3. Documenté en détail dans `docs/CAHIER_DES_CHARGES.md` (nouvelle section 3decies) :
   la marche à suivre complète pour finir la mise en place (créer un PAT GitHub à
   portée restreinte à ce repo, configurer un job sur cron-job.org ou équivalent qui
   POST vers `repos/{owner}/{repo}/dispatches`).

**Pourquoi ce n'est pas allé plus loin** : je ne peux pas créer moi-même de compte sur
un service tiers (cron-job.org) ni générer/stocker un Personal Access Token GitHub au
nom de l'utilisateur — ce sont des actions qui engagent son compte et ses accès, donc
hors de portée d'une session autonome, même avec permission générale d'agir. Le code
est prêt à recevoir le déclenchement dès que ces ~10 minutes de configuration externe
seront faites ; en attendant, le `schedule` natif (imprécis mais fonctionnel) continue
de tourner exactement comme avant, donc aucune régression si cette dernière étape
n'est jamais complétée.

**Validation faite** : `pnpm build`/`test`/`lint`/`typecheck` tous verts (27 tests db,
5 nouveaux), YAML validé (`python3 -c "import yaml; yaml.safe_load(...)"`).

**Prochain pas concret** : suivre la section 3decies de `docs/CAHIER_DES_CHARGES.md`
pour configurer le déclencheur externe.

---

## [2026-09-27] Tâche 10 — channel_id sur blocked_tracks — TERMINÉ

Ajouté `channel_id TEXT NOT NULL REFERENCES channels(id)` à `blocked_tracks`
(`packages/db/src/schema.ts`), avec migration idempotente pour les bases existantes
(`migrateBlockedTracksChannelId` dans `database.ts`, `ALTER TABLE ... ADD COLUMN
... DEFAULT 'blindtest-fr'`, backfill correct pour ce projet mono-chaîne). `blockTrack()`
prend maintenant un `channelId` obligatoire ; câblé dans `replace-blocked-tracks.ts`
via `videoRow.channel_id` (déjà disponible, la vidéo bloquée sait sur quelle chaîne
elle a été publiée).

**Décision arbitraire et pourquoi** : `getBlockedTrackIds()` reste volontairement
**non filtrée par chaîne** — le commentaire déjà présent dans `schema.ts` explique
qu'une réclamation Content ID porte sur l'enregistrement lui-même, pas sur la chaîne ;
une deuxième chaîne qui republierait le même morceau risquerait exactement la même
réclamation. `channel_id` est donc une piste d'audit (quelle chaîne a découvert le
blocage), pas une clé de filtrage — j'ai documenté ce choix explicitement dans le code
pour qu'une future implémentation multi-chaînes ne le change pas par erreur en pensant
combler un oubli.

**Validation faite** : 3 nouveaux tests unitaires (`database.test.ts` : migration sur
DB fraîche / DB legacy sans la colonne / idempotence ; `blocked-tracks-repository.test.ts`
: nouveau cas + FK maintenant respectée dans le `beforeEach`), `pnpm build/test/lint/
typecheck` tous verts. **Migration réellement exécutée contre le vrai
`data/blindtest.sqlite` committé** (pas seulement en test) : colonne ajoutée, 2 lignes
existantes backfillées à `'blindtest-fr'`, tous les compteurs de lignes de toutes les
tables identiques avant/après (vérifié par script), donc committée telle quelle — la
prochaine fois que le pipeline tournera (CI ou local), la migration sera un no-op.

---

## [2026-09-27] Tâche 7 — Tests pour scripts CLI à 0% couverture — TERMINÉ (approche adaptée)

**Constat** : `replace-blocked-tracks.ts`, `recut-episode.ts`, `reupload-video.ts` et
`set-thumbnail.ts` sont des scripts CLI "top-level" au sens strict (parsing de
`process.argv`, effets de bord exécutés dès l'import — DB, réseau, filesystem — sur le
modèle exact de `index.ts`), pas des modules exportant des fonctions. Les
importer directement dans un test exécuterait tout le script. Ce n'est pas un oubli :
c'est le même schéma que tous les autres fichiers de ce dossier qui ont 100% de
logique testable ailleurs (`discover-artists.ts`, `persist-discovered-artists.ts`,
`youtube-metadata.ts`, etc.) — ces 4 scripts sont simplement les seuls qui n'avaient
jamais eu leur logique non-triviale extraite.

**Ce qui a été fait** : les 4 scripts partageaient deux blocs de logique dupliqués,
mot pour mot ou presque :

1. "Retrouver le thème correspondant à `videoRow.theme_id` dans la config de chaîne,
   ou lever une erreur descriptive" — présent identique dans les 4 scripts. Extrait en
   `apps/pipeline/src/find-theme-by-id.ts` (`findThemeOrThrow`), 2 tests.
2. Dans `replace-blocked-tracks.ts` seulement : le rapprochement des paires
   titre/artiste fournies en ligne de commande (lues à la main sur YouTube Studio) avec
   les lignes `tracks_used` réelles de l'épisode (normalisation diacritiques/casse,
   artiste en sous-chaîne, erreur si ce n'est pas exactement 1 correspondance — la
   logique la plus délicate et la plus risquée des 4 scripts, puisqu'une mauvaise
   correspondance bloquerait le mauvais morceau). Extrait en
   `apps/pipeline/src/match-blocked-track-rows.ts` (`matchBlockedTrackRows`), 6 tests
   (correspondance exacte, sous-chaîne d'artiste, insensible aux diacritiques,
   plusieurs specs, 0 correspondance, correspondances ambiguës).

Les 4 scripts ont été mis à jour pour utiliser ces deux fonctions à la place de leur
logique dupliquée — en plus d'ajouter des tests, ça élimine une duplication réelle sur
4 fichiers (pas seulement un prétexte pour écrire des tests).

**Ce qui reste à 0% et pourquoi c'est un choix assumé, pas un oubli** : le reste de ces
4 scripts (orchestration DB/réseau/rendu vidéo — upload YouTube, rendu Remotion,
requêtes Spotify/iTunes en direct) n'a pas été testé unitairement. Le faire
nécessiterait soit des tests d'intégration avec de vraies credentials (impossibles
dans ce sandbox, cf. blocage noté en tête de journal), soit un mock lourd de
`createClientsFromEnv`/`openDatabase`/`bundleVideoRenderer` qui testerait surtout la
plomberie de mock elle-même plutôt que d'apporter une vraie confiance — non fait, pour
rester cohérent avec la façon dont le reste du projet teste déjà ce genre de code
(voir `packages/integrations/*/src/*.test.ts` : mock au niveau du client HTTP, jamais
au niveau du script CLI entier).

**Validation faite** : 8 nouveaux tests (82 tests pipeline au total, avant 74),
`pnpm build/test/lint/typecheck` tous verts.

---

## [2026-09-27] Tâche 9 — Miniatures pour thèmes pauvres en photos d'artistes — TERMINÉ, vérifié visuellement

**Diagnostic confirmé par un vrai rendu local** (voir méthode ci-dessous) : quand
`resolveHeroArtistImages` (`render-thumbnail.ts`) ne trouve **aucune** photo Spotify
d'artiste — cas fréquent sur le thème "Génériques dessins animés/films" (crédits
compositeur/orchestre, rarement présents sur Spotify avec portrait), la miniature
retombait sur `CoverGridFallback` : une grille de 40 pochettes assombries à 50% de
luminosité + un dégradé radial qui les assombrit encore plus au centre — résultat :
un grand vide noir sur les 2/3 inférieurs de l'image, très faible visuellement.

**Correctif** (`packages/video-renderer/src/Thumbnail.tsx`) : quand `artistImageUrls`
est vide, les pochettes distinctes (`coverImageUrls` dédupliquées) passent maintenant
dans le **même composant `HeroCollage`** que les vraies photos d'artistes (mêmes
`HERO_LAYOUTS` 1-6 déjà conçus et déjà bons) — au lieu de la grille assombrie. La
grille reste en tout dernier recours, seulement si vraiment aucune image du tout
n'est disponible (cas pathologique qui ne devrait jamais arriver en pratique).

**Décision arbitraire et pourquoi** : réutiliser `HeroCollage` tel quel (même bordure
colorée, même ombre) plutôt que créer un style visuel distinct pour "pochettes" vs
"visages" — cohérence de marque, et le rendu vérifié (voir ci-dessous) montre que ça
fonctionne très bien visuellement sans changement supplémentaire.

**Méthode de vérification — rendu Remotion réel, pas une lecture de code seule** :
ce sandbox n'a pas de credentials Spotify, mais le rendu de la composition `Thumbnail`
elle-même ne nécessite aucun réseau externe (juste des images locales). Chromium étant
préinstallé (`/opt/pw-browsers`), j'ai généré des images de test (carrés de couleurs
unies, aucune bibliothèque d'images disponible dans ce sandbox) et fait tourner
`bundleVideoRenderer()` + `renderStill` en pointant `browserExecutable` vers
`chromium_headless_shell` (le Chrome standard de Playwright refuse l'ancien mode
headless que Remotion utilise) avec `chromiumOptions.ignoreCertificateErrors: true`
(le proxy de cet environnement fait échouer le chargement TLS des Google Fonts
sinon). 5 scénarios rendus en PNG réels et inspectés visuellement : 0 photo (avant/
après), 0 photo + 6 pochettes distinctes, 1/2/3 photos d'artiste (pour confirmer
l'absence de régression sur le cas déjà bon). Images avant/après envoyées à
l'utilisateur. Scripts de test et images placeholder non committés (nettoyés après
usage, `packages/video-renderer/public/{covers,artists}` étaient de toute façon déjà
gitignorés).

**Validation faite** : rendu visuel réel (voir ci-dessus) + `pnpm build/lint/
typecheck` verts pour `@blindtest/video-renderer`. Pas de test unitaire ajouté pour
`Thumbnail.tsx` — aucun composant React de ce package n'a de test unitaire existant
(seule `countdown-math.ts`, logique pure, en a), la vérification visuelle est la
méthode déjà établie dans ce projet pour ce type de composant (voir historique des
compositions bannière/photo de profil de chaîne, "rendues une fois et livrées
directement à l'utilisateur").

---

## [2026-09-27] Tâche 6 — Croissance abonnés + prototype YouTube Shorts — TERMINÉ

**Recherche (via web search, infos 2026)** : les Shorts sont désormais le principal
levier de découverte pour une petite chaîne — l'algorithme juge chaque Short sur ses
propres performances (pas l'ancienneté de la chaîne), donc une chaîne neuve peut
rivaliser. Repères retenus :

- Volume : les chaînes en croissance rapide postent 3 à 5 Shorts/semaine minimum.
- Les 2-3 premières secondes décident si le viewer reste ou swipe — pas de place pour
  une explication de règles longue.
- Cohérence de niche : rester sur un seul format/sujet améliore nettement les
  performances algorithmiques.
- Rôle des Shorts : couche de découverte, pas moteur de fidélisation — le format long
  reste ce qui construit la vraie audience ; le rôle d'un Short est d'amener vers la
  chaîne, pas de la remplacer.
- Spécs techniques 2026 : 9:16, jusqu'à 1080×1920, durée max relevée à 180s (plus la
  limite de 60s d'avant octobre 2024) — largement assez pour une "mini partie" à 5-6
  morceaux plutôt qu'un simple teaser à 1 morceau.
  Sources : vidpros.com, metricool.com, vidseeds.ai, vidiq.com, hopperhq.com (liens
  complets dans la réponse de recherche de cette session).

**Décision de conception** : plutôt qu'un teaser abstrait, le Short reprend le
**même gameplay countdown+reveal** que le format long (`TrackSegment`, déjà conçu de
façon centrée/`AbsoluteFill`, donc réutilisable tel quel en vertical sans aucune
modification) sur les 5-6 premiers morceaux d'un épisode déjà publié — ces morceaux
sont déjà les plus forts/reconnaissables grâce à `buildOpeningHook`, qui réordonne
l'épisode pour ouvrir sur ses meilleurs morceaux. Le Short se termine par un renvoi
explicite vers l'épisode complet + abonnement.

**Implémenté** :

- `packages/video-renderer/src/Short.tsx` (+ `short-schema.ts`, `ShortIntro.tsx`,
  `ShortOutro.tsx`) : composition Remotion verticale 1080×1920, enregistrée dans
  `Root.tsx` sous l'id `"Short"`. Réutilise `TrackSegment`/`CountdownRing`/`RevealCard`
  sans aucune modification.
- `apps/pipeline/src/render-short.ts` (`renderShort`) : calque exact de
  `render-episode.ts` pour la composition `"Short"`.
- `apps/pipeline/src/generate-short.ts` : script CLI (`generate-short
<channel-config.json> <long-video-row-id> [--track-count=5] [--upload]`) — relit les
  N premiers `tracks_used` d'un épisode déjà publié, ré-hydrate cover+extrait audio
  (même schéma que `recut-episode.ts`), rend le Short, et avec `--upload` le publie sur
  YouTube (`format: 'short'`, le champ existait déjà dans le schéma DB, jamais utilisé
  jusqu'ici). **Décision explicite** : n'enregistre PAS ces morceaux une 2e fois dans
  `tracks_used` (pas de double-comptage du cooldown anti-répétition — voir commentaire
  dans le fichier) et ne l'ajoute pas au pipeline quotidien automatique (script manuel,
  comme `recut-episode.ts`/`reupload-video.ts` — publier des Shorts en routine est une
  décision de cadence éditoriale qui revient à l'utilisateur, pas quelque chose à
  activer silencieusement).
- `apps/pipeline/src/youtube-metadata.ts` : nouvelle `buildShortMetadata` (titre avec
  `#Shorts`, description qui renvoie vers l'épisode complet plutôt que de lister les
  morceaux du Short) — 3 tests.

**Vérifié par un vrai rendu local** (même méthode que la tâche 9 : chromium
headless_shell + `ignoreCertificateErrors`, images de test en couleurs unies) : intro,
countdown, reveal et outro rendus en PNG et envoyés à l'utilisateur. Fonctionne de bout
en bout visuellement. **Limite assumée et notée pour plus tard** : le countdown/reveal,
dimensionné pour le format long (anneau à 340px), laisse un vide visuel important en
haut et en bas du cadre vertical 1080×1920 — pas retouché ici pour ne pas modifier
`CountdownRing`/`RevealCard`/`TrackSegment` (composants partagés avec le format long,
déjà en prod, jamais revus visuellement dans cette session) sans pouvoir vérifier
l'absence de régression sur le format long en conditions réelles. Amélioration de
suivi possible : soit un fond dynamique propre au Short (dégradé/glow animé derrière
`TrackSegment`), soit un anneau agrandi via une prop de taille optionnelle sur
`CountdownRing`/`RevealCard` (rétrocompatible, valeur par défaut = comportement actuel
pour le format long).

**Ce qui reste non testé** : la partie réseau de `generate-short.ts` (Spotify/iTunes/
YouTube) — même limite que les 4 scripts CLI de la tâche 7, cohérent avec comment ce
projet teste déjà ce genre de code (mock au niveau client HTTP dans les packages
`integrations/*`, jamais au niveau script CLI entier). Jamais exécuté en conditions
réelles (pas de credentials dans ce sandbox) — **prochain pas concret** : lancer
`node apps/pipeline/dist/generate-short.js channels/blindtest-fr.json <id-épisode>`
sur un épisode déjà publié (ex. celui de "Génériques" du 2026-09-27,
`e81a9fc8-dcde-4224-b9e5-abe1e69c157f`) sans `--upload` d'abord pour valider le rendu
sur une vraie vidéo, puis avec `--upload` en `visibility` privée pour valider la
publication avant d'en faire une habitude.

**Validation faite** : rendu visuel réel + `pnpm build/test/lint/typecheck` tous
verts (85 tests pipeline, 3 nouveaux pour `buildShortMetadata`).

---

## [2026-09-27] Tâche 8 — Mise à jour docs/CAHIER_DES_CHARGES.md — TERMINÉ

Ajouté 2 nouvelles sous-sections datées (3undecies, 3duodecies) : un rattrapage
documentaire pour des fonctionnalités déjà en prod mais jamais décrites dans ce
document (revue IA Anthropic optionnelle, `curatedTracks`, liste noire Content ID
`blocked_tracks`, scripts de récupération manuelle, miniature avec photos d'artistes,
bannière/photo de profil de chaîne), puis un récapitulatif de tout ce qui a été fait
dans cette session cloud avec renvoi vers `CLOUD_SESSION_LOG.md` pour le détail
complet. Mis à jour : section 6 (modèle de données — ajout `blocked_tracks` et
`service_cooldowns`, précision sur `format`), section 8 (prérequis utilisateur —
3 nouvelles lignes optionnelles : clé Anthropic, apps Spotify de secours,
déclencheur externe), section 9 (roadmap — v1.2 Shorts marqué "prototypé", v1.1
multi-chaînes noté "premier pas fait"), section 11 (5 nouveaux points ouverts reflétant
l'état réel après cette session).

**Validation faite** : `prettier --write` appliqué, `pnpm build/test/lint/typecheck`
tous verts.

---

## [2026-09-27] FIN DE SESSION — résumé pour la reprise

**Toutes les 10 tâches de la liste de priorité sont terminées** (certaines
partiellement, par manque de credentials dans ce sandbox — voir chaque entrée
ci-dessus pour le détail). Résumé express :

| #   | Tâche                                          | État                                                                                                 |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | curatedTracks variete-actuelle + classiques-fr | Fait, **non vérifié contre Spotify**                                                                 |
| 2   | Revérifier ~10 morceaux incertains             | Liste précise introuvable ; outillage d'audit livré à la place                                       |
| 3   | Run quotidien de ce matin                      | Vérifié : a échoué puis réussi en retry, déjà géré avant cette session                               |
| 4   | Diversifier vérif. Spotify                     | Rotation multi-app faite et testée ; MusicBrainz documenté seulement (réseau bloqué)                 |
| 5   | Fiabiliser l'heure du run                      | Code fait et testé ; **config externe (PAT + cron tiers) reste à faire côté utilisateur**            |
| 6   | Croissance abonnés + Shorts                    | Recherche faite ; prototype Shorts codé et **vérifié par rendu réel**, jamais testé avec credentials |
| 7   | Tests scripts CLI 0%                           | Fait (refactor + 8 tests)                                                                            |
| 8   | Mise à jour cahier des charges                 | Fait                                                                                                 |
| 9   | Miniatures thèmes pauvres en photos            | Fait et **vérifié par rendu réel**                                                                   |
| 10  | channel_id sur blocked_tracks                  | Fait, migration exécutée sur la vraie DB                                                             |

**Ce qui bloque toute nouvelle vérification en conditions réelles dans ce type de
session cloud** : aucune credential (`.env` absent, `SPOTIFY_*`/`YOUTUBE_*`/
`ANTHROPIC_API_KEY` non configurées dans l'environnement), et la politique réseau de
cet environnement bloque certains hosts externes (confirmé pour `musicbrainz.org`,
probablement Spotify/YouTube aussi). Une session cloud future avec ces credentials
configurées dans les settings de l'environnement (ou une reprise en local, qui a déjà
`.env`) pourrait exécuter tout ce qui est resté "code prêt mais jamais testé en
conditions réelles" ci-dessus.

**Ordre suggéré pour la suite (locale ou prochaine session cloud avec credentials)** :

1. Auditer les `curatedTracks` (tâches 1+2) avec `scripts/export-curated-songs-ndjson.mjs`
   - `curate-songs-cli.ts` — corrige d'un coup les deux tâches les plus incertaines.
2. Laisser tourner le run quotidien normalement quelques jours pour confirmer que
   l'idempotence (tâche 5) et le fallback miniature (tâche 9) se comportent bien en
   prod — rien à faire activement, juste observer.
3. Finir la config du déclencheur externe (tâche 5, section 3decies du cahier des
   charges) — 10 minutes côté utilisateur (PAT GitHub + cron-job.org).
4. Tester `generate-short.ts` sur un épisode déjà publié, d'abord sans `--upload`
   pour valider le rendu, puis avec `--upload` en privé (tâche 6).
5. Si le rate-limit Spotify redevient un problème récurrent, créer 2-3 apps
   supplémentaires et renseigner `SPOTIFY_CLIENT_ID_2`/`_SECRET_2` etc. (tâche 4).
6. Le volet MusicBrainz (tâche 4) reste à faire de zéro si jugé utile après le point 5
   — non commencé, seulement documenté comme proposition.

Tout le code de cette session est committé et poussé sur `main-hpf4qz` au fur et à
mesure (jamais de travail non poussé laissé dans ce sandbox), avec `pnpm build/test/
lint/typecheck` verts à chaque étape.

---

# Nouvelle session cloud — 2026-09-27 (suite)

Reprise par l'utilisateur après lecture du journal ci-dessus. Objectif : étendre le
prototype Shorts existant (ne pas le dupliquer) — corriger le défaut visuel connu,
ajouter 6 types de Shorts (2 familles), automatiser en quotidien avec dry-run.

## [2026-09-27] Vérification credentials/réseau — BLOQUÉ, identique à la session précédente

- `.env` absent, aucune variable `SPOTIFY_*`/`YOUTUBE_*`/`ANTHROPIC_API_KEY` dans
  l'environnement.
- `curl` vers `accounts.spotify.com`, `api.spotify.com`, `musicbrainz.org` : tunnel
  CONNECT refusé (403) par le proxy de cet environnement — mêmes hosts bloqués que la
  session précédente.
- `googleapis.com` répond (404 sur la racine, normal), mais sans credentials YouTube
  ça ne débloque rien.

**Conséquence** : comme la session précédente, aucune validation réseau réelle
possible (tâche "validation end-to-end" ci-dessous restera documentée comme prochain
pas, pas exécutée). Tout ce qui suit est soit vérifiable localement sans réseau
(rendu Remotion, tests unitaires, logique pure), soit écrit avec le même soin que la
session précédente pour du code jamais exécuté en conditions réelles — clairement
signalé à chaque fois.

## [2026-09-27] Recherche stratégie Shorts 2026 (avant tout code) — TERMINÉ

Recherche web (3 requêtes, résultats agrégés de multiples sources 2026 : air.io,
metricool.com, shortimize.com, vidiq.com, miraflow.ai, blitzcutai.com, et autres —
liens complets dans les résultats de recherche de cette session). Les trois points
demandés :

**a) Fréquence de publication optimale** — pas un chiffre unique, un compromis avec
rendements décroissants clairement documenté :

- Passer de 1 à 2 Shorts/jour ~triple la croissance d'abonnés observée ; passer de 3 à
  4+ n'ajoute que ~8% — rendements très décroissants au-delà de 3/jour.
- **Seuils de pénalité identifiés** : au-delà de 5 Shorts/jour, "signaux de spam"
  probables et chute de portée par vidéo ; 10+ Shorts en une journée peut déclencher la
  détection anti-spam de YouTube et réduire la visibilité de la chaîne entière.
- Plusieurs sources convergent : des Shorts de qualité postés 3-5x/semaine
  surperforment des Shorts médiocres postés quotidiennement — la régularité compte plus
  que le volume brut, et la qualité prime sur la fréquence au-delà du minimum viable.
- **Fourchette recommandée retenue** : 5-7 Shorts/semaine (~1/jour en moyenne, jusqu'à
  2-3/jour ponctuellement pour des types de contenu différents) — au-dessus du minimum
  qui bénéficie à la croissance, largement sous les seuils de pénalité.
- **Décision pour ce projet** : avec 6 types de Shorts distincts prévus (4 famille A +
  2 famille B), viser ~2 Shorts/jour en moyenne (pas 6/jour tous types confondus —
  beaucoup trop haut, franchirait la zone de pénalité) en faisant tourner les types sur
  la semaine plutôt que de tous les publier chaque jour. Détail du calendrier dans la
  tâche d'automatisation ci-dessous.

**b) Durée optimale et monétisation** :

- La fourchette qui maximise le taux de complétion est **15-30 secondes** pour la
  plupart des niches (35-58s pour un second pic, mais réservé aux niches "narratives
  denses" — histoire, finance, débat — pas le format jeu/quiz de ce projet).
- **Ce qui compte pour l'algorithme, ce n'est pas la durée mais le taux de complétion**
  : un Short de 20s regardé jusqu'au bout surperforme un Short de 2 minutes avec 15% de
  décrochage. La limite technique de 180s (relevée d'octobre 2024) ne dit rien sur ce
  qui performe réellement — confirmé par cette recherche, la limite technique et la
  durée optimale sont deux choses différentes.
- **Monétisation — point demandé explicitement à vérifier, CONFIRMÉ** : c'est bien
  l'éligibilité de la CHAÎNE au Partner Program qui conditionne la monétisation, pas la
  durée d'une vidéo individuelle. Deux voies d'éligibilité : 1000 abonnés + 10M vues
  Shorts valides sur 90 jours, OU 1000 abonnés + 4000h de visionnage format long sur 12
  mois. Une fois éligible, la monétisation Shorts se répartit sur un pool de revenus au
  niveau de la chaîne (part des vues totales), pas un paiement par vidéo individuelle.
  RPM Shorts très bas (0,01-0,07$/1000 vues en général, 0,10-0,25$ dans les niches à
  forte valeur) — la durée d'un Short donné n'entre pas dans ce calcul.
- **Décision pour ce projet** : recalibrer "devine la chanson" de 5-6 morceaux
  (~90-105s, décision de la session précédente, jamais vérifiée par cette recherche) à
  **2-3 morceaux** (~23-58s selon le nombre) — bien mieux aligné avec la fourchette
  15-30/35-58s qui maximise le taux de complétion. Les autres types (plus courts par
  nature, un seul morceau ou un fait ponctuel) viseront la même fourchette basse.

**c) Pourquoi la première seconde est déterminante** — confirmé et détaillé :

- Les 0-3 premières secondes sont "la décision de swipe" : 30 à 50% des viewers
  partent dans cette fenêtre en moyenne. L'algorithme utilise le taux de swipe-away
  comme filtre principal de distribution — si trop de viewers swipent dans les 2
  premières secondes, la distribution s'arrête, indépendamment de la qualité du reste.
  Benchmark cité : rester sous 40% de "Swiped Away" dans YouTube Studio, viser 75%+ de
  "Viewed vs Swiped Away".
- Ce qui tue un hook, nommément identifié par la recherche : un plan large qui plante
  le décor, une accroche du type "Dans cette vidéo je vais vous montrer...", un appel à
  s'abonner en ouverture — tout ce qui retarde l'action réelle. Implication explicite :
  **pas d'intro/logo qui retarde l'accroche, cut direct sur l'élément le plus fort**.
- **Conséquence concrète pour ce projet** : l'actuel `ShortIntro.tsx` (2,5s plein écran
  de texte statique "🎧 BLIND TEST · {thème} · 12s chrono") est exactement le type
  d'ouverture que cette recherche identifie comme sous-performante — un "context dump"
  statique avant que le jeu commence. **Décision** : remplacer cette séquence bloquante
  par un bandeau non-bloquant (theme label en petit, en haut du cadre) superposé
  DIRECTEMENT sur l'anneau de compte à rebours du premier morceau, qui démarre dès la
  frame 0 — l'action (l'anneau qui tourne, déjà l'élément le plus dynamique visuellement
  de toute la composition) est visible immédiatement, rien ne bloque avant elle. Détail
  dans la tâche du correctif visuel ci-dessous.

Sources (liens complets retournés par les 3 recherches de cette session) : air.io,
metricool.com, shortimize.com, sendshort.ai, flowshorts.app, vidiq.com, miraflow.ai,
blitzcutai.com, socialync.io, toptal.com, et autres agrégateurs 2026 convergents sur
ces points.

## [2026-09-27] Correctif visuel + recalibrage durée — TERMINÉ, vérifié par rendu réel

**Vide visuel (priorité demandée)** : `CountdownRing` et `RevealCard` prennent
maintenant une prop de taille optionnelle (`size`/`coverSize`), rétrocompatible —
absente, comportement identique à avant (340px/360px, format long `Episode.tsx`
inchangé, zéro risque de régression puisque `Episode.tsx` n'a pas été touché).
`TrackSegment.tsx` relaie ces props optionnelles. `Short.tsx` passe 620px pour les
deux (contre 340/360px) — remplit beaucoup plus le cadre vertical 1080×1920.

**Première seconde (point c de la recherche ci-dessus, appliqué directement)** :
supprimé `ShortIntro.tsx` (séquence plein écran bloquante de 2,5s, texte statique)
— exactement l'anti-pattern identifié par la recherche. Remplacé par
`ShortHeader.tsx` : un bandeau non-bloquant (thème en petit, pilule semi-
transparente en haut) superposé sur l'anneau du premier morceau, qui démarre lui
dès la frame 0. Le nouveau `totalShortDurationInFrames` ne compte plus de temps
d'intro séparé — supprimé du calcul, pas juste caché.

**Durée recalibrée (point b de la recherche)** : `DEFAULT_SHORT_TRACK_COUNT` dans
`generate-short.ts` passe de 5 à **2** morceaux — 5 morceaux ≈ 94s (bien au-delà de
la fourchette 15-30/35-58s qui maximise le taux de complétion) ; 2 morceaux ≈ 38s,
dans la fourchette haute recommandée. Toujours configurable via `--track-count`.

**Vérifié par un vrai rendu Remotion local** (même méthode que la session
précédente : `chromium_headless_shell` + `ignoreCertificateErrors`, images de test
en couleurs unies) : 4 frames (frame 0, bandeau visible, reveal, outro) rendues en
PNG et envoyées à l'utilisateur, comparables aux captures "avant" de la session
précédente. Différence visuelle nette : plus de vide, contenu visible dès la
première frame.

**Validation faite** : `pnpm build/lint/typecheck` verts pour `@blindtest/video-
renderer` et `@blindtest/pipeline` (aucun test unitaire cassé — `Short.tsx`/
`CountdownRing.tsx`/`RevealCard.tsx`/`TrackSegment.tsx` n'ont pas de tests unitaires
dédiés dans ce projet, cohérent avec le reste des composants React de
`video-renderer`, vérification visuelle étant la méthode établie ici).

## [2026-09-27] Conception abstraction "type de Short" — recherche source de données famille B

**Avant tout code** (comme demandé) : recherché si `GET /v1/browse/new-releases` ou
`search?q=tag:new` sont des options viables pour la famille B, étant donné les
restrictions déjà connues de cette app Spotify (recommendations/playlist/artist-
top-tracks fermés pour les nouvelles apps, voir CAHIER_DES_CHARGES 3bis).

- **`/v1/browse/new-releases` : CONFIRMÉ SUPPRIMÉ** — changelog officiel Spotify
  for Developers de février 2026 : l'endpoint "Get New Releases" a été retiré dans
  le cadre des changements "Developer Mode". Option écartée, sans ambiguïté.
- **`search?q=tag:new` : écarté aussi**, pour deux raisons trouvées dans la
  documentation officielle et les retours de la communauté Spotify : (1) ce filtre
  ne s'applique qu'à la recherche **d'albums**, jamais de morceaux directement,
  obligeant un second aller-retour album→morceaux ; (2) historique documenté
  d'instabilité — plusieurs signalements communautaires du filtre qui cesse de
  fonctionner sans préavis. Trop fragile pour une automatisation quotidienne sans
  possibilité de le tester en direct dans ce sandbox.
- **Point plus large et important, à surveiller** : le changelog Spotify de février
  2026 indique aussi un éloignement du flow Client Credentials pour les endpoints
  de métadonnées, et un Developer Mode désormais limité à 5 utilisateurs par app et
  nécessitant un compte Premium. Ce projet utilise déjà Client Credentials pour
  tout le pipeline existant (confirmé fonctionnel via le run du 2026-09-27, tâche 3
  de la session précédente) — pas d'action requise maintenant, mais **à surveiller** :
  si Spotify restreint encore Client Credentials, tout le pipeline (pas seulement
  les Shorts) serait affecté. Noté dans les points ouverts en fin de session.

**Solution retenue — n'utilise QUE des endpoints déjà vérifiés fonctionnels dans ce
projet**, zéro nouveau risque d'endpoint non testé : combiner `searchArtists`
(déjà utilisé par `discover-artists.ts` pour découvrir des artistes par requête de
genre, ex. "rap francais") avec `searchTracksByArtist` (déjà le cœur de la
sélection de morceaux du pipeline principal), puis trier les résultats
côté client par `album.release_date` (nouveau champ ajouté au client Spotify, voir
plus bas) pour ne garder que les plus récents. Aucun nouvel endpoint, aucune
supposition non vérifiée sur la forme des données — uniquement de la composition
de deux méthodes déjà testées et déjà en production. Détail dans la tâche famille B
ci-dessous.

## [2026-09-27] Famille A — les 4 types de Short liés à un épisode

Implémentation des 4 types "famille A" (lien vers la chaîne, réutilisent des
morceaux déjà en base) dans un nouveau dossier `apps/pipeline/src/shorts/` — un
fichier par type, dans le style déjà établi du projet (pas d'abstraction générique
de "stratégie" : les entrées de chaque type diffèrent trop, seule la sortie
(`ShortCandidateTrack`, dans `types.ts`) est partagée) :

1. **`devine-la-chanson.ts`** — extrait de la logique déjà existante dans
   `generate-short.ts` (les N premières lignes `tracks_used` de l'épisode, dans
   l'ordre où `buildOpeningHook` les avait classées). Comportement inchangé,
   simplement déplacé dans son propre module réutilisable.
2. **`pepite-meconnue.ts`** — même épisode, mais les morceaux les **moins**
   populaires (vraie `popularity` Spotify, pas `popularityRank`). Coût : un appel
   `getTrackById` par morceau de l'épisode (~40-60), documenté en commentaire
   comme acceptable pour un usage occasionnel, pas gratuit.
3. **`top-artiste.ts`** — construit uniquement à partir de
   `getUsedTracksForChannel` (l'historique déjà connu de la chaîne), jamais d'appel
   à un endpoint "top morceaux d'un artiste" (fermé sur ce tier d'app Spotify).
   Filtre par correspondance de sous-chaîne normalisée (diacritiques/casse) sur le
   champ `artist` (qui peut contenir plusieurs artistes crédités, ex.
   "Vitaa, Slimane"), trie par popularité réelle décroissante.
4. **`anniversaire-sortie.ts`** — scanne tout l'historique de la chaîne, parse
   `release_date` (précision variable : année seule, année-mois, ou date
   complète — un mois/jour absent est traité comme le 1er, au mieux), calcule les
   correspondances "sorti il y a N ans, ce jour-ci" avec une fenêtre `windowDays`
   optionnelle pour planifier à l'avance sans forcément rendre tout de suite.

Ajout à `packages/db/src/tracks-used-repository.ts` : `getUsedTracksForChannel`
(tous les morceaux distincts jamais utilisés par une chaîne, toutes thématiques/
épisodes confondus) — nécessaire pour les types 3 et 4 qui ne se limitent pas à un
seul épisode. 3 nouveaux tests (multi-thème, dédoublonnage, historique vide).

**`fullEpisodeTrackCount` rendu optionnel** dans `short-schema.ts`, `ShortOutro.tsx`
et `render-short.ts` (`RenderShortParams`) : les types "pépite méconnue" et
"top artiste" n'ont pas de notion propre de "l'épisode complet fait N morceaux" à
afficher dans l'outro (pépite méconnue vient bien d'un épisode mais ce n'est pas
son angle marketing ; top artiste n'est même pas rattaché à un seul épisode) —
`ShortOutro` affiche un message générique de marque ("Un nouveau Blind Test chaque
jour") quand ce champ est absent, au lieu d'exiger une valeur qui n'a pas de sens
pour ces types.

**Tests** : 4 nouveaux fichiers de test (`devine-la-chanson.test.ts`,
`pepite-meconnue.test.ts`, `top-artiste.test.ts`, `anniversaire-sortie.test.ts`),
18 tests au total, avec une vraie base SQLite en mémoire (pas de mock du schéma —
suit le pattern déjà établi dans `tracks-used-repository.test.ts`) et des clients
Spotify/iTunes factices (pattern déjà établi dans `discover-artists.test.ts`/
`verify-curated-songs.test.ts`). Aucun fichier de test partagé créé exprès — les
fakes sont dupliqués par fichier, cohérent avec la convention déjà en place dans ce
projet plutôt que d'introduire un nouveau helper centralisé.

**Non fait dans cette tâche, à faire avant que ces types soient réellement
utilisables en pipeline** : les templates `youtube-metadata.ts` (titre/description)
pour "pépite méconnue", "top artiste" et "anniversaire de sortie" — seul "devine la
chanson" a un template aujourd'hui. `top-artiste.ts` référence déjà en commentaire
une future `buildTopArtisteMetadata` avec un choix de formulation assumé : le
Short ne montre que `count` morceaux (2-3, pour la durée), donc le titre ne doit
pas promettre littéralement "Top 5" si `count` est plus petit — reste à écrire.
Un script CLI d'appel (comme `generate-short.ts` pour le type 1) manque aussi pour
chacun des 3 nouveaux types — prévu dans la suite de cette tâche/la tâche
automatisation (voir plus loin dans ce log).

**Validation** : `pnpm build/test/lint/typecheck` verts pour `@blindtest/pipeline`
(103 tests, dont les 18 nouveaux) et `@blindtest/db` (34 tests, dont les 3
nouveaux) ; `@blindtest/spotify` et `@blindtest/video-renderer` revérifiés verts en
même temps (aucune régression des changements des tâches précédentes de cette
session, qui n'avaient pas encore été confirmés ensemble).

## [2026-09-27] Famille A — complète : templates YouTube + scripts CLI pour les 3 nouveaux types

Suite directe de l'entrée précédente : les sélecteurs de morceaux existaient déjà,
mais rien ne les rendait réellement utilisables (pas de template de titre/
description, pas de script CLI). Complété maintenant :

**`youtube-metadata.ts`** — 3 nouvelles fonctions, même style que
`buildShortMetadata` déjà existant :

- `buildPepiteMeconnueMetadata(theme, tracks)` — angle "morceaux que tu as
  peut-être ratés" plutôt qu'un défi de reconnaissance.
- `buildTopArtisteMetadata(artistName, tracks)` — titre honnête : annonce
  `tracks.length` (2-3, la vraie taille du Short), jamais un "Top 5" fixe qui
  ne correspondrait pas à ce qui est montré.
- `buildAnniversaireSortieMetadata({title, artist, yearsAgo})` — un seul
  morceau, CTA générique (pas d'épisode précis à pointer).
  8 nouveaux tests dans `youtube-metadata.test.ts`.

**`apps/pipeline/src/shorts/publish-short.ts`** — nouveau module partagé
(render + upload YouTube optionnel + écriture `videos`/`markVideoUploaded`)
extrait de la logique qui était dupliquée dans `generate-short.ts` : les 4
scripts CLI de la famille A ne diffèrent que par _quels_ morceaux et _quel_
metadata, jamais par ce qui se passe une fois les deux décidés. Pas de test
dédié (même convention que `render-short.ts`/`render-episode.ts` : le rendu
Remotion réel n'est pas unit-testable dans ce projet, validé visuellement).

**`generate-short.ts` refactorisé** pour appeler `selectDevineLaChansonTracks`

- `publishShort` au lieu de dupliquer cette logique en interne — corrige une
  duplication que j'avais moi-même laissée dans la tâche précédente (le
  sélecteur existait mais n'était pas encore branché). Aucun changement
  d'interface CLI (mêmes arguments), donc rétrocompatible avec tout usage
  existant.

**3 nouveaux scripts CLI**, un par type restant :

- `generate-short-pepite-meconnue.ts` — mêmes arguments que `generate-short.ts`
  (config, id de la vidéo longue, `--track-count`, `--upload`).
- `generate-short-top-artiste.ts` — `<config> "<nom d'artiste>"` ; résout le
  thème/la visibilité en cherchant quel thème liste cet artiste dans
  `seedArtists` (pas de vidéo source à cette échelle-là, donc pas de
  thème/visibilité à hériter directement).
- `generate-short-anniversaire.ts` — `<config> [--date=] [--window-days=]` ;
  s'arrête proprement (code 0, pas une erreur) si aucun anniversaire ne tombe
  ce jour-là — la majorité des jours n'en auront pas, c'est attendu. Le
  thème/la chaîne d'origine du morceau sont retrouvés via une requête directe
  sur `tracks_used` (le match ne porte pas cette info lui-même, volontairement
  — `getUsedTracksForChannel` reste `DISTINCT` sur plusieurs thèmes).

**Non fait** : ces 3 nouveaux scripts ne sont invoqués nulle part encore (ni
`package.json`, ni workflow GitHub Actions) — cohérent avec `generate-short.ts`
qui ne l'était pas non plus avant cette session ; le branchement dans une
automatisation revient à la tâche suivante (famille B, puis automatisation).

**Validation** : `pnpm build/test/lint/typecheck` verts pour
`@blindtest/pipeline` — 111 tests (103 + 8 nouveaux tests de metadata), 0
régression.
