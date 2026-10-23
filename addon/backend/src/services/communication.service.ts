import { getDb } from "../db/schema";
import type { CommunicationRow } from "../types";
import { GoogleAuthRequiredError, withGoogleAuth } from "./google/auth";
import { createStyledDocument, replaceStyledDocument } from "./google/docs";
import { documentStyles } from "./google/document-styles";
import { DocumentBuilder } from "./google/DocumentBuilder";
import { deleteFile, ensureCommunicationsFolder, makeShareableAndGetLink, moveFileToFolder } from "./google/drive";
import { getSetting, getTeamName, SETTINGS_KEYS } from "./settings.service";
import { buildCommunicationContent, loadEventTypes, loadLiveEvents } from "./communication-content";
import { isNotionActive, notionStatus, publishNotion, NotionError, saveNotionSettings } from "./notion.service";

function buildStyledDocument(events: Parameters<typeof buildCommunicationContent>[0], eventTypes: Parameters<typeof buildCommunicationContent>[1]) {
  const content = buildCommunicationContent(events, eventTypes);
  const builder = new DocumentBuilder();
  for (const paragraph of content.paragraphs) {
    const base = documentStyles[paragraph.kind];
    builder.addParagraph(paragraph.text, paragraph.past ? {
      ...base, textStyle: { ...base.textStyle, strikethrough: true,
        foregroundColor: { color: { rgbColor: { red: 0.48, green: 0.48, blue: 0.48 } } } },
    } : base);
  }
  return { title: content.title, builder };
}

export interface LiveCommunication {
  title: string;
  provider: "google" | "notion";
  requiresPageSetup?: boolean;
  documentId: string;
  url: string;
  publicUrl?: string;
  lastError?: string | null;
  googleDocId?: string;
  googleDocUrl?: string;
  updatedAt: string;
}

export interface RefreshLiveCommunicationOptions {
  /** Crea intenzionalmente un nuovo documento e aggiorna il link salvato. */
  recreate?: boolean;
  force?: boolean;
}

// Gli aggiornamenti possono arrivare dal pulsante, dal salvataggio di un
// evento e dal job giornaliero. Serializzarli evita che due sostituzioni del
// body leggano lo stesso contenuto e lo inseriscano entrambe.
let liveRefreshQueue: Promise<void> = Promise.resolve();

/** Evita di cambiare pagina o token mentre una pubblicazione è in corso. */
export function configureNotion(input: Parameters<typeof saveNotionSettings>[0]) {
  const save = liveRefreshQueue.then(() => saveNotionSettings(input));
  liveRefreshQueue = save.then(() => undefined, () => undefined);
  return save;
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
    message?: unknown;
    errors?: Array<{ reason?: unknown }>;
  };
  return (
    Number(candidate.code) === 404 ||
    Number(candidate.response?.status) === 404 ||
    candidate.errors?.some((item) => item.reason === "notFound") === true ||
    (typeof candidate.message === "string" && /not found/i.test(candidate.message))
  );
}


function savedLiveCommunication(): LiveCommunication | null {
  const googleDocId = getSetting(SETTINGS_KEYS.googleLiveDocId);
  const googleDocUrl = getSetting(SETTINGS_KEYS.googleLiveDocUrl);
  if (!googleDocId || !googleDocUrl) return null;
  return {
    title: getSetting(SETTINGS_KEYS.googleLiveDocTitle) ?? `${getTeamName()} – Appuntamenti`,
    provider: "google",
    documentId: googleDocId,
    url: googleDocUrl,
    googleDocId,
    googleDocUrl,
    updatedAt: getSetting(SETTINGS_KEYS.googleLiveDocUpdatedAt) ?? "",
  };
}

/** Restituisce il documento unico, se è già stato creato o adottato. */
export function getLiveCommunication(): LiveCommunication | null {
  if (isNotionActive()) {
    const status = notionStatus();
    return status.configured ? {
      title: `${getTeamName()} – Appuntamenti`, provider: "notion", requiresPageSetup: status.requiresPageSetup, documentId: status.pageId,
      url: status.pageUrl, publicUrl: status.publicUrl, updatedAt: status.updatedAt, lastError: status.lastError,
    } : null;
  }
  return savedLiveCommunication();
}

/**
 * Crea una sola volta, quindi aggiorna sempre lo stesso Google Doc. Il body è
 * completamente rigenerato: conserva solo l'ultimo appuntamento passato
 * (in grigio e barrato), l'evento odierno e quelli futuri.
 */
export function refreshLiveCommunication(
  options: RefreshLiveCommunicationOptions = {},
): Promise<LiveCommunication> {
  const refresh = liveRefreshQueue.then(() => refreshLiveCommunicationNow(options));
  liveRefreshQueue = refresh.then(
    () => undefined,
    () => undefined,
  );
  return refresh;
}

async function refreshLiveCommunicationNow(
  { recreate = false, force = false }: RefreshLiveCommunicationOptions,
): Promise<LiveCommunication> {
  const db = getDb();
  const events = loadLiveEvents();
  const eventTypes = loadEventTypes();
  if (isNotionActive()) {
    if (recreate) throw new NotionError("Per cambiare pagina collega una nuova pagina Notion nelle Impostazioni, quindi pubblicala e aggiorna il link pubblico.");
    await publishNotion(buildCommunicationContent(events, eventTypes), force);
    return getLiveCommunication()!;
  }
  const built = buildStyledDocument(events, eventTypes);
  let existing = recreate ? null : savedLiveCommunication();

  // Al primo aggiornamento riutilizziamo l'ultimo documento già generato,
  // così le installazioni esistenti mantengono il link già condiviso.
  if (!existing && !recreate) {
    const latest = db
      .prepare("SELECT * FROM communications ORDER BY created_at DESC LIMIT 1")
      .get() as CommunicationRow | undefined;
    if (latest) {
      existing = {
        title: latest.title,
        provider: "google",
        documentId: latest.google_doc_id,
        url: latest.google_doc_url,
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
    const url = await makeShareableAndGetLink(auth, documentId);
    return {
      title: built.title,
      provider: "google" as const,
      documentId: documentId,
      url,
      googleDocId: documentId,
      googleDocUrl: url,
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
    ).run(SETTINGS_KEYS.googleLiveDocId, live.documentId);
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(SETTINGS_KEYS.googleLiveDocUrl, live.url);
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
