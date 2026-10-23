import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import path from "node:path";
import { buildDemo, demoEvents } from "./render.mjs";
import { bundle } from "./cli.mjs";
import { CloudflareClient, configuration, mime } from "./cloudflare.mjs";
import { PUBLIC_ASSET_FILES, hashSiteFiles } from "../../addon/backend/src/services/public-site/assets.mjs";

const config = { accountId: "a".repeat(32), name: "teams-manager", token: "private-test-token" };
const ok = (result) => Response.json({ success: true, result });
const missing = () => Response.json({ success: false, errors: [{ code: 10007 }] }, { status: 404 });
const now = new Date("2026-10-24T22:30:00Z");

test("demo is deterministic, uses Rome dates and never repeats the featured appointment", () => {
  const files = buildDemo(now);
  assert.equal(demoEvents(now)[1].date, "2026-10-26");
  assert.equal(files.get("/index.html"), buildDemo(now).get("/index.html"));
  for (const id of [1, 2, 3, 4]) assert.equal(files.get("/index.html").split(`id="evento-${id}"`).length - 1, 1);
  assert.ok(files.has("/avvisi/index.html") && files.has("/informazioni/index.html") && files.has("/404.html"));
  for (const html of [...files].filter(([name]) => name.endsWith(".html")).map(([, text]) => text)) {
    assert.match(html, /Dati fittizi/);
    assert.match(html, /name="viewport"/);
    assert.match(html, /<details class="menu"><summary/);
    assert.match(html, /class="team-logo" src="\/logo.png"/);
    assert.match(html, /Bacheca avvisi e appuntamenti/);
    assert.doesNotMatch(html, /<script[^>]*>[^<]+<\/script>|iframe|api\.notion|localhost|private-test-token/);
  }
});

test("bundle contains local assets, security headers and revision metadata", async () => {
  const files = await bundle();
  for (const filename of PUBLIC_ASSET_FILES) assert.ok(files.has(`/${filename}`), filename);
  assert.equal(files.size, buildDemo().size + PUBLIC_ASSET_FILES.length + 1);
  assert.match(files.get("/_headers"), /Content-Security-Policy/);
  assert.match(files.get("/_headers"), /font-src 'self'/);
  assert.ok(files.get("/style.css").length > 100);
  assert.match(files.get("/style.css"), /font-family: "Poppins"/);
  assert.doesNotMatch(files.get("/style.css"), /fonts\.googleapis|fonts\.gstatic/);
  assert.equal(files.get("/logo.png").subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(mime("/logo.png"), "image/png");
  for (const weight of [400, 500, 600, 700]) {
    const filename = `/fonts/poppins-latin-${weight}.woff2`;
    assert.equal(files.get(filename).subarray(0, 4).toString(), "wOF2");
    assert.equal(mime(filename), "font/woff2");
    assert.ok(files.get("/style.css").includes(filename));
  }
  assert.match(files.get("/fonts/OFL.txt"), /SIL OPEN FONT LICENSE/);
  assert.match(JSON.parse(files.get("/manifest.json")).revision, /^[a-f0-9]{64}$/);
});

test("compact introduction puts the featured appointment before notices", () => {
  const html = buildDemo(now).get("/index.html");
  assert.match(html, /<section class="intro"><h1>Appuntamenti<\/h1>/);
  assert.doesNotMatch(html, /Ci vediamo|in campo\./);
  assert.ok(html.indexOf('id="evento-2"') < html.indexOf('class="event notice"'));
});

test("asset revision hashes binary bytes deterministically and includes path names", () => {
  const files = new Map([["/logo.png", Buffer.from([0x80])], ["/style.css", "body {}"]]);
  const hash = hashSiteFiles(files);
  assert.equal(hashSiteFiles(new Map([...files].reverse())), hash);
  // Both invalid UTF-8 bytes stringify to the same replacement character.
  files.set("/logo.png", Buffer.from([0x81]));
  assert.notEqual(hashSiteFiles(files), hash);
  files.set("/logo.png", Buffer.from([0x80]));
  files.set("/fonts/test.woff2", files.get("/logo.png"));
  files.delete("/logo.png");
  assert.notEqual(hashSiteFiles(files), hash);
});

test("configuration refuses malformed account IDs, worker names and credentials", () => {
  assert.throws(() => configuration({}), /Account ID/);
  assert.throws(() => configuration({ CLOUDFLARE_ACCOUNT_ID: config.accountId }), /token/i);
  assert.throws(() => configuration({ CLOUDFLARE_ACCOUNT_ID: config.accountId, CLOUDFLARE_API_TOKEN: "secret", CLOUDFLARE_WORKER_NAME: "../other" }), /Nome/);
});

test("verify is read-only and distinguishes missing from foreign workers", async () => {
  const calls = [];
  const client = new CloudflareClient(config, async (url, options) => {
    calls.push(options.method);
    return url.endsWith("/subdomain") ? ok({ subdomain: "example" }) : missing();
  });
  assert.deepEqual(await client.verify(), { url: "https://teams-manager.example.workers.dev", exists: false, owned: false });
  assert.deepEqual(calls, ["GET", "GET"]);
  const foreign = new CloudflareClient(config, async (url) => url.endsWith("/subdomain") ? ok({ subdomain: "example" }) : ok({ tags: [] }));
  await assert.rejects(foreign.deploy(buildDemo(now)), /non è riconosciuto/);
});

test("missing response must be explicit; gateway errors must never allow creation", async () => {
  let count = 0;
  const client = new CloudflareClient(config, async () => {
    count++;
    return count === 1 ? ok({ subdomain: "example" }) : new Response("Bad gateway private-test-token", { status: 502 });
  });
  await assert.rejects(client.deploy(buildDemo(now)), (error) => /HTTP 502/.test(error.message) && !error.message.includes(config.token));
  assert.equal(count, 2);
});

function mockDeployment({ failUpload = false, bucketsEmpty = false, owned = false, files = buildDemo(now) } = {}) {
  const requests = [];
  let manifest;
  const fetcher = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes(".workers.dev/")) {
      assert.equal(options.headers, undefined, "public verification must never receive credentials");
      return Response.json(JSON.parse(files.get("/manifest.json")));
    }
    if (url.endsWith("/workers/subdomain")) return ok({ subdomain: "example" });
    if (url.endsWith("/settings")) return owned ? ok({ tags: ["teams-manager-public-site-prototype"] }) : missing();
    if (url.endsWith("/assets-upload-session")) {
      manifest = JSON.parse(options.body).manifest;
      return ok({ jwt: "upload-jwt", buckets: bucketsEmpty ? [] : [Object.values(manifest).map((item) => item.hash)] });
    }
    if (url.includes("/assets/upload")) {
      assert.equal(options.headers.Authorization, "Bearer upload-jwt");
      for (const [hash, blob] of options.body.entries()) {
        const filename = Object.keys(manifest).find((name) => manifest[name].hash === hash);
        assert.equal(await blob.text(), Buffer.from(files.get(filename)).toString("base64"));
        const expected = createHash("sha256").update(await blob.text() + path.extname(filename).slice(1)).digest("hex").slice(0, 32);
        assert.equal(hash, expected);
      }
      return failUpload ? Response.json({ success: false }, { status: 400 }) : ok({ jwt: "completion-jwt" });
    }
    if (url.endsWith("/scripts/teams-manager")) {
      assert.equal(options.method, "PUT");
      const metadata = JSON.parse(options.body.get("metadata"));
      assert.equal(metadata.assets.jwt, bucketsEmpty ? "upload-jwt" : "completion-jwt");
      assert.equal(metadata.assets.config.run_worker_first, false);
      assert.equal(metadata.main_module, undefined, "static-only prototype must not add runtime code");
      return ok({ id: "teams-manager" });
    }
    if (url.endsWith("/scripts/teams-manager/subdomain")) {
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), { enabled: true, previews_enabled: false });
      return ok({ enabled: true });
    }
    assert.fail(`Unexpected request: ${url}`);
  };
  return { files, requests, client: new CloudflareClient(config, fetcher) };
}

test("deploy follows manifest and base64 upload protocol, activates static assets and verifies the public revision", async () => {
  const { client, files, requests } = mockDeployment();
  const result = await client.deploy(files);
  assert.equal(result.url, "https://teams-manager.example.workers.dev");
  assert.equal(requests.filter(({ options }) => options.method === "PUT").length, 1);
});

test("failed upload must never activate or enable a site", async () => {
  const { client, files, requests } = mockDeployment({ failUpload: true });
  await assert.rejects(client.deploy(files), /HTTP 400/);
  assert.equal(requests.some(({ options }) => options.method === "PUT"), false);
  assert.equal(requests.some(({ url }) => url.includes("/teams-manager/subdomain")), false);
});

test("owned worker updates can reuse existing assets when the manifest requires no uploads", async () => {
  const { client, files, requests } = mockDeployment({ bucketsEmpty: true, owned: true });
  await client.deploy(files);
  assert.equal(requests.some(({ url }) => url.includes("assets/upload?")), false);
});

test("the real CLI bundle including _headers can be deployed", async () => {
  const files = await bundle();
  const { client } = mockDeployment({ files });
  const result = await client.deploy(files);
  assert.equal(result.fileCount, files.size);
  assert.ok(files.has("/_headers"));
});

test("allowing underscores must not allow traversal or unsafe asset paths", async () => {
  for (const filename of ["/../secret.txt", "/assets/../../secret.txt", "/assets\\secret.txt", "/file?query.txt", "relative.txt"]) {
    const files = buildDemo(now);
    files.set(filename, "must not be uploaded");
    const { client, requests } = mockDeployment({ files });
    await assert.rejects(client.deploy(files), /Percorso asset non valido/);
    assert.ok(requests.every(({ options }) => options.method === "GET"), "invalid paths must be rejected before any write");
  }
});
