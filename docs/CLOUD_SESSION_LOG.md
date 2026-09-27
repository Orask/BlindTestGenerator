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

## [2026-09-27] Famille B — implémentation des types "nouveauté par genre" (5 et 6)

Suite de la recherche déjà loguée (browse/new-releases supprimé, tag:new écarté) :
implémentation d'**un seul module générique** `apps/pipeline/src/shorts/nouveaute-
genre.ts`, paramétré par une requête de genre (ex. "rap francais", "house",
"variete francaise") — pas un fichier par genre, puisque la logique de sélection
est identique et que seule la requête/l'étiquette change. Une seule exécution CLI
par genre couvre donc à la fois le type 5 ("nouveauté rap de la semaine") et le
type 6 ("même concept par genre") : `generate-short-nouveaute.ts <config> "rap
francais"`, `generate-short-nouveaute.ts <config> "house"`, etc.

**Logique** : `searchArtists(genreQuery)` (déjà utilisé par `discover-artists.ts`)
pour obtenir des artistes du genre, puis `searchTracksByArtist` sur chacun (déjà le
cœur du pipeline principal) pour leurs morceaux, filtrés par `release_date` réelle
(pas plus de 60 jours, sinon "nouveauté" perdrait tout son sens), triés du plus
récent au plus ancien. Zéro nouvel endpoint, uniquement de la composition de deux
appels déjà en production.

**Contrainte explicite du cahier des charges respectée à la lettre** : ces Shorts
ne doivent JAMAIS provenir de morceaux déjà utilisés (`tracks_used`, via
`getUsedTrackIds` déjà existant) NI des `curatedTracks` configurés par thème (le
CLI construit un `Set` de clés "titre|artiste" normalisées à partir de
`channel.themes[].curatedTracks` et le passe en exclusion) — testé explicitement
(3 tests dédiés : tracks_used, curatedTracks, fraîcheur du `release_date`).

**`buildNouveauteMetadata(genreLabel, tracks)`** ajouté à `youtube-metadata.ts` —
même famille de template que les autres types famille B/pépite méconnue, CTA
générique (pas d'épisode à pointer).

**`generate-short-nouveaute.ts`** — nouveau script CLI, réutilise `publishShort`
comme les 4 scripts famille A. Comme pour top-artiste/anniversaire, pas de vidéo
source : thème/visibilité pris sur le premier thème du channel config / la
visibilité par défaut de la chaîne (raison identique : rien d'épisode-spécifique à
hériter).

**Tests** : 6 nouveaux tests (`nouveaute-genre.test.ts`) + 3 nouveaux tests de
metadata. `parseReleaseDate` exporté depuis `anniversaire-sortie.ts` et réutilisé
ici plutôt que redupliqué — ce n'est pas un helper d'une ligne comme `normalize()`,
une divergence de comportement entre les deux copies aurait un vrai coût de
correction (dates d'anniversaire vs fraîcheur de nouveauté).

**Validation** : `pnpm build/test/lint/typecheck` verts pour `@blindtest/pipeline`
— 120 tests (111 + 9 nouveaux), 0 régression.

**Point ouvert, à surveiller** (déjà noté dans l'entrée de recherche famille B) :
cette solution dépend toujours du flow Client Credentials, que Spotify pourrait
restreindre davantage selon le changelog de février 2026 — aucune action requise
maintenant, mais si `searchArtists`/`searchTracksByArtist` devenaient
indisponibles, ce ne serait pas seulement la famille B qui casserait, mais tout le
pipeline existant.

## [2026-09-27] Automatisation quotidienne multi-Shorts (dry-run par défaut)

Implémentation demandée explicitement par l'utilisateur en remplacement de la
décision "script manuel" de la session précédente : génération ET publication
AUTOMATIQUE et QUOTIDIENNE, mais calibrée sur la recherche de l'étape 1
(fréquence), pas sur un chiffre arbitraire.

**`apps/pipeline/src/shorts/weekly-rotation.ts`** — table de rotation hebdomadaire
pure (testée, 9 tests) :

| Jour     | Types lancés                            |
| -------- | --------------------------------------- |
| Lundi    | devine-la-chanson + nouveauté-genre     |
| Mardi    | pépite-méconnue + nouveauté-genre       |
| Mercredi | devine-la-chanson + top-artiste         |
| Jeudi    | pépite-méconnue + nouveauté-genre       |
| Vendredi | devine-la-chanson + anniversaire-sortie |
| Samedi   | top-artiste + nouveauté-genre           |
| Dimanche | pépite-méconnue + anniversaire-sortie   |

Directement calibré sur la décision déjà loguée dans la recherche stratégie
Shorts 2026 : **~2 Shorts/jour en moyenne** (pas 6/jour tous types confondus —
"seuils de pénalité" identifiés au-delà de 5/jour, rendements décroissants au-delà
de 3/jour), en faisant tourner les 6 types sur la semaine plutôt que de tous les
publier chaque jour. Le nombre réel publié un jour donné peut être inférieur à 2
(anniversaire-sortie et nouveauté-genre s'arrêtent proprement sans rien publier
quand rien ne correspond ce jour-là) — jamais supérieur, ce qui reste du bon côté
des seuils identifiés par la recherche.

`genreForDate`/`artistForDate` font tourner le genre (nouveauté) et l'artiste
(top-artiste) d'un jour calendaire à l'autre, pour qu'un créneau hebdomadaire fixe
(ex. "tous les mercredis") ne mette pas en avant systématiquement le même artiste
semaine après semaine.

**`apps/pipeline/src/generate-shorts-daily.ts`** — orchestrateur qui exécute la
rotation du jour en un seul run : pour chaque type prévu aujourd'hui, appelle
directement le sélecteur + le template + `publishShort` déjà testés (familles A et
B), capture les échecs par type sans arrêter les autres (même philosophie que
`runWeeklyBatch` dans `pipeline.ts`), logue combien de Shorts ont réellement été
générés. Ajoute `getLatestUploadedVideoForTheme` à `packages/db` (4 nouveaux
tests) — nécessaire pour que devine-la-chanson/pépite-méconnue retrouvent
l'épisode long du jour sans qu'on leur passe son id à la main.

**Dry-run demandé explicitement** : pas de flag séparé — même convention que tous
les scripts `generate-short*.ts` déjà existants, rendu local par défaut, `--upload`
pour publier réellement. C'est délibéré : ajouter un `--dry-run` distinct aurait
introduit deux façons différentes d'exprimer la même chose dans ce projet.

**`.github/workflows/daily-shorts.yml`** — nouveau workflow dédié (pas une
extension de `daily-pipeline.yml`, pour ne pas coupler leurs échecs/timeouts) :

- Cron à 5h UTC, 2h après le run quotidien long (3h UTC) pour laisser le temps à
  l'épisode du jour d'être publié et commité avant que les Shorts le cherchent.
- `workflow_dispatch` avec une case à cocher "upload" — pour valider manuellement
  en dry-run (décochée) puis en publication réelle (cochée) avant d'activer
  l'automatisation complète.
- Le run planifié (cron) reste en dry-run tant que la variable de repo
  `SHORTS_AUTO_UPLOAD` n'est pas mise à `"true"` — bascule explicite, à faire une
  fois les rendus dry-run vérifiés (voir tâche suivante, validation end-to-end).
- Même pattern de persistance DB que `daily-pipeline.yml` (commit de
  `data/blindtest.sqlite` après le run, aucun disque persistant entre les runs
  Actions).

**Validation** : `pnpm build/test/lint/typecheck` verts pour `@blindtest/pipeline`
(129 tests, 111+9 rotation+... ) et `@blindtest/db` (38 tests, +4 nouveaux) ; YAML
du nouveau workflow validé avec `python3 -c "import yaml; yaml.safe_load(...)"`.
Pas de test end-to-end réel du workflow lui-même (nécessiterait des credentials
GitHub Actions + Spotify/YouTube réels, indisponibles dans ce sandbox — voir tâche
suivante).

## [2026-09-27] Validation end-to-end réelle — toujours bloquée, revérifié

Revérifié comme demandé explicitement avant de conclure : toujours aucun fichier
`.env`, aucune variable `SPOTIFY_*`/`YOUTUBE_*`/`ANTHROPIC_API_KEY` dans
l'environnement, et le proxy réseau de ce sandbox refuse explicitement (403,
"organization policy") les tunnels CONNECT vers `api.spotify.com` et
`accounts.spotify.com` — identique aux sessions précédentes, aucun changement.

**Conséquence** : impossible de générer réellement le Short "devine la chanson" sur
l'épisode "Génériques" déjà publié (`e81a9fc8-dcde-4224-b9e5-abe1e69c157f`) ni sur
aucun des 5 autres types, ni de tester le workflow `daily-shorts.yml` en conditions
réelles, dans ce sandbox. Tout le travail de cette session (familles A et B,
automatisation) a donc été validé par :

- Build/lint/typecheck/tests unitaires réels (129 tests pipeline, 38 tests db, 0
  régression) — logique de sélection, filtres, tris, exclusions, templates de
  métadonnées toutes couvertes par des tests avec de vraies fixtures.
- Un vrai rendu Remotion local (chromium_headless_shell, voir tâche du correctif
  visuel) pour valider que le nouveau `ShortHeader`/dimensionnement `Short.tsx`
  produit visuellement ce qui était attendu — mais uniquement avec des images de
  test synthétiques, jamais avec de vraies données Spotify/iTunes.
- Relecture manuelle attentive de chaque script CLI et de l'orchestrateur pour la
  cohérence des arguments/chemins/appels, sans pouvoir les exécuter de bout en bout.

**Reste un vrai point de risque non couvert par les tests** : le comportement réel
de `searchArtists`/`searchTracksByArtist` sur ce tier d'app Spotify pour la famille
B (formes de données non vérifiées en direct dans cette session, malgré la demande
explicite de le faire si des credentials étaient disponibles) et l'upload YouTube
réel (visibilité, format Shorts, `publishAt`). **Premier test à faire en local**,
avant tout `--upload` réel ou avant d'activer `SHORTS_AUTO_UPLOAD` : lancer
`generate-short.ts` sur l'épisode déjà publié mentionné ci-dessus SANS `--upload`
d'abord (vérifier le rendu), puis avec `--upload` en visibilité privée — exactement
la démarche demandée par l'utilisateur en cas de credentials disponibles,
maintenant à faire hors de ce sandbox.

## [2026-09-27] FIN DE SESSION — résumé pour la reprise

**Les 9 tâches demandées dans cette session sont terminées** (la dernière,
validation end-to-end réelle, reste bloquée par credentials/réseau — voir
l'entrée juste au-dessus). Résumé express :

| #   | Tâche                                             | État                                                                                                   |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 11  | Credentials/réseau + lecture code Shorts existant | Vérifié bloqué (identique aux sessions précédentes) ; code existant lu en détail avant tout changement |
| 12  | Recherche fréquence/durée/first-second 2026       | Fait, sources citées, décisions du projet ajustées en conséquence (pas de chiffre imposé à l'avance)   |
| 13  | Vide visuel CountdownRing/RevealCard              | Fait, rétrocompatible (prop `size` optionnelle), **vérifié par rendu réel**                            |
| 14  | Abstraction "type de Short"                       | Fait : petits modules indépendants par type, sortie partagée (`ShortCandidateTrack`)                   |
| 15  | Famille A (4 types liés à un épisode)             | Fait, testé (sélecteurs + templates + CLI), **jamais exécuté avec de vraies données**                  |
| 16  | Famille B (2 types nouveauté, trafic pur)         | Fait, testé, source de données validée par recherche (pas codée à l'aveugle)                           |
| 17  | Automatisation quotidienne (dry-run)              | Fait : rotation ~2/jour calibrée sur la recherche, workflow dédié, dry-run par défaut                  |
| 18  | Validation end-to-end réelle                      | **Bloquée** — mêmes limites réseau/credentials que la session précédente, revérifié                    |
| 19  | Ce récapitulatif                                  | Cette entrée                                                                                           |

**Ce qui a changé par rapport à la décision de la session précédente** : le prototype
initial était pensé comme un script manuel, un seul type de Short. Cette session
l'étend (sans dupliquer le code existant, comme demandé) à 6 types répartis en 2
familles, avec une automatisation quotidienne réelle calibrée sur une vraie
recherche 2026 plutôt qu'un chiffre arbitraire.

**État du code, tout committé et poussé sur `main-hpf4qz` au fur et à mesure** (7
commits cette session, jamais de travail non poussé) :

- `packages/video-renderer/` : `CountdownRing`/`RevealCard`/`TrackSegment` avec
  tailles optionnelles rétrocompatibles ; `ShortIntro.tsx` supprimé, remplacé par
  `ShortHeader.tsx` (bandeau non-bloquant) ; `Short.tsx` recalibré (2 morceaux par
  défaut, ~38s) ; `ShortOutro.tsx`/`short-schema.ts` avec `fullEpisodeTrackCount`
  optionnel pour les types sans épisode source.
- `packages/integrations/spotify/` : `SpotifyTrackMetadata` étendu avec `popularity`
  (vraie popularité 0-100, distincte de `popularityRank`) et `releaseDate`.
- `packages/db/` : `getUsedTracksForChannel` (historique toute-chaîne) et
  `getLatestUploadedVideoForTheme` (épisode du jour pour l'automatisation).
- `apps/pipeline/src/shorts/` : 4 sélecteurs famille A (`devine-la-chanson`,
  `pepite-meconnue`, `top-artiste`, `anniversaire-sortie`), 1 sélecteur générique
  famille B (`nouveaute-genre`, paramétré par genre), `hydrate-track.ts` +
  `publish-short.ts` partagés, `weekly-rotation.ts` (calendrier + rotation
  genre/artiste).
- `apps/pipeline/src/generate-short*.ts` : 4 scripts CLI famille A + 1 famille B +
  `generate-shorts-daily.ts` (orchestrateur de la rotation quotidienne).
- `apps/pipeline/src/youtube-metadata.ts` : 4 nouveaux templates de titre/description
  (un par type sans template existant).
- `.github/workflows/daily-shorts.yml` : nouveau workflow dédié, dry-run par défaut.

**Ordre suggéré pour la suite (locale ou prochaine session cloud avec credentials)** :

1. **D'abord, avant tout le reste** : lancer `generate-short.ts` sur l'épisode
   "Génériques" déjà publié (`e81a9fc8-dcde-4224-b9e5-abe1e69c157f`) sans `--upload`
   pour vérifier le rendu (nouveau dimensionnement, bandeau non-bloquant), puis avec
   `--upload` en visibilité privée — exactement la démarche demandée par
   l'utilisateur, jamais faite faute de credentials dans ce sandbox.
2. Répéter la même vérification (sans puis avec `--upload`, en privé) pour les 3
   autres scripts CLI famille A (`generate-short-pepite-meconnue.ts`,
   `-top-artiste.ts`, `-anniversaire.ts`) et le script famille B
   (`generate-short-nouveaute.ts`) — c'est là que la forme réelle des données
   `searchArtists`/`searchTracksByArtist` sera vérifiée pour de vrai pour la
   première fois (jamais fait dans ce sandbox, malgré la demande explicite).
3. Une fois les 6 types validés manuellement en privé, lancer
   `generate-shorts-daily.ts` sans `--upload` une fois (dry run complet de la
   rotation du jour), vérifier les logs (quels types ont été ignorés et pourquoi),
   puis avec `--upload` en privé.
4. Ajuster `MAX_RELEASE_AGE_DAYS`/`ARTIST_SEARCH_LIMIT`
   (`shorts/nouveaute-genre.ts`) si la fraîcheur réelle des résultats
   `searchTracksByArtist` s'avère différente de ce qui était supposé (aucune donnée
   réelle vérifiée dans cette session, decision prise sur la seule base de la
   forme documentée de l'API).
5. Seulement une fois tout ça validé en privé pendant quelques jours : activer
   `SHORTS_AUTO_UPLOAD` (variable de repo) pour laisser `daily-shorts.yml` publier
   automatiquement, et éventuellement repasser en visibilité publique.
6. Écrire les templates `youtube-metadata.ts` restants si l'usage réel montre qu'un
   des 4 nouveaux mérite un texte plus travaillé que ce qui a été écrit ici sans
   retour utilisateur réel.
7. Reprendre les tâches 1-10 (audit `curatedTracks`, config du déclencheur externe,
   etc.) de la session précédente si pas encore faites — inchangées, non retouchées
   cette session.

Tout le code de cette session est committé et poussé sur `main-hpf4qz` au fur et à
mesure, avec `pnpm build/test/lint/typecheck` verts à chaque étape (129 tests
`@blindtest/pipeline`, 38 tests `@blindtest/db`, 0 régression sur les autres
packages).

---

# Nouvelle session cloud — 2026-09-27 (suite 2)

Reprise après un test local (vraies credentials, hors sandbox) qui a trouvé un bug
réel déjà corrigé et poussé par l'utilisateur (commit `54f5208` : téléchargement des
pochettes avant le bundle Remotion dans les 6 scripts de Shorts — pull effectué,
`pnpm build/test` reverifiés verts, 129 tests). Deux découvertes non committées à
creuser en priorité avant toute nouvelle feature, puis recherche business
multi-plateformes.

## [2026-09-27] `popularity` toujours `undefined` sur `/v1/tracks/{id}` — CAUSE IDENTIFIÉE : champ supprimé par Spotify en février 2026, pas une restriction de tier

**Recherche demandée avant tout code** — pas de credentials nécessaires, uniquement
documentation/changelog. Confirmé par plusieurs sources indépendantes qui citent
directement le changelog officiel Spotify for Developers (accès direct à
`developer.spotify.com` bloqué par le proxy réseau de ce sandbox, comme
`api.spotify.com` — mêmes recherches indirectes que pour la découverte
browse/new-releases de la session précédente) :

- **Cause exacte** : le changelog officiel "Web API Changelog — February 2026"
  liste explicitement `[REMOVED] popularity — The popularity of the album/track`
  pour les objets `Track` ET `Album` (et `followers` pour `Artist`/`User`). Ce n'est
  **pas une restriction liée au tier de l'app** (Development Mode vs Extended Quota
  Mode) — c'est un champ supprimé de la réponse API pour **tout le monde**, quel que
  soit le flow d'auth ou le statut de l'app. Confirmé par 3 sources indépendantes
  citant le même changelog : issue GitHub `ramsayleung/rspotify#550`, issue GitHub
  `NovaLux12/spotify-mcp-server#639` (liste précise : "popularity (album and
  track)"), et le fil communautaire officiel Spotify ("February 2026 Spotify for
  Developers update thread").
- **`releaseDate` (`album.release_date`) N'EST PAS dans la liste des champs
  supprimés** — vérifié explicitement par une recherche dédiée sur la liste
  complète des champs retirés (`available_markets`, `external_ids` — réintroduit en
  mars 2026 —, `linked_from`, `popularity` pour Track ; `album_group`,
  `available_markets`, `external_ids`, `label`, `popularity` pour Album). **Donc
  `anniversaire-sortie.ts` et `nouveaute-genre.ts`, qui reposent sur `releaseDate`
  et jamais sur `popularity`, ne sont probablement PAS affectés par ce problème
  précis** — à reconfirmer en live dès que le rate-limit Spotify sera levé (~4h14
  UTC selon l'utilisateur), mais rien dans les changelogs trouvés n'indique que
  `release_date` ait bougé.
- **Pourquoi aucune erreur, juste `undefined` silencieux** : `RawSpotifyTrack` dans
  `packages/integrations/spotify/src/client.ts` déclare `popularity: number` côté
  TypeScript (ajouté la session précédente), mais TypeScript ne valide rien au
  runtime — le JSON réel renvoyé par Spotify n'a simplement plus cette clé, donc
  `track.popularity` vaut `undefined` en JS, et le mapping `popularity:
track.popularity` propage cet `undefined` sans qu'aucune exception ne se déclenche
  nulle part dans la chaîne. Un bug de type "silent-wrong-answer", pas un crash — le
  même terme est utilisé par l'audit cité dans `NovaLux12/spotify-mcp-server#639`
  pour qualifier exactement ce genre de problème.
- **Signal déjà noté comme risque ouvert la session précédente, maintenant
  matérialisé** : l'entrée "Conception abstraction... famille B" de cette même
  session notait déjà "le changelog Spotify de février 2026 indique aussi un
  éloignement du flow Client Credentials pour les endpoints de métadonnées... à
  surveiller". Une source (commentaire épinglé sur `ramsayleung/rspotify#550`)
  confirme la citation exacte : Spotify a déclaré vouloir "mov[e] away from the
  Client Credentials flow for metadata endpoints" — cohérent avec la suppression de
  `popularity` étant un premier pas concret dans cette direction, pas juste un
  changement de schéma isolé.

**Impact réel sur le code de cette session (non corrigé ici, cause seulement
documentée comme demandé)** :

- `shorts/pepite-meconnue.ts` : trie par `popularity` croissante — avec
  `popularity` toujours `undefined`, le comparateur `(a, b) => a.popularity -
b.popularity` retourne `NaN` pour chaque paire, ce que `Array.prototype.sort`
  traite comme "pas de changement d'ordre" dans V8/Node — le tri est un no-op
  silencieux, le Short retombe sur l'ordre `tracks_used` (par `rowid`), pas sur les
  morceaux réellement les moins populaires.
- `shorts/top-artiste.ts` : même mécanisme, tri par popularité décroissante devenu
  no-op.
- Les tests unitaires de ces deux fichiers (écrits cette session) ne détectent PAS
  ce problème : ils passent des fixtures avec de vraies valeurs de `popularity`
  (`50`, `90`, etc.), donc le tri fonctionne correctement dans les tests — c'est
  uniquement en conditions réelles (vrai JSON Spotify, sans le champ) que le
  problème apparaît. Écart classique fixture-vs-réalité, comme le
  `toEqual`/`undefined` de la session précédente sur `client.test.ts`, mais cette
  fois la fixture elle-même était fausse (supposait un champ qui n'existe plus),
  pas le test.

**Pas de solution codée dans cette entrée, comme demandé.** Pistes possibles pour
la prochaine étape (à valider une fois le rate-limit levé et `release_date` reconfirmé
intact en live) :

1. Abandonner le tri par `popularity` réelle pour ces deux types, revenir à une
   heuristique disponible sans ce champ (ex. `popularityRank` du moment de la
   recherche originale, déjà enregistré nulle part dans `tracks_used` — demanderait
   un changement de schéma pour être rejouable après coup).
2. Chercher si `popularity` reste accessible via un autre endpoint non listé comme
   affecté (ex. `/v1/search` renvoie-t-il encore `popularity` sur les résultats
   `type=track` ? Pas vérifié — aucune recherche n'a listé `/v1/search` parmi les
   endpoints affectés par la suppression de champ, seulement les objets Track/Album/
   Artist eux-mêmes, ce qui suggère que la suppression s'applique partout où ces
   objets apparaissent, y compris dans les résultats de recherche — à vérifier en
   direct, pas supposé).
3. Accepter que "pépite méconnue"/"top artiste" ne puissent plus honnêtement
   prétendre trier par popularité réelle, et ajuster leur framing marketing en
   conséquence (ex. "pépite méconnue" devient "un morceau plus confidentiel de
   l'épisode" sans ordre de tri garanti, "top artiste" redevient un tirage parmi
   l'historique sans classement).

## [2026-09-27] Cas "Un deux trois allons dans les bois" (Claude Lombard) — CAUSE RÉELLE : épisode publié AVANT le correctif qualité, pas un problème de discoveryQuery

**Creusé avec `git log`/l'historique de `channels/blindtest-fr.json` et la base
SQLite réelle (`data/blindtest.sqlite`, présente dans ce sandbox depuis le dernier
pull) — pas supposé, vérifié.**

**Chronologie exacte reconstituée** :

- L'épisode "Génériques" testé (`e81a9fc8-dcde-4224-b9e5-abe1e69c157f`) a été créé à
  `2026-09-27T10:06:15.909Z` (colonne `created_at` de la table `videos`) — les deux
  morceaux crédités à Claude Lombard ("Un deux trois allons dans les bois" et "Petit
  Papa Noël") ont été enregistrés dans `tracks_used` à `10:06:19.801Z`/`.803Z`, donc
  au moment même de la génération de cet épisode.
- Le commit `e26d088` ("feat(pipeline): morceaux curatés pour les thèmes où la
  recherche par artiste échoue") — celui qui **retire Claude Lombard (et 9 autres
  chanteurs pour enfants : Chantal Goya, Henri Dès, Anne Sylvestre, Amanda Lear, Les
  Musclés, Corynne Charby, Jean-Pierre Cassel, Datcha Mandala, Annie Cordy, Les
  Poppys) des `seedArtists` du thème "Génériques"**, les remplace par de vrais
  compositeurs de BO (Bruno Coulais, Alexandre Desplat, Éric Serra, en gardant
  Bernard Minet), et ajoute les 63 `curatedTracks` + `discoveryQuery: "bande
originale film celebre"` — a été committé à `2026-09-27T15:19:50+02:00` soit
  `13:19:50 UTC`.
- **L'épisode testé a donc été généré ~3h avant que ce correctif qualité n'existe.**
  À ce moment-là, Claude Lombard était encore un `seedArtist` direct et légitime du
  thème (présent depuis la toute première version du channel config, commit
  `fb07459`) — ses morceaux ont été trouvés par une recherche directe par nom
  d'artiste (`collectCandidateTracks`/`searchTracksByArtist`), **pas par
  `discoveryQuery`/`discoverNewArtists`, qui n'existait même pas encore pour ce
  thème à cet instant précis**.

**Conclusion — l'hypothèse initiale (découverte automatique qui déterre de vieilles
chansons pour enfants) ne s'applique PAS à ce cas précis** : aucun mécanisme de
découverte automatique n'a tourné pour produire cet épisode ; c'est simplement du
contenu généré avec l'ancienne liste d'artistes, avant sa propre correction. **Rien
à corriger dans le code pour ce cas précis** — regénérer un nouvel épisode
"Génériques" avec la config actuelle (déjà committée) suffit à ne plus voir Claude
Lombard, puisqu'il n'est plus dans `seedArtists` ni dans les 63 `curatedTracks`.

**Cela dit, la préoccupation plus large sur `discoveryQuery` reste légitime et
mérite d'être creusée pour l'avenir** — analyse chiffrée du risque réel que ce
fallback se déclenche un jour pour ce thème précis :

- Le thème tourne une fois par semaine (`"day": "sunday"`), demande 60 morceaux par
  épisode (`DEFAULT_TRACKS_PER_EPISODE`), et `REUSE_COOLDOWN_DAYS = 14` — soit un
  cooldown de 2 semaines pour un thème hebdomadaire. **Un morceau utilisé cette
  semaine reste donc bloqué la semaine prochaine, libéré seulement la semaine
  d'après.**
- Avec seulement 63 `curatedTracks` fixes pour couvrir 60 morceaux/semaine, **la
  marge est très mince** : si ~60 des 63 curatedTracks sont utilisés une semaine
  donnée, il n'en reste que ~3 disponibles (hors cooldown) la semaine suivante — le
  reste du quota doit venir des 4 `seedArtists` (`collectCandidateTracks`,
  `CANDIDATES_PER_ARTIST = 20` chacun, soit jusqu'à 80 candidats supplémentaires,
  mais un compositeur de BO n'a pas forcément 20 morceaux distincts identifiables
  sur Spotify, et ce vivier lui-même s'épuise avec le même cooldown).
- **Verdict : `discoveryQuery` n'est pas un filet de sécurité théorique jamais
  utilisé pour ce thème — les chiffres suggèrent qu'il a une chance réelle de se
  déclencher régulièrement**, dès que le cycle de rotation des 63 curatedTracks +
  4 artistes tombe à court un dimanche donné. Le risque de qualité que l'utilisateur
  soupçonne (des résultats `searchArtists("bande originale film celebre", ...)` peu
  pertinents — pseudo-artistes/compilations, chansons génériques datées plutôt que
  de vraies BO modernes reconnaissables) reste donc pertinent à traiter, même s'il
  ne s'est pas encore matérialisé dans l'épisode testé.

**Deux pistes proposées (non implémentées, comme demandé)** :

1. **Affiner `discoveryQuery`** — remplacer "bande originale film celebre" par
   quelque chose de plus spécifique (ex. cibler des compositeurs/franchises précis
   plutôt qu'une requête générique susceptible de remonter des pseudo-artistes de
   compilation) ; `searchArtists` est un texte libre sur le NOM d'artiste, pas un
   filtre de genre fiable (déjà documenté dans son propre commentaire de doc dans
   `packages/integrations/spotify/src/types.ts` : "also surfaces the occasional
   compilation/pseudo-artist entry").
2. **Augmenter le nombre de `curatedTracks`** (63 → par exemple 120-150) pour ce
   thème précis, ce qui réduit mécaniquement la fréquence à laquelle `discoveryQuery`
   doit se déclencher, sans toucher à la logique de découverte elle-même — cohérent
   avec le pattern déjà utilisé par ce même commit `e26d088` pour ce thème.
3. (Option de repli, plus radicale) **Désactiver `discoveryQuery`** pour ce thème
   maintenant qu'il a des `curatedTracks` — accepte le risque qu'un dimanche
   ponctuel tombe à court (`InsufficientTracksError`, l'épisode de ce jour-là
   échouerait/serait sauté) plutôt que de risquer une découverte non fiable qui
   dégraderait la qualité déjà corrigée.

Aucune décision prise, aucune implémentation faite — l'utilisateur vérifiera
localement et choisira.

## [2026-09-27] Recherche business — contraintes réelles des plateformes pour ~20 chaînes multi-plateformes (Instagram/TikTok/Snapchat/Facebook)

**Recherche documentaire uniquement (pas de credentials nécessaires), comme
demandé, avant toute décision sur l'objectif 3-4 mois** de ~20 chaînes sur
YouTube/Instagram/TikTok/Snapchat/Facebook avec un site centralisant les stats.
Sources : documentation officielle des plateformes quand accessible directement,
sinon agrégateurs/guides développeurs 2026 qui la citent (même méthode que pour les
recherches Spotify de cette session — accès direct à `developers.facebook.com`/
`developers.tiktok.com`/`developer.spotify.com` non testé, pas nécessaire ici
puisqu'aucun de ces hosts n'est dans le scope réseau de ce projet).

### Instagram (Meta Graph API / "Instagram API with Instagram Login")

- **Compte requis** : compte Instagram **Professionnel** (Business ou Creator) —
  un compte personnel n'est éligible à AUCUNE API officielle, plus du tout depuis
  les dernières dépréciations.
- **Deux chemins d'implémentation en 2026** : l'ancien ("Instagram API with
  Facebook Login") exige de lier chaque compte Instagram à une Page Facebook ; le
  plus récent ("Instagram API with Instagram Login", lancé juillet 2024, chemin
  recommandé par Meta en 2026) **ne demande plus de Page Facebook liée** —
  simplifie nettement la mise en place pour 20 comptes (pas besoin de créer 20
  Pages Facebook juste pour satisfaire l'ancienne exigence).
- **Publication programmatique** : oui, `instagram_content_publish` — permission
  soumise à App Review.
- **Stats exposées via API** : oui, largement — vues, reach, likes, commentaires,
  saves, shares, visites de profil, followers (Instagram Graph API Insights).
- **Strikes/blocages** : **PAS exposés via l'API officielle** — uniquement visibles
  dans le tableau de bord humain "Compte Status" (Meta Business Suite / app
  Instagram elle-même). Aucune source trouvée ne documente un endpoint retournant
  cette information.
- **Délai d'approbation** : App Review standard ~2-4 semaines (une source cite "de
  quelques jours à plusieurs semaines", un rejet relance le délai) ; **vérification
  d'entreprise (Meta Business Manager) séparée, jusqu'à 4 semaines**. Les scopes
  sensibles (`instagram_content_publish` inclus) sont "souvent rejetés en première
  soumission".
- **Scaling à 20 comptes** : la review d'app et la vérification d'entreprise sont
  **au niveau de l'app/de la Business Manager, pas par compte** — une fois
  approuvées, elles couvrent toutes les Pages/comptes Instagram rattachés à la même
  Business Manager. Le coût de review ne se multiplie donc pas par 20, seulement le
  travail de connexion de chaque compte à la Business Manager.

### Facebook (Graph API — Pages, Reels)

- **Compte requis** : une **Page Facebook** (jamais un profil personnel ni un
  groupe) pour publier des vidéos/Reels.
- **Publication programmatique** : oui (`pages_manage_posts`, `pages_manage_engagement`
  pour les Reels) — Reels : MP4, 9:16, 3-90s, 720p minimum. Publier un Reel sur
  Facebook ne le republie PAS automatiquement sur Instagram (deux appels séparés).
- **Stats exposées via API** : oui, Graph API Insights (vues, reach, engagement).
- **Strikes/blocages** : même limite qu'Instagram — visibles uniquement dans le
  Centre de transparence Meta / tableau de bord humain, pas via API documentée.
- **Délai d'approbation** : même processus App Review que Instagram (`pages_show_list`,
  `pages_read_engagement`, `pages_manage_posts`) — quelques jours à quelques
  semaines, au niveau de l'app comme ci-dessus.

### TikTok (Content Posting API)

- **Compte requis** : Creator OU Business account (les deux fonctionnent) — pas de
  compte personnel/perso non converti.
- **Publication programmatique** : oui, Content Posting API — **mais toute
  publication reste EN PRIVÉ TANT QUE L'APP N'A PAS PASSÉ UN AUDIT** séparé de
  l'inscription initiale, qui vérifie la conformité aux conditions TikTok. Sans cet
  audit, impossible de publier en public via l'API, quel que soit le nombre de
  comptes connectés.
- **Stats exposées via API** : oui — vues, likes, commentaires, partages, durée,
  date de publication par vidéo ; abonnés/likes totaux/nombre de vidéos au niveau
  du profil créateur.
- **Strikes/blocages** : pas d'endpoint documenté trouvé — uniquement visible dans
  l'app TikTok elle-même ("Account status").
- **Délai d'approbation** : estimations très variables selon les sources — de
  "3-5 jours ouvrés pour les cas les mieux préparés" à "2-6 semaines", un rejet
  relance le délai de 1-2 semaines à chaque fois. **L'audit est une étape séparée
  de l'inscription de l'app**, à faire une fois le flow testé bout-à-bout — donc un
  second aller-retour après le premier enregistrement, pas un délai unique.
- **Scaling à 20 comptes** : l'audit est **au niveau de l'app, pas par compte** —
  une fois passé, tous les comptes connectés peuvent publier en public. Mais
  chaque compte doit individuellement s'authentifier via OAuth (pas de jeton
  "agence" couvrant plusieurs comptes) — jetons à gérer/rafraîchir par compte
  (24h d'expiration selon une source), et un plafond de ~15 posts/jour PAR COMPTE
  côté TikTok (largement au-dessus du volume prévu pour ce projet, pas un problème
  réel ici).

### Snapchat — **AUCUNE API officielle de publication organique trouvée**

- **Le "Marketing API" de Snapchat est une API PUBLICITAIRE** (campagnes payantes,
  attribution, gestion d'audience) — ouverte à tous depuis 2018, sans review ni
  audit, mais **ne sert pas à publier du contenu organique** sur un compte Snapchat
  (Stories/Spotlight).
- **"Creative Kit"** (partie de Snap Kit) permet de partager du contenu VERS
  Snapchat depuis une app tierce, mais via **le bouton de partage natif déclenché
  par un utilisateur humain** — pas une automatisation serveur-à-serveur sans
  interaction, et pas conçu pour poster sur le compte propre d'une chaîne de façon
  planifiée.
- **Confirmé par plusieurs sources indépendantes (2026)** : "Snapchat has no
  documented public API for core organic publishing, including posting Snaps,
  Stories, or Spotlight content programmatically." Les services tiers qui
  prétendent le faire (Ayrshare, Mallary, etc.) sont des **contournements non
  officiels**, pas une API Snapchat elle-même — risque réel de ToS/bannissement à
  publier ainsi à l'échelle de 20 chaînes automatisées.
- **Conséquence directe pour l'objectif 3-4 mois** : Snapchat n'est probablement
  **pas automatisable de façon fiable/officielle** avec la même approche que les 4
  autres plateformes. À traiter à part (poster manuellement en dernier recours, ou
  écarter Snapchat du plan d'automatisation, ou accepter le risque d'un
  contournement tiers — à décider par l'utilisateur, pas une décision technique).

### Rappel — YouTube (déjà en place dans ce projet) a une contrainte du même type, pas encore un problème mais à anticiper pour 20 chaînes

Recherché en comparaison, car directement pertinent pour le passage à 20 chaînes :
le **quota par défaut de l'API YouTube Data est de 10 000 unités/jour, PAR PROJET
Google Cloud, pas par chaîne**. Un upload coûte ~1600 unités (déjà documenté dans
`pipeline.ts`, confirmé en conditions réelles cette session : "plus de ~6 uploads
par jour commenceront à échouer"). Avec 1 épisode long + jusqu'à 2 Shorts/jour par
chaîne (~4800 unités/chaîne/jour), **20 chaînes sous un même projet Google Cloud
dépasseraient largement le quota par défaut** (besoin réel ~96 000 unités/jour vs
10 000 disponibles). Deux options, ni codées ni décidées ici :

1. Demander une extension de quota via le formulaire d'audit YouTube — **délai non
   garanti**, plusieurs semaines, et les cas "usage à grande échelle" sont
   fréquemment rejetés selon les sources trouvées.
2. **Créer un projet Google Cloud (et des credentials OAuth) séparé par chaîne ou
   par petit groupe de chaînes**, chacun restant sous son propre quota par défaut
   de 10 000 — évite complètement le processus d'audit incertain. Rejoint le
   pattern déjà construit dans ce projet pour Spotify (`rotating-client.ts`,
   `SPOTIFY_CLIENT_ID_2`/`_3`...) — voir la tâche suivante sur la réutilisabilité.

### Synthèse — est-ce le vrai goulot d'étranglement pour l'objectif 3-4 mois ?

**Oui, clairement, pour Instagram/Facebook/TikTok** — pas parce que le délai est
énorme en soi (2-6 semaines selon la plateforme), mais parce que :

- C'est un **délai externe, non compressible par plus de travail ou plus de
  budget cloud** — contrairement à écrire du code, attendre une review humaine
  chez Meta/TikTok ne s'accélère pas en y consacrant plus de sessions.
- **Chaque rejet relance le délai complet** (confirmé pour les deux plateformes) —
  soumettre tard et découvrir un problème de conformité repousse d'autant le
  lancement.
- La review est heureusement **au niveau de l'app/Business Manager, pas par
  chaîne** — donc ce n'est PAS 20× le délai, c'est un délai fixe une fois, à
  condition de démarrer le processus avec UNE SEULE app/Business Manager pensée
  dès le départ pour héberger les 20 chaînes (pas 20 apps séparées, ce qui serait
  20× le risque de rejet et de délai).

**Ce qu'il faudrait démarrer dès maintenant côté ADMINISTRATIF (pas de code)**,
sans attendre que la qualité vidéo soit jugée suffisante pour publier réellement —
ces démarches sont gratuites, réversibles (rien n'oblige à publier tant que
l'approbation n'a pas eu lieu), et leur délai tourne "en arrière-plan" pendant que
le travail de qualité continue :

1. Créer les comptes développeur (Meta for Developers, TikTok for Developers) et
   UNE app par plateforme pensée dès le départ pour héberger 20 chaînes/comptes.
2. Démarrer la vérification d'entreprise Meta Business Manager (jusqu'à 4 semaines
   à elle seule, indépendante de l'app review).
3. Soumettre l'app review Meta (`instagram_content_publish`, `pages_manage_posts`,
   etc.) avec un cas d'usage et une démo dès qu'un flow minimal de test existe (pas
   besoin d'attendre que le contenu soit publiable en vrai — un compte de test
   suffit pour la review).
4. Enregistrer l'app TikTok, tester le flow bout-à-bout en privé (obligatoire avant
   l'audit), puis soumettre l'audit dès que ce test privé fonctionne.
5. Décider du sort de Snapchat maintenant que l'absence d'API organique officielle
   est confirmée (l'écarter du plan, ou accepter un contournement tiers en toute
   connaissance du risque).
6. Anticiper le choix d'architecture quota YouTube (1 projet GCP par chaîne, ou par
   petit groupe) AVANT de créer les 20 chaînes YouTube, pour ne pas avoir à tout
   migrer plus tard.

**Ce qui peut clairement attendre** : le code de publication multi-plateforme
lui-même (personne ne peut rien publier avant l'approbation de toute façon), et le
site de centralisation des stats (voir tâche suivante) — les deux dépendent d'API
dont l'accès n'existera pas avant plusieurs semaines au mieux.

## [2026-09-27] Esquisse — modèle de données générique pour un futur site de centralisation des stats (conception seulement, aucune implémentation)

**Objectif rappelé** : éviter de se logger sur ~20 chaînes × jusqu'à 5 plateformes
pour connaître vues/abonnés/blocages/rythme de publication. Conçu à partir des
contraintes réelles trouvées dans la tâche précédente (ce qui est vraiment exposé
par chaque API), pas d'hypothèses optimistes.

### Principe directeur : deux sources de vérité très différentes, à ne pas mélanger

1. **Ce que CE projet publie lui-même** (déjà connu, zéro appel API externe
   nécessaire) — le rythme de publication, l'horodatage, le format, le type de
   contenu (Short famille A/B, épisode long...). Ce projet a déjà exactement ce
   pattern pour YouTube (table `videos` dans `packages/db`) — un futur site
   multi-plateforme n'a qu'à généraliser cette table, pas besoin d'appeler quelque
   API que ce soit pour savoir "qu'est-ce qu'on a publié et quand".
2. **Ce que chaque plateforme rapporte a posteriori sur ce contenu** (vues,
   likes, abonnés au moment T) — nécessite un appel API en lecture, périodique
   (les métriques d'un post évoluent dans le temps, un simple _snapshot_ daté, pas
   une valeur figée).

Ces deux sources ne doivent PAS partager une seule ligne/table : la première est
un fait immuable (on a publié CE contenu à CETTE heure), la seconde est une série
temporelle qui change à chaque synchronisation.

### Champs communs à toutes les plateformes (le "socle")

Directement dérivés de ce que la recherche précédente a confirmé comme
**réellement exposé par au moins Instagram/Facebook/TikTok/YouTube** :

- `platform` (`youtube` | `instagram` | `tiktok` | `facebook` | `snapchat`)
- `channel_id` (identifiant interne à CE projet, pas celui de la plateforme — pour
  relier un compte Instagram et un compte TikTok qui appartiennent à la même
  "chaîne" logique, ex. "BlindTest FR")
- `platform_account_id` (identifiant natif de la plateforme — nécessaire pour
  chaque appel API, distinct du `channel_id` logique ci-dessus)
- `followers_count` (vrai partout — Instagram/TikTok/Facebook/YouTube l'exposent
  tous via API)
- `snapshot_at` (horodatage de CETTE mesure — jamais une valeur "actuelle" unique,
  toujours une entrée dans une série temporelle)
- `recent_post_views_total` / `recent_post_engagement_total` — agrégé sur une
  fenêtre récente (ex. 7/30 jours), calculable sur toutes les plateformes à partir
  des métriques par post, même si le nom exact du champ diffère à la source
  (`views` YouTube/TikTok vs `impressions`/`reach` Instagram/Facebook — nécessite
  une table de correspondance par plateforme, pas un champ magique universel)

### Champs par-poste (une ligne par vidéo/Short/Reel publié), communs eux aussi

- `platform_post_id`, `channel_id`, `published_at` (= la table `videos` déjà
  existante, généralisée), `format` (long/short/reel/story/spotlight —
  vocabulaire déjà propre à chaque plateforme, à normaliser une fois)
- `views`, `likes`, `comments`, `shares` — quand disponibles ; **certains champs
  n'existent tout simplement pas partout** (ex. "saves" existe sur Instagram, pas
  sur YouTube) — le modèle doit accepter des colonnes `NULL`/absentes par
  plateforme plutôt que forcer une fausse valeur à 0, pour ne pas confondre "pas
  mesuré par cette plateforme" avec "zéro interaction réelle".

### Champ spécifique par plateforme — PAS un champ commun

- **`strikes`/`blocages`/`compte restreint`** : confirmé dans la recherche
  précédente — **AUCUNE des 4 plateformes (Instagram/Facebook/TikTok/YouTube) ne
  documente d'endpoint API exposant cette information.** Elle n'existe QUE dans le
  tableau de bord humain de chaque plateforme (Meta "État du compte", TikTok
  "Account status", YouTube Studio). **Implication de conception directe : ce
  champ ne peut PAS être un job de synchronisation automatique comme les autres —
  soit une saisie manuelle périodique (un humain regarde le dashboard une fois par
  semaine et coche une case sur le site de centralisation), soit laissé de côté
  pour une v1.** Aucune tentative de scraper ces dashboards humains — au-delà du
  risque ToS déjà écarté explicitement par l'utilisateur, ces pages nécessitent une
  session utilisateur connectée (pas un token API), donc un scraper devrait
  imiter un navigateur connecté par compte — un risque et une fragilité largement
  plus élevés qu'un champ simplement saisi à la main.
- **`rythme de publication`** : PAS besoin d'API du tout, comme expliqué plus
  haut — c'est une agrégation de la table de posts déjà connue par ce projet
  (`COUNT(*) GROUP BY date`), pas une donnée à synchroniser depuis l'extérieur.

### Ce qui est récupérable via API officielle vs seulement en scrapant (à éviter)

| Donnée                                | Récupérable via API officielle                                                                                                                                           | Notes                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Abonnés/followers                     | Oui (toutes plateformes)                                                                                                                                                 | —                                                                                                        |
| Vues/impressions par post             | Oui (toutes plateformes, vocabulaire différent)                                                                                                                          | —                                                                                                        |
| Likes/commentaires/partages           | Oui (toutes plateformes)                                                                                                                                                 | —                                                                                                        |
| Rythme de publication                 | Oui, mais pas besoin d'appel API — déjà connu de ce projet                                                                                                               | —                                                                                                        |
| Démographie de l'audience (âge, pays) | Partiellement — Instagram/TikTok l'exposent au niveau agrégé du compte, pas par post individuel dans tous les cas                                                        | À creuser plus tard si jugé utile, pas prioritaire pour l'objectif "éviter de se logger sur 100 comptes" |
| **Strikes/blocages/restrictions**     | **NON, sur aucune des plateformes recherchées**                                                                                                                          | Champ manuel uniquement, voir ci-dessus                                                                  |
| Revenus/monétisation détaillés        | Partiel (YouTube Analytics API le permet avec des scopes sensibles supplémentaires ; pas creusé pour les autres plateformes cette session, hors périmètre de la demande) | À rechercher séparément si un jour pertinent                                                             |

**Recommandation de conception** (pas d'implémentation) : un site de centralisation
réaliste pour cet objectif est donc **~90% automatisable via API officielle**
(vues/abonnés/rythme), avec **un petit formulaire de saisie manuelle
hebdomadaire pour les strikes/restrictions** plutôt qu'une tentative de tout
automatiser — cohérent avec la contrainte explicite de l'utilisateur d'éviter le
scraping.

## [2026-09-27] Ce qui est réutilisable de ce projet pour une future extension multi-plateforme/multi-chaîne (analyse seulement)

**Analysé** : `packages/integrations/spotify/src/rotating-client.ts`, le pattern de
cron/scheduling des deux workflows GitHub Actions existants, et
`packages/core/src/channel-config.ts`.

### Directement réutilisable en l'état (le pattern, pas le code)

- **`packages/integrations/<service>/` en tant que structure** — `types.ts` (une
  interface `XClient` + ses types de retour) + `client.ts` (l'implémentation réelle
  contre l'API HTTP) + `index.ts` (exports). Déjà appliqué 4 fois dans ce projet
  (spotify, itunes, youtube, anthropic) — le patron exact à suivre pour un futur
  `packages/integrations/instagram/`, `.../tiktok/`, `.../facebook/`. Rien à
  généraliser : c'est déjà une convention, pas un module partagé à extraire.
- **Le pattern des workflows GitHub Actions** (`daily-pipeline.yml`/
  `daily-shorts.yml` de cette session) — `schedule` + `workflow_dispatch` avec
  input de contrôle (`upload`), secrets par credential, persistance d'état
  (commit de la DB) après le run — **entièrement générique**, ne dépend d'aucune
  logique YouTube/Spotify. Un futur `sync-stats-daily.yml` (lire les stats de
  toutes les plateformes) ou `publish-instagram-daily.yml` suivrait exactement la
  même forme.
- **`create-clients.ts`** — factory qui construit tous les clients typés depuis les
  variables d'environnement, avec fallback "silencieux" quand un service optionnel
  n'est pas configuré (`ANTHROPIC_API_KEY` absent ⇒ `anthropic: undefined`, jamais
  une erreur). Le même principe s'applique directement à une chaîne qui n'a pas
  encore de compte TikTok configuré, par exemple.

### Réutilisable dans son PRINCIPE, mais pas le code tel quel

- **`rotating-client.ts`** — le concept ("plusieurs clients credentialés
  indépendants, bascule sticky quand l'un est épuisé, jamais de round-robin qui
  retape le même quota") est directement pertinent au-delà de Spotify. **Connexion
  concrète trouvée cette session** : le problème de quota YouTube identifié dans la
  recherche business (10 000 unités/jour PAR PROJET Google Cloud, pas par chaîne —
  20 chaînes sous un seul projet dépasseraient largement ce quota) pourrait se
  résoudre avec exactement ce même principe : plusieurs projets Google Cloud
  (`YOUTUBE_CLIENT_ID_2`/`_3`... comme `SPOTIFY_CLIENT_ID_2`/`_3` déjà fait), et un
  `createRotatingYoutubeClient` qui route vers un projet non épuisé. **Différence
  importante à noter** : le rate-limit Spotify est transitoire (quelques dizaines
  de secondes, la bascule sticky a du sens dans une même session), alors que le
  quota YouTube se réinitialise une fois par jour — la bascule serait donc plus
  une **assignation statique par chaîne** (chaîne N → toujours projet N) qu'un
  vrai failover dynamique intra-session. Le code actuel n'est pas directement
  copiable, mais l'idée générale (pool de credentials indépendants + logique de
  sélection) transfère bien.
- **`channel-config.ts` (le concept de "config déclarative par chaîne")** —
  l'idée d'un fichier JSON décrivant une identité de contenu (thèmes, jour de
  publication, visibilité) reste pertinente, mais **le schéma actuel est
  structurellement mono-plateforme** : `youtubePlaylistId` au niveau du thème
  suppose UNE seule destination de publication ; `seedArtists`/`discoveryQuery`/
  `curatedTracks` sont des concepts de sélection de CONTENU (quoi mettre dans la
  vidéo), pas de distribution (où la publier) — ils resteraient identiques
  quelle que soit la plateforme de destination, donc pas à dupliquer par
  plateforme. Une évolution multi-plateforme ajouterait plutôt une notion séparée
  ("cette chaîne logique a aussi un compte Instagram X, un compte TikTok Y...")
  greffée à côté du contenu, pas dans les thèmes eux-mêmes.

### Pas réutilisable / à refaire de zéro

- **La table `videos`** (`packages/db/src/schema.ts`) est structurée pour UNE
  plateforme (`youtube_video_id`, `format: 'long'|'short'`) — cohérent avec
  l'esquisse de modèle de données de la tâche précédente : une extension
  multi-plateforme demande une nouvelle table (`platform_posts` ou équivalent),
  pas un ajout de colonne à celle-ci.
- **`build-episode-tracks.ts`/`opening-hook.ts`/toute la logique de sélection
  musicale** — spécifique au concept "blind test", n'a pas vocation à être
  généralisée pour d'autres plateformes ; c'est la partie CONTENU, indépendante de
  la partie DISTRIBUTION discutée ici.

## [2026-09-27] FIN DE SESSION — résumé pour la reprise

**Session purement investigation/documentation/recherche, comme demandé — aucun
code de production modifié.** Le seul changement de code de cette session vient de
l'utilisateur lui-même (commit `54f5208`, pull effectué et revérifié vert en
premier). Résumé express :

| #   | Tâche                                | État                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20  | Cause de `popularity: undefined`     | **Identifiée** : champ supprimé du changelog Spotify février 2026, pour tout le monde — pas une restriction de tier. `releaseDate` non affecté. Impact documenté sur pepite-meconnue.ts/top-artiste.ts (tri devenu no-op silencieux), aucune correction codée             |
| 21  | Cas Claude Lombard                   | **Élucidé** : épisode testé généré ~3h avant le commit qui a corrigé la qualité du thème — pas un bug de discoveryQuery. Risque réel de discoveryQuery pour l'avenir quantifié séparément (cooldown 14j vs cadence hebdo, marge fine), 3 pistes proposées                 |
| 22  | Recherche business multi-plateformes | Fait — contraintes réelles par plateforme, Snapchat sans API organique officielle, review au niveau app pas par chaîne mais délai externe incompressible (2-6 semaines) = vrai goulot d'étranglement si non démarré maintenant                                            |
| 23  | Modèle de données stats centralisées | Esquissé — socle commun (followers/vues/engagement, ~90% automatisable via API), strikes/blocages jamais exposés par aucune API trouvée (champ manuel uniquement)                                                                                                         |
| 24  | Réutilisabilité du code existant     | Analysé — structure `packages/integrations/*` et pattern des workflows directement réutilisables ; `rotating-client.ts` généralise dans son principe (connexion avec le problème de quota YouTube identifié) ; `channel-config.ts`/table `videos` restent mono-plateforme |
| 25  | Ce récapitulatif                     | Cette entrée                                                                                                                                                                                                                                                              |

**Ce qui a le plus de valeur immédiate pour l'utilisateur dans cette session** :

1. Les deux causes racines élucidées (`popularity`, Claude Lombard) débloquent la
   suite du test local en cours, avec des pistes concrètes non encore implémentées
   — décision à prendre par l'utilisateur avant que je code quoi que ce soit dessus.
2. La réponse claire à la question "goulot d'étranglement ?" : **oui pour
   Instagram/Facebook/TikTok**, démarrer les démarches administratives
   (comptes développeur, vérification d'entreprise Meta, audit TikTok) **maintenant**
   plutôt que d'attendre que la qualité vidéo soit jugée suffisante — ces démarches
   sont gratuites, réversibles, et leur délai externe ne se raccourcit pas en
   attendant. **Snapchat n'a pas d'API organique officielle** — décision à prendre
   sur son inclusion dans le plan.
3. Un problème de quota YouTube (10 000 unités/jour par PROJET Google Cloud, pas
   par chaîne) déjà pertinent pour l'objectif 20 chaînes, indépendamment des autres
   plateformes — à anticiper avant de créer les chaînes YouTube supplémentaires.

**Ordre suggéré pour la suite (local ou prochaine session)** :

1. **D'abord** : une fois le rate-limit Spotify levé, vérifier en live que
   `release_date` est bien toujours présent sur `/v1/tracks/{id}` (l'hypothèse de
   cette session, jamais confirmée en direct) et confirmer que `popularity` est
   bien absent partout où il est utilisé (pas seulement `getTrackById`).
2. Décider quelle piste suivre pour pepite-meconnue.ts/top-artiste.ts (abandon du
   tri par popularité réelle, autre source, ou reformulation marketing sans
   promesse d'ordre) — implémentation à faire dans une prochaine session une fois
   la décision prise.
3. Décider du sort de `discoveryQuery` pour le thème "Génériques" (affiner la
   requête, grossir `curatedTracks`, ou désactiver) — voir les 3 pistes chiffrées
   ci-dessus.
4. Continuer la validation manuelle des 6 types de Shorts commencée localement
   (voir l'ordre déjà suggéré dans l'entrée FIN DE SESSION précédente).
5. Si la décision est de lancer les démarches multi-plateformes maintenant :
   créer les comptes développeur Meta/TikTok, démarrer la vérification
   d'entreprise Meta, soumettre les app reviews avec un cas d'usage minimal (pas
   besoin d'attendre du contenu publiable) — travail 100% administratif, aucun
   code à écrire pour cette étape.
6. Trancher l'architecture quota YouTube (1 projet GCP par chaîne vs demande
   d'extension) avant de créer les chaînes YouTube supplémentaires au-delà de la
   première.
7. Le site de centralisation des stats et le code de publication multi-plateforme
   restent explicitement HORS PÉRIMÈTRE tant que 5 n'a pas avancé — rien à faire
   dessus avant plusieurs semaines au mieux.

Tout le travail de cette session est committé et poussé sur `main-hpf4qz` au fur
et à mesure (6 commits, uniquement de la documentation dans `CLOUD_SESSION_LOG.md`
— aucun fichier de code modifié par cette session elle-même), `pnpm build/test/
lint/typecheck` revérifiés verts après chaque pull/commit (129 tests
`@blindtest/pipeline`, 38 tests `@blindtest/db`, 0 régression).
