import { createHash, randomUUID } from "node:crypto";
import type { Event, EventTypeDef } from "../types";
import { buildCommunicationContent } from "./communication-content";
import { getSetting, setSetting } from "./settings.service";
import { NotionError, notionRequest, type NotionProperty, type NotionResponse } from "./notion.service";

const ID_PROPERTY = "TM Evento ID";
const HASH_PROPERTY = "TM Impronta";
const text = (value: string) => Array.from({ length: Math.ceil(value.length / 2000) }, (_, index) => ({ type: "text", text: { content: value.slice(index * 2000, (index + 1) * 2000) } }));
const plain = (property?: NotionProperty) => (property?.rich_text ?? []).map((part) => part.plain_text ?? part.text?.content ?? "").join("");

export async function verifyNotionDatabase() {
  const id = getSetting("notion_page_id");
  if (!id) throw new NotionError("Configura il database Notion nelle Impostazioni.");
  const database = await notionRequest(`databases/${id}`);
  if (database.archived || database.in_trash) throw new NotionError("Il database Notion è nel cestino. Ripristinalo oppure collega un altro database.");
  if (database.object !== "database" || database.data_sources?.length !== 1) throw new NotionError("Collega un database Notion con una sola origine dati. Le viste Elenco e Calendario possono usare la stessa origine.");
  const source = await notionRequest(`data_sources/${database.data_sources[0].id}`);
  if (!source.id || !source.properties || !Object.values(source.properties).some((property) => property.type === "title")) throw new NotionError("Il database non ha una proprietà titolo utilizzabile.");
  return source;
}

function schemaNames(source: NotionResponse) {
  const entries = Object.entries(source.properties!);
  const title = entries.find(([, value]) => value.type === "title")![0];
  const date = source.properties?.Data?.type === "date" ? "Data" : entries.find(([, value]) => value.type === "date")?.[0] ?? "Data";
  return { title, date };
}

async function prepareSchema(source: NotionResponse) {
  const names = schemaNames(source);
  const required: Record<string, string> = { [names.date]: "date", Tipo: "select", Stato: "select", Luogo: "rich_text", Ritrovo: "rich_text", [ID_PROPERTY]: "rich_text", [HASH_PROPERTY]: "rich_text" };
  const missing: Record<string, object> = {};
  for (const [name, type] of Object.entries(required)) {
    const existing = source.properties![name];
    if (existing && existing.type !== type) throw new NotionError(`La proprietà Notion "${name}" deve essere di tipo ${type}. Rinomina la proprietà esistente oppure correggine il tipo.`);
    if (!existing) missing[name] = { [type]: {} };
  }
  if (Object.keys(missing).length) await notionRequest(`data_sources/${source.id}`, "PATCH", { properties: missing });
  return names;
}

async function queryEntries(sourceId: string) {
  const entries: NotionResponse[] = [];
  let cursor: string | undefined;
  do {
    const response = await notionRequest(`data_sources/${sourceId}/query`, "POST", { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    if (!Array.isArray(response.results)) throw new NotionError("Risposta incompleta dal database Notion. Nessuna voce è stata rimossa.");
    entries.push(...response.results);
    if (response.has_more && !response.next_cursor) throw new NotionError("Elenco Notion incompleto: impossibile completare la sincronizzazione.");
    cursor = response.has_more ? response.next_cursor! : undefined;
  } while (cursor);
  return entries;
}

function eventDate(event: Event) {
  if (!event.startTime) return { start: event.date };
  const start = `${event.date}T${event.startTime}:00`;
  let end: string | undefined;
  if (event.endTime) {
    let endDate = event.date;
    if (event.endTime <= event.startTime) {
      const next = new Date(`${event.date}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      endDate = next.toISOString().slice(0, 10);
    }
    end = `${endDate}T${event.endTime}:00`;
  }
  return { start, ...(end ? { end } : {}), time_zone: "Europe/Rome" };
}

/** Ogni voce gestita ha una chiave persistente, distinta dai contenuti manuali del database. */
export async function publishNotionCalendar(events: Event[], eventTypes: Map<string, EventTypeDef>, force = false) {
  try {
    const source = await verifyNotionDatabase();
    const names = await prepareSchema(source);
    let instance = getSetting("notion_calendar_instance");
    if (!instance) { instance = randomUUID(); setSetting("notion_calendar_instance", instance); }
    const prefix = `${instance}:`;
    const entries = await queryEntries(source.id!);
    const byKey = new Map<string, NotionResponse>();
    const obsolete: NotionResponse[] = [];
    for (const entry of entries) {
      const id = plain(entry.properties?.[ID_PROPERTY]);
      if (!id.startsWith(prefix)) continue;
      if (byKey.has(id)) obsolete.push(entry);
      else byKey.set(id, entry);
    }
    const desired = new Set<string>();
    const { renderNotionMarkdown } = await import("./notion.service.js");
    for (const event of events) {
      if (eventTypes.get(event.type)?.includeInGoogleDoc === false) continue;
      const eventKey = `${prefix}${event.id}`;
      desired.add(eventKey);
      const content = buildCommunicationContent([event], eventTypes);
      const paragraphs = content.paragraphs.filter((paragraph) => paragraph.kind !== "title" && paragraph.kind !== "subtitle");
      const heading = paragraphs.find((paragraph) => paragraph.kind === "event");
      const past = Boolean(heading?.past);
      const title = `${heading?.text ?? event.type}${event.opponent ? ` · ${event.opponent}` : ""}`;
      const markdown = renderNotionMarkdown({ ...content, paragraphs });
      const properties = {
        [names.title]: { title: text(title).map((part) => ({ ...part, annotations: { strikethrough: past, color: past ? "gray" : "default" } })) },
        [names.date]: { date: eventDate(event) },
        Tipo: { select: { name: (eventTypes.get(event.type)?.label ?? event.type).slice(0, 100) } },
        Stato: { select: { name: event.status === "cancelled" ? "Annullato" : past ? "Passato" : event.status === "modified" ? "Modificato" : "Programmato" } },
        Luogo: { rich_text: text([event.location, event.address].filter(Boolean).join(" · ")) },
        Ritrovo: { rich_text: text(event.meetingTime ?? "") },
        [ID_PROPERTY]: { rich_text: text(eventKey) },
      };
      const hash = createHash("sha256").update(JSON.stringify({ properties, markdown })).digest("hex");
      let entry = byKey.get(eventKey);
      if (!force && entry && plain(entry.properties?.[HASH_PROPERTY]) === hash) continue;
      if (!entry) {
        // La chiave è inserita insieme alla pagina: anche una risposta persa è recuperabile alla query successiva.
        entry = await notionRequest("pages", "POST", { parent: { type: "data_source_id", data_source_id: source.id }, properties, markdown });
      } else {
        const result = await notionRequest(`pages/${entry.id}/markdown`, "PATCH", { type: "replace_content", replace_content: { new_str: markdown } });
        if (result.warnings?.length) throw new NotionError("Notion ha segnalato avvisi nel contenuto dell'evento. Controlla la scheda e riprova.");
      }
      if (!entry.id) throw new NotionError("Notion non ha restituito l'identificativo dell'evento. Riprova la sincronizzazione.");
      // L'impronta è salvata solo dopo la scrittura del contenuto: un errore parziale verrà ritentato.
      await notionRequest(`pages/${entry.id}`, "PATCH", { properties: { ...properties, [HASH_PROPERTY]: { rich_text: text(hash) } } });
    }
    for (const [id, entry] of byKey) if (!desired.has(id)) obsolete.push(entry);
    // Si archiviano soltanto le voci di questa installazione, dopo avere aggiornato tutte le altre.
    for (const entry of obsolete) {
      if (!entry.id) throw new NotionError("Voce Notion senza ID: pulizia interrotta.");
      await notionRequest(`pages/${entry.id}`, "PATCH", { in_trash: true });
    }
    const id = getSetting("notion_page_id")!;
    setSetting("notion_synced_page_id", id);
    setSetting("notion_updated_at", new Date().toISOString());
    setSetting("notion_last_error", null);
  } catch (error) {
    setSetting("notion_last_error", error instanceof NotionError ? error.message : "Sincronizzazione del calendario Notion non riuscita.");
    throw error;
  }
}
