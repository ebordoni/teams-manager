import { rowToEvent, rowToEventTypeDef } from "../db/helpers";
import { getDb } from "../db/schema";
import type {
  CommunicationRow,
  Event,
  EventRow,
  EventTypeDef,
  EventTypeDefRow,
  FormationRow,
} from "../types";
import { GoogleAuthRequiredError, withGoogleAuth } from "./google/auth";
import { createStyledDocument, replacePlaceholders } from "./google/docs";
import { documentStyles } from "./google/document-styles";
import { DocumentBuilder } from "./google/DocumentBuilder";
import {
  copyFile,
  deleteFile,
  ensureCommunicationsFolder,
  makeShareableAndGetLink,
  moveFileToFolder,
} from "./google/drive";
import { getSetting, SETTINGS_KEYS } from "./settings.service";

const FORMATION_SLOTS: Array<[string, string]> = [
  ["portiere", "Portiere"],
  ["difensoreSinistro", "Difensore sinistro"],
  ["difensoreDestro", "Difensore destro"],
  ["centrale", "Centrocampista"],
  ["fasciaSinistra", "Fascia sinistra"],
  ["fasciaDestra", "Fascia destra"],
  ["attaccante", "Attaccante"],
];

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

function getTeamPlayerNames(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT name FROM players ORDER BY name ASC",
    )
    .all() as unknown as { name: string }[];
  return rows.map((r) => r.name);
}

function getFormationLines(event: Event): string[] {
  if (!event.formationId) return [];
  const db = getDb();
  const formation = db
    .prepare("SELECT * FROM formations WHERE id = ?")
    .get(event.formationId) as FormationRow | undefined;
  if (!formation) return [];
  const assignments = JSON.parse(formation.assignments) as Record<
    string,
    number | null
  >;
  const playerIds = Object.values(assignments).filter(
    (id): id is number => id !== null,
  );
  if (playerIds.length === 0) return [];
  const players = db
    .prepare(
      `SELECT id, name FROM players WHERE id IN (${playerIds.map(() => "?").join(", ")})`,
    )
    .all(...playerIds) as Array<{ id: number; name: string }>;
  const playerNames = new Map(
    players.map((player) => [player.id, player.name]),
  );
  const lineup = FORMATION_SLOTS.flatMap(([slot, label]) => {
    const name = assignments[slot]
      ? playerNames.get(assignments[slot]!)
      : undefined;
    return name ? [`${label}: ${name}`] : [];
  });
  return lineup.length
    ? [`FORMAZIONE · ${formation.name}`, ...lineup.map((item) => `- ${item}`)]
    : [];
}

function getAttendanceLines(eventId: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT p.name AS name, a.status AS status
     FROM attendance a JOIN players p ON p.id = a.player_id
     WHERE a.event_id = ? ORDER BY p.name ASC`,
    )
    .all(eventId) as Array<{
    name: string;
    status: "present" | "absent" | "excused";
  }>;
  if (rows.length === 0) return [];
  const labels = {
    present: "Presenti",
    absent: "Assenti",
    excused: "Giustificati",
  };
  return (["present", "absent", "excused"] as const).flatMap((status) => {
    const names = rows
      .filter((row) => row.status === status)
      .map((row) => row.name);
    return names.length ? [`${labels[status]}: ${names.join(", ")}`] : [];
  });
}

function eventIcon(icon?: string): string {
  return icon?.startsWith("Icon") ? "⚽" : (icon ?? "⚽");
}

function formatEvent(
  event: Event,
  eventTypes: Map<string, EventTypeDef>,
): string {
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
    const teamPlayers = getTeamPlayerNames();
    if (teamPlayers.length > 0) {
      lines.push("");
      lines.push("CONVOCATI");
      for (const name of teamPlayers) lines.push(`- ${name}`);
    }
  }

  const formation = getFormationLines(event);
  if (formation.length > 0) lines.push("", ...formation);
  const attendance = getAttendanceLines(event.id);
  if (attendance.length > 0)
    lines.push("", "PRESENZE REGISTRATE", ...attendance);

  return lines.join("\n");
}

/** Costruisce il documento automatico con una gerarchia leggibile su mobile. */
function buildStyledDocument(
  events: Event[],
  eventTypes: Map<string, EventTypeDef>,
): { title: string; builder: DocumentBuilder } {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const title = `GIPS Salizzole – Appuntamenti dal ${formatDateIt(sorted[0].date)}`;
  const builder = new DocumentBuilder()
    .addParagraph("GIPS SALIZZOLE", documentStyles.title)
    .addParagraph(
      `Appuntamenti dal ${formatDateIt(sorted[0].date)}`,
      documentStyles.subtitle,
    );

  for (const event of sorted) {
    const typeDef = eventTypes.get(event.type);
    const eventLabel = (typeDef?.label ?? event.type).toUpperCase();

    builder
      .addParagraph(formatDateIt(event.date), documentStyles.date)
      .addParagraph(
        `${eventIcon(typeDef?.icon)} ${eventLabel}`,
        documentStyles.event,
      );

    if (event.status !== "scheduled") {
      const status = event.status === "cancelled" ? "ANNULLATO" : "MODIFICATO";
      builder.addParagraph(
        `⚠️ ${status}${event.notes ? `: ${event.notes}` : ""}`,
        documentStyles.note,
      );
    }

    if (typeDef?.hasOpponent && event.opponent) {
      builder.addParagraph(
        `GIPS Salizzole – ${event.opponent}`,
        documentStyles.match,
      );
    }
    if (event.location)
      builder.addParagraph(`📍 ${event.location}`, documentStyles.normal);
    if (event.meetingTime)
      builder.addParagraph(
        `⏰ Ritrovo: ${event.meetingTime}`,
        documentStyles.normal,
      );
    if (event.startTime) {
      builder.addParagraph(
        `⏰ Inizio: ${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`,
        documentStyles.normal,
      );
    }
    if (event.notes && event.status === "scheduled") {
      builder.addParagraph(event.notes, documentStyles.note);
    }

    if (typeDef?.hasOpponent) {
      const teamPlayers = getTeamPlayerNames();
      if (teamPlayers.length > 0) {
        builder
          .addParagraph("Convocati", documentStyles.match)
          .addParagraph(teamPlayers.join(" · "), documentStyles.normal);
      }
    }

    const formation = getFormationLines(event);
    if (formation.length > 0) {
      builder.addParagraph(formation[0], documentStyles.match);
      builder.addParagraph(
        formation.slice(1).join(" · "),
        documentStyles.normal,
      );
    }
    const attendance = getAttendanceLines(event.id);
    if (attendance.length > 0) {
      builder
        .addParagraph("Presenze registrate", documentStyles.match)
        .addParagraph(attendance.join(" · "), documentStyles.normal);
    }

    builder.addEmptyLine();
  }

  return { title, builder };
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
  const formazione =
    matches
      .map((event) => getFormationLines(event).join("\n"))
      .filter(Boolean)
      .join("\n\n") || "Nessuna formazione associata.";
  const presenze =
    sorted
      .map((event) => getAttendanceLines(event.id).join("\n"))
      .filter(Boolean)
      .join("\n\n") || "Nessuna presenza registrata.";

  return {
    title,
    replacements: {
      TITOLO: title,
      SETTIMANA: formatDateIt(sorted[0].date),
      PARTITE: partite,
      ALLENAMENTI: allenamenti,
      FORMAZIONI: formazione,
      PRESENZE: presenze,
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

/** La richiesta non è valida: nessun evento selezionato o id inesistenti. */
export class CommunicationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunicationRequestError";
  }
}

/** Errore recuperabile: la comunicazione resta nello storico locale. */
export class DriveDeletionError extends Error {
  constructor() {
    super(
      "Impossibile eliminare il documento da Google Drive. Riprova più tardi.",
    );
    this.name = "DriveDeletionError";
  }
}

function isGoogleNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    response?: { status?: unknown };
  };
  return candidate.code === 404 || candidate.response?.status === 404;
}

/** Genera un Google Doc con gli appuntamenti selezionati e lo salva su Drive. */
export async function generateCommunication(
  eventIds: number[],
): Promise<GeneratedCommunication> {
  if (eventIds.length === 0) {
    throw new CommunicationRequestError("Seleziona almeno un evento");
  }

  const db = getDb();
  const placeholders = eventIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM events WHERE id IN (${placeholders})`)
    .all(...eventIds) as unknown as EventRow[];
  if (rows.length === 0) {
    throw new CommunicationRequestError(
      "Nessun evento trovato per gli id forniti",
    );
  }
  const events = rows.map(rowToEvent);
  const eventTypes = loadEventTypes();
  const templateDocId = getSetting(SETTINGS_KEYS.googleTemplateDocId);

  const { documentId, title, url } = await withGoogleAuth(async (auth) => {
    let documentId: string;
    let title: string;

    if (templateDocId) {
      const built = buildTemplatePlaceholders(events, eventTypes);
      title = built.title;
      documentId = await copyFile(auth, templateDocId, title);
      await replacePlaceholders(auth, documentId, built.replacements);
    } else {
      const built = buildStyledDocument(events, eventTypes);
      title = built.title;
      documentId = await createStyledDocument(auth, title, built.builder);
    }

    const folderId = await ensureCommunicationsFolder(auth);
    await moveFileToFolder(auth, documentId, folderId);
    return {
      documentId,
      title,
      url: await makeShareableAndGetLink(auth, documentId),
    };
  });

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
    throw new CommunicationRequestError("Comunicazione non trovata");
  }

  try {
    await withGoogleAuth((auth) => deleteFile(auth, row.google_doc_id));
  } catch (err) {
    if (err instanceof GoogleAuthRequiredError) throw err;
    // Il file potrebbe essere già stato rimosso manualmente da Drive: non
    // bloccare la pulizia dello storico locale solo in questo caso.
    if (!isGoogleNotFoundError(err)) {
      console.error(
        "[communications] Eliminazione Drive non riuscita; storico conservato",
        err instanceof Error ? err.message : err,
      );
      throw new DriveDeletionError();
    }
    console.warn(
      "[communications] File Drive già assente; pulisco lo storico locale",
    );
  }

  db.prepare("DELETE FROM communications WHERE id = ?").run(id);
}
