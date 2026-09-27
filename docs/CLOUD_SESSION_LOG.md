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
