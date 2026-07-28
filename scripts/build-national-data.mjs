import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const source = JSON.parse(
  readFileSync(resolve(root, "data", "china-rider-spots-batch2.json"), "utf8"),
);
const sourceBatch3 = JSON.parse(
  readFileSync(resolve(root, "data", "china-rider-spots-batch3.json"), "utf8"),
);
const mergedCities = new Map();
for (const city of [...source.cities, ...sourceBatch3.cities]) {
  const current = mergedCities.get(city.city) || [];
  mergedCities.set(city.city, [...current, ...city.spots]);
}
const compact = Object.fromEntries(
  [...mergedCities.entries()].map(([city, spots]) => [
    city,
    spots.map((spot) => [
      spot.name,
      spot.summary,
      `${spot.verification} · ${spot.parking}`,
      spot.type,
      spot.access,
      spot.sourceUrl || "",
    ]),
  ]),
);

writeFileSync(
  resolve(root, "outputs", "national-batch2.js"),
  `window.nationalBatch2=${JSON.stringify(compact)};\n`,
);

console.log(
  `Nationwide batches ready: ${mergedCities.size} deep cities / ${[...mergedCities.values()].flat().length} spots.`,
);

const publicResearch = JSON.parse(
  readFileSync(resolve(root, "data", "public-research-seeds.json"), "utf8"),
);
writeFileSync(
  resolve(root, "outputs", "public-research.js"),
  `window.publicResearchSeeds=${JSON.stringify(publicResearch)};\n`,
);
console.log(`Public research seeds ready: ${publicResearch.records.length} records.`);
