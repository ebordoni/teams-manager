import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { config } from "./config";
import { initDb } from "./db/schema";
import attendanceRouter from "./routes/attendance";
import callupsRouter from "./routes/callups";
import communicationsRouter from "./routes/communications";
import eventsRouter from "./routes/events";
import googleRouter from "./routes/google";
import playersRouter from "./routes/players";

function resolveVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8"),
    ) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
const APP_VERSION = resolveVersion();

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Normalize double slashes in the request path that HA Ingress can produce
app.use((req, _res, next) => {
  req.url = req.url.replace(/\/+/g, "/");
  next();
});

// Allow Vite dev server origin in development only
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: "http://localhost:5175" }));
}

// ── API routes ─────────────────────────────────────────────────────────────
app.use("/api/players", playersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/events/:id/callups", callupsRouter);
app.use("/api/events/:id/attendance", attendanceRouter);
app.use("/api/google", googleRouter);
app.use("/api/communications", communicationsRouter);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  });
});

// Any unmatched /api/* route is a genuine 404
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Frontend static files (production / HA addon) ──────────────────────────
const frontendDir = process.env.FRONTEND_DIR;
if (frontendDir) {
  app.use(express.static(frontendDir));
  const indexHtml = fs.readFileSync(
    path.join(frontendDir, "index.html"),
    "utf-8",
  );
  // SPA fallback: inject the HA Ingress base path so the frontend can build
  // correct API URLs regardless of the ingress token.
  app.get("*", (req: Request, res: Response) => {
    const ingressBase =
      (req.headers["x-ingress-path"] as string | undefined) ?? "";
    const html = ingressBase
      ? indexHtml.replace(
          "</head>",
          `<script>window.__INGRESS_BASE__="${ingressBase}"</script></head>`,
        )
      : indexHtml;
    res.type("html").send(html);
  });
}

// ── Global error handler ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────
initDb();

app.listen(config.port, () => {
  console.log(
    `[server] GIPS Calcio running on port ${config.port} (${process.env.NODE_ENV ?? "development"})`,
  );
});

export default app;
