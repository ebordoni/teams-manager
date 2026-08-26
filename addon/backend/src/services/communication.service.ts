import { getAuthorizedClient } from "./google/auth";
import { createDocumentWithText } from "./google/docs";
import {
  ensureCommunicationsFolder,
  makeShareableAndGetLink,
  moveFileToFolder,
} from "./google/drive";
import { getDb } from "../db/schema";
import { rowToEvent } from "../db/helpers";
import type { CommunicationRow, Event, EventRow, EventType } from "../types";

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  training: "ALLENAMENTO",
  match: "PARTITA",
  tournament: "TORNEO",
};

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

function formatEvent(event: Event): string {
  const lines: string[] = [];
  const header = `${formatDateIt(event.date)} — ${EVENT_TYPE_LABEL[event.type]}`;
  lines.push(header);

  if (event.status !== "scheduled") {
    lines.push(
      `⚠️ ${event.status === "cancelled" ? "ANNULLATO" : "MODIFICATO"}${
        event.notes ? `: ${event.notes}` : ""
      }`,
    );
  }

  if (event.type === "match" && event.opponent) {
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

  if (event.type !== "training") {
    const callups = getCallupNames(event.id);
    if (callups.length > 0) {
      lines.push("");
      lines.push("CONVOCATI");
      for (const name of callups) lines.push(`- ${name}`);
    }
  }

  return lines.join("\n");
}

function buildDocumentText(events: Event[]): { title: string; body: string } {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const title = `GIPS Salizzole – Appuntamenti dal ${formatDateIt(sorted[0].date)}`;
  const body = [
    "GIPS SALIZZOLE – APPUNTAMENTI",
    "",
    ...sorted.flatMap((event, i) => [
      formatEvent(event),
      ...(i < sorted.length - 1 ? ["", "---", ""] : []),
    ]),
  ].join("\n");
  return { title, body };
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

  const auth = getAuthorizedClient();
  const { title, body } = buildDocumentText(events);

  const documentId = await createDocumentWithText(auth, title, body);
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
