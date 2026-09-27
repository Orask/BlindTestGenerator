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
