import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) =>
  fs.writeFileSync(path.join(root, file), content, "utf8");
const readJson = (file) => JSON.parse(read(file));

function usage() {
  console.error("Uso: npm run version:bump -- <patch|minor|major|X.Y.Z>");
  process.exit(1);
}

function nextVersion(current, argument) {
  const currentParts = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!currentParts) throw new Error(`Versione corrente non valida: ${current}`);
  if (/^\d+\.\d+\.\d+$/.test(argument)) return argument;
  const [major, minor, patch] = currentParts.slice(1).map(Number);
  if (argument === "major") return `${major + 1}.0.0`;
  if (argument === "minor") return `${major}.${minor + 1}.0`;
  if (argument === "patch") return `${major}.${minor}.${patch + 1}`;
  usage();
}

function replaceOnce(file, pattern, replacement) {
  const source = read(file);
  if (!pattern.test(source)) {
    throw new Error(`Impossibile aggiornare ${file}: valore atteso non trovato`);
  }
  write(file, source.replace(pattern, replacement));
}

function localDate() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const argument = process.argv[2];
if (!argument) usage();

const current = readJson("package.json").version;
const next = nextVersion(current, argument);
if (next === current) throw new Error("La nuova versione deve essere diversa da quella corrente");
const date = localDate();

function updatePackageVersion(file, lockfile = false) {
  let source = read(file);
  source = source.replace(
    /^(\s*"version":\s*")[^"]+(")/m,
    `$1${next}$2`,
  );
  if (lockfile) {
    source = source.replace(
      /("":\s*\{\s*\r?\n\s*"name":\s*"[^"]+",\s*\r?\n\s*"version":\s*")[^"]+(")/,
      `$1${next}$2`,
    );
  }
  write(file, source);
}

for (const file of ["package.json", "addon/package.json", "addon/backend/package.json", "addon/frontend/package.json"]) {
  updatePackageVersion(file);
}
for (const file of ["addon/backend/package-lock.json", "addon/frontend/package-lock.json"]) {
  updatePackageVersion(file, true);
}

replaceOnce("addon/config.yaml", /version: "[^"]+"/, `version: "${next}"`);
replaceOnce("addon/Dockerfile", /io\.hass\.version="[^"]+"/, `io.hass.version="${next}"`);
replaceOnce("README.md", /version-[0-9]+\.[0-9]+\.[0-9]+-blue/, `version-${next}-blue`);
replaceOnce("addon/README.md", /version-[0-9]+\.[0-9]+\.[0-9]+-blue/, `version-${next}-blue`);
replaceOnce("README.md", /v[0-9]+\.[0-9]+\.[0-9]+/, `v${next}`);
replaceOnce("addon/README.md", /v[0-9]+\.[0-9]+\.[0-9]+/, `v${next}`);
replaceOnce("SPECS.md", /v[0-9]+\.[0-9]+\.[0-9]+/, `v${next}`);
replaceOnce("addon/SPECS.md", /v[0-9]+\.[0-9]+\.[0-9]+/, `v${next}`);

const rootEntry = `## [${next}] — ${date}\n\n### Aggiunto\n\n- TODO: descrivere le modifiche della release.\n\n`;
const addonEntry = `## [${next}] — ${date}\n\n### Added\n\n- TODO: describe the release changes.\n\n`;
replaceOnce("CHANGELOG.md", /---\r?\n\r?\n/, (match) => `${match}${rootEntry}`);
replaceOnce("addon/CHANGELOG.md", /# Changelog\r?\n\r?\n/, (match) => `${match}${addonEntry}`);

execFileSync(process.execPath, [path.join(root, "scripts/verify-version.mjs")], {
  stdio: "inherit",
});
console.log(`Versione aggiornata: ${current} → ${next}`);
console.log("Completa le voci TODO nei changelog prima del commit.");
