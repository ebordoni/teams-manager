import assert from "node:assert/strict";
import { mkdtemp, readdir, stat, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";

const directory = await mkdtemp(path.join(os.tmpdir(), "teams-manager-import-"));
process.env.DATA_DIR = directory;
process.env.NODE_ENV = "test";
const { initDb, getDb, closeDb } = await import("../dist/db/schema.js");
const { app } = await import("../dist/index.js");
const { getSetting, setSetting } = await import("../dist/services/settings.service.js");
const { refreshLiveCommunication, getLiveCommunication } = await import("../dist/services/communication.service.js");
const { trackDataWrite } = await import("../dist/services/data-operations.service.js");
const originalFetch = globalThis.fetch;
let server, base, backup;
const keys = ["players", "eventTypes", "events", "attendance", "results", "formations", "matchPlans", "matchPeriods"];
const records = (payload) => Object.fromEntries(keys.map((key) => [key, payload[key]]));
const backupFiles = async () => (await readdir(directory)).filter((name) => name.startsWith("teams-manager.pre-import-"));
async function api(route, body, raw = false) {
  const response = await originalFetch(`${base}/api/data/${route}`, {
    method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
}
const commit = (payload, preview, confirmed = true) => api("import", { backup: payload, expectedRevision: preview.expectedRevision, confirmReplace: confirmed });

before(async () => {
  initDb();
  const db = getDb();
  db.exec(`
    INSERT INTO players (id,name,jersey_number,preferred_foot) VALUES (10,'Giocatore importato',7,'left');
    INSERT INTO players (id,name,archived_at) VALUES (11,'Giocatore archiviato','2026-10-01 10:00:00');
    INSERT INTO formations (id,name,assignments) VALUES (20,'Formazione test','{"portiere":10}');
    INSERT INTO events (id,type,date,venue,formation_id,attendance_finalized_at) VALUES (30,'match','2026-10-10','away',20,'2026-10-10 12:00:00');
    INSERT INTO attendance (id,event_id,player_id,status) VALUES (40,30,10,'present');
    INSERT INTO match_results (event_id,team_score,opponent_score,scorers) VALUES (30,2,1,'[{"playerId":10,"goals":2}]');
    INSERT INTO match_plans (id,event_id,name,period_count,minutes_per_period,players_on_field,source) VALUES (50,30,'Piano manuale',2,15,2,'manual');
    INSERT INTO match_periods (id,match_plan_id,period_number,assignments,bench_player_ids) VALUES (60,50,1,'[{"slot":"portiere","role":"Portiere","playerId":10}]','[11]');
    INSERT INTO match_periods (id,match_plan_id,period_number,assignments,bench_player_ids) VALUES (61,50,2,'[]','[10,11]');
    INSERT INTO google_tokens (id,access_token) VALUES (1,'private-oauth-test');
    INSERT INTO app_settings (key,value) VALUES ('team_name','Nome squadra locale'),('ai_api_key','private-ai-test');
  `);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  backup = (await api("export")).data;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  await rm(directory, { recursive: true, force: true });
});

test("import preview accepts the existing export without writing or contacting integrations", async () => {
  globalThis.fetch = async () => assert.fail("preview must never call integrations");
  try {
    const preview = await api("import/preview", backup);
    assert.equal(preview.status, 200);
    assert.deepEqual(preview.data.counts, preview.data.currentCounts);
    assert.equal(preview.data.counts.players, 2);
    assert.equal(preview.data.counts.matchPeriods, 2);
    assert.match(preview.data.expectedRevision, /^[a-f0-9]{64}$/);
    assert.deepEqual(await backupFiles(), []);
    assert.deepEqual(records((await api("export")).data), records(backup));
  } finally { globalThis.fetch = originalFetch; }
});

test("invalid formats, incomplete backups, newer versions, duplicate IDs and broken references are rejected", async () => {
  const variants = [
    { ...backup, format: "other-app" }, { ...backup, version: 999 }, { ...backup, schemaVersion: 999 },
    { ...backup, players: undefined }, { ...backup, matchPeriods: undefined },
    { ...backup, players: [...backup.players, backup.players[0]] },
    { ...backup, players: backup.players.map((row) => ({ ...row, jersey_number: 7 })) },
    { ...backup, attendance: [{ ...backup.attendance[0], player_id: 999 }] },
    { ...backup, events: [{ ...backup.events[0], type: "unknown" }] },
    { ...backup, events: [{ ...backup.events[0], date: "2026-02-31" }] },
    { ...backup, events: [{ ...backup.events[0], formation_id: 999 }] },
    { ...backup, formations: [{ ...backup.formations[0], assignments: '{"portiere":999}' }] },
    { ...backup, results: [{ ...backup.results[0], scorers: "not json" }] },
    { ...backup, results: [{ ...backup.results[0], scorers: '[{"playerId":999,"goals":1}]' }] },
    { ...backup, results: [{ ...backup.results[0], team_score: 1 }] },
    { ...backup, matchPlans: [{ ...backup.matchPlans[0], event_id: 999 }] },
    { ...backup, matchPeriods: [{ ...backup.matchPeriods[0], match_plan_id: 999 }] },
    { ...backup, matchPeriods: [{ ...backup.matchPeriods[0], bench_player_ids: "[10,11]" }] },
    { ...backup, matchPeriods: [{ ...backup.matchPeriods[0], period_number: 99 }] },
  ];
  for (const variant of variants) {
    const response = await api("import/preview", variant);
    assert.equal(response.status, 400, JSON.stringify(variant));
    assert.equal(typeof response.data.error, "string");
  }
  const preview = (await api("import/preview", backup)).data;
  assert.equal((await commit(variants[7], preview)).status, 400, "commit must revalidate the file");
  assert.deepEqual(await backupFiles(), []);
  assert.deepEqual(records((await api("export")).data), records(backup));
});

test("malformed JSON and oversized requests return actionable errors without touching data", async () => {
  assert.equal((await api("import/preview", "{broken", true)).status, 400);
  const oversized = await api("import/preview", JSON.stringify({ padding: "x".repeat(5 * 1024 * 1024) }), true);
  assert.equal(oversized.status, 413);
  assert.match(oversized.data.error, /5 MB/);
  assert.deepEqual(await backupFiles(), []);
});

test("replacement requires explicit confirmation and rejects changes after preview", async () => {
  const preview = (await api("import/preview", backup)).data;
  assert.equal((await commit(backup, preview, false)).status, 400);
  assert.equal((await api("import", { backup, confirmReplace: true })).status, 400);
  getDb().prepare("INSERT INTO players (id,name) VALUES (?,?)").run(99, "Dati aggiunti dopo l'anteprima");
  assert.equal((await commit(backup, preview)).status, 409);
  assert.ok(getDb().prepare("SELECT id FROM players WHERE id=99").get());
  assert.deepEqual(await backupFiles(), []);
});

test("replacement is atomic, preserves relations and credentials and makes a private recoverable SQLite backup", async () => {
  getDb().exec("INSERT INTO google_calendar_exports (event_id,google_event_id) VALUES (30,'remote-id')");
  const preview = (await api("import/preview", backup)).data;
  globalThis.fetch = async () => assert.fail("import must never call integrations");
  try {
    // Untrusted extra settings and unknown row columns must never be inserted.
    const payload = structuredClone(backup);
    payload.app_settings = [{ key: "ai_api_key", value: "malicious" }];
    payload.players[0].untrusted_sql_column = "malicious";
    const response = await commit(payload, preview);
    assert.equal(response.status, 200);
    assert.equal(response.data.imported.players, 2);
    assert.equal(response.data.communicationsPaused, true);
    assert.doesNotMatch(JSON.stringify(response.data), /private-|malicious/);
    assert.deepEqual(records((await api("export")).data), records(backup));
    assert.equal(getDb().prepare("SELECT COUNT(*) AS n FROM google_calendar_exports").get().n, 0);
    assert.equal(getSetting("team_name"), "Nome squadra locale");
    assert.equal(getSetting("ai_api_key"), "private-ai-test");
    assert.equal(getSetting("communication_import_paused"), "true");
    assert.equal(getDb().prepare("SELECT access_token FROM google_tokens").get().access_token, "private-oauth-test");
    assert.deepEqual(getDb().prepare("PRAGMA foreign_key_check").all(), []);
    const filename = path.join(directory, response.data.backupFile);
    const saved = new DatabaseSync(filename, { readOnly: true });
    try {
      assert.equal(saved.prepare("SELECT name FROM players WHERE id=99").get().name, "Dati aggiunti dopo l'anteprima");
      assert.equal(saved.prepare("SELECT COUNT(*) AS n FROM google_calendar_exports").get().n, 1);
      assert.equal(saved.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    } finally { saved.close(); }
    assert.equal((await stat(filename)).mode & 0o777, 0o600);
  } finally { globalThis.fetch = originalFetch; }
});

test("SQL failures roll back all deletions and inserts, and backup failures abort before replacement", async () => {
  const before = records((await api("export")).data);
  getDb().exec("CREATE TRIGGER reject_import BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT,'test failure'); END");
  try {
    const preview = (await api("import/preview", backup)).data;
    assert.equal((await commit(backup, preview)).status, 500);
    assert.deepEqual(records((await api("export")).data), before);
  } finally { getDb().exec("DROP TRIGGER reject_import"); }
  getDb().exec("PRAGMA query_only=ON");
  try {
    const preview = (await api("import/preview", backup)).data;
    const response = await commit(backup, preview);
    assert.equal(response.status, 500);
    assert.match(response.data.error, /backup di sicurezza/);
    assert.deepEqual(records((await api("export")).data), before);
  } finally { getDb().exec("PRAGMA query_only=OFF"); }
});

test("repeated imports do not duplicate records and legacy missing fields receive safe defaults", async () => {
  const legacy = structuredClone(backup);
  delete legacy.players[0].preferred_foot;
  delete legacy.players[0].created_at;
  delete legacy.eventTypes[0].include_in_google_doc;
  delete legacy.events[0].venue;
  const preview = (await api("import/preview", legacy)).data;
  assert.equal((await commit(legacy, preview)).status, 200);
  assert.equal(getDb().prepare("SELECT preferred_foot FROM players WHERE id=10").get().preferred_foot, "both");
  assert.equal(getDb().prepare("SELECT venue FROM events WHERE id=30").get().venue, "home");
  const again = (await api("import/preview", backup)).data;
  assert.equal((await commit(backup, again)).status, 200);
  assert.deepEqual(records((await api("export")).data), records(backup));
});

test("in-flight asynchronous data writers block replacement until completion", async () => {
  let finish;
  const operation = trackDataWrite(() => new Promise((resolve) => { finish = resolve; }));
  try {
    const preview = (await api("import/preview", backup)).data;
    assert.equal((await commit(backup, preview)).status, 409);
  } finally { finish(); await operation; }
});

test("empty exports require confirmation too, and can subsequently be restored from JSON", async () => {
  const empty = { ...backup, ...Object.fromEntries(keys.map((key) => [key, []])) };
  const preview = (await api("import/preview", empty)).data;
  assert.ok(Object.values(preview.counts).every((count) => count === 0));
  assert.equal((await commit(empty, preview, false)).status, 400);
  assert.equal((await commit(empty, preview)).status, 200);
  assert.ok(keys.every((key) => records(empty)[key].length === 0));
  assert.deepEqual(records((await api("export")).data), records(empty));
  const restore = (await api("import/preview", backup)).data;
  assert.equal((await commit(backup, restore)).status, 200);
});

test("import pauses publication, refuses active jobs and only successful explicit refresh resumes automation", async () => {
  const settings = { communication_provider: "website", website_account_id: "a".repeat(32), website_worker_name: "teams-manager", website_token: "private-cloudflare-test", website_synced_destination: `${"a".repeat(32)}/teams-manager` };
  for (const [key, value] of Object.entries(settings)) setSetting(key, value);
  globalThis.fetch = async () => assert.fail("paused background refresh must not call Cloudflare");
  await assert.rejects(refreshLiveCommunication(), /sospesi/);
  assert.equal(getLiveCommunication().syncPaused, true);
  assert.equal(getLiveCommunication().autoSync, false);
  let started, release;
  const ready = new Promise((resolve) => { started = resolve; });
  globalThis.fetch = async () => { started(); return new Promise((resolve) => { release = resolve; }); };
  const pending = refreshLiveCommunication({ force: true });
  const rejected = assert.rejects(pending, /HTTP 403/);
  try {
    await ready;
    const preview = (await api("import/preview", backup)).data;
    assert.equal((await commit(backup, preview)).status, 409);
  } finally {
    release(Response.json({ success: false }, { status: 403 }));
    await rejected;
  }
  assert.equal(getSetting("communication_import_paused"), "true", "failed refresh must not resume automation");
  const ok = (result) => Response.json({ success: true, result });
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes(".workers.dev/manifest.json")) return Response.json({ revision: new URL(url).searchParams.get("revision") });
    if (String(url).endsWith("/workers/subdomain")) return ok({ subdomain: "example" });
    if (String(url).endsWith("/settings")) return ok({ tags: ["teams-manager-public-site-prototype"] });
    if (String(url).endsWith("assets-upload-session")) return ok({ jwt: "completion", buckets: [] });
    if (options.method === "PUT" || options.method === "POST") return ok({});
    assert.fail(`Unexpected request ${url}`);
  };
  try {
    const result = await refreshLiveCommunication({ force: true });
    assert.equal(result.syncPaused, false);
    assert.equal(result.autoSync, true);
    assert.equal(getSetting("communication_import_paused"), null);
  } finally { globalThis.fetch = originalFetch; }
});
