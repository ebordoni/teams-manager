import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { config } from "./config";
import { initDb } from "./db/schema";
import aiRouter from "./routes/ai";
import attendanceRouter from "./routes/attendance";
import calendarExportRouter from "./routes/calendar-export";
import communicationsRouter from "./routes/communications";
import eventTypesRouter from "./routes/event-types";
import eventsRouter from "./routes/events";
import formationsRouter from "./routes/formations";
import googleRouter from "./routes/google";
import matchPlansRouter from "./routes/match-plans";
import playersRouter from "./routes/players";
import settingsRouter from "./routes/settings";

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

export function createApp() {
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
  app.use("/api/events/:id/attendance", attendanceRouter);
  app.use("/api/events/:id/match-plans", matchPlansRouter);
  app.use("/api/event-types", eventTypesRouter);
  app.use("/api/formations", formationsRouter);
  app.use("/api/google", googleRouter);
  app.use("/api/google/calendar", calendarExportRouter);
  app.use("/api/communications", communicationsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/ai", aiRouter);

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
    // SPA fallback. Il frontend usa solo URL relativi (base "api" + HashRouter),
    // quindi funziona sotto qualsiasi path Ingress senza riscritture lato server.
    app.get("*", (_req: Request, res: Response) => {
      res.type("html").send(indexHtml);
    });
  }

  // ── Global error handler ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[error]", err.message);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

export const app = createApp();

export function startServer() {
  initDb();
  return app.listen(config.port, () => {
    console.log(
      `[server] Teams Manager running on port ${config.port} (${process.env.NODE_ENV ?? "development"})`,
    );
  });
}

if (require.main === module) startServer();

export default app;
