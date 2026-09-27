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

