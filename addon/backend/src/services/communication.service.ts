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
import { createStyledDocument, replaceStyledDocument } from "./google/docs";
import { documentStyles } from "./google/document-styles";
import { DocumentBuilder } from "./google/DocumentBuilder";
import {
  deleteFile,
  ensureCommunicationsFolder,
  makeShareableAndGetLink,
  moveFileToFolder,
} from "./google/drive";
import { areMatchCallupsEnabled, getSetting, getTeamName, SETTINGS_KEYS } from "./settings.service";

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
    .prepare("SELECT name FROM players ORDER BY name ASC")
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

function eventIcon(icon?: string): string {
  return icon?.startsWith("Icon") ? "⚽" : (icon ?? "⚽");
}

/** Costruisce il documento automatico con una gerarchia leggibile su mobile. */
function buildStyledDocument(
  events: Event[],
  eventTypes: Map<string, EventTypeDef>,
): { title: string; builder: DocumentBuilder } {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const teamName = getTeamName();
  const today = todayIso();
  const title = `${teamName} – Appuntamenti`;
  const builder = new DocumentBuilder()
    .addParagraph(teamName.toLocaleUpperCase("it-IT"), documentStyles.title)
    .addParagraph(
      "Appuntamenti di squadra",
      documentStyles.subtitle,
    );

  for (const event of sorted) {
    const typeDef = eventTypes.get(event.type);
    const eventLabel = (typeDef?.label ?? event.type).toUpperCase();
    const style = <T extends { textStyle?: object }>(base: T): T =>
      event.date < today
        ? {
            ...base,
            textStyle: {
              ...base.textStyle,
              foregroundColor: {
                color: { rgbColor: { red: 0.48, green: 0.48, blue: 0.48 } },
              },
            },
          }
        : base;

    builder
      .addParagraph(formatDateIt(event.date), style(documentStyles.date))
      .addParagraph(
        `${eventIcon(typeDef?.icon)} ${eventLabel}`,
        style(documentStyles.event),
      );

    if (event.status !== "scheduled") {
      const status = event.status === "cancelled" ? "ANNULLATO" : "MODIFICATO";
      builder.addParagraph(
        `⚠️ ${status}${event.notes ? `: ${event.notes}` : ""}`,
        style(documentStyles.note),
      );
    }

    if (typeDef?.hasOpponent && event.opponent) {
      builder.addParagraph(
        `${teamName} – ${event.opponent}`,
        style(documentStyles.match),
      );
    }
    if (event.location)
      builder.addParagraph(`📍 ${event.location}`, style(documentStyles.normal));
    if (event.meetingTime)
      builder.addParagraph(
        `⏰ Ritrovo: ${event.meetingTime}`,
        style(documentStyles.normal),
      );
    if (event.startTime) {
      builder.addParagraph(
        `⏰ Inizio: ${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`,
        style(documentStyles.normal),
      );
    }
    if (event.notes && event.status === "scheduled") {
      builder.addParagraph(event.notes, style(documentStyles.note));
    }

    if (typeDef?.hasOpponent && areMatchCallupsEnabled()) {
      const teamPlayers = getTeamPlayerNames();
      if (teamPlayers.length > 0) {
        builder
          .addParagraph("Convocati", style(documentStyles.match))
          .addParagraph(teamPlayers.join(" · "), style(documentStyles.normal));
      }
    }

    const formation = getFormationLines(event);
    if (formation.length > 0) {
      builder.addParagraph(formation[0], style(documentStyles.match));
      builder.addParagraph(
        formation.slice(1).join(" · "),
        style(documentStyles.normal),
      );
    }
    builder.addEmptyLine();
  }

  return { title, builder };
}

function todayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export interface LiveCommunication {
  title: string;
  googleDocId: string;
  googleDocUrl: string;
  updatedAt: string;
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

function loadLiveEvents(): Event[] {
  const db = getDb();
  const today = todayIso();
  const recentPast = db
    .prepare(
      "SELECT * FROM events WHERE date < ? ORDER BY date DESC, start_time DESC LIMIT 2",
    )
    .all(today) as unknown as EventRow[];
  const currentAndFuture = db
    .prepare(
      "SELECT * FROM events WHERE date >= ? ORDER BY date ASC, start_time ASC",
    )
    .all(today) as unknown as EventRow[];
  return [...recentPast.reverse(), ...currentAndFuture].map(rowToEvent);
}

function savedLiveCommunication(): LiveCommunication | null {
  const googleDocId = getSetting(SETTINGS_KEYS.googleLiveDocId);
  const googleDocUrl = getSetting(SETTINGS_KEYS.googleLiveDocUrl);
  if (!googleDocId || !googleDocUrl) return null;
  return {
    title: getSetting(SETTINGS_KEYS.googleLiveDocTitle) ?? `${getTeamName()} – Appuntamenti`,
    googleDocId,
    googleDocUrl,
    updatedAt: getSetting(SETTINGS_KEYS.googleLiveDocUpdatedAt) ?? "",
  };
}

/** Restituisce il documento unico, se è già stato creato o adottato. */
export function getLiveCommunication(): LiveCommunication | null {
  return savedLiveCommunication();
}

/**
 * Crea una sola volta, quindi aggiorna sempre lo stesso Google Doc. Il body è
 * completamente rigenerato: conserva solo i due appuntamenti passati più
 * recenti (in grigio), l'evento odierno e quelli futuri.
 */
export async function refreshLiveCommunication(): Promise<LiveCommunication> {
  const db = getDb();
  const events = loadLiveEvents();
  const eventTypes = loadEventTypes();
  const built = buildStyledDocument(events, eventTypes);
  let existing = savedLiveCommunication();

  // Al primo aggiornamento riutilizziamo l'ultimo documento già generato,
  // così le installazioni esistenti mantengono il link già condiviso.
  if (!existing) {
    const latest = db
      .prepare("SELECT * FROM communications ORDER BY created_at DESC LIMIT 1")
      .get() as CommunicationRow | undefined;
    if (latest) {
      existing = {
        title: latest.title,
        googleDocId: latest.google_doc_id,
        googleDocUrl: latest.google_doc_url,
        updatedAt: latest.created_at,
      };
    }
  }

  const live = await withGoogleAuth(async (auth) => {
    let documentId = existing?.googleDocId;
    if (documentId) {
      try {
        await replaceStyledDocument(auth, documentId, built.builder);
      } catch (error) {
        if (!isGoogleNotFoundError(error)) throw error;
        documentId = undefined;
      }
    }
    if (!documentId) {
      documentId = await createStyledDocument(auth, built.title, built.builder);
      const folderId = await ensureCommunicationsFolder(auth);
      await moveFileToFolder(auth, documentId, folderId);
    }
    return {
      title: built.title,
      googleDocId: documentId,
      googleDocUrl: await makeShareableAndGetLink(auth, documentId),
      updatedAt: new Date().toISOString(),
    };
  });

  setLiveCommunication(live);
  return live;
}

function setLiveCommunication(live: LiveCommunication): void {
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(SETTINGS_KEYS.googleLiveDocId, live.googleDocId);
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(SETTINGS_KEYS.googleLiveDocUrl, live.googleDocUrl);
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(SETTINGS_KEYS.googleLiveDocTitle, live.title);
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(SETTINGS_KEYS.googleLiveDocUpdatedAt, live.updatedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Retrocompatibilità: le vecchie chiamate ora aggiornano il documento unico. */
export async function generateCommunication(eventIds: number[]): Promise<LiveCommunication> {
  if (eventIds.length === 0) {
    throw new CommunicationRequestError("Seleziona almeno un evento");
  }
  return refreshLiveCommunication();
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
