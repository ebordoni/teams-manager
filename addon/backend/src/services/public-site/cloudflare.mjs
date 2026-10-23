import { createHash } from "node:crypto";
import path from "node:path";

const OWNER_TAG = "teams-manager-public-site-prototype";
export const securityHeaders = `/*
  Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-cache
`;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };
export function mime(filename) { return MIME[path.extname(filename)] ?? "application/octet-stream"; }

export function configuration(env = process.env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const name = env.CLOUDFLARE_WORKER_NAME?.trim() || "teams-manager";
  if (!/^[a-f0-9]{32}$/i.test(accountId ?? "")) throw new Error("Imposta CLOUDFLARE_ACCOUNT_ID con l'Account ID di 32 caratteri.");
  if (!token || /[\s\u0000-\u001f]/u.test(token)) throw new Error("Imposta CLOUDFLARE_API_TOKEN con il token salvato, senza spazi.");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) throw new Error("Nome Worker non valido.");
  return { accountId, token, name };
}

export class CloudflareClient {
  constructor(config, fetcher = fetch) { this.config = config; this.fetcher = fetcher; }
  async request(route, { method = "GET", body, bearer = this.config.token, allowMissing = false } = {}) {
    let response;
    try {
      response = await this.fetcher(`https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/workers/${route}`, {
        method, headers: { Authorization: `Bearer ${bearer}`, ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30_000), redirect: "error",
      });
    } catch { throw new Error("Cloudflare non raggiungibile o risposta persa. Verifica lo stato prima di ripetere un deploy."); }
    const data = await response.json().catch(() => null);
    if (allowMissing && response.status === 404 && data?.errors?.some((error) => error.code === 10007)) return null;
    if (!response.ok || data?.success !== true) {
      // Mai stampare body remoto, header o eccezioni fetch: possono contenere token.
      const hint = response.status === 401 || response.status === 403 ? "Controlla token, account e permesso Workers Scripts Edit."
        : response.status === 429 ? "Limite API raggiunto; attendi prima di riprovare." : "Operazione non riuscita; verifica la destinazione nel pannello Cloudflare.";
      const codes = Array.isArray(data?.errors) ? data.errors.map((error) => error.code).filter((code) => Number.isSafeInteger(code)).slice(0, 5) : [];
      throw new Error(`Cloudflare HTTP ${response.status}${codes.length ? ` (codici ${codes.join(", ")})` : ""}. ${hint}`);
    }
    return data.result;
  }
  async verify() {
    const { name } = this.config;
    const domain = await this.request("subdomain");
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(domain?.subdomain ?? "")) throw new Error("Configura prima il sottodominio workers.dev nel pannello Cloudflare.");
    const settings = await this.request(`scripts/${name}/settings`, { allowMissing: true });
    return { url: `https://${name}.${domain.subdomain}.workers.dev`, exists: settings !== null, owned: settings?.tags?.includes(OWNER_TAG) === true };
  }
  async deploy(files) {
    const status = await this.verify();
    if (status.exists && !status.owned) throw new Error("Il Worker esiste e non è riconosciuto come prototipo Teams Manager. Nessuna modifica eseguita: scegli un nome libero o verifica manualmente la destinazione.");
    if (!files.has("/index.html") || !files.has("/manifest.json")) throw new Error("Artefatto incompleto.");
    const manifest = {};
    const byHash = new Map();
    for (const [filename, content] of files) {
      if (!/^\/[a-z0-9._/-]+$/i.test(filename) || filename.includes("..")) throw new Error("Percorso asset non valido.");
      const buffer = Buffer.from(content);
      if (buffer.length > 25 * 1024 * 1024) throw new Error("Asset troppo grande.");
      // Algoritmo dell'esempio ufficiale Direct Upload, non l'hash dell'intero sito.
      const hash = createHash("sha256").update(buffer.toString("base64") + path.extname(filename).slice(1)).digest("hex").slice(0, 32);
      manifest[filename] = { hash, size: buffer.length };
      byHash.set(hash, { content: buffer, filename });
    }
    const session = await this.request(`scripts/${this.config.name}/assets-upload-session`, { method: "POST", body: { manifest } });
    if (!session?.jwt || !Array.isArray(session.buckets)) throw new Error("Sessione upload incompleta; nessuna attivazione eseguita.");
    let completion = session.buckets.length === 0 ? session.jwt : undefined;
    for (const bucket of session.buckets) {
      if (!Array.isArray(bucket) || bucket.length === 0) throw new Error("Gruppo upload non valido.");
      const form = new FormData();
      for (const hash of bucket) {
        const asset = byHash.get(hash);
        if (!asset) throw new Error("Cloudflare ha richiesto un asset sconosciuto.");
        form.append(hash, new Blob([asset.content.toString("base64")], { type: mime(asset.filename) }), hash);
      }
      const uploaded = await this.request("assets/upload?base64=true", { method: "POST", body: form, bearer: session.jwt });
      if (uploaded?.jwt) completion = uploaded.jwt;
    }
    if (!completion) throw new Error("Upload non completato; il sito precedente non è stato sostituito.");
    const metadata = new FormData();
    metadata.append("metadata", JSON.stringify({
      compatibility_date: "2026-10-23", tags: [OWNER_TAG],
      assets: { jwt: completion, config: { html_handling: "auto-trailing-slash", not_found_handling: "404-page", run_worker_first: false, _headers: securityHeaders } },
    }));
    await this.request(`scripts/${this.config.name}`, { method: "PUT", body: metadata });
    await this.request(`scripts/${this.config.name}/subdomain`, { method: "POST", body: { enabled: true, previews_enabled: false } });
    // Una risposta positiva all'upload non prova che l'URL pubblico sia aggiornato.
    const expected = JSON.parse(files.get("/manifest.json")).revision;
    let visible = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await this.fetcher(`${status.url}/manifest.json?revision=${expected}`, { signal: AbortSignal.timeout(10_000), redirect: "error", cache: "no-store" });
        if (response.ok && (await response.json()).revision === expected) { visible = true; break; }
      } catch { /* propagazione CDN: lettura ripetibile, nessun nuovo upload */ }
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!visible) throw new Error(`Deploy inviato ma revisione pubblica non verificata. Controlla ${status.url} prima di ripetere il comando.`);
    return { url: status.url, revision: expected, fileCount: files.size };
  }
}
