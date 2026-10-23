import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const dir = await mkdtemp(path.join(os.tmpdir(), "teams-manager-notion-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
const { initDb, getDb, closeDb } = await import("../dist/db/schema.js");
const notion = await import("../dist/services/notion.service.js");
const { buildCommunicationContent, loadLiveEvents, loadEventTypes } = await import("../dist/services/communication-content.js");
const { refreshLiveCommunication, configureNotion, getLiveCommunication } = await import("../dist/services/communication.service.js");
const { app } = await import("../dist/index.js");
const { getSetting, setSetting } = await import("../dist/services/settings.service.js");
const originalFetch = globalThis.fetch;
const id = "11111111222243338444555555555555";
let server;
let base;
before(async () => {
  initDb();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  await rm(dir, { recursive: true, force: true });
});

test("Notion settings validate page URLs and never expose the token", async () => {
  assert.equal(notion.parseNotionPage(`https://www.notion.so/Appuntamenti-${id}?source=copy_link`), id);
  assert.throws(() => notion.parseNotionPage(`https://example.com/${id}`));
  assert.throws(() => notion.parseNotionPage("not-a-page"));
  const saved = await originalFetch(`${base}/api/notion`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "secret-notion-token", page: id, publicUrl: "https://squadra.notion.site/appuntamenti", active: true }) });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).autoSync, false);
  const status = await (await originalFetch(`${base}/api/notion`)).json();
  assert.equal(status.configured, true);
  assert.equal(status.requiresPageSetup, false);
  assert.equal(status.mode, undefined);
  assert.equal(JSON.stringify(status).includes("secret-notion-token"), false);
  const exported = await (await originalFetch(`${base}/api/data/export`)).text();
  assert.equal(exported.includes("secret-notion-token"), false);
});

test("shared content selects one included past event and preserves Notion formatting", () => {
  const db = getDb();
  db.prepare("INSERT INTO event_types (key, label, icon, has_opponent, include_in_google_doc, sort_order) VALUES (?, ?, ?, ?, ?, ?)").run("public-test", "Partita", "IconTrophy", 1, 1, 98);
  db.prepare("INSERT INTO event_types (key, label, icon, has_opponent, include_in_google_doc, sort_order) VALUES (?, ?, ?, ?, ?, ?)").run("private-test", "Privato", "IconRun", 0, 0, 99);
  const insert = db.prepare("INSERT INTO events (type, date, start_time, opponent, venue, notes) VALUES (?, ?, ?, ?, ?, ?)");
  insert.run("public-test", "2000-01-01", "15:00", "Vecchio", "home", null);
  insert.run("public-test", "2000-01-02", "15:00", "Ultimo", "away", "<private> *test*");
  insert.run("private-test", "2000-01-03", "15:00", null, "home", null);
  insert.run("public-test", "2099-01-01", "17:00", "Futuro", "home", null);
  const events = loadLiveEvents();
  assert.deepEqual(events.map((event) => event.date), ["2000-01-02", "2099-01-01"]);
  const markdown = notion.renderNotionMarkdown(buildCommunicationContent(events, loadEventTypes()));
  assert.match(markdown, /PARTITA IN TRASFERTA/);
  assert.match(markdown, /ULTIMO VS GIPS SALIZZOLE/);
  assert.match(markdown, /~~.*~~ \{color="gray"\}/);
  assert.match(markdown, /\\<private\\>/);
  assert.ok(markdown.indexOf("FUTURO") < markdown.indexOf("ULTIMO VS"));
  assert.doesNotMatch(markdown, /Presenze/);
  db.prepare("INSERT INTO players (name) VALUES (?)").run("Convocato prova");
  setSetting("match_callups_enabled", "false");
  assert.doesNotMatch(notion.renderNotionMarkdown(buildCommunicationContent(events, loadEventTypes())), /Convocati|Convocato prova/);
  setSetting("match_callups_enabled", "true");
  assert.match(notion.renderNotionMarkdown(buildCommunicationContent(events, loadEventTypes())), /Convocato prova/);
});

test("shared content orders same-day events by start time and carries status metadata", () => {
  const types = new Map([["training", { label: "Allenamento", icon: "IconRun", hasOpponent: false, includeInGoogleDoc: true }]]);
  const content = buildCommunicationContent([
    { id: 2, type: "training", date: "2099-02-01", startTime: "18:00", status: "scheduled" },
    { id: 1, type: "training", date: "2099-02-01", startTime: "09:00", status: "cancelled" },
  ], types);
  assert.deepEqual(content.paragraphs.filter((paragraph) => paragraph.kind === "date").map((paragraph) => paragraph.event), [
    { id: 1, date: "2099-02-01", status: "cancelled" },
    { id: 2, date: "2099-02-01", status: "scheduled" },
  ]);
  const card = notion.renderNotionMarkdown(content).match(/<callout[^>]+>([\s\S]+?)<\/callout>/)[1];
  assert.match(card, /18:00/);
  assert.doesNotMatch(card, /09:00|ANNULLATO/);
});

test("Notion replaces a stable page, skips unchanged background writes, forces repair and records errors", async () => {
  let writes = 0;
  let inaccessible = false;
  let unauthorized = false;
  globalThis.fetch = async (url, options = {}) => {
    assert.match(String(url), /^https:\/\/api\.notion\.com\/v1\/pages\//);
    assert.equal(options.headers.Authorization, "Bearer secret-notion-token");
    if (unauthorized) return Response.json({}, { status: 401 });
    if (inaccessible) return Response.json({ code: "object_not_found" }, { status: 404 });
    if (options.method === "PATCH") {
      writes++;
      const body = JSON.parse(options.body);
      assert.equal(body.type, "replace_content");
      assert.equal(body.allow_deleting_content, undefined);
      assert.match(body.replace_content.new_str, /FUTURO/);
      return Response.json({ object: "page_markdown" });
    }
    return Response.json({ object: "page", id, archived: false });
  };
  try {
    const first = await refreshLiveCommunication();
    assert.equal(first.provider, "notion");
    assert.equal(first.documentId, id);
    assert.equal(notion.notionStatus().autoSync, true);
    await refreshLiveCommunication();
    assert.equal(writes, 1);
    // Il refresh manuale ricostruisce la pagina anche se il contenuto locale non cambia.
    await refreshLiveCommunication({ force: true });
    assert.equal(writes, 2);
    inaccessible = true;
    await assert.rejects(refreshLiveCommunication(), /non trovata o non condivisa/);
    assert.match(notion.notionStatus().lastError, /non trovata/);
    assert.equal(notion.notionStatus().pageId, id);
    assert.equal(writes, 2);
    inaccessible = false;
    unauthorized = true;
    await assert.rejects(refreshLiveCommunication(), /Token Notion non valido o revocato/);
    unauthorized = false;
    await refreshLiveCommunication();
    assert.equal(notion.notionStatus().lastError, null);
    await configureNotion({ page: "22222222333344448555666666666666", publicUrl: "", active: true });
    assert.equal(notion.notionStatus().autoSync, false);
    assert.equal(notion.notionStatus().updatedAt, "");
  } finally { globalThis.fetch = originalFetch; }
});

test("verify preserves upstream validation details without exposing credentials or suggesting content deletion", async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /\/v1\/pages\/[^/]+$/);
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    return Response.json({
      code: "validation_error",
      message: "Provided ID is a database, not a page. secret-notion-token ntn_sensitive",
      request_id: "notion-request-123",
      extra: "secret-notion-token",
    }, { status: 400 });
  };
  try {
    const response = await originalFetch(`${base}/api/notion/verify`, { method: "POST" });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.upstream, "notion");
    assert.equal(body.upstreamStatus, 400);
    assert.equal(body.notionCode, "validation_error");
    assert.equal(body.requestId, "notion-request-123");
    assert.match(body.error, /Verifica accesso/);
    assert.match(body.error, /database, not a page/);
    assert.doesNotMatch(body.error, /sottopagine/);
    assert.doesNotMatch(JSON.stringify(body), /secret-notion-token|ntn_sensitive|extra/);

    globalThis.fetch = async () => new Response("<html>Bad gateway</html>", { status: 502 });
    const unavailable = await originalFetch(`${base}/api/notion/verify`, { method: "POST" });
    const fallback = await unavailable.json();
    assert.equal(fallback.upstreamStatus, 502);
    assert.match(fallback.error, /Verifica accesso/);
    assert.doesNotMatch(fallback.error, /<html>|sottopagine/);
  } finally { globalThis.fetch = originalFetch; }
});

test("legacy database configuration pauses sync, preserves credentials and requires an explicit page migration", async () => {
  const databaseId = "aaaaaaaa111141118111111111111111";
  const pageId = "bbbbbbbb222242228222222222222222";
  setSetting("notion_mode", "database");
  setSetting("notion_page_id", databaseId);
  setSetting("notion_page_url", `https://www.notion.so/${databaseId}`);
  setSetting("notion_synced_page_id", databaseId);
  setSetting("notion_hash", "old-database-hash");
  setSetting("notion_updated_at", "2026-01-01T10:00:00.000Z");
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options.method });
    assert.equal(options.headers.Authorization, "Bearer secret-notion-token");
    assert.ok(String(url).startsWith(`https://api.notion.com/v1/pages/${pageId}`), "must never contact or modify the previous database");
    return Response.json({ object: "page", id: pageId });
  };
  try {
    assert.equal(notion.notionStatus().requiresPageSetup, true);
    assert.equal(notion.notionStatus().autoSync, false);
    assert.equal(getLiveCommunication().requiresPageSetup, true);
    await assert.rejects(notion.verifyNotion(), /pagina Notion normale/);
    await assert.rejects(refreshLiveCommunication({ force: true }), /pagina Notion normale/);
    await assert.rejects(configureNotion({ token: "must-not-replace-token", page: databaseId, publicUrl: "", active: true }), /non il database precedente/);
    assert.equal(getSetting("notion_token"), "secret-notion-token");
    assert.equal(getSetting("notion_hash"), "old-database-hash");
    assert.equal(requests.length, 0);

    // Anche prima del passaggio è possibile tornare a Google senza toccare Notion.
    const disabled = await configureNotion({ page: databaseId, publicUrl: "", active: false });
    assert.equal(disabled.active, false);
    assert.equal(disabled.requiresPageSetup, true);
    assert.equal(requests.length, 0);

    const saved = await originalFetch(`${base}/api/notion`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: pageId, publicUrl: "https://squadra.notion.site/agenda", active: true }) });
    assert.equal(saved.status, 200);
    const status = await saved.json();
    assert.equal(status.requiresPageSetup, false);
    assert.equal(status.autoSync, false);
    assert.equal(status.updatedAt, "");
    assert.equal(status.lastError, null);
    assert.equal(status.publicUrl, "https://squadra.notion.site/agenda");
    assert.equal(requests.length, 0, "saving settings must not write content or enable automatic publication");
    assert.equal(getSetting("notion_mode"), null);
    const published = await refreshLiveCommunication();
    assert.equal(published.documentId, pageId);
    assert.equal(published.requiresPageSetup, false);
    assert.equal(notion.notionStatus().autoSync, true);
    assert.deepEqual(requests.map((request) => request.method), ["GET", "PATCH"]);
    assert.equal(requests[1].url, `https://api.notion.com/v1/pages/${pageId}/markdown`);
  } finally { globalThis.fetch = originalFetch; }
});

test("background publication uses one content write; status polling and repeated clicks do not contact Notion", async () => {
  let calls = 0;
  let releaseWrite;
  let signalWrite;
  const writeGate = new Promise((resolve) => { releaseWrite = resolve; });
  const writeStarted = new Promise((resolve) => { signalWrite = resolve; });
  async function waitForJob() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await originalFetch(`${base}/api/communications/live/status`);
      const state = await response.json();
      if (!state.running) return state;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail("background publication did not finish");
  }
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (options.method === "PATCH") {
      assert.equal(JSON.parse(options.body).type, "replace_content");
      signalWrite();
      await writeGate;
    }
    return Response.json({ object: "page" });
  };
  try {
    const job = await originalFetch(`${base}/api/communications/live/refresh?background=1`, { method: "POST" });
    assert.equal(job.status, 202);
    await writeStarted;
    assert.equal(calls, 2);
    const repeated = await originalFetch(`${base}/api/communications/live/refresh?background=1`, { method: "POST" });
    assert.equal(repeated.status, 202);
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal((await (await originalFetch(`${base}/api/communications/live/status`)).json()).running, true);
    }
    assert.equal(calls, 2, "polling and repeated clicks must not trigger any extra upstream requests");
    releaseWrite();
    const state = await waitForJob();
    assert.equal(state.result.provider, "notion");
    assert.equal(state.result.requiresPageSetup, false);
    assert.equal(state.error, undefined);
    assert.equal(calls, 2);

    globalThis.fetch = async () => Response.json({}, { status: 401 });
    await originalFetch(`${base}/api/communications/live/refresh?background=1`, { method: "POST" });
    const failed = await waitForJob();
    assert.equal(failed.errorStatus, 502);
    assert.match(failed.error, /Token Notion non valido/);
    assert.equal(failed.result, undefined, "an error must not return a stale successful result");
  } finally { releaseWrite(); globalThis.fetch = originalFetch; }
});
