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

// GET /api/events/:id/attendance — stato presenza di tutti i convocati
router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const eventId = req.params.id;

  const event = db.prepare("SELECT id FROM events WHERE id = ?").get(eventId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  // Solo i giocatori convocati per l'evento hanno senso di presenza/assenza
  const rows = db
    .prepare(
      `SELECT p.id AS playerId, p.name AS playerName,
              COALESCE(a.status, 'present') AS status
       FROM players p
       JOIN callups c ON c.player_id = p.id AND c.event_id = ?
       LEFT JOIN attendance a ON a.player_id = p.id AND a.event_id = ?
       ORDER BY p.name ASC`,
    )
    .all(eventId, eventId) as unknown as Attendance[];

  res.json(rows);
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
  const event = db.prepare("SELECT id FROM events WHERE id = ?").get(eventId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
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

export default router;
