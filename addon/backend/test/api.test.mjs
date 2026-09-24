import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "teams-manager-test-"));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.GROQ_API_KEY = "";
process.env.XAI_API_KEY = "";

// Simula un database creato prima delle migrazioni versionate.
const legacyDb = new DatabaseSync(path.join(dataDir, "teams-manager.db"));
legacyDb.exec(`
  CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  INSERT INTO schema_version (version) VALUES (1);
  CREATE TABLE players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT, secondary_roles TEXT NOT NULL DEFAULT '[]', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT, end_time TEXT, location TEXT, address TEXT, opponent TEXT, meeting_time TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'scheduled', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, player_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'present', UNIQUE(event_id, player_id));
`);
legacyDb.close();

const { closeDb, getDb, initDb } = await import("../dist/db/schema.js");
const { app } = await import("../dist/index.js");

let server;
let baseUrl;

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const body = response.status === 204 ? undefined : await response.json();
  return { response, body };
}

before(async () => {
  initDb();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

test("health endpoint reports the running service", async () => {
  const { response, body } = await request("/api/health");
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(typeof body.version, "string");
});

test("database migrations reach the latest schema and pass integrity validation", () => {
  const versions = getDb().prepare("SELECT version FROM schema_version ORDER BY version").all();
  assert.deepEqual(versions.map((row) => row.version), [1, 2, 3, 4]);
  const integrity = getDb().prepare("PRAGMA integrity_check").get();
  assert.equal(integrity.integrity_check, "ok");
});

test("legacy databases are backed up before migration", async () => {
  const files = await readdir(dataDir);
  assert.ok(files.some((file) => file.startsWith("teams-manager.db.backup-")));
});

test("data export contains team records but excludes OAuth credentials", async () => {
  const { response, body } = await request("/api/data/export");
  assert.equal(response.status, 200);
  assert.equal(body.format, "teams-manager-export");
  assert.equal(body.version, 1);
  assert.equal("google_tokens" in body, false);
  assert.equal("app_settings" in body, false);
  assert.ok(Array.isArray(body.players));
});

test("team name is configurable and retained in settings", async () => {
  const initial = await request("/api/settings");
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.teamName, "GIPS Salizzole");

  const updated = await request("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ teamName: "Squadra test" }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.teamName, "Squadra test");
});

test("player and event workflow is available through the API", async () => {
  const player = await request("/api/players", {
    method: "POST",
    body: JSON.stringify({
      name: "Giocatore test", role: "Centrocampista", jerseyNumber: 8, preferredFoot: "left",
      fitness: 72, speed: 81, technique: 76, shooting: 64, defending: 58, attacking: 70,
    }),
  });
  assert.equal(player.response.status, 201);
  assert.equal(player.body.preferredFoot, "left");
  assert.equal(player.body.jerseyNumber, 8);
  assert.equal(player.body.speed, 81);

  const event = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({
      type: "match",
      date: "2026-10-01",
      opponent: "Squadra test",
    }),
  });
  assert.equal(event.response.status, 201);

  const attendance = await request(`/api/events/${event.body.id}/attendance`);
  assert.equal(attendance.response.status, 200);
  assert.ok(
    attendance.body.some(
      (record) =>
        record.playerId === player.body.id &&
        record.status === "present" &&
        record.recorded === false,
    ),
  );
});

test("weekly recurrence creates independent events through the selected date", async () => {
  const { response, body } = await request("/api/events/recurring", {
    method: "POST",
    body: JSON.stringify({
      type: "training",
      date: "2026-10-07",
      startTime: "17:30",
      location: "Campo comunale",
      recurrence: { frequency: "weekly", until: "2026-10-28" },
    }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(body.created.map((event) => event.date), [
    "2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28",
  ]);
  assert.ok(body.created.every((event) => event.startTime === "17:30"));

  const invalid = await request("/api/events/recurring", {
    method: "POST",
    body: JSON.stringify({
      type: "training",
      date: "2026-10-07",
      recurrence: { frequency: "weekly", until: "2026-10-01" },
    }),
  });
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.error, /data finale/i);
});

test("unknown event types are rejected", async () => {
  const { response, body } = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({ type: "inesistente", date: "2026-10-02" }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /Tipo evento sconosciuto/);
});

test("creating a cancelled event without notes is rejected", async () => {
  const { response, body } = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({
      type: "training",
      date: "2026-10-03",
      status: "cancelled",
    }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /note sono obbligatorie/i);
});

test("attendance reports whether each record was actually saved", async () => {
  const player = await request("/api/players", {
    method: "POST",
    body: JSON.stringify({ name: "Presenze test" }),
  });
  const event = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({ type: "training", date: "2026-10-04" }),
  });
  const proposed = await request(`/api/events/${event.body.id}/attendance`);
  assert.equal(proposed.response.status, 200);
  assert.deepEqual(
    proposed.body.find((record) => record.playerId === player.body.id),
    { playerId: player.body.id, playerName: "Presenze test", status: "present", recorded: false },
  );

  await request(`/api/events/${event.body.id}/attendance`, {
    method: "PUT",
    body: JSON.stringify({
      records: [{ playerId: player.body.id, status: "absent" }],
    }),
  });

  const saved = await request(`/api/events/${event.body.id}/attendance`);
  assert.deepEqual(
    saved.body.find((record) => record.playerId === player.body.id),
    { playerId: player.body.id, playerName: "Presenze test", status: "absent", recorded: true },
  );
});

test("match results and finalized attendance are retained in player history", async () => {
  const player = await request("/api/players", {
    method: "POST",
    body: JSON.stringify({ name: "Storico risultato" }),
  });
  const event = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({ type: "match", date: "2026-10-06", opponent: "Avversari" }),
  });

  const result = await request(`/api/events/${event.body.id}/result`, {
    method: "PUT",
    body: JSON.stringify({ teamScore: 4, opponentScore: 3, venue: "away", notes: "Bella partita" }),
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, {
    eventId: event.body.id, teamScore: 4, opponentScore: 3,
    venue: "away", notes: "Bella partita", completedAt: result.body.completedAt,
  });

  const summary = await request("/api/reports/summary");
  assert.equal(summary.response.status, 200);
  assert.ok(summary.body.results.played >= 1);

  const finalized = await request(`/api/events/${event.body.id}/attendance/finalize`, {
    method: "POST",
    body: JSON.stringify({ records: [{ playerId: player.body.id, status: "present" }] }),
  });
  assert.equal(finalized.response.status, 200);
  assert.equal(typeof finalized.body.finalizedAt, "string");

  const closedUpdate = await request(`/api/events/${event.body.id}/attendance`, {
    method: "PUT",
    body: JSON.stringify({ records: [{ playerId: player.body.id, status: "absent" }] }),
  });
  assert.equal(closedUpdate.response.status, 409);

  const history = await request(`/api/players/${player.body.id}/attendance-history`);
  assert.equal(history.response.status, 200);
  assert.ok(history.body.some((item) => item.eventId === event.body.id && item.status === "present"));

  const archived = await request(`/api/players/${player.body.id}`, { method: "DELETE" });
  assert.equal(archived.response.status, 200);
  assert.equal(archived.body.archived, true);
  const activePlayers = await request("/api/players");
  assert.equal(activePlayers.body.some((item) => item.id === player.body.id), false);
  const archivedHistory = await request(`/api/players/${player.body.id}/attendance-history`);
  assert.ok(archivedHistory.body.some((item) => item.eventId === event.body.id));

  const report = await request("/api/reports/attendance", { headers: { "content-type": "application/json" } });
  assert.equal(report.response.status, 200);
  assert.ok(report.body.events.some((item) => item.id === event.body.id));
  assert.ok(report.body.records.some((item) => item.eventId === event.body.id && item.playerId === player.body.id));

  const reopened = await request(`/api/events/${event.body.id}/attendance/reopen`, { method: "POST" });
  assert.equal(reopened.response.status, 204);
  const removed = await request(`/api/events/${event.body.id}/result`, { method: "DELETE" });
  assert.equal(removed.response.status, 204);
});

test("generating a communication without a linked Google account asks to connect it", async () => {
  const event = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({ type: "training", date: "2026-10-05" }),
  });
  const { response, body } = await request("/api/communications", {
    method: "POST",
    body: JSON.stringify({ eventIds: [event.body.id] }),
  });
  assert.equal(response.status, 403);
  assert.match(body.error, /Google non è collegato/);
});

test("Google Calendar verification explains when Calendar authorization is missing", async () => {
  const { response, body } = await request("/api/google/calendar/test", {
    method: "POST",
    body: JSON.stringify({ calendarId: "primary" }),
  });
  assert.equal(response.status, 403);
  assert.match(body.error, /Ricollega Google/);
});

test("AI configuration never exposes API keys", async () => {
  const updated = await request("/api/ai/config", {
    method: "PUT",
    body: JSON.stringify({
      provider: "openai",
      model: "gpt-4o-mini",
      defaultPeriodCount: 4,
      defaultMinutesPerPeriod: 15,
      defaultPlayersOnField: 7,
      defaultRolePolicy: "preferred",
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.defaultPeriodCount, 4);
  assert.equal("apiKey" in updated.body, false);
  assert.equal("aiApiKeys" in updated.body, false);
});

test("match plans use the validated local fallback when AI is not configured", async () => {
  const roles = [
    "Portiere",
    "Difensore",
    "Difensore",
    "Centrocampista",
    "Esterno",
    "Esterno",
    "Attaccante",
  ];
  for (let index = 0; index < roles.length; index += 1) {
    const player = await request("/api/players", {
      method: "POST",
      body: JSON.stringify({
        name: `Rotazione ${index + 1}`,
        role: roles[index],
      }),
    });
    assert.equal(player.response.status, 201);
  }
  const event = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({
      type: "match",
      date: "2026-10-03",
      opponent: "Avversario rotazioni",
    }),
  });
  const generated = await request(
    `/api/events/${event.body.id}/match-plans/generate`,
    {
      method: "POST",
      body: JSON.stringify({
        periodCount: 3,
        minutesPerPeriod: 20,
        playersOnField: 7,
        rolePolicy: "preferred",
      }),
    },
  );
  assert.equal(generated.response.status, 201);
  assert.equal(generated.body.source, "fallback");
  assert.equal(generated.body.periods.length, 3);
  assert.ok(
    generated.body.periods.every((period) => period.assignments.length === 7),
  );

  const confirmed = await request(
    `/api/events/${event.body.id}/match-plans/${generated.body.id}/confirm`,
    { method: "POST" },
  );
  assert.equal(confirmed.response.status, 200);
  assert.equal(confirmed.body.status, "confirmed");

  const exportWithoutGoogle = await request(
    `/api/events/${event.body.id}/match-plans/${generated.body.id}/export`,
    { method: "POST" },
  );
  assert.equal(exportWithoutGoogle.response.status, 403);
  assert.match(exportWithoutGoogle.body.error, /Google non è collegato/);

  const removed = await request(
    `/api/events/${event.body.id}/match-plans/${generated.body.id}`,
    { method: "DELETE" },
  );
  assert.equal(removed.response.status, 204);
});
