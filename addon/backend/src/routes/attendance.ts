import { Request, Response, Router } from "express";
import { z } from "zod";
import { getDb } from "../db/schema";
import type { Attendance } from "../types";

const router = Router({ mergeParams: true });

const AttendanceSchema = z.object({
  records: z.array(
    z.object({
      playerId: z.number().int().positive(),
      status: z.enum(["present", "absent", "excused"]),
    }),
  ),
});

function findEvent(eventId: string) {
  return getDb()
    .prepare("SELECT id, attendance_finalized_at FROM events WHERE id = ?")
    .get(eventId) as { id: number; attendance_finalized_at: string | null } | undefined;
}

router.get("/status", (req: Request, res: Response) => {
  const event = findEvent(req.params.id);
  if (!event) return void res.status(404).json({ error: "Event not found" });
  res.json({ finalizedAt: event.attendance_finalized_at });
});

// GET /api/events/:id/attendance — tutti i giocatori sono presenti di default.
router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const eventId = req.params.id;

  const event = findEvent(eventId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  // La presenza riguarda tutta la rosa: l'assenza è l'unica eccezione che
  // l'operatore deve indicare. `recorded` distingue il default dal salvataggio.
  const rows = db
    .prepare(
      `SELECT p.id AS playerId, p.name AS playerName,
              COALESCE(a.status, 'present') AS status,
              a.status IS NOT NULL AS recorded
       FROM players p
       LEFT JOIN attendance a ON a.player_id = p.id AND a.event_id = ?
       ORDER BY p.name ASC`,
    )
    .all(eventId) as unknown as Array<
    Omit<Attendance, "recorded"> & { recorded: number }
  >;

  res.json(rows.map((row) => ({ ...row, recorded: row.recorded === 1 })));
});

// PUT /api/events/:id/attendance — body: { records: [{ playerId, status }] }
router.put("/", (req: Request, res: Response) => {
  const parse = AttendanceSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  const db = getDb();
  const eventId = req.params.id;
  const event = findEvent(eventId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (event.attendance_finalized_at) {
    return void res.status(409).json({
      error: "Il registro presenze è chiuso: riaprilo prima di modificarlo",
    });
  }

  const { records } = parse.data;

  db.exec("BEGIN");
  try {
    const upsert = db.prepare(
      `INSERT INTO attendance (event_id, player_id, status) VALUES (?, ?, ?)
       ON CONFLICT(event_id, player_id) DO UPDATE SET status = excluded.status`,
    );
    for (const record of records) {
      upsert.run(eventId, record.playerId, record.status);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  res.json({ eventId: Number(eventId), recordCount: records.length });
});

// POST /api/events/:id/attendance/finalize — salva una fotografia completa della rosa.
router.post("/finalize", (req: Request, res: Response) => {
  const parse = AttendanceSchema.safeParse(req.body);
  if (!parse.success) return void res.status(400).json({ error: parse.error.flatten() });
  const db = getDb();
  const event = findEvent(req.params.id);
  if (!event) return void res.status(404).json({ error: "Event not found" });
  if (event.attendance_finalized_at) {
    return void res.status(409).json({ error: "Il registro presenze è già chiuso" });
  }

  const submitted = new Map(parse.data.records.map((record) => [record.playerId, record.status]));
  const players = db.prepare("SELECT id FROM players ORDER BY id").all() as Array<{ id: number }>;
  const existing = new Map(
    (db.prepare("SELECT player_id, status FROM attendance WHERE event_id = ?").all(req.params.id) as Array<{ player_id: number; status: Attendance["status"] }>).
      map((record) => [record.player_id, record.status]),
  );
  const upsert = db.prepare(
    `INSERT INTO attendance (event_id, player_id, status) VALUES (?, ?, ?)
     ON CONFLICT(event_id, player_id) DO UPDATE SET status = excluded.status`,
  );
  db.exec("BEGIN");
  try {
    for (const player of players) {
      upsert.run(req.params.id, player.id, submitted.get(player.id) ?? existing.get(player.id) ?? "present");
    }
    db.prepare("UPDATE events SET attendance_finalized_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const finalized = findEvent(req.params.id)!;
  res.json({ eventId: finalized.id, finalizedAt: finalized.attendance_finalized_at, recordCount: players.length });
});

router.post("/reopen", (req: Request, res: Response) => {
  const event = findEvent(req.params.id);
  if (!event) return void res.status(404).json({ error: "Event not found" });
  getDb().prepare("UPDATE events SET attendance_finalized_at = NULL WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
