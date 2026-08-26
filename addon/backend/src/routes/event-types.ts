import { Request, Response, Router } from "express";
import { z } from "zod";
import { rowToEventTypeDef } from "../db/helpers";
import { getDb } from "../db/schema";
import type { EventTypeDefRow } from "../types";

const router = Router();

/** Normalizza un testo libero in una chiave valida (minuscolo, solo [a-z0-9_-]). */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // rimuove gli accenti
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const EventTypeSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .transform(slugify)
    .refine((v) => v.length > 0, "Inserisci un nome valido per la chiave"),
  label: z.string().trim().min(1),
  icon: z.string().trim().min(1).default("⚽"),
  hasOpponent: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

// GET /api/event-types
router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM event_types ORDER BY sort_order ASC, label ASC")
    .all() as unknown as EventTypeDefRow[];
  res.json(rows.map(rowToEventTypeDef));
});

// POST /api/event-types
router.post("/", (req: Request, res: Response) => {
  const parse = EventTypeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const { key, label, icon, hasOpponent, sortOrder } = parse.data;
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM event_types WHERE key = ?")
    .get(key);
  if (existing) {
    res.status(409).json({ error: `Esiste già un tipo con chiave "${key}"` });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO event_types (key, label, icon, has_opponent, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(key, label, icon, hasOpponent ? 1 : 0, sortOrder);

  const row = db
    .prepare("SELECT * FROM event_types WHERE id = ?")
    .get(result.lastInsertRowid) as unknown as EventTypeDefRow;
  res.status(201).json(rowToEventTypeDef(row));
});

// PUT /api/event-types/:id
router.put("/:id", (req: Request, res: Response) => {
  const parse = EventTypeSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM event_types WHERE id = ?")
    .get(req.params.id) as EventTypeDefRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Tipo evento non trovato" });
    return;
  }

  const e = parse.data;
  db.prepare(
    `UPDATE event_types SET
      key = ?, label = ?, icon = ?, has_opponent = ?, sort_order = ?
     WHERE id = ?`,
  ).run(
    e.key ?? existing.key,
    e.label ?? existing.label,
    e.icon ?? existing.icon,
    e.hasOpponent !== undefined ? (e.hasOpponent ? 1 : 0) : existing.has_opponent,
    e.sortOrder ?? existing.sort_order,
    req.params.id,
  );

  const row = db
    .prepare("SELECT * FROM event_types WHERE id = ?")
    .get(req.params.id) as unknown as EventTypeDefRow;
  res.json(rowToEventTypeDef(row));
});

// DELETE /api/event-types/:id
router.delete("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const inUse = db
    .prepare(
      "SELECT COUNT(*) AS n FROM events WHERE type = (SELECT key FROM event_types WHERE id = ?)",
    )
    .get(req.params.id) as { n: number };
  if (inUse.n > 0) {
    res.status(409).json({
      error: `Impossibile eliminare: ${inUse.n} evento/i usano ancora questo tipo`,
    });
    return;
  }

  const result = db
    .prepare("DELETE FROM event_types WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Tipo evento non trovato" });
    return;
  }
  res.status(204).send();
});

export default router;
