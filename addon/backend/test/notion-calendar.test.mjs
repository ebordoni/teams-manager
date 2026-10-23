import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const dir = await mkdtemp(path.join(os.tmpdir(), "teams-manager-calendar-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
const { initDb, closeDb } = await import("../dist/db/schema.js");
const { saveNotionSettings, notionStatus, verifyNotion } = await import("../dist/services/notion.service.js");
const { publishNotionCalendar } = await import("../dist/services/notion-calendar.service.js");
const { app } = await import("../dist/index.js");
const originalFetch = globalThis.fetch;
const databaseId = "aaaaaaaa111141118111111111111111";
const sourceId = "bbbbbbbb222242228222222222222222";
const rows = new Map([["manual", { object: "page", id: "manual", properties: {} }]]);
const schema = { Nome: { type: "title" }, Quando: { type: "date" } };
let writes = 0;
let creates = 0;
let loseCreateResponse = true;
let multipleSources = false;
let failContent = false;
let server;
let base;

before(async () => {
  initDb();
  saveNotionSettings({ token: "test-calendar-token", page: databaseId, publicUrl: "", active: true, mode: "database" });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(options.headers.Authorization, "Bearer test-calendar-token");
    const route = String(url).split("/v1/")[1];
    const body = options.body ? JSON.parse(options.body) : undefined;
    if (route === `databases/${databaseId}`) return Response.json({ object: "database", id: databaseId, data_sources: multipleSources ? [{ id: sourceId }, { id: "other" }] : [{ id: sourceId }] });
    if (route === `data_sources/${sourceId}`) {
      if (options.method === "PATCH") {
        writes++;
        for (const [name, value] of Object.entries(body.properties)) schema[name] = { type: Object.keys(value)[0] };
      }
      return Response.json({ object: "data_source", id: sourceId, properties: schema });
    }
    if (route === `data_sources/${sourceId}/query`) {
      const active = [...rows.values()].filter((row) => !row.in_trash);
      // Due pagine di risultati obbligano a completare la query prima di pulire.
      return Response.json({ results: body.start_cursor ? active.slice(1) : active.slice(0, 1), has_more: !body.start_cursor, next_cursor: body.start_cursor ? null : "cursor-two" });
    }
    if (route === "pages" && options.method === "POST") {
      writes++; creates++;
      assert.equal(body.parent.data_source_id, sourceId);
      assert.match(body.markdown, /ALLENAMENTO/);
      const row = { object: "page", id: `event-${creates}`, properties: body.properties };
      rows.set(row.id, row);
      if (loseCreateResponse) { loseCreateResponse = false; throw new Error("response lost after creation"); }
      return Response.json(row);
    }
    const match = route.match(/^pages\/(event-\d+)(\/markdown)?$/);
    if (match && options.method === "PATCH") {
      writes++;
      if (match[2]) {
        if (failContent) return Response.json({ code: "validation_error", message: "Content rejected" }, { status: 400 });
        assert.equal(body.type, "replace_content");
        return Response.json({ object: "page_markdown" });
      }
      const row = rows.get(match[1]);
      if (body.properties) row.properties = body.properties;
      if (body.in_trash) row.in_trash = true;
      return Response.json(row);
    }
    throw new Error(`Unexpected request: ${route}`);
  };
});
after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  await rm(dir, { recursive: true, force: true });
});

test("database verification is read-only and refuses ambiguous data sources", async () => {
  await verifyNotion();
  assert.equal(writes, 0);
  multipleSources = true;
  await assert.rejects(verifyNotion(), /una sola origine/);
  multipleSources = false;
});

test("calendar sync recovers a lost creation response, updates stable entries and protects manual rows", async () => {
  const event = { id: 42, type: "training", date: "2099-10-25", startTime: "23:30", endTime: "00:30", meetingTime: "23:15", location: "Campo", address: "Via Roma", status: "scheduled", venue: "home" };
  const types = new Map([["training", { key: "training", label: "Allenamento", icon: "IconRun", hasOpponent: false, includeInGoogleDoc: true }]]);
  await assert.rejects(publishNotionCalendar([event], types), /non raggiungibile/);
  assert.equal(creates, 1);
  assert.equal(notionStatus().autoSync, false);
  await publishNotionCalendar([event], types);
  assert.equal(creates, 1, "the existing event is recovered by its stable key");
  const row = rows.get("event-1");
  assert.equal(row.properties.Quando.date.start, "2099-10-25T23:30:00");
  assert.equal(row.properties.Quando.date.end, "2099-10-26T00:30:00");
  assert.equal(row.properties.Quando.date.time_zone, "Europe/Rome");
  assert.equal(notionStatus().autoSync, true);
  const savedWrites = writes;
  await publishNotionCalendar([event], types);
  assert.equal(writes, savedWrites, "unchanged entries are not rewritten");
  event.location = "Campo nuovo";
  await publishNotionCalendar([event], types);
  assert.equal(creates, 1);
  assert.match(row.properties.Luogo.rich_text[0].text.content, /Campo nuovo/);

  // Una scrittura fallita non anticipa la pulizia delle vecchie voci.
  failContent = true;
  await assert.rejects(publishNotionCalendar([event], types, true), /Content rejected/);
  assert.equal(row.in_trash, undefined);
  assert.equal(rows.get("manual").in_trash, undefined);
  failContent = false;

  const beforeJob = writes;
  const job = await originalFetch(`${base}/api/communications/live/refresh?background=1`, { method: "POST" });
  assert.equal(job.status, 202);
  let state;
  for (let attempt = 0; attempt < 150; attempt++) {
    state = await (await originalFetch(`${base}/api/communications/live/status`)).json();
    if (!state.running) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(state.running, false);
  assert.equal(state.error, undefined);
  assert.equal(state.result.notionMode, "database");
  // Il database locale di test non contiene eventi: l'evento gestito viene archiviato.
  assert.equal(row.in_trash, true);
  assert.equal(rows.get("manual").in_trash, undefined);
  assert.ok(writes > beforeJob);
});
