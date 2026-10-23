import { createHash } from "node:crypto";
import { getSetting, setSetting } from "./settings.service";
import type { CommunicationContent } from "./communication-content";
import { renderNotionMarkdown } from "./notion-agenda";
export { renderNotionMarkdown } from "./notion-agenda";

const key = (name: string) => `notion_${name}`;
export class NotionError extends Error {
  constructor(message: string, readonly upstreamStatus?: number, readonly notionCode?: string, readonly requestId?: string) {
    super(message);
    this.name = "NotionError";
  }
}

export function notionErrorResponse(error: NotionError) {
  return { error: error.message, upstream: "notion", upstreamStatus: error.upstreamStatus, notionCode: error.notionCode, requestId: error.requestId };
}
export const isNotionActive = () => getSetting("communication_provider") === "notion";
// Compatibilità con le vecchie installazioni: non usare mai il database salvato
// come destinazione della nuova agenda, né modificarlo durante il passaggio.
const requiresPageSetup = () => getSetting(key("mode")) === "database";
export function notionStatus() {
  return {
    active: isNotionActive(),
    requiresPageSetup: requiresPageSetup(),
    configured: Boolean(getSetting(key("token")) && getSetting(key("page_id"))),
    pageId: getSetting(key("page_id")) ?? "",
    pageUrl: getSetting(key("page_url")) ?? "",
    publicUrl: getSetting(key("public_url")) ?? "",
    updatedAt: getSetting(key("updated_at")) ?? "",
    lastError: getSetting(key("last_error")),
    autoSync: !requiresPageSetup() && getSetting(key("synced_page_id")) === getSetting(key("page_id")) && Boolean(getSetting(key("page_id"))),
  };
}

export function parseNotionPage(input: string): string {
  let value = input.trim();
  if (/^https?:/i.test(value)) {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/(^|\.)(notion\.so|notion\.com|notion\.site)$/.test(url.hostname)) {
      throw new NotionError("Inserisci un link HTTPS di Notion o l'ID della pagina.");
    }
    value = decodeURIComponent(url.pathname).split("/").filter(Boolean).pop() ?? "";
  }
  const match = value.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
  if (!match) throw new NotionError("ID pagina non riconosciuto: copia il link della pagina dal workspace Notion.");
  return match[1].replace(/-/g, "").toLowerCase();
}

export function saveNotionSettings(input: { token?: string; page: string; publicUrl: string; active: boolean }) {
  const pageId = parseNotionPage(input.page);
  const legacyDestination = requiresPageSetup() && pageId === getSetting(key("page_id"));
  if (legacyDestination && input.active) {
    throw new NotionError("Collega una pagina Notion normale, non il database precedente. Il database e i suoi appuntamenti restano intatti.");
  }
  if (!input.token?.trim() && !getSetting(key("token"))) throw new NotionError("Inserisci il token della connessione interna Notion.");
  if (input.publicUrl) {
    const url = new URL(input.publicUrl);
    if (url.protocol !== "https:" || !/(^|\.)(notion\.so|notion\.com|notion\.site)$/.test(url.hostname)) throw new NotionError("Il link pubblico deve essere un URL HTTPS di Notion.");
  }
  if (input.token?.trim()) setSetting(key("token"), input.token.trim());
  // È sempre possibile disattivare Notion senza dover prima migrare la pagina.
  if (legacyDestination) {
    setSetting("communication_provider", "google");
    return notionStatus();
  }
  if (pageId !== getSetting(key("page_id")) || requiresPageSetup()) {
    for (const name of ["hash", "updated_at", "synced_page_id", "last_error"]) setSetting(key(name), null);
  }
  setSetting(key("page_id"), pageId);
  setSetting(key("mode"), null);
  setSetting(key("page_url"), `https://www.notion.so/${pageId}`);
  setSetting(key("public_url"), input.publicUrl || null);
  setSetting("communication_provider", input.active ? "notion" : "google");
  return notionStatus();
}

interface NotionResponse {
  object?: string; id?: string; archived?: boolean; in_trash?: boolean; warnings?: unknown[];
}
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;
async function paceNotionRequests() {
  const turn = requestQueue.then(async () => {
    const delay = nextRequestAt - Date.now();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    nextRequestAt = Date.now() + 350;
  });
  requestQueue = turn.catch(() => undefined);
  await turn;
}
async function notionRequest(path: string, method = "GET", body?: object): Promise<NotionResponse> {
  const token = getSetting(key("token"));
  if (!token) throw new NotionError("Configura la connessione Notion nelle Impostazioni.");
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: globalThis.Response;
    try {
      await paceNotionRequests();
      response = await fetch(`https://api.notion.com/v1/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2026-03-11", "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30_000),
      });
    } catch { throw new NotionError("Notion non raggiungibile. Riprova più tardi."); }
    if ((response.status === 429 || response.status === 529) && attempt < 2) {
      const wait = Number(response.headers.get("retry-after") ?? 1);
      if (!Number.isFinite(wait) || wait > 10) throw new NotionError("Notion è temporaneamente occupato. Riprova più tardi.");
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, wait) * 1000));
      continue;
    }
    if (!response.ok) {
      // Non restituire il body intero: può contenere dati estranei alla diagnosi.
      const detail = await response.json().catch(() => null) as { code?: unknown; message?: unknown; request_id?: unknown } | null;
      const sanitize = (value: string) => value.split(token).join("[token nascosto]")
        .replace(/\b(?:secret_|ntn_)[A-Za-z0-9_-]+/g, "[token nascosto]")
        .replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 800);
      const code = typeof detail?.code === "string" ? sanitize(detail.code) : undefined;
      const requestId = typeof detail?.request_id === "string" ? sanitize(detail.request_id) : undefined;
      const message = typeof detail?.message === "string" ? sanitize(detail.message) : "";
      const context = method === "GET" ? "Verifica accesso a Notion non riuscita" : "Aggiornamento Notion non riuscito";
      const hint = response.status === 401 ? "Token Notion non valido o revocato."
        : response.status === 404 ? "Pagina Notion non trovata o non condivisa con la connessione. Controlla il link e i permessi; non è stata creata un'altra pagina."
        : response.status === 403 ? "Notion ha rifiutato l'accesso: controlla i permessi di lettura e aggiornamento e i limiti del workspace."
        : context;
      throw new NotionError(`${hint} (HTTP ${response.status}${code ? ` · ${code}` : ""})${message ? `: ${message}` : "."}`, response.status, code, requestId);
    }
    return await response.json() as NotionResponse;
  }
  throw new NotionError("Notion temporaneamente occupato.");
}

export async function verifyNotion() {
  const id = getSetting(key("page_id"));
  if (!id) throw new NotionError("Configura la pagina Notion nelle Impostazioni.");
  if (requiresPageSetup()) throw new NotionError("Collega una pagina Notion normale nelle Impostazioni per pubblicare l'agenda. Il database precedente non viene modificato.");
  const page = await notionRequest(`pages/${id}`);
  if (page.archived || page.in_trash) throw new NotionError("La pagina Notion è nel cestino. Ripristinala oppure collega un'altra pagina.");
  if (page.object !== "page") throw new NotionError("Il link deve indicare una pagina Notion.");
  return page;
}

export async function publishNotion(content: CommunicationContent, force = false) {
  try {
    await verifyNotion();
    const id = getSetting(key("page_id"))!;
    const markdown = renderNotionMarkdown(content);
    const hash = createHash("sha256").update(markdown).digest("hex");
    if (force || getSetting(key("hash")) !== hash) {
      const result = await notionRequest(`pages/${id}/markdown`, "PATCH", {
        type: "replace_content", replace_content: { new_str: markdown },
      });
      if (result.warnings?.length) throw new NotionError("Notion ha applicato il contenuto con avvisi di formattazione. Verifica la pagina e riprova.");
      setSetting(key("hash"), hash);
      setSetting(key("updated_at"), new Date().toISOString());
    }
    setSetting(key("synced_page_id"), id);
    setSetting(key("last_error"), null);
    return notionStatus();
  } catch (error) {
    setSetting(key("last_error"), error instanceof NotionError ? error.message : "Aggiornamento Notion non riuscito.");
    throw error;
  }
}
