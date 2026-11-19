import { createHash, randomUUID } from "node:crypto";
import { chmodSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getDb, LATEST_SCHEMA_VERSION } from "../db/schema";
import { isLiveCommunicationBusy } from "./communication.service";
import { setSetting } from "./settings.service";
import { hasPendingDataWrites } from "./data-operations.service";
import { birthDateSchema, birthdayPublicNameSchema, birthdaySettingsError } from "./birthdays.service";
import { storedPhotoSchema, validateStoredPhoto } from "./player-photo.service";

export class DataImportError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

const id = z.number().int().positive();
const text = z.string();
const nullableText = text.nullable().default(null);
const timestamp = text.max(100).refine((value) => Number.isFinite(Date.parse(value)), "Data non valida");
const createdAt = timestamp.optional();
const flag = z.union([z.literal(0), z.literal(1)]);
const venue = z.enum(["home", "away", "neutral"]);
const rating = z.number().int().min(0).max(100).default(50);
const date = text.regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Data evento non valida");

function jsonColumn(schema: z.ZodType) {
  return text.transform((value, context) => {
    try {
      if (schema.safeParse(JSON.parse(value)).success) return value;
    } catch { /* Messaggio privo di contenuti caricati dall'utente. */ }
    context.addIssue({ code: "custom", message: "Contenuto JSON non valido" });
    return z.NEVER;
  });
}

const scorerSchema = z.array(z.object({ playerId: id, goals: z.number().int().positive() }));
const assignmentSchema = z.array(z.object({ slot: text.min(1), playerId: id, role: text.min(1) }));
const formationSchema = z.record(z.string(), id.nullable());
const backupSchema = z.object({
  format: z.literal("teams-manager-export"), version: z.literal(1), exportedAt: timestamp,
  schemaVersion: z.number().int().min(1).max(LATEST_SCHEMA_VERSION),
  players: z.array(z.object({
    id, name: text.min(1), role: nullableText, secondary_roles: jsonColumn(z.array(text)).default("[]"),
    photo: storedPhotoSchema.nullable().default(null), birth_date: birthDateSchema.nullable().default(null), birthday_public_name: birthdayPublicNameSchema.nullable().default(null),
    jersey_number: z.number().int().min(1).max(99).nullable().default(null),
    preferred_foot: z.enum(["right", "left", "both"]).default("both"),
    fitness: rating, speed: rating, technique: rating, shooting: rating, defending: rating, attacking: rating,
    notes: nullableText, archived_at: timestamp.nullable().default(null), created_at: createdAt,
  })),
  eventTypes: z.array(z.object({
    id, key: text.min(1), label: text.min(1), icon: text.min(1).default("IconBallFootball"),
    has_opponent: flag.default(0), include_in_google_doc: flag.default(1), sort_order: z.number().int().default(0),
  })),
  events: z.array(z.object({
    id, type: text.min(1), date, start_time: nullableText, end_time: nullableText,
    location: nullableText, address: nullableText, opponent: nullableText, venue: venue.default("home"),
    meeting_time: nullableText, notes: nullableText, status: z.enum(["scheduled", "modified", "cancelled"]),
    formation_id: id.nullable().default(null), attendance_finalized_at: timestamp.nullable().default(null), created_at: createdAt,
  })),
  attendance: z.array(z.object({ id, event_id: id, player_id: id, status: z.enum(["present", "absent", "excused"]) })),
  results: z.array(z.object({
    event_id: id, team_score: z.number().int().nonnegative(), opponent_score: z.number().int().nonnegative(),
    venue: venue.default("home"), scorers: jsonColumn(scorerSchema).default("[]"), notes: nullableText, completed_at: createdAt,
  })),
  formations: z.array(z.object({ id, name: text.min(1), system: text.min(1), assignments: jsonColumn(formationSchema), created_at: createdAt })),
  matchPlans: z.array(z.object({
    id, event_id: id, name: text.min(1), period_count: z.number().int().min(1).max(12),
    minutes_per_period: z.number().int().min(1).max(90), players_on_field: z.number().int().min(2).max(11),
    system: text.min(1), role_policy: z.enum(["strict", "preferred", "free"]),
    source: z.enum(["ai", "fallback", "manual"]), provider: nullableText, model: nullableText,
    status: z.enum(["draft", "confirmed"]), warnings: jsonColumn(z.array(text)), created_at: createdAt, updated_at: createdAt,
  })),
  matchPeriods: z.array(z.object({
    id, match_plan_id: id, period_number: id, assignments: jsonColumn(assignmentSchema), bench_player_ids: jsonColumn(z.array(id)),
  })),
});
type Backup = z.infer<typeof backupSchema>;

const tables = {
  players: "players", eventTypes: "event_types", formations: "formations", events: "events",
  attendance: "attendance", results: "match_results", matchPlans: "match_plans", matchPeriods: "match_periods",
} as const;
type Collection = keyof typeof tables;
const collectionNames = Object.keys(tables) as Collection[];
const counts = (backup: Record<Collection, readonly unknown[]>) => Object.fromEntries(collectionNames.map((key) => [key, backup[key].length]));

export function createDataExport() {
  const db = getDb();
  return {
    format: "teams-manager-export", version: 1, exportedAt: new Date().toISOString(),
    schemaVersion: LATEST_SCHEMA_VERSION,
    players: db.prepare("SELECT * FROM players ORDER BY id").all(),
    eventTypes: db.prepare("SELECT * FROM event_types ORDER BY sort_order, id").all(),
    events: db.prepare("SELECT * FROM events ORDER BY date, id").all(),
    attendance: db.prepare("SELECT * FROM attendance ORDER BY event_id, player_id").all(),
    results: db.prepare("SELECT * FROM match_results ORDER BY event_id").all(),
    formations: db.prepare("SELECT * FROM formations ORDER BY id").all(),
    matchPlans: db.prepare("SELECT * FROM match_plans ORDER BY id").all(),
    matchPeriods: db.prepare("SELECT * FROM match_periods ORDER BY match_plan_id, period_number").all(),
  };
}

function currentRevision() {
  const { exportedAt: _timestamp, ...snapshot } = createDataExport();
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function unique(values: Array<string | number>, label: string) {
  if (new Set(values).size !== values.length) throw new DataImportError(`Il file contiene duplicati: ${label}.`);
}
function references(ids: Array<number | null>, known: Set<number>, label: string) {
  if (ids.some((value) => value !== null && !known.has(value))) throw new DataImportError(`Riferimento inesistente nel file: ${label}.`);
}

async function validateBackup(input: unknown): Promise<Backup> {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.map(String).join(".") || "formato";
    throw new DataImportError(`File di backup non valido (${field}). Usa un export JSON di Teams Manager compatibile con questa versione.`);
  }
  const data = parsed.data;
  for (const player of data.players) {
    const error = birthdaySettingsError(player.birth_date, player.birthday_public_name);
    if (error) throw new DataImportError(error);
    if (player.photo) {
      try { await validateStoredPhoto(player.photo); }
      catch { throw new DataImportError("Il file contiene una foto giocatore non valida o troppo grande."); }
    }
  }
  for (const key of collectionNames.filter((name) => name !== "results")) unique((data[key] as Array<{ id: number }>).map((row) => row.id), key);
  unique(data.eventTypes.map((row) => row.key), "tipi evento");
  unique(data.players.flatMap((row) => row.jersey_number === null ? [] : [row.jersey_number]), "numeri di maglia");
  unique(data.attendance.map((row) => `${row.event_id}:${row.player_id}`), "presenze");
  unique(data.results.map((row) => row.event_id), "risultati");
  unique(data.matchPeriods.map((row) => `${row.match_plan_id}:${row.period_number}`), "tempi partita");
  const playerIds = new Set(data.players.map((row) => row.id));
  const eventIds = new Set(data.events.map((row) => row.id));
  const formationIds = new Set(data.formations.map((row) => row.id));
  const planIds = new Set(data.matchPlans.map((row) => row.id));
  const typeKeys = new Set(data.eventTypes.map((row) => row.key));
  if (data.events.some((row) => !typeKeys.has(row.type))) throw new DataImportError("Il file contiene eventi con un tipo inesistente.");
  references(data.events.map((row) => row.formation_id), formationIds, "formazioni degli eventi");
  references(data.attendance.map((row) => row.event_id), eventIds, "eventi delle presenze");
  references(data.attendance.map((row) => row.player_id), playerIds, "giocatori delle presenze");
  references(data.results.map((row) => row.event_id), eventIds, "eventi dei risultati");
  references(data.matchPlans.map((row) => row.event_id), eventIds, "eventi dei piani partita");
  references(data.matchPeriods.map((row) => row.match_plan_id), planIds, "piani dei tempi partita");
  for (const row of data.formations) {
    const assignments = Object.values(JSON.parse(row.assignments) as Record<string, number | null>).filter((value): value is number => value !== null);
    references(assignments, playerIds, "giocatori delle formazioni");
    unique(assignments, "giocatori delle formazioni");
  }
  for (const row of data.results) {
    const scorers = JSON.parse(row.scorers) as Array<{ playerId: number; goals: number }>;
    references(scorers.map((scorer) => scorer.playerId), playerIds, "marcatori");
    unique(scorers.map((scorer) => scorer.playerId), "marcatori");
    if (scorers.reduce((sum, scorer) => sum + scorer.goals, 0) > row.team_score) throw new DataImportError("I gol dei marcatori superano il risultato della squadra.");
  }
  const plans = new Map(data.matchPlans.map((row) => [row.id, row]));
  for (const row of data.matchPeriods) {
    const assignments = JSON.parse(row.assignments) as Array<{ slot: string; playerId: number }>;
    const bench = JSON.parse(row.bench_player_ids) as number[];
    references([...assignments.map((item) => item.playerId), ...bench], playerIds, "giocatori dei tempi partita");
    unique([...assignments.map((item) => item.playerId), ...bench], "giocatori dei tempi partita");
    unique(assignments.map((item) => item.slot), "posizioni dei tempi partita");
    const plan = plans.get(row.match_plan_id)!;
    if (row.period_number > plan.period_count || assignments.length > plan.players_on_field) throw new DataImportError("Tempi partita incompatibili con il piano.");
  }
  return data;
}

export async function previewDataImport(input: unknown) {
  const backup = await validateBackup(input);
  return {
    exportedAt: backup.exportedAt, counts: counts(backup),
    currentCounts: counts(createDataExport()), expectedRevision: currentRevision(),
  };
}

export async function importData(input: unknown, expectedRevision: string) {
  const backup = await validateBackup(input);
  if (isLiveCommunicationBusy() || hasPendingDataWrites()) throw new DataImportError("Una pubblicazione o generazione è in corso. Attendi il completamento prima di importare.", 409);
  if (expectedRevision !== currentRevision()) throw new DataImportError("I dati sono cambiati dopo l'anteprima. Seleziona di nuovo il file e verifica il riepilogo.", 409);
  const db = getDb();
  const database = db.prepare("PRAGMA database_list").all().find((row) => row.name === "main") as { file: string };
  const backupFile = `teams-manager.pre-import-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.db`;
  try {
    const destination = path.join(path.dirname(database.file), backupFile);
    const previousMask = process.umask(0o077);
    try {
      db.prepare("VACUUM main INTO ?").run(destination);
      chmodSync(destination, 0o600);
    } finally { process.umask(previousMask); }
  } catch {
    throw new DataImportError("Impossibile creare il backup di sicurezza. Nessun dato è stato modificato. Verifica lo spazio e i permessi della cartella dati.", 500);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    if (expectedRevision !== currentRevision()) throw new DataImportError("I dati sono cambiati dopo l'anteprima. Ripeti la verifica.", 409);
    for (const key of [...collectionNames].reverse()) db.exec(`DELETE FROM ${tables[key]}`);
    for (const key of collectionNames) {
      const rows = backup[key] as unknown as Array<Record<string, string | number | null | undefined>>;
      if (!rows.length) continue;
      const columns = [...new Set(rows.flatMap(Object.keys))];
      // Nomi di colonne provenienti esclusivamente dallo schema validato, mai dal JSON grezzo.
      const insert = db.prepare(`INSERT INTO ${tables[key]} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
      for (const row of rows) insert.run(...columns.map((column) => row[column] ?? (column.endsWith("_at") && column !== "archived_at" && column !== "attendance_finalized_at" ? backup.exportedAt : null)));
    }
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Riferimenti non validi");
    // I collegamenti e i segreti rimangono invariati. Nessuna scrittura remota fino a conferma manuale.
    setSetting("communication_import_paused", "true");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    if (error instanceof DataImportError) throw error;
    throw new DataImportError("Importazione non riuscita. I dati precedenti sono stati mantenuti.", 500);
  }
  return { imported: counts(backup), backupFile, communicationsPaused: true };
}
