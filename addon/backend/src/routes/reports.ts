import { Request, Response, Router } from "express";
import { z } from "zod";
import { getDb } from "../db/schema";

const router = Router();
const FiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.string().optional(),
});

function attendanceFilter(query: unknown) {
  const parsed = FiltersSchema.safeParse(query);
  if (!parsed.success) return { error: parsed.error.flatten() } as const;
  const conditions = ["e.attendance_finalized_at IS NOT NULL"];
  const params: string[] = [];
  if (parsed.data.from) { conditions.push("e.date >= ?"); params.push(parsed.data.from); }
  if (parsed.data.to) { conditions.push("e.date <= ?"); params.push(parsed.data.to); }
  if (parsed.data.type) { conditions.push("e.type = ?"); params.push(parsed.data.type); }
  return { where: conditions.join(" AND "), params } as const;
}

router.get("/attendance", (req: Request, res: Response) => {
  const filter = attendanceFilter(req.query);
  if ("error" in filter) return void res.status(400).json({ error: filter.error });
  const db = getDb();
  const events = db.prepare(
    `SELECT e.id, e.date, e.type, e.opponent FROM events e
     WHERE ${filter.where} ORDER BY e.date DESC, e.id DESC`,
  ).all(...filter.params) as Array<{ id: number; date: string; type: string; opponent: string | null }>;
  const players = db.prepare("SELECT id, name FROM players WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE").all() as Array<{ id: number; name: string }>;
  const records = db.prepare(
    `SELECT a.event_id AS eventId, a.player_id AS playerId, a.status AS status
     FROM attendance a JOIN events e ON e.id = a.event_id
     WHERE ${filter.where}`,
  ).all(...filter.params);
  res.json({ events, players, records });
});

router.get("/summary", (_req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare(
    `SELECT COUNT(*) AS played,
      COALESCE(SUM(CASE WHEN team_score > opponent_score THEN 1 ELSE 0 END), 0) AS wins,
      COALESCE(SUM(CASE WHEN team_score = opponent_score THEN 1 ELSE 0 END), 0) AS draws,
      COALESCE(SUM(CASE WHEN team_score < opponent_score THEN 1 ELSE 0 END), 0) AS losses,
      COALESCE(SUM(team_score), 0) AS goalsFor,
      COALESCE(SUM(opponent_score), 0) AS goalsAgainst
     FROM match_results`,
  ).get();
  const attendance = db.prepare(
    `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) AS present
     FROM attendance a JOIN events e ON e.id = a.event_id
     WHERE e.attendance_finalized_at IS NOT NULL`,
  ).get();
  const recentResults = db.prepare(
    `SELECT e.id AS eventId, e.date, e.opponent, r.team_score AS teamScore, r.opponent_score AS opponentScore
     FROM match_results r JOIN events e ON e.id = r.event_id
     ORDER BY e.date DESC, e.id DESC LIMIT 5`,
  ).all();
  res.json({ results: result, attendance, recentResults });
});

export default router;
