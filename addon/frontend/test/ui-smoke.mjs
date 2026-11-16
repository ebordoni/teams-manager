import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";
const root =
  process.env.TEAMS_MANAGER_ROOT ??
  fileURLToPath(new URL("../../../", import.meta.url));
const output =
  process.env.UI_SCREENSHOT_DIR ??
  (await mkdtemp(path.join(os.tmpdir(), "teams-ui-review-")));
const directory = await mkdtemp(path.join(os.tmpdir(), "teams-ui-browser-"));
process.env.DATA_DIR = directory;
process.env.NODE_ENV = "test";
process.env.FRONTEND_DIR = path.join(root, "addon/frontend/dist");
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
for (const key of [
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GROQ_API_KEY",
  "XAI_API_KEY",
])
  process.env[key] = "";
const require = createRequire(import.meta.url);
const { initDb, getDb, closeDb } = require(
  path.join(root, "addon/backend/dist/db/schema.js"),
);
const { app } = require(path.join(root, "addon/backend/dist/index.js"));
const { setSetting } = require(
  path.join(root, "addon/backend/dist/services/settings.service.js"),
);
initDb();
const db = getDb();
setSetting("team_name", "GIPS Salizzole");
setSetting("communication_provider", "website");
const names = [
  "Luca Bianchi",
  "Matteo Rossi",
  "Andrea Moretti",
  "Davide Ferrari",
  "Marco Romano",
  "Pietro De Luca",
  "Alessandro Costa",
  "Tommaso Ricci",
];
names.forEach((name, index) =>
  db
    .prepare(
      "INSERT INTO players (id,name,role,jersey_number,preferred_foot) VALUES (?,?,?,?,?)",
    )
    .run(
      index + 1,
      name,
      ["Portiere", "Difensore", "Centrocampista", "Attaccante"][index % 4],
      index + 1,
      index % 2 ? "left" : "right",
    ),
);
const slots = [
  "portiere",
  "difensoreSinistro",
  "difensoreDestro",
  "centrale",
  "fasciaSinistra",
  "fasciaDestra",
  "attaccante",
];
const assignments = Object.fromEntries(
  slots.map((slot, index) => [slot, index + 1]),
);
db.prepare("INSERT INTO formations (id,name,assignments) VALUES (1,?,?)").run(
  "Equilibrio 2–3–1",
  JSON.stringify(assignments),
);
const day = (offset) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
for (const [id, type, offset, opponent, start, status, notes] of [
  [
    1,
    "training",
    0,
    null,
    "17:45",
    "scheduled",
    "Portare borraccia e giacca a vento.",
  ],
  [
    2,
    "match",
    1,
    "ASD Nogara",
    "15:00",
    "scheduled",
    "Presentarsi al campo con la divisa da gara.",
  ],
  [3, "match", -2, "Bovolone", "10:00", "scheduled", null],
  [4, "training", 3, null, "17:45", "cancelled", "Campo non disponibile."],
])
  db.prepare(
    "INSERT INTO events (id,type,date,start_time,end_time,meeting_time,location,opponent,venue,status,notes,formation_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    type,
    day(offset),
    start,
    type === "match" ? "16:30" : "19:15",
    type === "match" ? "14:30" : null,
    "Campo sportivo di Bionde",
    opponent,
    type === "match" ? "away" : "home",
    status,
    notes,
    type === "match" ? 1 : null,
  );
db.exec(
  "UPDATE events SET attendance_finalized_at=CURRENT_TIMESTAMP WHERE id=3",
);
for (let player = 1; player <= 8; player++) {
  db.prepare(
    "INSERT INTO attendance (event_id,player_id,status) VALUES (?,?,?)",
  ).run(3, player, player === 8 ? "absent" : "present");
  db.prepare(
    "INSERT INTO attendance (event_id,player_id,status) VALUES (?,?,?)",
  ).run(2, player, "present");
}
db.prepare(
  "INSERT INTO match_results (event_id,team_score,opponent_score,venue,scorers) VALUES (3,3,1,'away',?)",
).run('[{"playerId":4,"goals":2},{"playerId":7,"goals":1}]');
db.exec(
  "INSERT INTO match_plans (id,event_id,name,period_count,minutes_per_period,players_on_field,source) VALUES (1,2,'Rotazione equilibrata',3,20,7,'manual')",
);
for (let period = 1; period <= 3; period++)
  db.prepare(
    "INSERT INTO match_periods (match_plan_id,period_number,assignments,bench_player_ids) VALUES (1,?,?,?)",
  ).run(
    period,
    JSON.stringify(
      slots.map((slot, index) => ({
        slot,
        playerId: index + 1,
        role: "Giocatore",
      })),
    ),
    "[8]",
  );
// Exercise the same app under an HA-style path, including relative assets and API calls.
const express = require(path.join(root, "addon/backend/node_modules/express"));
const host = express();
host.use("/ha/ingress/test", app);
host.use(app);
const server = host.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const routes = [
  "dashboard",
  "calendar",
  "players",
  "attendance",
  "formations",
  "settings",
  "communications",
  "ai-settings",
  "events/2",
  "events/2/match-plan",
];
try {
  for (const [width, colorScheme] of process.env.UI_INTERACTIONS_ONLY
    ? []
    : [
        [320, "light"],
        [375, "light"],
        [768, "light"],
        [1440, "light"],
        [375, "dark"],
        [1440, "dark"],
      ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    for (const route of routes) {
      await page.goto(`${base}/#/${route}`);
      await page.locator("#app-content h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(100);
      assert.equal(
        await page.locator("h1").count(),
        1,
        `${route}: one primary heading`,
      );
      const size = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      if (size.scroll > size.width) {
        console.log(
          "OVERFLOW",
          width,
          route,
          await page.locator("body *").evaluateAll((elements) =>
            elements
              .map((el) => ({
                tag: el.tagName,
                cls: el.className,
                r: el.getBoundingClientRect().right,
                w: el.getBoundingClientRect().width,
              }))
              .filter((el) => el.r > innerWidth + 1 && el.w > 0)
              .slice(-12),
          ),
        );
      }
      assert.ok(
        size.scroll <= size.width,
        `${width}px ${route}: overflow ${size.scroll}`,
      );
      assert.equal(
        await page.evaluate(() => document.fonts.check('400 16px "Poppins"')),
        true,
      );
      if (width < 768) {
        assert.equal(
          await page
            .getByRole("navigation", { name: "Navigazione mobile" })
            .isVisible(),
          true,
        );
        assert.equal(
          await page
            .getByRole("navigation", { name: "Navigazione principale" })
            .isVisible(),
          false,
        );
        assert.equal(
          await page
            .getByRole("link", { name: "Impostazioni", exact: true })
            .last()
            .isVisible(),
          true,
        );
      }
      if (
        [375, 1440].includes(width) &&
        ["dashboard", "calendar", "players", "events/2", "formations"].includes(
          route,
        )
      ) {
        await page.screenshot({
          path: path.join(
            output,
            `${route.replaceAll("/", "-")}-${width}-${colorScheme}.png`,
          ),
          fullPage: true,
        });
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px ${colorScheme}: all 10 routes, headings, fonts, navigation and no overflow`,
    );
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(`${base}/#/calendar`);
  await page.getByRole("button", { name: "Nuovo evento", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.goto(`${base}/#/players`);
  await page
    .getByRole("button", { name: "Nuovo giocatore", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Giocatore UI test");
  await page
    .getByRole("button", { name: "Aggiungi giocatore", exact: true })
    .click();
  await page.getByText("Giocatore UI test", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Modifica Giocatore UI test", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Giocatore aggiornato");
  await page
    .getByRole("button", { name: "Salva modifiche", exact: true })
    .click();
  await page.getByText("Giocatore aggiornato", { exact: true }).waitFor();
  console.log("PASS player creation and editing on isolated database");
  await page.goto(`${base}/#/events/2`);
  await page.getByRole("tab", { name: /Presenze/ }).click();
  const attendance = page.getByRole("button", {
    name: /Luca Bianchi: presente/,
  });
  await attendance.click();
  assert.equal(
    await page
      .getByRole("button", { name: /Luca Bianchi: assente/ })
      .getAttribute("aria-pressed"),
    "false",
  );
  await page
    .getByRole("button", { name: "Salva presenze", exact: true })
    .click();
  await page.getByRole("tab", { name: "Partita", exact: true }).click();
  await page
    .getByRole("button", { name: "Aumenta gol squadra", exact: true })
    .click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().endsWith("/result") &&
        response.ok(),
    ),
    page.getByRole("button", { name: "Salva risultato", exact: true }).click(),
  ]);
  assert.equal(
    db.prepare("SELECT team_score FROM match_results WHERE event_id=2").get()
      .team_score,
    1,
  );
  console.log("PASS attendance and match result workflows");
  await page.goto(`${base}/#/formations`);
  await page
    .getByRole("button", { name: "Portiere: non assegnato", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("combobox", { name: "Giocatore", exact: true }).click();
  await page.getByRole("option", { name: "Luca Bianchi", exact: true }).click();
  await page
    .getByRole("button", { name: "Portiere: Luca Bianchi", exact: true })
    .waitFor();
  await page.goto(`${base}/#/events/2/match-plan`);
  await page
    .getByRole("button", { name: "Portiere: Luca Bianchi", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rimuovi giocatore", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salva modifiche", exact: true })
    .click();
  console.log("PASS shared formation pitch and draft match plan editing");
  await page.goto(`${base}/#/attendance`);
  await page.getByRole("button", { name: /Luca Bianchi/ }).click();
  await page.getByText("Presente", { exact: true }).first().waitFor();
  await page.goto(`${base}/#/settings`);
  await page.getByRole("tab", { name: "Integrazioni", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Cloudflare Account ID", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Notion", exact: true }).click();
  await page.getByRole("textbox", { name: /Pagina Notion/ }).waitFor();
  await page.getByRole("button", { name: "Google", exact: true }).click();
  await page.getByRole("textbox", { name: /ID calendario/ }).waitFor();
  for (const tab of ["Tipi di evento", "Generale"])
    await page.getByRole("tab", { name: tab, exact: true }).click();
  await page.getByText("Backup e ripristino dati", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Tipi di evento", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Seduta tecnica");
  await Promise.all([
    page
      .waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().endsWith("/api/event-types"),
      )
      .then(async (response) => {
        assert.equal(response.status(), 201, await response.text());
      }),
    page.getByRole("button", { name: "Aggiungi", exact: true }).click(),
  ]);
  await page.getByText("Seduta tecnica", { exact: false }).waitFor();
  assert.equal(
    await page
      .getByRole("tab", { name: "Tipi di evento", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  console.log(
    "PASS register details, settings tabs, existing import/export entry points",
  );
  await page.goto(`${base}/#/calendar`);
  await page.getByText("Mese", { exact: true }).click();
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.getByText("Elenco", { exact: true }).click();
  const beforeDeletion = db.prepare("SELECT COUNT(*) AS n FROM events").get().n;
  await page
    .getByRole("checkbox", { name: /^Seleziona Allenamento del/ })
    .first()
    .check();
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        response.url().includes("/api/events/") &&
        response.ok(),
    ),
    page
      .getByRole("button", { name: "Elimina selezionati", exact: true })
      .click(),
  ]);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM events").get().n,
    beforeDeletion - 1,
  );
  await page.getByRole("button", { name: "Nuovo evento", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  const dateInput = page.getByRole("dialog").getByLabel(/^Data/);
  await dateInput.fill(day(0).split("-").reverse().join("-"));
  await dateInput.press("Tab");
  assert.equal(
    await dateInput.inputValue(),
    day(0).split("-").reverse().join("-"),
  );
  assert.equal(
    await dateInput.evaluate(
      (element) => parseFloat(getComputedStyle(element).fontSize) >= 16,
    ),
    true,
  );
  await page
    .getByRole("textbox", { name: "Note e indicazioni", exact: true })
    .fill("Appuntamento di verifica UI");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/events") &&
        response.status() === 201,
    ),
    page.getByRole("button", { name: "Crea evento", exact: true }).click(),
  ]);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok(
    db
      .prepare("SELECT id FROM events WHERE notes=?")
      .get("Appuntamento di verifica UI"),
  );
  console.log("PASS calendar month/list, bulk deletion and event creation");
  await page.goto(`${base}/ha/ingress/test/#/dashboard`);
  await page.locator("#app-content h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(() => document.fonts.check('400 16px "Poppins"')),
    true,
  );
  assert.ok(
    await page
      .getByRole("heading", { name: "Panoramica", exact: true })
      .isVisible(),
  );
  console.log("PASS HA-style subpath navigation, APIs and bundled fonts");
  assert.match(
    await (
      await page.request.get(`${base}/ha/ingress/test/fonts/OFL.txt`)
    ).text(),
    /SIL OPEN FONT LICENSE/,
  );
  console.log(`Screenshots: ${output}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  await rm(directory, { recursive: true, force: true });
}
