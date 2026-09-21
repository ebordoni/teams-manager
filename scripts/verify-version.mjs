import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const readJson = (file) => JSON.parse(read(file));
const version = readJson("package.json").version;

const checks = [
  ["addon/config.yaml", /version: "([^"]+)"/],
  ["addon/Dockerfile", /io\.hass\.version="([^"]+)"/],
  ["README.md", /version-([0-9]+\.[0-9]+\.[0-9]+)-blue/],
];

const mismatches = checks.flatMap(([file, pattern]) => {
  const found = read(file).match(pattern)?.[1];
  return found === version ? [] : [`${file}: atteso ${version}, trovato ${found ?? "nessuna versione"}`];
});

for (const file of ["addon/backend/package.json", "addon/frontend/package.json"]) {
  const found = readJson(file).version;
  if (found !== version) mismatches.push(`${file}: atteso ${version}, trovato ${found}`);
}

for (const file of ["addon/backend/package-lock.json", "addon/frontend/package-lock.json"]) {
  const lock = readJson(file);
  const found = lock.version;
  const packageVersion = lock.packages?.[""]?.version;
  if (found !== version || packageVersion !== version) {
    mismatches.push(`${file}: versione lockfile non allineata a ${version}`);
  }
}

if (mismatches.length > 0) {
  console.error("Versioni non allineate:\n- " + mismatches.join("\n- "));
  process.exitCode = 1;
} else {
  console.log(`Versioni allineate: ${version}`);
}
