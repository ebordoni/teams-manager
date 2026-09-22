import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { config } from "../config";

let db: DatabaseSync | undefined;

const SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS players (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    role            TEXT,
    secondary_roles TEXT    NOT NULL DEFAULT '[]',
    notes           TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    type          TEXT    NOT NULL, -- training | match | tournament
    date          TEXT    NOT NULL, -- YYYY-MM-DD
    start_time    TEXT,
    end_time      TEXT,
    location      TEXT,
    address       TEXT,
    opponent      TEXT,
    meeting_time  TEXT,
    notes         TEXT,
    status        TEXT    NOT NULL DEFAULT 'scheduled', -- scheduled | modified | cancelled
    formation_id  INTEGER REFERENCES formations(id) ON DELETE SET NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

  CREATE TABLE IF NOT EXISTS callups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    called_up   INTEGER NOT NULL DEFAULT 1,
    UNIQUE(event_id, player_id)
  );

  CREATE INDEX IF NOT EXISTS idx_callups_event  ON callups(event_id);
  CREATE INDEX IF NOT EXISTS idx_callups_player ON callups(player_id);

  CREATE TABLE IF NOT EXISTS attendance (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status      TEXT    NOT NULL DEFAULT 'present', -- present | absent | excused
    UNIQUE(event_id, player_id)
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_event  ON attendance(event_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_player ON attendance(player_id);

  -- Riga singola (id = 1): token OAuth 2.0 dell'account Google collegato.
  CREATE TABLE IF NOT EXISTS google_tokens (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    access_token  TEXT,
    refresh_token TEXT,
    scope         TEXT,
    token_type    TEXT,
    expiry_date   INTEGER,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS communications (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event_ids      TEXT    NOT NULL, -- JSON array di event id inclusi
    title          TEXT    NOT NULL,
    google_doc_id  TEXT    NOT NULL,
    google_doc_url TEXT    NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Tipi di evento configurabili dall'utente (sostituisce l'enum fisso iniziale).
  CREATE TABLE IF NOT EXISTS event_types (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    key          TEXT    NOT NULL UNIQUE,
    label        TEXT    NOT NULL,
    icon         TEXT    NOT NULL DEFAULT '\u26bd',
    has_opponent INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0
  );

  -- Coppie chiave/valore per impostazioni runtime (es. id del template Google Doc).
  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  -- Mappa locale per aggiornare gli eventi già esportati su Google Calendar.
  CREATE TABLE IF NOT EXISTS google_calendar_exports (
    event_id        INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    google_event_id TEXT NOT NULL,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS formations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    system      TEXT NOT NULL DEFAULT '2-3-1',
    assignments TEXT NOT NULL DEFAULT '{}',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS match_plans (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id           INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    period_count       INTEGER NOT NULL,
    minutes_per_period INTEGER NOT NULL,
    players_on_field   INTEGER NOT NULL,
    system             TEXT NOT NULL DEFAULT '2-3-1',
    role_policy        TEXT NOT NULL DEFAULT 'preferred',
    source             TEXT NOT NULL DEFAULT 'ai',
    provider           TEXT,
    model              TEXT,
    status             TEXT NOT NULL DEFAULT 'draft',
    warnings           TEXT NOT NULL DEFAULT '[]',
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_match_plans_event ON match_plans(event_id);

  CREATE TABLE IF NOT EXISTS match_periods (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    match_plan_id    INTEGER NOT NULL REFERENCES match_plans(id) ON DELETE CASCADE,
    period_number    INTEGER NOT NULL,
    assignments      TEXT NOT NULL DEFAULT '[]',
    bench_player_ids TEXT NOT NULL DEFAULT '[]',
    UNIQUE(match_plan_id, period_number)
  );

  INSERT OR IGNORE INTO schema_version (version) VALUES (1);
`;

export function initDb(): void {
  const dbPath = path.join(config.dataDir, "gips-calcio.db");
  fs.mkdirSync(config.dataDir, { recursive: true });

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_V1);
  ensureColumn("events", "formation_id", "INTEGER REFERENCES formations(id) ON DELETE SET NULL");
  seedDefaultEventTypes();

  console.log(`[db] SQLite ready at ${dbPath}`);
}

function ensureColumn(table: string, column: string, definition: string): void {
  const database = getDb();
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function seedDefaultEventTypes(): void {
  const database = getDb();
  const count = database.prepare("SELECT COUNT(*) AS n FROM event_types").get() as {
    n: number;
  };
  if (count.n > 0) return;

  const insert = database.prepare(
    `INSERT INTO event_types (key, label, icon, has_opponent, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  );
  insert.run("training", "Allenamento", "IconRun", 0, 0);
  insert.run("match", "Partita", "IconBallFootball", 1, 1);
  insert.run("tournament", "Torneo", "IconTrophy", 1, 2);
}

export function getDb(): DatabaseSync {
  if (!db) {
    throw new Error("Database not initialized — call initDb() first");
  }
  return db;
}

/** Chiude il database, utile per i test e per uno shutdown controllato. */
export function closeDb(): void {
  db?.close();
  db = undefined;
}
