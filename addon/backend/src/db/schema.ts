import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { config } from "../config";

let db: DatabaseSync | undefined;
const LATEST_SCHEMA_VERSION = 4;

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
    jersey_number  INTEGER UNIQUE CHECK (jersey_number BETWEEN 1 AND 99),
    preferred_foot  TEXT    NOT NULL DEFAULT 'both',
    fitness         INTEGER NOT NULL DEFAULT 50,
    speed           INTEGER NOT NULL DEFAULT 50,
    technique       INTEGER NOT NULL DEFAULT 50,
    shooting        INTEGER NOT NULL DEFAULT 50,
    defending       INTEGER NOT NULL DEFAULT 50,
    attacking       INTEGER NOT NULL DEFAULT 50,
    notes           TEXT,
    archived_at     DATETIME,
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
    attendance_finalized_at DATETIME,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

  CREATE TABLE IF NOT EXISTS attendance (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status      TEXT    NOT NULL DEFAULT 'present', -- present | absent | excused
    UNIQUE(event_id, player_id)
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_event  ON attendance(event_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_player ON attendance(player_id);

  CREATE TABLE IF NOT EXISTS match_results (
    event_id       INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    team_score     INTEGER NOT NULL CHECK (team_score >= 0),
    opponent_score INTEGER NOT NULL CHECK (opponent_score >= 0),
    venue          TEXT NOT NULL DEFAULT 'home' CHECK (venue IN ('home', 'away', 'neutral')),
    notes          TEXT,
    completed_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

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
    icon         TEXT    NOT NULL DEFAULT 'IconBallFootball',
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
  fs.mkdirSync(config.dataDir, { recursive: true });

  const currentDbPath = path.join(config.dataDir, "teams-manager.db");
  const legacyDbPath = path.join(config.dataDir, "gips-calcio.db");
  // Le installazioni precedenti continuano a usare il loro database senza
  // spostamenti impliciti; le nuove installazioni adottano il nome corrente.
  const dbPath = fs.existsSync(currentDbPath) || !fs.existsSync(legacyDbPath)
    ? currentDbPath
    : legacyDbPath;
  const databaseAlreadyExists = fs.existsSync(dbPath);

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_V1);
  applyMigrations(dbPath, databaseAlreadyExists);
  assertIntegrity();
  seedDefaultEventTypes();

  console.log(`[db] SQLite ready at ${dbPath}`);
}

const migrations: Record<number, () => void> = {
  // Rende esplicite le modifiche introdotte prima del sistema versionato,
  // così tutti i database storici arrivano allo stesso schema in modo idempotente.
  2: () => {
    ensureColumn("events", "formation_id", "INTEGER REFERENCES formations(id) ON DELETE SET NULL");
    ensureColumn("events", "attendance_finalized_at", "DATETIME");
    ensureColumn("players", "preferred_foot", "TEXT NOT NULL DEFAULT 'both'");
    ensureColumn("players", "fitness", "INTEGER NOT NULL DEFAULT 50");
    ensureColumn("players", "speed", "INTEGER NOT NULL DEFAULT 50");
    ensureColumn("players", "technique", "INTEGER NOT NULL DEFAULT 50");
    ensureColumn("players", "shooting", "INTEGER NOT NULL DEFAULT 50");
    ensureColumn("players", "defending", "INTEGER NOT NULL DEFAULT 50");
    ensureColumn("players", "attacking", "INTEGER NOT NULL DEFAULT 50");
    getDb().exec(`CREATE TABLE IF NOT EXISTS match_results (
      event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      team_score INTEGER NOT NULL CHECK (team_score >= 0),
      opponent_score INTEGER NOT NULL CHECK (opponent_score >= 0),
      venue TEXT NOT NULL DEFAULT 'home' CHECK (venue IN ('home', 'away', 'neutral')),
      notes TEXT, completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  },
  // Un giocatore con presenze confermate viene archiviato, non eliminato:
  // lo storico resta così consultabile e i riferimenti non vengono cascati.
  3: () => ensureColumn("players", "archived_at", "DATETIME"),
  4: () => {
    ensureColumn("players", "jersey_number", "INTEGER CHECK (jersey_number BETWEEN 1 AND 99)");
    getDb().exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_players_jersey_number ON players(jersey_number) WHERE jersey_number IS NOT NULL");
  },
};

function applyMigrations(dbPath: string, databaseAlreadyExists: boolean): void {
  const database = getDb();
  const applied = new Set(
    (database.prepare("SELECT version FROM schema_version").all() as Array<{ version: number }>).map((row) => row.version),
  );
  const pending = Array.from({ length: LATEST_SCHEMA_VERSION - 1 }, (_, index) => index + 2)
    .filter((version) => !applied.has(version));
  if (pending.length === 0) return;

  if (databaseAlreadyExists) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${dbPath}.backup-${stamp}`;
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[db] Backup pre-migrazione creato: ${backupPath}`);
  }

  database.exec("BEGIN");
  try {
    for (const version of pending) {
      migrations[version]!();
      database.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
      console.log(`[db] Migrazione schema ${version} applicata`);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function assertIntegrity(): void {
  const result = getDb().prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  if (result.integrity_check !== "ok") {
    throw new Error(`Integrità SQLite non valida: ${result.integrity_check}`);
  }
}

function ensureColumn(table: string, column: string, definition: string): void {
  const database = getDb();
  const columns = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column))
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function seedDefaultEventTypes(): void {
  const database = getDb();
  const count = database
    .prepare("SELECT COUNT(*) AS n FROM event_types")
    .get() as {
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
