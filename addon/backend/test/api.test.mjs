import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "gips-calcio-test-"));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "test";

const { closeDb, initDb } = await import("../dist/db/schema.js");
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
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

test("health endpoint reports the running service", async () => {
  const { response, body } = await request("/api/health");
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(typeof body.version, "string");
});

test("player, event and callup workflow is available through the API", async () => {
  const player = await request("/api/players", {
    method: "POST",
    body: JSON.stringify({ name: "Giocatore test", role: "Centrocampista" }),
  });
  assert.equal(player.response.status, 201);

  const event = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({ type: "match", date: "2026-10-01", opponent: "Squadra test" }),
  });
  assert.equal(event.response.status, 201);

  const callups = await request(`/api/events/${event.body.id}/callups`, {
    method: "PUT",
    body: JSON.stringify({ playerIds: [player.body.id] }),
  });
  assert.equal(callups.response.status, 200);
  assert.equal(callups.body.callupCount, 1);

  const list = await request(`/api/events/${event.body.id}/callups`);
  assert.equal(list.response.status, 200);
  assert.deepEqual(list.body, [{ playerId: player.body.id, playerName: "Giocatore test", calledUp: true }]);
});

test("unknown event types are rejected", async () => {
  const { response, body } = await request("/api/events", {
    method: "POST",
    body: JSON.stringify({ type: "inesistente", date: "2026-10-02" }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /Tipo evento sconosciuto/);
});
