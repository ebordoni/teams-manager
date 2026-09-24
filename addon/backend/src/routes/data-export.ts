import { Router } from "express";
import { getDb } from "../db/schema";

const router = Router();

/** Esporta i dati gestionali, escludendo token OAuth, chiavi AI e stato di consenso. */
router.get("/export", (_req, res) => {
  const db = getDb();
  const schemaVersion = db.prepare("SELECT MAX(version) AS version FROM schema_version").get() as { version: number };
  const payload = {
    format: "teams-manager-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    schemaVersion: schemaVersion.version,
    players: db.prepare("SELECT * FROM players ORDER BY id").all(),
    eventTypes: db.prepare("SELECT * FROM event_types ORDER BY sort_order, id").all(),
    events: db.prepare("SELECT * FROM events ORDER BY date, id").all(),
    attendance: db.prepare("SELECT * FROM attendance ORDER BY event_id, player_id").all(),
    results: db.prepare("SELECT * FROM match_results ORDER BY event_id").all(),
    formations: db.prepare("SELECT * FROM formations ORDER BY id").all(),
    matchPlans: db.prepare("SELECT * FROM match_plans ORDER BY id").all(),
    matchPeriods: db.prepare("SELECT * FROM match_periods ORDER BY match_plan_id, period_number").all(),
  };
  const stamp = payload.exportedAt.slice(0, 10);
  res
    .status(200)
    .type("application/json")
    .setHeader("Content-Disposition", `attachment; filename="teams-manager-${stamp}.json"`)
    .send(JSON.stringify(payload, null, 2));
});

export default router;
