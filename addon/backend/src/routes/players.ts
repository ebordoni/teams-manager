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
  preferredFoot: z.enum(["right", "left", "both"]).optional(),
  fitness: z.number().int().min(0).max(100).optional(),
  speed: z.number().int().min(0).max(100).optional(),
  technique: z.number().int().min(0).max(100).optional(),
  shooting: z.number().int().min(0).max(100).optional(),
  defending: z.number().int().min(0).max(100).optional(),
  attacking: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/players
router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM players ORDER BY name ASC")
    .all() as unknown as PlayerRow[];
  res.json(rows.map(rowToPlayer));
});

// GET /api/players/:id
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
  const { name, role, secondaryRoles, preferredFoot, fitness, speed, technique, shooting, defending, attacking, notes } = parse.data;
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO players
        (name, role, secondary_roles, preferred_foot, fitness, speed, technique, shooting, defending, attacking, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(name, role ?? null, JSON.stringify(secondaryRoles), preferredFoot ?? "both", fitness ?? 50, speed ?? 50, technique ?? 50, shooting ?? 50, defending ?? 50, attacking ?? 50, notes ?? null);

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

  const { name, role, secondaryRoles, preferredFoot, fitness, speed, technique, shooting, defending, attacking, notes } = parse.data;
  db.prepare(
    `UPDATE players SET name = ?, role = ?, secondary_roles = ?, preferred_foot = ?,
      fitness = ?, speed = ?, technique = ?, shooting = ?, defending = ?, attacking = ?, notes = ?
     WHERE id = ?`,
  ).run(
    name ?? existing.name,
    role !== undefined ? role : existing.role,
    secondaryRoles ? JSON.stringify(secondaryRoles) : existing.secondary_roles,
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
  const result = db
    .prepare("DELETE FROM players WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.status(204).send();
});

export default router;
