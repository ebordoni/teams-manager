import { getDb } from "../db/schema";
import type { MatchPeriod, MatchPeriodRow, MatchPlan, MatchPlanRow, PlayerRow, RolePolicy } from "../types";
import { AIService } from "./ai.service";
import { slotsFor, validateRotation, type RotationPlayer, type RotationRequest } from "./rotation.service";

function loadPlayers(eventId: number): RotationPlayer[] {
  const rows = getDb().prepare(
    "SELECT p.* FROM players p ORDER BY p.name ASC",
  ).all() as unknown as PlayerRow[];
  return rows.map((row) => ({
    id: row.id,
    roles: [row.role, ...(JSON.parse(row.secondary_roles) as string[])].filter((role): role is string => Boolean(role)),
    preferredFoot: row.preferred_foot,
    fitness: row.fitness,
    speed: row.speed,
    technique: row.technique,
    shooting: row.shooting,
    defending: row.defending,
    attacking: row.attacking,
  }));
}

function periodsFor(planId: number): MatchPeriod[] {
  const rows = getDb().prepare("SELECT * FROM match_periods WHERE match_plan_id = ? ORDER BY period_number").all(planId) as unknown as MatchPeriodRow[];
  return rows.map((row) => ({
    periodNumber: row.period_number,
    assignments: JSON.parse(row.assignments),
    benchPlayerIds: JSON.parse(row.bench_player_ids),
  }));
}

function toPlan(row: MatchPlanRow): MatchPlan {
  return {
    id: row.id, eventId: row.event_id, name: row.name, periodCount: row.period_count,
    minutesPerPeriod: row.minutes_per_period, playersOnField: row.players_on_field,
    system: row.system, rolePolicy: row.role_policy, source: row.source,
    provider: row.provider, model: row.model, status: row.status,
    warnings: JSON.parse(row.warnings), periods: periodsFor(row.id),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function getMatchPlan(eventId: number, planId: number): MatchPlan | null {
  const row = getDb().prepare("SELECT * FROM match_plans WHERE id = ? AND event_id = ?").get(planId, eventId) as MatchPlanRow | undefined;
  return row ? toPlan(row) : null;
}

export function listMatchPlans(eventId: number): MatchPlan[] {
  const rows = getDb().prepare("SELECT * FROM match_plans WHERE event_id = ? ORDER BY created_at DESC").all(eventId) as unknown as MatchPlanRow[];
  return rows.map(toPlan);
}

function savePeriods(planId: number, periods: MatchPeriod[]): void {
  const db = getDb();
  db.prepare("DELETE FROM match_periods WHERE match_plan_id = ?").run(planId);
  const insert = db.prepare("INSERT INTO match_periods (match_plan_id, period_number, assignments, bench_player_ids) VALUES (?, ?, ?, ?)");
  periods.forEach((period) => insert.run(planId, period.periodNumber, JSON.stringify(period.assignments), JSON.stringify(period.benchPlayerIds)));
}

export async function generateMatchPlan(eventId: number, input: {
  name?: string; periodCount: number; minutesPerPeriod: number; playersOnField: number;
  system?: string; rolePolicy: RolePolicy;
}): Promise<MatchPlan> {
  const db = getDb();
  const event = db.prepare("SELECT id, date FROM events WHERE id = ?").get(eventId) as { id: number; date: string } | undefined;
  if (!event) throw new Error("Evento non trovato");
  const players = loadPlayers(eventId);
  if (players.length < input.playersOnField) throw new Error(`Servono almeno ${input.playersOnField} giocatori nella rosa`);
  const request: RotationRequest = { ...input, players };
  const generated = await new AIService().generateRotations(request);

  db.exec("BEGIN");
  try {
    const result = db.prepare(
      `INSERT INTO match_plans (event_id, name, period_count, minutes_per_period, players_on_field, system, role_policy, source, provider, model, warnings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(eventId, input.name?.trim() || `Piano partita ${event.date}`, input.periodCount, input.minutesPerPeriod,
      input.playersOnField, input.system ?? "2-3-1", input.rolePolicy, generated.source,
      generated.provider, generated.model, JSON.stringify(generated.warnings));
    const planId = Number(result.lastInsertRowid);
    savePeriods(planId, generated.periods);
    db.exec("COMMIT");
    return getMatchPlan(eventId, planId)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createManualMatchPlan(eventId: number, input: {
  name?: string; periodCount: number; minutesPerPeriod: number; playersOnField: number;
  system?: string; rolePolicy: RolePolicy;
}): MatchPlan {
  const db = getDb();
  const event = db.prepare("SELECT id, date FROM events WHERE id = ?").get(eventId) as { id: number; date: string } | undefined;
  if (!event) throw new Error("Evento non trovato");
  const players = loadPlayers(eventId);
  if (players.length < input.playersOnField) throw new Error(`Servono almeno ${input.playersOnField} giocatori nella rosa`);
  const result = db.prepare(
    `INSERT INTO match_plans (event_id, name, period_count, minutes_per_period, players_on_field, system, role_policy, source, warnings)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', '[]')`,
  ).run(eventId, input.name?.trim() || `Piano partita ${event.date}`, input.periodCount, input.minutesPerPeriod,
    input.playersOnField, input.system ?? "2-3-1", input.rolePolicy);
  const planId = Number(result.lastInsertRowid);
  const periods = Array.from({ length: input.periodCount }, (_, index) => ({
    periodNumber: index + 1,
    assignments: [],
    benchPlayerIds: players.map((player) => player.id),
  }));
  savePeriods(planId, periods);
  return getMatchPlan(eventId, planId)!;
}

function rotationRequestFromPlan(plan: MatchPlan): RotationRequest {
  return { periodCount: plan.periodCount, minutesPerPeriod: plan.minutesPerPeriod, playersOnField: plan.playersOnField, rolePolicy: plan.rolePolicy, players: loadPlayers(plan.eventId) };
}

/** I piani manuali in bozza possono essere salvati anche mentre alcuni tempi sono incompleti. */
function validateDraftPeriods(request: RotationRequest, periods: MatchPeriod[]): string[] {
  const errors: string[] = [];
  const playerIds = new Set(request.players.map((player) => player.id));
  const slotIds = new Set(slotsFor(request.playersOnField).map(([slot]) => slot));
  if (periods.length !== request.periodCount) errors.push(`Attesi ${request.periodCount} tempi, ricevuti ${periods.length}`);
  periods.forEach((period, index) => {
    if (period.periodNumber !== index + 1) errors.push(`Numerazione non valida per il tempo ${index + 1}`);
    if (period.assignments.length > request.playersOnField) errors.push(`Troppi giocatori nel tempo ${index + 1}`);
    const usedPlayers = new Set<number>(); const usedSlots = new Set<string>();
    period.assignments.forEach((assignment) => {
      if (!playerIds.has(assignment.playerId)) errors.push(`Giocatore non convocato nel tempo ${index + 1}`);
      if (!slotIds.has(assignment.slot)) errors.push(`Ruolo non valido nel tempo ${index + 1}`);
      if (usedPlayers.has(assignment.playerId)) errors.push(`Giocatore duplicato nel tempo ${index + 1}`);
      if (usedSlots.has(assignment.slot)) errors.push(`Ruolo duplicato nel tempo ${index + 1}`);
      usedPlayers.add(assignment.playerId); usedSlots.add(assignment.slot);
    });
  });
  return [...new Set(errors)];
}

export function updateMatchPlan(eventId: number, planId: number, input: { name?: string; periods?: MatchPeriod[] }): MatchPlan {
  const plan = getMatchPlan(eventId, planId);
  if (!plan) throw new Error("Piano partita non trovato");
  const db = getDb();
  let warnings = plan.warnings;
  if (input.periods) {
    const validation = validateRotation(rotationRequestFromPlan(plan), input.periods);
    if (validation.errors.length) {
      if (plan.status !== "draft") throw new Error(validation.errors.join("; "));
      const draftErrors = validateDraftPeriods(rotationRequestFromPlan(plan), input.periods);
      if (draftErrors.length) throw new Error(draftErrors.join("; "));
      warnings = [];
    } else warnings = validation.warnings;
  }
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE match_plans SET name = ?, source = ?, warnings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(input.name?.trim() || plan.name, input.periods ? "manual" : plan.source, JSON.stringify(warnings), planId);
    if (input.periods) savePeriods(planId, input.periods);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return getMatchPlan(eventId, planId)!;
}

export function confirmMatchPlan(eventId: number, planId: number): MatchPlan {
  const plan = getMatchPlan(eventId, planId);
  if (!plan) throw new Error("Piano partita non trovato");
  const validation = validateRotation(rotationRequestFromPlan(plan), plan.periods);
  if (validation.errors.length) throw new Error(validation.errors.join("; "));
  getDb().prepare("UPDATE match_plans SET status = 'confirmed', warnings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(JSON.stringify(validation.warnings), planId);
  return getMatchPlan(eventId, planId)!;
}

export function deleteMatchPlan(eventId: number, planId: number): boolean {
  return getDb().prepare("DELETE FROM match_plans WHERE id = ? AND event_id = ?").run(planId, eventId).changes > 0;
}
