import { Request, Response, Router } from "express";
import { z } from "zod";
import { rowToEvent } from "../db/helpers";
import { getDb } from "../db/schema";
import type { EventRow } from "../types";

const router = Router();

const EventSchema = z.object({
  type: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
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

const RecurringEventSchema = EventSchema.extend({
  recurrence: z.object({
    frequency: z.literal("weekly"),
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

const FiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.string().optional(),
});
const ResultSchema = z.object({
  teamScore: z.number().int().min(0).max(99),
  opponentScore: z.number().int().min(0).max(99),
  venue: z.enum(["home", "away", "neutral"]),
  scorers: z.array(z.object({
    playerId: z.number().int().positive(),
    goals: z.number().int().min(1).max(99),
  })).max(30).optional().default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
}).superRefine((result, ctx) => {
  const scorerIds = new Set<number>();
  let scorerGoals = 0;
  result.scorers.forEach((scorer, index) => {
    if (scorerIds.has(scorer.playerId)) {
      ctx.addIssue({ code: "custom", path: ["scorers", index, "playerId"], message: "Un giocatore può comparire una sola volta" });
    }
    scorerIds.add(scorer.playerId);
    scorerGoals += scorer.goals;
  });
  if (scorerGoals > result.teamScore) {
    ctx.addIssue({ code: "custom", path: ["scorers"], message: "I gol dei marcatori non possono superare il totale squadra" });
  }
});

type MatchResultRow = {
  event_id: number; team_score: number; opponent_score: number; venue: "home" | "away" | "neutral";
  scorers: string; notes: string | null; completed_at: string;
};

function rowToMatchResult(row: MatchResultRow) {
  return {
    eventId: row.event_id,
    teamScore: row.team_score,
    opponentScore: row.opponent_score,
    venue: row.venue,
    scorers: JSON.parse(row.scorers) as Array<{ playerId: number; goals: number }>,
    notes: row.notes,
    completedAt: row.completed_at,
  };
}

function findResultEvent(id: string) {
  return getDb().prepare(
    `SELECT e.id FROM events e JOIN event_types t ON t.key = e.type
     WHERE e.id = ? AND t.has_opponent = 1`,
  ).get(id) as { id: number } | undefined;
}

router.get("/:id/result", (req: Request, res: Response) => {
  if (!findResultEvent(req.params.id)) return void res.status(404).json({ error: "Evento partita non trovato" });
  const row = getDb().prepare("SELECT * FROM match_results WHERE event_id = ?").get(req.params.id) as MatchResultRow | undefined;
  res.json(row ? rowToMatchResult(row) : null);
});

router.put("/:id/result", (req: Request, res: Response) => {
  const parse = ResultSchema.safeParse(req.body);
  if (!parse.success) return void res.status(400).json({ error: parse.error.flatten() });
  if (!findResultEvent(req.params.id)) return void res.status(404).json({ error: "Evento partita non trovato" });
  const result = parse.data;
  getDb().prepare(
    `INSERT INTO match_results (event_id, team_score, opponent_score, venue, scorers, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id) DO UPDATE SET team_score = excluded.team_score, opponent_score = excluded.opponent_score,
       venue = excluded.venue, scorers = excluded.scorers, notes = excluded.notes, completed_at = CURRENT_TIMESTAMP`,
  ).run(req.params.id, result.teamScore, result.opponentScore, result.venue, JSON.stringify(result.scorers), result.notes?.trim() || null);
  const row = getDb().prepare("SELECT * FROM match_results WHERE event_id = ?").get(req.params.id) as MatchResultRow;
  res.json(rowToMatchResult(row));
});

router.delete("/:id/result", (req: Request, res: Response) => {
  if (!findResultEvent(req.params.id)) return void res.status(404).json({ error: "Evento partita non trovato" });
  getDb().prepare("DELETE FROM match_results WHERE event_id = ?").run(req.params.id);
  res.status(204).send();
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

function isValidIsoDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function insertEvent(e: z.infer<typeof EventSchema>): number {
  const result = getDb()
    .prepare(
      `INSERT INTO events
        (type, date, start_time, end_time, location, address, opponent, meeting_time, notes, status, formation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      e.type, e.date, e.startTime ?? null, e.endTime ?? null, e.location ?? null,
      e.address ?? null, e.opponent ?? null, e.meetingTime ?? null, e.notes ?? null,
      e.status ?? "scheduled", e.formationId ?? null,
    );
  return Number(result.lastInsertRowid);
}

function validateEventInput(e: z.infer<typeof EventSchema>): string | null {
  if (!isValidIsoDate(e.date)) return "Data evento non valida";
  if (!isKnownEventType(e.type)) return `Tipo evento sconosciuto: "${e.type}"`;
  if (e.formationId !== null && e.formationId !== undefined && !isKnownFormation(e.formationId)) return "Formazione non trovata";
  if (statusNotesMissing(e.status, e.notes)) return STATUS_NOTES_ERROR;
  return null;
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

  const events = rows.map(rowToEvent);
  const ids = events.map((event) => event.id);
  const resultRows = ids.length
    ? (db.prepare(`SELECT * FROM match_results WHERE event_id IN (${ids.map(() => "?").join(",")})`).all(...ids) as MatchResultRow[])
    : [];
  const results = new Map(resultRows.map((result) => [result.event_id, rowToMatchResult(result)]));
  res.json(events.map((event) => ({ ...event, result: results.get(event.id) ?? null })));
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
  const inputError = validateEventInput(e);
  if (inputError) {
    res.status(400).json({ error: inputError });
    return;
  }
  const id = insertEvent(e);

  const row = getDb()
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(id) as unknown as EventRow;
  res.status(201).json(rowToEvent(row));
});

// POST /api/events/recurring — creates independent weekly events through the selected end date.
router.post("/recurring", (req: Request, res: Response) => {
  const parse = RecurringEventSchema.safeParse(req.body);
  if (!parse.success) return void res.status(400).json({ error: parse.error.flatten() });

  const { recurrence, ...event } = parse.data;
  const inputError = validateEventInput(event);
  if (inputError) return void res.status(400).json({ error: inputError });
  if (!isValidIsoDate(recurrence.until)) return void res.status(400).json({ error: "Data finale non valida" });
  if (recurrence.until < event.date) return void res.status(400).json({ error: "La data finale deve essere successiva alla data iniziale" });

  const dates: string[] = [];
  for (let date = event.date; date <= recurrence.until; date = addDays(date, 7)) dates.push(date);
  if (dates.length > 104) return void res.status(400).json({ error: "La ricorrenza può creare al massimo 104 eventi (due anni)" });

  const db = getDb();
  const ids: number[] = [];
  try {
    db.exec("BEGIN");
    for (const date of dates) ids.push(insertEvent({ ...event, date }));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM events WHERE id IN (${placeholders}) ORDER BY date ASC, start_time ASC`).all(...ids) as unknown as EventRow[];
  res.status(201).json({ created: rows.map(rowToEvent) });
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
