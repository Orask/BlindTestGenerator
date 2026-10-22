import { describe, expect, it } from "vitest";
import { parseCopyrightClaimsPage } from "./parse-copyright-claims.js";

// Trimmed excerpts of the real pages pasted from YouTube Studio's
// Copyright tab on 2026-10-22 — kept as fixtures because they're exactly
// what already tripped up manual parsing once (a regional-only video the
// region-count heuristic had flagged as worldwide, and 2 worldwide claims
// whose registered title didn't exactly match the stored Spotify title).

const REGIONAL_ONLY_VIDEO = `
Aperçu de la revendication
Votre vidéo
BLIND TEST Années 2000 🎧 | Devine 60 chansons en 12 secondes ! (Ép. 1)
Aperçu de la revendication
Que s'est-il passé ?
Du contenu protégé par des droits d'auteur a été détecté dans cette vidéo
Vidéo bloquée dans certains territoires
Cela affecte 5 % de votre audience (d'après votre durée de visionnage historique sur l'année écoulée).
Aucun impact sur la chaîne
Revendication
Type
Le Festin (From "Ratatouille"/Soundtrack Version)
Camille, Michael Giacchino
Droits d'auteur
Audio
Aucun impact sur votre vidéo.
Afficher les détails
Intervenir
Systaime
Christophe Willem
Droits d'auteur
Audio
La vidéo est bloquée dans certains territoires.
Afficher les détails
Intervenir
`;

const WORLDWIDE_SHORT = `
Aperçu de la revendication
Votre vidéo
2 extraits Années 80 en 12s chrono 🎧 #Shorts
Aperçu de la revendication
Que s'est-il passé ?
Du contenu protégé par des droits d'auteur a été détecté dans cette vidéo
Vidéo bloquée dans le monde entier
Le demandeur n'autorise pas la diffusion de ce contenu sur YouTube. Vous êtes la seule personne à pouvoir voir cette vidéo.
Revendication
Type
Un autre monde
Téléphone
Droits d'auteur
Audio
La vidéo est bloquée dans le monde entier et ne peut pas générer de revenus.
Afficher les détails
Intervenir
Tous les cris les S.O.S.
Daniel Balavoine
Droits d'auteur
Audio
Aucun impact sur la couverture de votre vidéo.
Afficher les détails
Intervenir
`;

const WORLDWIDE_LONG_EPISODE_EXCERPT = `
Vidéo bloquée dans le monde entier
Le demandeur n'autorise pas la diffusion de ce contenu sur YouTube. Vous êtes la seule personne à pouvoir voir cette vidéo.
Revendication
Type
Comme Caroline (feat. MC Solaar)
Zaho, MC Solaar
Droits d'auteur
Audio
La vidéo est bloquée dans le monde entier.
Afficher les détails
Intervenir
Les gens qu'on aime
Patrick Fiori
Droits d'auteur
Audio
La vidéo est bloquée dans le monde entier.
Afficher les détails
Intervenir
Quand même (Classic Version)
M. Pokora
Droits d'auteur
Audio
La vidéo est bloquée dans le monde entier.
Afficher les détails
Intervenir
`;

describe("parseCopyrightClaimsPage", () => {
  it("reads the page's own banner, not a per-claim inference, for a regional-only video", () => {
    const result = parseCopyrightClaimsPage(REGIONAL_ONLY_VIDEO);
    expect(result.videoGloballyBlocked).toBe(false);
    expect(result.worldwideBlockingClaims).toEqual([]);
    expect(result.claims).toHaveLength(2);
  });

  it("extracts the single worldwide-blocking claim from a Short", () => {
    const result = parseCopyrightClaimsPage(WORLDWIDE_SHORT);
    expect(result.videoGloballyBlocked).toBe(true);
    expect(result.worldwideBlockingClaims).toEqual([
      {
        title: "Un autre monde",
        artist: "Téléphone",
        impact: "worldwide",
        impactText: "La vidéo est bloquée dans le monde entier et ne peut pas générer de revenus.",
      },
    ]);
  });

  it("extracts every worldwide-blocking claim, title text verbatim, from a long episode", () => {
    const result = parseCopyrightClaimsPage(WORLDWIDE_LONG_EPISODE_EXCERPT);
    expect(result.videoGloballyBlocked).toBe(true);
    expect(result.worldwideBlockingClaims.map((c) => `${c.title}||${c.artist}`)).toEqual([
      "Comme Caroline (feat. MC Solaar)||Zaho, MC Solaar",
      "Les gens qu'on aime||Patrick Fiori",
      "Quand même (Classic Version)||M. Pokora",
    ]);
  });
});
