import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";

const dir = await mkdtemp(path.join(os.tmpdir(), "teams-manager-site-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
const { initDb, getDb, closeDb } = await import("../dist/db/schema.js");
const { getSetting, setSetting } = await import("../dist/services/settings.service.js");
const { app } = await import("../dist/index.js");
const { configureWebsite, configureNotion, refreshLiveCommunication, getLiveCommunication } = await import("../dist/services/communication.service.js");
const { websiteSettings, publicSiteModel, renderPublicSite } = await import("../dist/services/public-site.service.js");
const { millisecondsUntilNextDailyRefresh } = await import("../dist/services/live-communication-scheduler.service.js");
const originalFetch = globalThis.fetch;
const input = { accountId: "a".repeat(32), workerName: "teams-manager", token: "secret-cloudflare-test", active: true, includeNotes: false, autoPublish: true, introduction: "Il sito della squadra", notice: "Avviso <script>alert(1)</script>", information: "Informazioni pubbliche" };
let server, base;
before(async () => {
  initDb(); server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { globalThis.fetch = originalFetch; await new Promise((resolve) => server.close(resolve)); closeDb(); await rm(dir, { recursive: true, force: true }); });
const api = async (route, method = "GET", body) => {
  const response = await originalFetch(`${base}/api/${route}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
};

test("website configuration keeps credentials private and never publishes on save", async () => {
  globalThis.fetch = async () => assert.fail("saving must not contact Cloudflare");
  try {
    assert.equal((await api("public-site", "PUT", { ...input, accountId: "invalid" })).status, 400);
    const response = await api("public-site", "PUT", input);
    assert.equal(response.status, 200);
    assert.equal(response.data.active, true);
    assert.equal(response.data.autoSync, false);
    assert.doesNotMatch(JSON.stringify(response.data), /secret-cloudflare-test|"token"/);
    assert.equal(getLiveCommunication().provider, "website");
    assert.equal((await api("communications/live/refresh", "POST")).status, 502);
    assert.equal(getSetting("communication_provider"), "website", "website must never fall back to Google");
    assert.doesNotMatch(JSON.stringify((await api("data/export")).data), /secret-cloudflare-test/);
  } finally { globalThis.fetch = originalFetch; }
});

test("public model includes selected appointments only, never player data or private notes", async () => {
  const db = getDb();
  db.prepare("INSERT INTO event_types (key,label,icon,has_opponent,include_in_google_doc) VALUES (?,?,?,?,?)").run("pub", "Partita", "IconBallFootball", 1, 1);
  db.prepare("INSERT INTO event_types (key,label,icon,has_opponent,include_in_google_doc) VALUES (?,?,?,?,?)").run("excluded", "Escluso", "IconRun", 0, 0);
  db.prepare("INSERT INTO players (name) VALUES (?)").run("Giocatore riservato");
  const insert = db.prepare("INSERT INTO events (type,date,start_time,opponent,venue,notes,status) VALUES (?,?,?,?,?,?,?)");
  insert.run("pub", "2000-01-01", "10:00", "Vecchio", "home", "segreto", "scheduled");
  insert.run("pub", "2000-01-02", "10:00", "Passato", "home", "segreto", "scheduled");
  insert.run("pub", "2099-01-01", "10:00", "Avversario", "away", "segreto", "cancelled");
  insert.run("pub", "2099-01-02", "10:00", "Futuro", "home", "segreto", "scheduled");
  insert.run("excluded", "2099-01-03", "10:00", "Non pubblico", "home", "segreto", "scheduled");
  const model = publicSiteModel();
  assert.equal(model.events.length, 3);
  assert.match(model.events[1].match, /AVVERSARIO VS GIPS SALIZZOLE/);
  assert.equal(model.events[1].note, "ANNULLATO");
  assert.doesNotMatch(JSON.stringify(model), /Giocatore riservato|segreto|Non pubblico|Vecchio/);
  const files = await renderPublicSite();
  assert.ok(files.get("/style.css").length > 100);
  assert.match(files.get("/index.html"), /&lt;script&gt;/);
  assert.doesNotMatch(files.get("/index.html"), /<script>alert|PROTOTIPO|Squadra demo|undefined/);
  const preview = await api("public-site/preview");
  assert.equal(preview.status, 200);
  assert.match(preview.data.html, /<style>/);
  assert.doesNotMatch(preview.data.html, /<script/);
  assert.match(preview.data.html, /src="data:image\/png;base64,/);
  assert.equal(preview.data.html.split("data:font/woff2;base64,").length - 1, 4);
  assert.doesNotMatch(preview.data.html, /(?:src|href)="\/(?:logo|fonts|style)|url\("\/fonts|rel="preload"/);
  assert.match(preview.data.html, /<details class="menu"><summary/);
  assert.equal(files.get("/logo.png").subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(files.get("/index.html").split('id="evento-').length - 1, 3);
  assert.equal(JSON.parse(files.get("/manifest.json")).prototype, false);
});

function cloudflareMock({ fail = false, foreign = false } = {}) {
  let revision;
  const calls = [];
  const ok = (result) => Response.json({ success: true, result });
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method ?? "GET" });
    if (String(url).includes(".workers.dev/manifest.json")) {
      assert.equal(options.headers, undefined);
      return Response.json({ revision });
    }
    assert.equal(options.headers.Authorization, "Bearer secret-cloudflare-test");
    if (fail) return Response.json({ success: false, errors: [{ code: 10000, message: "secret-cloudflare-test" }] }, { status: 403 });
    if (String(url).endsWith("/workers/subdomain")) return ok({ subdomain: "test" });
    if (String(url).endsWith("/settings")) return ok({ tags: foreign ? [] : ["teams-manager-public-site-prototype"] });
    if (String(url).endsWith("assets-upload-session")) return ok({ jwt: "completion", buckets: [] });
    if (options.method === "PUT") {
      const metadata = JSON.parse(options.body.get("metadata"));
      assert.equal(metadata.assets.config.run_worker_first, false);
      return ok({ id: "teams-manager" });
    }
    if (String(url).endsWith("/subdomain") && options.method === "POST") return ok({ enabled: true });
    assert.fail(`Unexpected request ${url}`);
  };
  // Extracting the expected revision from the public verification URL tests
  // the full publisher without depending on wall-clock rendering timestamps.
  return { calls, fetcher: async (url, options) => {
    if (String(url).includes(".workers.dev/manifest.json")) revision = new URL(url).searchParams.get("revision");
    return fetcher(url, options);
  } };
}

test("read-only verification recognizes prototype, and confirmed publish activates automatic updates", async () => {
  const mock = cloudflareMock(); globalThis.fetch = mock.fetcher;
  try {
    const verify = await api("public-site/verify", "POST");
    assert.equal(verify.status, 200);
    assert.ok(mock.calls.every((call) => call.method === "GET"));
    assert.equal(websiteSettings().autoSync, false);
    await refreshLiveCommunication({ force: true, confirmPublic: true });
    assert.equal(websiteSettings().autoSync, true);
    assert.equal(getLiveCommunication().url, "https://teams-manager.test.workers.dev");
    const count = mock.calls.length;
    await refreshLiveCommunication();
    assert.equal(mock.calls.length, count, "unchanged background updates must not call Cloudflare");
    await refreshLiveCommunication({ force: true });
    assert.equal(mock.calls.filter((call) => call.method === "PUT").length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("publish failures preserve last success, redact credentials and leave foreign workers untouched", async () => {
  const previous = websiteSettings().updatedAt;
  const denied = cloudflareMock({ fail: true }); globalThis.fetch = denied.fetcher;
  try {
    await assert.rejects(refreshLiveCommunication({ force: true }), /HTTP 403/);
    assert.equal(websiteSettings().updatedAt, previous);
    assert.doesNotMatch(websiteSettings().lastError, /secret-cloudflare-test/);
    const foreign = cloudflareMock({ foreign: true }); globalThis.fetch = foreign.fetcher;
    await assert.rejects(refreshLiveCommunication({ force: true }), /non è riconosciuto/);
    assert.ok(foreign.calls.every((call) => call.method === "GET"));
  } finally { globalThis.fetch = originalFetch; }
});

test("settings preserve inactive providers, notes require opt-in and destination changes require confirmation again", async () => {
  await configureNotion({ page: "b".repeat(32), token: "notion-test", publicUrl: "", active: false });
  assert.equal(getSetting("communication_provider"), "website");
  await configureWebsite({ ...input, token: undefined, includeNotes: true });
  assert.match(JSON.stringify(publicSiteModel()), /segreto/);
  await configureNotion({ page: "b".repeat(32), publicUrl: "", active: true });
  await configureWebsite({ ...input, token: undefined, active: false });
  assert.equal(getSetting("communication_provider"), "notion");
  await configureWebsite({ ...input, token: undefined, workerName: "teams-manager-other" });
  assert.equal(websiteSettings().autoSync, false);
  assert.equal(websiteSettings().published, false);
  assert.equal(websiteSettings().url, "");
  await assert.rejects(refreshLiveCommunication(), /Conferma la prima pubblicazione/);
});

test("daily refresh follows Rome 03:05 across daylight saving transitions", () => {
  for (const [start, target] of [["2026-03-28T23:00:00Z", "2026-03-29T01:05:00Z"], ["2026-10-24T23:00:00Z", "2026-10-25T02:05:00Z"]]) {
    const date = new Date(start);
    assert.equal(date.getTime() + millisecondsUntilNextDailyRefresh(date), new Date(target).getTime());
  }
});
