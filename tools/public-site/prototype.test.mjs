import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import path from "node:path";
import { buildDemo, demoEvents } from "./render.mjs";
import { bundle } from "./cli.mjs";
import { CloudflareClient, configuration } from "./cloudflare.mjs";

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
    assert.doesNotMatch(html, /<script[^>]*>[^<]+<\/script>|iframe|api\.notion|localhost|private-test-token/);
  }
});

test("bundle contains local assets, security headers and revision metadata", async () => {
  const files = await bundle();
  assert.equal(files.size, 9);
  assert.match(files.get("/_headers"), /Content-Security-Policy/);
  assert.ok(files.get("/style.css").length > 100);
  assert.match(JSON.parse(files.get("/manifest.json")).revision, /^[a-f0-9]{64}$/);
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
