import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { config } from "../config";

let db: DatabaseSync;

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

  INSERT OR IGNORE INTO schema_version (version) VALUES (1);
`;

export function initDb(): void {
  const dbPath = path.join(config.dataDir, "gips-calcio.db");
  fs.mkdirSync(config.dataDir, { recursive: true });

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_V1);

  console.log(`[db] SQLite ready at ${dbPath}`);
}

export function getDb(): DatabaseSync {
  if (!db) {
    throw new Error("Database not initialized — call initDb() first");
  }
  return db;
}
