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

  // Solo i giocatori convocati per l'evento hanno senso di presenza/assenza.
  // `recorded` distingue lo stato realmente salvato dal default proposto.
  const rows = db
    .prepare(
      `SELECT p.id AS playerId, p.name AS playerName,
              COALESCE(a.status, 'present') AS status,
              a.status IS NOT NULL AS recorded
       FROM players p
       JOIN callups c ON c.player_id = p.id AND c.event_id = ?
       LEFT JOIN attendance a ON a.player_id = p.id AND a.event_id = ?
       ORDER BY p.name ASC`,
    )
    .all(eventId, eventId) as unknown as Array<
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
