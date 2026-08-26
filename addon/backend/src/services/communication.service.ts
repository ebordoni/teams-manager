import { getAuthorizedClient } from "./google/auth";
import { createDocumentWithText, replacePlaceholders } from "./google/docs";
import {
  copyFile,
  deleteFile,
  ensureCommunicationsFolder,
  makeShareableAndGetLink,
  moveFileToFolder,
} from "./google/drive";
import { getSetting, SETTINGS_KEYS } from "./settings.service";
import { getDb } from "../db/schema";
import { rowToEvent, rowToEventTypeDef } from "../db/helpers";
import type {
  CommunicationRow,
  Event,
  EventRow,
  EventTypeDef,
  EventTypeDefRow,
} from "../types";

function loadEventTypes(): Map<string, EventTypeDef> {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM event_types")
    .all() as unknown as EventTypeDefRow[];
  return new Map(rows.map((r) => [r.key, rowToEventTypeDef(r)]));
}

const WEEKDAYS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];
const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function formatDateIt(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function getCallupNames(eventId: number): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.name AS name
       FROM callups c
       JOIN players p ON p.id = c.player_id
       WHERE c.event_id = ? AND c.called_up = 1
       ORDER BY p.name ASC`,
    )
    .all(eventId) as unknown as { name: string }[];
  return rows.map((r) => r.name);
}

function formatEvent(event: Event, eventTypes: Map<string, EventTypeDef>): string {
  const typeDef = eventTypes.get(event.type);
  const lines: string[] = [];
  const header = `${formatDateIt(event.date)} — ${(typeDef?.label ?? event.type).toUpperCase()}`;
  lines.push(header);

  if (event.status !== "scheduled") {
    lines.push(
      `⚠️ ${event.status === "cancelled" ? "ANNULLATO" : "MODIFICATO"}${
        event.notes ? `: ${event.notes}` : ""
      }`,
    );
  }

  if (typeDef?.hasOpponent && event.opponent) {
    lines.push(`⚽ GIPS Salizzole – ${event.opponent}`);
  }
  if (event.location) lines.push(`📍 ${event.location}`);
  if (event.meetingTime) lines.push(`⏰ Ritrovo: ${event.meetingTime}`);
  if (event.startTime) {
    lines.push(
      `⏰ Inizio: ${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`,
    );
  }
  if (event.notes && event.status === "scheduled") lines.push(event.notes);

  if (typeDef?.hasOpponent) {
    const callups = getCallupNames(event.id);
    if (callups.length > 0) {
      lines.push("");
      lines.push("CONVOCATI");
      for (const name of callups) lines.push(`- ${name}`);
    }
  }

  return lines.join("\n");
}

function buildDocumentText(
  events: Event[],
  eventTypes: Map<string, EventTypeDef>,
): { title: string; body: string } {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const title = `GIPS Salizzole – Appuntamenti dal ${formatDateIt(sorted[0].date)}`;
  const body = [
    "GIPS SALIZZOLE – APPUNTAMENTI",
    "",
    ...sorted.flatMap((event, i) => [
      formatEvent(event, eventTypes),
      ...(i < sorted.length - 1 ? ["", "---", ""] : []),
    ]),
  ].join("\n");
  return { title, body };
}

/** Costruisce i placeholder `{{CHIAVE}}` usati dal template Google Docs. */
function buildTemplatePlaceholders(
  events: Event[],
  eventTypes: Map<string, EventTypeDef>,
): { title: string; replacements: Record<string, string> } {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const title = `GIPS Salizzole – Appuntamenti dal ${formatDateIt(sorted[0].date)}`;

  const matches = sorted.filter((e) => eventTypes.get(e.type)?.hasOpponent);
  const trainings = sorted.filter((e) => !eventTypes.get(e.type)?.hasOpponent);

  const partite = matches.length
    ? matches.map((e) => formatEvent(e, eventTypes)).join("\n\n---\n\n")
    : "Nessuna partita/torneo in programma.";
  const allenamenti = trainings.length
    ? trainings.map((e) => formatEvent(e, eventTypes)).join("\n\n---\n\n")
    : "Nessun allenamento in programma.";

  return {
    title,
    replacements: {
      TITOLO: title,
      SETTIMANA: formatDateIt(sorted[0].date),
      PARTITE: partite,
      ALLENAMENTI: allenamenti,
    },
  };
}

function buildWhatsappMessage(url: string): string {
  return `Ciao a tutti, vi condividiamo gli appuntamenti della prossima settimana ⚽\n\n👉 ${url}\n\nGrazie!`;
}

export interface GeneratedCommunication {
  id: number;
  title: string;
  googleDocId: string;
  googleDocUrl: string;
  whatsappMessage: string;
}

/** Genera un Google Doc con gli appuntamenti selezionati e lo salva su Drive. */
export async function generateCommunication(
  eventIds: number[],
): Promise<GeneratedCommunication> {
  if (eventIds.length === 0) {
    throw new Error("Seleziona almeno un evento");
  }

  const db = getDb();
  const placeholders = eventIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM events WHERE id IN (${placeholders})`)
    .all(...eventIds) as unknown as EventRow[];
  if (rows.length === 0) {
    throw new Error("Nessun evento trovato per gli id forniti");
  }
  const events = rows.map(rowToEvent);
  const eventTypes = loadEventTypes();

  const auth = getAuthorizedClient();
  const templateDocId = getSetting(SETTINGS_KEYS.googleTemplateDocId);

  let documentId: string;
  let title: string;

  if (templateDocId) {
    const built = buildTemplatePlaceholders(events, eventTypes);
    title = built.title;
    documentId = await copyFile(auth, templateDocId, title);
    await replacePlaceholders(auth, documentId, built.replacements);
  } else {
    const built = buildDocumentText(events, eventTypes);
    title = built.title;
    documentId = await createDocumentWithText(auth, title, built.body);
  }

  const folderId = await ensureCommunicationsFolder(auth);
  await moveFileToFolder(auth, documentId, folderId);
  const url = await makeShareableAndGetLink(auth, documentId);

  const result = db
    .prepare(
      `INSERT INTO communications (event_ids, title, google_doc_id, google_doc_url)
       VALUES (?, ?, ?, ?)`,
    )
    .run(JSON.stringify(eventIds), title, documentId, url);

  return {
    id: Number(result.lastInsertRowid),
    title,
    googleDocId: documentId,
    googleDocUrl: url,
    whatsappMessage: buildWhatsappMessage(url),
  };
}

export function listCommunications(): CommunicationRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM communications ORDER BY created_at DESC")
    .all() as unknown as CommunicationRow[];
}

/** Elimina la comunicazione: rimuove il file da Drive e la riga dallo storico. */
export async function deleteCommunication(id: number): Promise<void> {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM communications WHERE id = ?")
    .get(id) as CommunicationRow | undefined;
  if (!row) {
    throw new Error("Comunicazione non trovata");
  }

  const auth = getAuthorizedClient();
  try {
    await deleteFile(auth, row.google_doc_id);
  } catch (err) {
    // Il file potrebbe essere già stato rimosso manualmente da Drive: non
    // bloccare la pulizia dello storico locale in quel caso.
    console.warn("[communications] Impossibile eliminare il file Drive", err);
  }

  db.prepare("DELETE FROM communications WHERE id = ?").run(id);
}
