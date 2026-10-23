import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSetting, getTeamName, setSetting } from "./settings.service";
import { eventIcon, loadEventTypes, loadLiveEvents } from "./communication-content";

const key = (name: string) => `website_${name}`;
export class PublicSiteError extends Error {}
export const isWebsiteActive = () => getSetting("communication_provider") === "website";
export function websiteSettings() {
  return {
    accountId: getSetting(key("account_id")) ?? "", workerName: getSetting(key("worker_name")) ?? "teams-manager",
    active: isWebsiteActive(), configured: Boolean(getSetting(key("token")) && getSetting(key("account_id"))),
    includeNotes: getSetting(key("include_notes")) === "true", autoPublish: getSetting(key("auto_publish")) !== "false",
    introduction: getSetting(key("introduction")) ?? "Appuntamenti, orari e novità della squadra.",
    notice: getSetting(key("notice")) ?? "", information: getSetting(key("information")) ?? "",
    url: getSetting(key("url")) ?? "", updatedAt: getSetting(key("updated_at")) ?? "",
    lastError: getSetting(key("last_error")),
    autoSync: getSetting(key("synced_destination")) === destination() && getSetting(key("auto_publish")) !== "false",
    published: getSetting(key("synced_destination")) === destination(),
  };
}
function destination() { return `${getSetting(key("account_id")) ?? ""}/${getSetting(key("worker_name")) ?? "teams-manager"}`; }

export interface WebsiteInput {
  accountId: string; workerName: string; token?: string; active: boolean;
  includeNotes: boolean; autoPublish: boolean; introduction: string; notice: string; information: string;
}

export function saveWebsiteSettings(input: WebsiteInput) {
  if (!input.token?.trim() && !getSetting(key("token"))) throw new PublicSiteError("Inserisci il token Cloudflare.");
  const nextDestination = `${input.accountId}/${input.workerName}`;
  if (nextDestination !== destination() || (input.token?.trim() && input.token.trim() !== getSetting(key("token")))) {
    for (const name of ["hash", "synced_destination", "url", "updated_at", "last_error"]) setSetting(key(name), null);
  }
  if (input.token?.trim()) setSetting(key("token"), input.token.trim());
  for (const [name, value] of Object.entries({ account_id: input.accountId, worker_name: input.workerName, include_notes: String(input.includeNotes), auto_publish: String(input.autoPublish), introduction: input.introduction, notice: input.notice, information: input.information })) setSetting(key(name), value);
  if (input.active) setSetting("communication_provider", "website");
  else if (isWebsiteActive()) setSetting("communication_provider", "google");
  return websiteSettings();
}

async function client() {
  const { CloudflareClient, configuration } = await import("./public-site/cloudflare.mjs");
  return new CloudflareClient(configuration({ CLOUDFLARE_ACCOUNT_ID: getSetting(key("account_id")) ?? "", CLOUDFLARE_API_TOKEN: getSetting(key("token")) ?? "", CLOUDFLARE_WORKER_NAME: getSetting(key("worker_name")) || "teams-manager" }));
}

export async function verifyWebsite() {
  try {
    const target = destination();
    const result = await (await client()).verify();
    if (destination() !== target) throw new PublicSiteError("La configurazione è cambiata durante la verifica. Riprova.");
    if (result.exists && !result.owned) throw new PublicSiteError("Il Worker esiste ma non è gestito da Teams Manager. Nessuna modifica eseguita.");
    setSetting(key("url"), result.url);
    return { url: result.url, message: result.exists ? "Sito Teams Manager riconosciuto. Nessuna modifica eseguita." : "Accesso in lettura verificato. Il primo aggiornamento creerà il sito." };
  } catch (error) { throw safeError(error); }
}
function safeError(error: unknown): PublicSiteError {
  const token = getSetting(key("token"));
  const message = error instanceof Error ? error.message : "Pubblicazione sito non riuscita.";
  return new PublicSiteError(token ? message.split(token).join("[token nascosto]") : message);
}

export function publicSiteModel() {
  const settings = websiteSettings();
  const types = loadEventTypes();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const teamName = getTeamName();
  return {
    teamName, demo: false, intro: settings.introduction, notice: settings.notice, information: settings.information,
    events: loadLiveEvents().map((event) => {
      const type = types.get(event.type);
      const venue = event.venue === "away" ? "in trasferta" : event.venue === "neutral" ? "in campo neutro" : "in casa";
      const match = type?.hasOpponent && event.opponent ? (event.venue === "away" ? `${event.opponent} VS ${teamName}` : `${teamName} VS ${event.opponent}`).toLocaleUpperCase("it-IT") : "";
      const state = event.status === "cancelled" ? "ANNULLATO" : event.status === "modified" ? "MODIFICATO" : "";
      return { id: event.id, date: event.date, type: event.type, typeLabel: type?.label ?? event.type,
        title: `${type?.label ?? event.type}${type?.hasOpponent ? ` ${venue}` : ""}${state ? ` · ${state}` : ""}`,
        icon: eventIcon(type?.icon), match, start: event.startTime ?? "", end: event.endTime ?? "", meeting: event.meetingTime ?? "",
        location: [event.location, event.address].filter(Boolean).join(" · "),
        note: [state, settings.includeNotes ? event.notes : ""].filter(Boolean).join(": "),
        past: event.date < today, cancelled: event.status === "cancelled",
      };
    }),
  };
}

export async function renderPublicSite(now = new Date(), model = publicSiteModel()) {
  const { buildSite } = await import("./public-site/render.mjs");
  const { attachSiteAssets } = await import("./public-site/assets.mjs");
  return attachSiteAssets(buildSite(model, now));
}

export async function previewWebsite() {
  const files = await renderPublicSite();
  // srcDoc è isolato senza script o same-origin: incorpora solo gli asset
  // necessari, evitando richieste verso i percorsi dell'Ingress di HA.
  let css = files.get("/style.css")!.toString();
  for (const weight of [400, 500, 600, 700]) {
    const font = files.get(`/fonts/poppins-latin-${weight}.woff2`)!;
    css = css.replace(`/fonts/poppins-latin-${weight}.woff2`, `data:font/woff2;base64,${Buffer.from(font).toString("base64")}`);
  }
  return { html: files.get("/index.html")!.toString()
    .replace('<link rel="stylesheet" href="/style.css">', () => `<style>${css}</style>`)
    .replaceAll('src="/logo.png"', `src="data:image/png;base64,${Buffer.from(files.get("/logo.png")!).toString("base64")}"`)
    .replace(/<link[^>]+rel="(?:icon|preload)"[^>]*>/g, "")
    .replace('<script src="/site.js" defer></script>', "") };
}

export async function publishWebsite(force = false, confirmPublic = false) {
  const settings = websiteSettings();
  if (!settings.published && !confirmPublic) throw new PublicSiteError("Conferma la prima pubblicazione: gli appuntamenti saranno visibili pubblicamente.");
  try {
    // Hash significativo senza timestamp: niente deploy automatici a dati invariati.
    const { readSiteAssets, hashSiteFiles } = await import("./public-site/assets.mjs");
    const assets = hashSiteFiles(await readSiteAssets());
    const model = publicSiteModel();
    const renderer = await readFile(path.resolve(__dirname, "public-site/render.mjs"), "utf8");
    const hash = createHash("sha256").update(JSON.stringify({ model, assets, renderer })).digest("hex");
    if (!force && settings.published && getSetting(key("hash")) === hash) return websiteSettings();
    const files = await renderPublicSite(new Date(), model);
    const result = await (await client()).deploy(files);
    setSetting(key("url"), result.url);
    setSetting(key("hash"), hash);
    setSetting(key("synced_destination"), destination());
    setSetting(key("updated_at"), new Date().toISOString());
    setSetting(key("last_error"), null);
    return websiteSettings();
  } catch (error) {
    const safe = safeError(error);
    setSetting(key("last_error"), safe.message);
    throw safe;
  }
}
