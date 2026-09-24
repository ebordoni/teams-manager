import { Request, Response, Router } from "express";
import { z } from "zod";
import { rowToPlayer } from "../db/helpers";
import { getDb } from "../db/schema";
import type { PlayerRow } from "../types";

const router = Router();

const PlayerSchema = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().optional().nullable(),
  secondaryRoles: z.array(z.string()).optional().default([]),
  jerseyNumber: z.number().int().min(1).max(99).optional().nullable(),
  preferredFoot: z.enum(["right", "left", "both"]).optional(),
  fitness: z.number().int().min(0).max(100).optional(),
  speed: z.number().int().min(0).max(100).optional(),
  technique: z.number().int().min(0).max(100).optional(),
  shooting: z.number().int().min(0).max(100).optional(),
  defending: z.number().int().min(0).max(100).optional(),
  attacking: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
});

function jerseyNumberInUse(jerseyNumber: number, exceptPlayerId?: string): boolean {
  const row = getDb().prepare(
    `SELECT 1 FROM players WHERE jersey_number = ?${exceptPlayerId ? " AND id != ?" : ""} LIMIT 1`,
  ).get(jerseyNumber, ...(exceptPlayerId ? [exceptPlayerId] : []));
  return Boolean(row);
}

// GET /api/players
router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM players WHERE archived_at IS NULL ORDER BY name ASC")
    .all() as unknown as PlayerRow[];
  res.json(rows.map(rowToPlayer));
});

// GET /api/players/:id
router.get("/:id/attendance-history", (req: Request, res: Response) => {
  const db = getDb();
  const player = db.prepare("SELECT id FROM players WHERE id = ?").get(req.params.id);
  if (!player) return void res.status(404).json({ error: "Player not found" });
  const rows = db.prepare(
    `SELECT e.id AS eventId, e.date AS date, e.type AS type, e.opponent AS opponent, a.status AS status
     FROM attendance a JOIN events e ON e.id = a.event_id
     WHERE a.player_id = ? AND e.attendance_finalized_at IS NOT NULL
     ORDER BY e.date DESC, e.id DESC`,
  ).all(req.params.id);
  res.json(rows);
});

// GET /api/players/:id/statistics — gol registrati nei risultati partita.
router.get("/:id/statistics", (req: Request, res: Response) => {
  const db = getDb();
  const player = db.prepare("SELECT id FROM players WHERE id = ?").get(req.params.id);
  if (!player) return void res.status(404).json({ error: "Player not found" });

  const rows = db.prepare("SELECT scorers FROM match_results").all() as Array<{ scorers: string }>;
  let goals = 0;
  let matchesScored = 0;
  for (const row of rows) {
    try {
      const scorer = (JSON.parse(row.scorers) as Array<{ playerId: number; goals: number }>).find((item) => item.playerId === Number(req.params.id));
      if (scorer) {
        goals += scorer.goals;
        matchesScored += 1;
      }
    } catch {
      // Una riga storica non valida non deve impedire la consultazione delle statistiche.
    }
  }
  res.json({ goals, matchesScored });
});

router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM players WHERE id = ?")
    .get(req.params.id) as PlayerRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(rowToPlayer(row));
});

// POST /api/players
router.post("/", (req: Request, res: Response) => {
  const parse = PlayerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const { name, role, secondaryRoles, jerseyNumber, preferredFoot, fitness, speed, technique, shooting, defending, attacking, notes } = parse.data;
  if (jerseyNumber !== null && jerseyNumber !== undefined && jerseyNumberInUse(jerseyNumber)) {
    return void res.status(400).json({ error: "Numero di maglia già assegnato" });
  }
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO players
        (name, role, secondary_roles, jersey_number, preferred_foot, fitness, speed, technique, shooting, defending, attacking, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(name, role ?? null, JSON.stringify(secondaryRoles), jerseyNumber ?? null, preferredFoot ?? "both", fitness ?? 50, speed ?? 50, technique ?? 50, shooting ?? 50, defending ?? 50, attacking ?? 50, notes ?? null);

  const row = db
    .prepare("SELECT * FROM players WHERE id = ?")
    .get(result.lastInsertRowid) as unknown as PlayerRow;
  res.status(201).json(rowToPlayer(row));
});

// PUT /api/players/:id
router.put("/:id", (req: Request, res: Response) => {
  const parse = PlayerSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM players WHERE id = ?")
    .get(req.params.id) as PlayerRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const { name, role, secondaryRoles, jerseyNumber, preferredFoot, fitness, speed, technique, shooting, defending, attacking, notes } = parse.data;
  if (jerseyNumber !== null && jerseyNumber !== undefined && jerseyNumberInUse(jerseyNumber, req.params.id)) {
    return void res.status(400).json({ error: "Numero di maglia già assegnato" });
  }
  db.prepare(
    `UPDATE players SET name = ?, role = ?, secondary_roles = ?, jersey_number = ?, preferred_foot = ?,
      fitness = ?, speed = ?, technique = ?, shooting = ?, defending = ?, attacking = ?, notes = ?
     WHERE id = ?`,
  ).run(
    name ?? existing.name,
    role !== undefined ? role : existing.role,
    secondaryRoles ? JSON.stringify(secondaryRoles) : existing.secondary_roles,
    jerseyNumber !== undefined ? jerseyNumber : existing.jersey_number,
    preferredFoot ?? existing.preferred_foot,
    fitness ?? existing.fitness,
    speed ?? existing.speed,
    technique ?? existing.technique,
    shooting ?? existing.shooting,
    defending ?? existing.defending,
    attacking ?? existing.attacking,
    notes !== undefined ? notes : existing.notes,
    req.params.id,
  );

  const row = db
    .prepare("SELECT * FROM players WHERE id = ?")
    .get(req.params.id) as unknown as PlayerRow;
  res.json(rowToPlayer(row));
});

// DELETE /api/players/:id
router.delete("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const player = db.prepare("SELECT id FROM players WHERE id = ?").get(req.params.id);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  const historicalAttendance = db.prepare(
    `SELECT 1 FROM attendance a JOIN events e ON e.id = a.event_id
     WHERE a.player_id = ? AND e.attendance_finalized_at IS NOT NULL LIMIT 1`,
  ).get(req.params.id);
  if (historicalAttendance) {
    db.prepare("UPDATE players SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP) WHERE id = ?").run(req.params.id);
    res.json({ archived: true });
    return;
  }
  db.prepare("DELETE FROM players WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
