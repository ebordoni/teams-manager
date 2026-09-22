import { Request, Response, Router } from "express";
import { z } from "zod";
import { rowToEvent } from "../db/helpers";
import { getDb } from "../db/schema";
import type { EventRow } from "../types";

const router = Router();

const EventSchema = z.object({
  type: z.string().trim().min(1),
  date: z.string().trim().min(1), // YYYY-MM-DD
  startTime: z.string().trim().optional().nullable(),
  endTime: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  opponent: z.string().trim().optional().nullable(),
  meetingTime: z.string().trim().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["scheduled", "modified", "cancelled"]).optional(),
  formationId: z.number().int().positive().optional().nullable(),
});

const FiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.string().optional(),
});

function isKnownEventType(type: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM event_types WHERE key = ?").get(type);
  return Boolean(row);
}

function isKnownFormation(formationId: number): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM formations WHERE id = ?")
    .get(formationId);
  return Boolean(row);
}

/**
 * Un evento modificato/annullato deve riportare in "notes" il motivo, così i
 * genitori vedono sempre perché l'appuntamento è cambiato.
 */
const STATUS_NOTES_ERROR =
  "Le note sono obbligatorie quando l'evento è modificato o annullato";

function statusNotesMissing(
  status: string | null | undefined,
  notes: string | null | undefined,
): boolean {
  return (
    status !== undefined &&
    status !== null &&
    status !== "scheduled" &&
    !notes?.trim()
  );
}

// GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD&type=match
router.get("/", (req: Request, res: Response) => {
  const parse = FiltersSchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const { from, to, type } = parse.data;
  const db = getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (from) {
    conditions.push("date >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("date <= ?");
    params.push(to);
  }
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM events ${where} ORDER BY date ASC, start_time ASC`)
    .all(...params) as unknown as EventRow[];

  res.json(rows.map(rowToEvent));
});

// GET /api/events/:id
router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(req.params.id) as EventRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(rowToEvent(row));
});

// POST /api/events
router.post("/", (req: Request, res: Response) => {
  const parse = EventSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const e = parse.data;
  if (!isKnownEventType(e.type)) {
    res.status(400).json({ error: `Tipo evento sconosciuto: "${e.type}"` });
    return;
  }
  if (
    e.formationId !== null &&
    e.formationId !== undefined &&
    !isKnownFormation(e.formationId)
  ) {
    res.status(400).json({ error: "Formazione non trovata" });
    return;
  }
  if (statusNotesMissing(e.status, e.notes)) {
    res.status(400).json({ error: STATUS_NOTES_ERROR });
    return;
  }
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO events
        (type, date, start_time, end_time, location, address, opponent, meeting_time, notes, status, formation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      e.type,
      e.date,
      e.startTime ?? null,
      e.endTime ?? null,
      e.location ?? null,
      e.address ?? null,
      e.opponent ?? null,
      e.meetingTime ?? null,
      e.notes ?? null,
      e.status ?? "scheduled",
      e.formationId ?? null,
    );

  const row = db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(result.lastInsertRowid) as unknown as EventRow;
  res.status(201).json(rowToEvent(row));
});

// PUT /api/events/:id
router.put("/:id", (req: Request, res: Response) => {
  const parse = EventSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(req.params.id) as EventRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const e = parse.data;
  if (e.type !== undefined && !isKnownEventType(e.type)) {
    res.status(400).json({ error: `Tipo evento sconosciuto: "${e.type}"` });
    return;
  }
  if (
    e.formationId !== null &&
    e.formationId !== undefined &&
    !isKnownFormation(e.formationId)
  ) {
    res.status(400).json({ error: "Formazione non trovata" });
    return;
  }
  const nextStatus = e.status ?? existing.status;
  const nextNotes = e.notes !== undefined ? e.notes : existing.notes;
  if (statusNotesMissing(nextStatus, nextNotes)) {
    res.status(400).json({ error: STATUS_NOTES_ERROR });
    return;
  }

  db.prepare(
    `UPDATE events SET
      type = ?, date = ?, start_time = ?, end_time = ?, location = ?,
      address = ?, opponent = ?, meeting_time = ?, notes = ?, status = ?, formation_id = ?
     WHERE id = ?`,
  ).run(
    e.type ?? existing.type,
    e.date ?? existing.date,
    e.startTime !== undefined ? e.startTime : existing.start_time,
    e.endTime !== undefined ? e.endTime : existing.end_time,
    e.location !== undefined ? e.location : existing.location,
    e.address !== undefined ? e.address : existing.address,
    e.opponent !== undefined ? e.opponent : existing.opponent,
    e.meetingTime !== undefined ? e.meetingTime : existing.meeting_time,
    e.notes !== undefined ? e.notes : existing.notes,
    e.status ?? existing.status,
    e.formationId !== undefined ? e.formationId : existing.formation_id,
    req.params.id,
  );

  const row = db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(req.params.id) as unknown as EventRow;
  res.json(rowToEvent(row));
});

// DELETE /api/events/:id
router.delete("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM events WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.status(204).send();
});

export default router;
