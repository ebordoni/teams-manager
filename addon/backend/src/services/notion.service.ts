import { createHash } from "node:crypto";
import { getSetting, setSetting } from "./settings.service";
import type { CommunicationContent } from "./communication-content";

const key = (name: string) => `notion_${name}`;
export class NotionError extends Error {}
export const isNotionActive = () => getSetting("communication_provider") === "notion";
export function notionStatus() {
  return {
    active: isNotionActive(),
    configured: Boolean(getSetting(key("token")) && getSetting(key("page_id"))),
    pageId: getSetting(key("page_id")) ?? "",
    pageUrl: getSetting(key("page_url")) ?? "",
    publicUrl: getSetting(key("public_url")) ?? "",
    updatedAt: getSetting(key("updated_at")) ?? "",
    lastError: getSetting(key("last_error")),
    autoSync: getSetting(key("synced_page_id")) === getSetting(key("page_id")) && Boolean(getSetting(key("page_id"))),
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
  if (!input.token?.trim() && !getSetting(key("token"))) throw new NotionError("Inserisci il token della connessione interna Notion.");
  if (input.publicUrl) {
    const url = new URL(input.publicUrl);
    if (url.protocol !== "https:" || !/(^|\.)(notion\.so|notion\.com|notion\.site)$/.test(url.hostname)) throw new NotionError("Il link pubblico deve essere un URL HTTPS di Notion.");
  }
  if (input.token?.trim()) setSetting(key("token"), input.token.trim());
  if (pageId !== getSetting(key("page_id"))) {
    for (const name of ["hash", "updated_at", "synced_page_id", "last_error"]) setSetting(key(name), null);
  }
  setSetting(key("page_id"), pageId);
  setSetting(key("page_url"), `https://www.notion.so/${pageId}`);
  setSetting(key("public_url"), input.publicUrl || null);
  setSetting("communication_provider", input.active ? "notion" : "google");
  return notionStatus();
}

interface NotionResponse { object?: string; archived?: boolean; in_trash?: boolean; warnings?: unknown[] }
async function notionRequest(path: string, method = "GET", body?: object): Promise<NotionResponse> {
  const token = getSetting(key("token"));
  if (!token) throw new NotionError("Configura la connessione Notion nelle Impostazioni.");
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: globalThis.Response;
    try {
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
    if (response.status === 401) throw new NotionError("Token Notion non valido o revocato.");
    if (response.status === 404) throw new NotionError("Pagina Notion non trovata o non condivisa con la connessione. Controlla il link e i permessi; non è stata creata un'altra pagina.");
    if (response.status === 403) throw new NotionError("Notion ha rifiutato l'accesso: controlla i permessi di lettura e aggiornamento e i limiti del workspace.");
    if (!response.ok) throw new NotionError(`Aggiornamento Notion non riuscito (HTTP ${response.status}). Controlla che la pagina sia dedicata agli appuntamenti e non contenga sottopagine o database.`);
    return await response.json() as NotionResponse;
  }
  throw new NotionError("Notion temporaneamente occupato.");
}

export async function verifyNotion() {
  const id = getSetting(key("page_id"));
  if (!id) throw new NotionError("Configura la pagina Notion nelle Impostazioni.");
  const page = await notionRequest(`pages/${id}`);
  if (page.archived || page.in_trash) throw new NotionError("La pagina Notion è nel cestino. Ripristinala oppure collega un'altra pagina.");
  if (page.object !== "page") throw new NotionError("Il link deve indicare una pagina Notion.");
  return page;
}

export function renderNotionMarkdown(content: CommunicationContent): string {
  const escape = (text: string) => text.replace(/[\\*~`$\[\]<>{}|^#]/g, "\\$&").replace(/\r?\n/g, "<br>");
  return content.paragraphs.map((paragraph) => {
    if (!paragraph.text) return "---";
    let text = escape(paragraph.text);
    if (paragraph.kind === "event" || paragraph.kind === "match") text = `**${text}**`;
    if (paragraph.kind === "note") text = `*${text}*`;
    if (paragraph.past) text = `~~${text}~~`;
    const prefix = paragraph.kind === "title" ? "# " : paragraph.kind === "date" ? "## " : "";
    return `${prefix}${text}${paragraph.past ? ' {color="gray"}' : ""}`;
  }).join("\n\n");
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
