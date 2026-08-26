import { Request, Response, Router } from "express";
import { z } from "zod";
import { getDb } from "../db/schema";
import type { Callup, CallupRow } from "../types";

const router = Router({ mergeParams: true });

const CallupsSchema = z.object({
  playerIds: z.array(z.number().int().positive()),
});

// GET /api/events/:id/callups — elenco di tutti i giocatori con lo stato convocazione
router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const eventId = req.params.id;

  const event = db.prepare("SELECT id FROM events WHERE id = ?").get(eventId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const rows = db
    .prepare(
      `SELECT p.id AS playerId, p.name AS playerName,
              COALESCE(c.called_up, 0) AS calledUp
       FROM players p
       LEFT JOIN callups c ON c.player_id = p.id AND c.event_id = ?
       ORDER BY p.name ASC`,
    )
    .all(eventId) as unknown as Array<{
    playerId: number;
    playerName: string;
    calledUp: number;
  }>;

  const callups: Callup[] = rows.map((r) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    calledUp: r.calledUp === 1,
  }));

  res.json(callups);
});

// PUT /api/events/:id/callups — body: { playerIds: number[] } = giocatori convocati
router.put("/", (req: Request, res: Response) => {
  const parse = CallupsSchema.safeParse(req.body);
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

  const { playerIds } = parse.data;

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM callups WHERE event_id = ?").run(eventId);
    const insert = db.prepare(
      "INSERT INTO callups (event_id, player_id, called_up) VALUES (?, ?, 1)",
    );
    for (const playerId of playerIds) {
      insert.run(eventId, playerId);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const rows = db
    .prepare("SELECT * FROM callups WHERE event_id = ?")
    .all(eventId) as unknown as CallupRow[];
  res.json({ eventId: Number(eventId), callupCount: rows.length });
});

export default router;
