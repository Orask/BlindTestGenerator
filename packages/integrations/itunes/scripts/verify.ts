import { createItunesClient } from "../src/client.js";

const client = createItunesClient();

const samples: readonly { readonly title: string; readonly artist: string }[] = [
  { title: "Dernière danse", artist: "Indila" },
  { title: "Papaoutai", artist: "Stromae" },
  { title: "Formidable", artist: "Stromae" },
  { title: "This Song Does Not Exist 12345", artist: "Nobody At All" },
];

for (const sample of samples) {
  try {
    const result = await client.findPreviewByTitleAndArtist(sample.title, sample.artist);
    console.log(
      `${sample.artist} — ${sample.title}: ${result ? `OK (${result.previewUrl})` : "no match"}`,
    );
  } catch (error) {
    console.error(`${sample.artist} — ${sample.title}: ERROR`, error);
  }
}
