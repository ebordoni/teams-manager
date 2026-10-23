import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "./cloudflare.mjs";

const directory = fileURLToPath(new URL("../../../public-site-assets/", import.meta.url));
export const PUBLIC_ASSET_FILES = [
  "style.css", "site.js", "logo.png", "fonts/OFL.txt",
  ...[400, 500, 600, 700].map((weight) => `fonts/poppins-latin-${weight}.woff2`),
];

export async function readSiteAssets() {
  const files = new Map(await Promise.all(PUBLIC_ASSET_FILES.map(async (filename) => {
    const data = await readFile(path.join(directory, filename));
    return [`/${filename}`, /\.(?:css|js|txt)$/.test(filename) ? data.toString("utf8") : data];
  })));
  files.set("/_headers", securityHeaders);
  return files;
}

// Hash dei byte, non della conversione UTF-8: logo e font sono file binari.
export function hashSiteFiles(files) {
  const hash = createHash("sha256");
  for (const [name, value] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const data = Buffer.from(value);
    hash.update(`${name}\0${data.length}\0`).update(data);
  }
  return hash.digest("hex");
}

export async function attachSiteAssets(pages) {
  const files = new Map([...pages, ...await readSiteAssets()]);
  const metadata = JSON.parse(files.get("/manifest.json").toString());
  metadata.revision = hashSiteFiles(new Map([...files].filter(([name]) => name !== "/manifest.json")));
  files.set("/manifest.json", JSON.stringify(metadata));
  return files;
}
