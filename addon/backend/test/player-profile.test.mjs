import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";

const directory = await mkdtemp(
  path.join(os.tmpdir(), "teams-manager-profiles-"),
);
process.env.DATA_DIR = directory;
process.env.NODE_ENV = "test";
const { initDb, getDb, closeDb } = await import("../dist/db/schema.js");
const { app } = await import("../dist/index.js");
const { birthdaysToday, publicBirthdaysToday, isBirthdayOn, romeDay } =
  await import("../dist/services/birthdays.service.js");
const { publicSiteModel, renderPublicSite } = await import(
  "../dist/services/public-site.service.js"
);
const { millisecondsUntilNextDailyRefresh } = await import(
  "../dist/services/live-communication-scheduler.service.js"
);
let server, base, source, player;
const dataUrl = (buffer, type = "png") =>
  `data:image/${type};base64,${buffer.toString("base64")}`;
const bytes = (photo) => Buffer.from(photo.split(",")[1], "base64");
async function api(route, method = "GET", body) {
  const response = await fetch(`${base}/api/${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}
before(async () => {
  initDb();
  source = await sharp({
    create: { width: 900, height: 600, channels: 3, background: "#376da2" },
  })
    .withMetadata({ exif: { IFD0: { Artist: "Private camera metadata" } } })
    .png()
    .toBuffer();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  await rm(directory, { recursive: true, force: true });
});

test("player photos are cropped, bounded, re-encoded and stripped of camera metadata", async () => {
  const response = await api("players", "POST", {
    name: "Profilo privato",
    photo: dataUrl(source),
    birthDate: "2016-11-19",
  });
  assert.equal(response.status, 201);
  player = response.data;
  assert.equal(player.birthDate, "2016-11-19");
  assert.equal(
    player.birthdayPublicName,
    null,
    "public birthdays require explicit opt-in",
  );
  assert.match(player.photo, /^data:image\/jpeg;base64,/);
  assert.ok(bytes(player.photo).length <= 80 * 1024);
  const metadata = await sharp(bytes(player.photo)).metadata();
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  for (const key of ["exif", "icc", "xmp", "iptc"])
    assert.equal(metadata[key], undefined, key);
  await sharp(bytes(player.photo)).raw().toBuffer();
  assert.equal(
    (await api(`players/${player.id}`, "PUT", { name: "Profilo aggiornato" }))
      .data.photo,
    player.photo,
  );
});

test("API rejects invalid, oversized, disguised and excessive-resolution images", async () => {
  const huge = await sharp({
    create: { width: 2050, height: 2050, channels: 3, background: "#aaa" },
  })
    .png()
    .toBuffer();
  const invalid = [
    "https://example.com/photo.png",
    "data:image/svg+xml;base64," +
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString(
        "base64",
      ),
    dataUrl(Buffer.from("not an image")),
    dataUrl(Buffer.from("<svg/>")),
    dataUrl(bytes(player.photo), "png"),
    dataUrl(Buffer.alloc(257 * 1024)),
    dataUrl(huge),
  ];
  for (const photo of invalid)
    assert.equal(
      (await api(`players/${player.id}`, "PUT", { photo })).status,
      400,
    );
  assert.equal((await api(`players/${player.id}`)).data.photo, player.photo);
});

test("birth dates and public aliases are validated together; either may be removed", async () => {
  for (const birthDate of [
    "2035-01-01",
    "2017-02-29",
    "2016-04-31",
    "20/11/2016",
    "1899-01-01",
    "",
  ]) {
    assert.equal(
      (await api(`players/${player.id}`, "PUT", { birthDate })).status,
      400,
      birthDate,
    );
  }
  assert.equal(
    (
      await api("players", "POST", {
        name: "No birthday",
        birthdayPublicName: "Luca",
      })
    ).status,
    400,
  );
  assert.equal(
    (await api(`players/${player.id}`, "PUT", { birthdayPublicName: "" }))
      .status,
    400,
  );
  assert.equal(
    (
      await api(`players/${player.id}`, "PUT", {
        birthdayPublicName: "  Luca  ",
      })
    ).data.birthdayPublicName,
    "Luca",
  );
  assert.equal(
    (await api(`players/${player.id}`, "PUT", { birthDate: null })).status,
    400,
  );
  const clear = await api(`players/${player.id}`, "PUT", {
    photo: null,
    birthDate: null,
    birthdayPublicName: null,
  });
  assert.equal(clear.status, 200);
  assert.equal(clear.data.photo, null);
  assert.equal(clear.data.birthDate, null);
  assert.equal(clear.data.birthdayPublicName, null);
});

test("birthdays follow the Rome day, exclude archives and do not disclose birth year or age", async () => {
  const insert = getDb().prepare(
    "INSERT INTO players (name,birth_date,birthday_public_name,archived_at,photo) VALUES (?,?,?,?,?)",
  );
  insert.run(
    "Nome privato del festeggiato",
    "2016-11-19",
    "Luca & <Matteo>",
    null,
    player.photo,
  );
  insert.run("Altro profilo privato", "2015-11-19", null, null, null);
  insert.run(
    "Archiviato privato",
    "2014-11-19",
    "Archiviato",
    "2026-11-01",
    null,
  );
  const now = new Date("2026-11-18T23:10:00Z");
  assert.equal(romeDay(now), "2026-11-19");
  assert.deepEqual(
    birthdaysToday(new Date("2026-11-18T22:59:00Z")).players,
    [],
  );
  const privateBirthdays = birthdaysToday(now);
  assert.equal(privateBirthdays.players.length, 2);
  assert.equal(privateBirthdays.date, "2026-11-19");
  for (const entry of privateBirthdays.players)
    assert.deepEqual(Object.keys(entry).sort(), ["id", "name", "photo"]);
  assert.deepEqual(publicBirthdaysToday(now), {
    day: "2026-11-19",
    names: ["Luca & <Matteo>"],
  });
  const model = publicSiteModel(now);
  assert.deepEqual(model.birthday, publicBirthdaysToday(now));
  assert.doesNotMatch(
    JSON.stringify(model),
    /Nome privato|Altro profilo|Archiviato|2016-11-19|data:image|birth_date|photo/,
  );
  const html = (await renderPublicSite(now, model)).get("/index.html");
  assert.match(html, /Luca &amp; &lt;Matteo&gt;/);
  assert.doesNotMatch(html, /Nome privato|2016-11-19|data:image|<Matteo>/);
  assert.equal(
    publicSiteModel(new Date("2026-11-19T23:01:00Z")).birthday,
    null,
  );
  const today = romeDay();
  insert.run("Compleanno API oggi", `2000-${today.slice(5)}`, null, null, null);
  const endpoint = await api("players/birthdays");
  assert.equal(endpoint.status, 200);
  assert.equal(endpoint.data.date, today);
  assert.ok(
    endpoint.data.players.some((item) => item.name === "Compleanno API oggi"),
  );
});

test("leap birthdays have one reminder per year and midnight scheduling survives DST", () => {
  assert.equal(isBirthdayOn("2016-02-29", "2027-02-28"), true);
  assert.equal(isBirthdayOn("2016-02-29", "2028-02-28"), false);
  assert.equal(isBirthdayOn("2016-02-29", "2028-02-29"), true);
  assert.equal(isBirthdayOn("2016-02-29", "2027-03-01"), false);
  for (const [start, end] of [
    ["2026-03-28T23:01:00Z", "2026-03-29T22:00:00Z"],
    ["2026-10-24T22:01:00Z", "2026-10-25T23:00:00Z"],
  ]) {
    const now = new Date(start);
    assert.equal(
      now.getTime() + millisecondsUntilNextDailyRefresh(now, "00:00:00"),
      new Date(end).getTime(),
    );
  }
});

test("photo and birthday data survive export/import exactly, including legacy backups", async () => {
  await api(`players/${player.id}`, "PUT", {
    photo: player.photo,
    birthDate: "2016-02-29",
    birthdayPublicName: "Profilo",
  });
  const backup = (await api("data/export")).data;
  const saved = backup.players.find((item) => item.id === player.id);
  assert.equal(saved.photo, player.photo);
  assert.equal(saved.birth_date, "2016-02-29");
  assert.equal(saved.birthday_public_name, "Profilo");
  const preview = await api("data/import/preview", "POST", backup);
  assert.equal(preview.status, 200);
  const result = await api("data/import", "POST", {
    backup,
    confirmReplace: true,
    expectedRevision: preview.data.expectedRevision,
  });
  assert.equal(result.status, 200);
  assert.deepEqual((await api("data/export")).data.players, backup.players);
  const legacy = structuredClone(backup);
  for (const item of legacy.players)
    for (const key of ["photo", "birth_date", "birthday_public_name"])
      delete item[key];
  const legacyPreview = (await api("data/import/preview", "POST", legacy)).data;
  assert.equal(
    (
      await api("data/import", "POST", {
        backup: legacy,
        confirmReplace: true,
        expectedRevision: legacyPreview.expectedRevision,
      })
    ).status,
    200,
  );
  const legacyPlayer = (await api(`players/${player.id}`)).data;
  assert.equal(legacyPlayer.photo, null);
  assert.equal(legacyPlayer.birthDate, null);
  assert.equal(legacyPlayer.birthdayPublicName, null);
});

test("malformed backup photos and inconsistent birthday flags fail before backup or replacement", async () => {
  const backup = (await api("data/export")).data;
  const files = await readdir(directory);
  const preview = (await api("data/import/preview", "POST", backup)).data;
  for (const changes of [
    { photo: dataUrl(Buffer.from("invalid"), "jpeg") },
    { photo: dataUrl(source) },
    { birthday_public_name: "Alias", birth_date: null },
    { birth_date: "2015-02-29" },
  ]) {
    const invalid = structuredClone(backup);
    Object.assign(invalid.players[0], changes);
    assert.equal(
      (await api("data/import/preview", "POST", invalid)).status,
      400,
    );
    assert.equal(
      (
        await api("data/import", "POST", {
          backup: invalid,
          confirmReplace: true,
          expectedRevision: preview.expectedRevision,
        })
      ).status,
      400,
    );
  }
  assert.deepEqual(await readdir(directory), files);
  assert.deepEqual((await api("data/export")).data.players, backup.players);
});
