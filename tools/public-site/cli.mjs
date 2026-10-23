import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { buildDemo } from "./render.mjs";
import { CloudflareClient, configuration, mime, securityHeaders } from "./cloudflare.mjs";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(sourceDir, "../../dist/public-site-prototype");

export async function bundle() {
  const files = buildDemo();
  for (const name of ["style.css", "site.js"]) files.set(`/${name}`, await readFile(path.resolve(sourceDir, "../../addon/backend/public-site-assets", name), "utf8"));
  files.set("/_headers", securityHeaders);
  const manifest = JSON.parse(files.get("/manifest.json"));
  manifest.revision = createHash("sha256").update([...files].filter(([name]) => name !== "/manifest.json").map(([name, value]) => `${name}\n${value}`).join("\n")).digest("hex");
  files.set("/manifest.json", JSON.stringify(manifest));
  return files;
}

async function main() {
  const command = process.argv[2];
  if (command === "build" || command === "preview") {
    const files = await bundle();
    await mkdir(output, { recursive: true });
    for (const [filename, content] of files) {
      const destination = path.join(output, filename);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content);
    }
    console.log(`Generati ${files.size} file dimostrativi in ${output}`);
    if (command === "preview") {
      const server = createServer((req, res) => {
        if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname); }
        catch { res.writeHead(400); res.end(); return; }
        const filename = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
        const content = files.get(filename);
        res.writeHead(content === undefined ? 404 : 200, {
          "Content-Type": mime(filename), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        });
        res.end(req.method === "HEAD" ? undefined : content ?? files.get("/404.html"));
      });
      server.on("error", () => { console.error("Anteprima non avviata: controlla che la porta 4174 sia libera."); process.exitCode = 1; });
      server.listen(4174, "127.0.0.1", () => console.log("Anteprima: http://127.0.0.1:4174 (Ctrl+C per terminare)"));
    }
    return;
  }
  if (command === "verify") {
    const status = await new CloudflareClient(configuration()).verify();
    console.log(`Accesso in lettura verificato. URL previsto: ${status.url}`);
    console.log(status.exists ? status.owned ? "Worker riconosciuto: aggiornabile dal prototipo." : "ATTENZIONE: Worker esistente estraneo al prototipo; il deploy sarà bloccato." : "Nome libero: il primo deploy creerà il Worker.");
    console.log("La verifica non prova i permessi di scrittura e non pubblica contenuti.");
    return;
  }
  if (command === "deploy") {
    if (!process.argv.includes("--confirm-publish")) throw new Error("La pubblicazione rende il prototipo pubblico. Usa npm run site:deploy -- --confirm-publish per confermare.");
    const result = await new CloudflareClient(configuration()).deploy(await bundle());
    console.log(`Pubblicato e verificato: ${result.url}\nRevisione: ${result.revision}\nContenuti esclusivamente dimostrativi.`);
    return;
  }
  throw new Error("Comandi: build | preview | verify | deploy --confirm-publish. Token solo nella variabile CLOUDFLARE_API_TOKEN.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
