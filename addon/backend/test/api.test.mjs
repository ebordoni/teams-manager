import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "gips-calcio-test-"));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "";
process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.GROQ_API_KEY = "";
process.env.XAI_API_KEY = "";

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

test("player and event workflow is available through the API", async () => {
  const player = await request("/api/players", {
    method: "POST",
    body: JSON.stringify({
      name: "Giocatore test", role: "Centrocampista", preferredFoot: "left",
      fitness: 72, speed: 81, technique: 76, shooting: 64, defending: 58, attacking: 70,
    }),
  });
  assert.equal(player.response.status, 201);
  assert.equal(player.body.preferredFoot, "left");
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

  const removed = await request(
    `/api/events/${event.body.id}/match-plans/${generated.body.id}`,
    { method: "DELETE" },
  );
  assert.equal(removed.response.status, 204);
});
