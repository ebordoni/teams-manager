import type { MatchPeriod, MatchPeriodAssignment, RolePolicy } from "../types";

export interface RotationPlayer { id: number; roles: string[] }
export interface RotationRequest {
  periodCount: number;
  minutesPerPeriod: number;
  playersOnField: number;
  rolePolicy: RolePolicy;
  players: RotationPlayer[];
}

const SEVEN_SLOTS: Array<[string, string]> = [
  ["portiere", "Portiere"], ["difensoreSinistro", "Difensore"],
  ["difensoreDestro", "Difensore"], ["centrale", "Centrocampista"],
  ["fasciaSinistra", "Esterno"], ["fasciaDestra", "Esterno"], ["attaccante", "Attaccante"],
];

export function slotsFor(playersOnField: number): Array<[string, string]> {
  if (playersOnField === 7) return SEVEN_SLOTS;
  return [["portiere", "Portiere"], ...Array.from({ length: playersOnField - 1 }, (_, index) => [`movimento${index + 1}`, "Giocatore di movimento"] as [string, string])];
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("it-IT");
function roleMatches(player: RotationPlayer, requiredRole: string): boolean {
  if (requiredRole === "Giocatore di movimento") return !player.roles.some((role) => normalize(role) === "portiere") || player.roles.length > 1;
  const required = normalize(requiredRole);
  return player.roles.some((role) => {
    const candidate = normalize(role);
    return candidate === required || (required === "esterno" && ["fascia", "centrocampista"].includes(candidate));
  });
}

export function validateRotation(request: RotationRequest, periods: MatchPeriod[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const playerIds = new Set(request.players.map((player) => player.id));
  const appearances = new Map(request.players.map((player) => [player.id, 0]));
  const slots = slotsFor(request.playersOnField);
  if (periods.length !== request.periodCount) errors.push(`Attesi ${request.periodCount} tempi, ricevuti ${periods.length}`);

  periods.forEach((period, index) => {
    if (period.periodNumber !== index + 1) errors.push(`Numerazione non valida per il tempo ${index + 1}`);
    if (period.assignments.length !== request.playersOnField) errors.push(`Il tempo ${index + 1} deve avere ${request.playersOnField} giocatori`);
    const used = new Set<number>();
    for (const assignment of period.assignments) {
      if (!playerIds.has(assignment.playerId)) errors.push(`Giocatore non convocato nel tempo ${index + 1}`);
      if (used.has(assignment.playerId)) errors.push(`Giocatore duplicato nel tempo ${index + 1}`);
      used.add(assignment.playerId);
      appearances.set(assignment.playerId, (appearances.get(assignment.playerId) ?? 0) + 1);
      const requiredRole = slots.find(([slot]) => slot === assignment.slot)?.[1];
      const player = request.players.find((item) => item.id === assignment.playerId);
      if (requiredRole && player && !roleMatches(player, requiredRole)) {
        const message = `Ruolo ${assignment.role} non abituale per un giocatore nel tempo ${index + 1}`;
        if (request.rolePolicy === "strict") errors.push(message);
        else if (request.rolePolicy === "preferred") warnings.push(message);
      }
    }
    if (!period.assignments.some((item) => item.slot === "portiere")) errors.push(`Manca il portiere nel tempo ${index + 1}`);
  });

  const counts = [...appearances.values()];
  const totalSpots = request.periodCount * request.playersOnField;
  const theoreticalDifference = Math.ceil(totalSpots / request.players.length) - Math.floor(totalSpots / request.players.length);
  const actualDifference = Math.max(...counts) - Math.min(...counts);
  if (totalSpots >= request.players.length && counts.some((count) => count === 0)) errors.push("Non tutti i giocatori hanno un tempo di gioco");
  if (actualDifference > theoreticalDifference) warnings.push(`La differenza di minutaggio è ${actualDifference * request.minutesPerPeriod} minuti; il minimo teorico è ${theoreticalDifference * request.minutesPerPeriod}`);
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

export function generateFallbackRotation(request: RotationRequest): MatchPeriod[] {
  const totalSpots = request.periodCount * request.playersOnField;
  const base = Math.floor(totalSpots / request.players.length);
  const extras = totalSpots % request.players.length;
  const remaining = new Map(request.players.map((player, index) => [player.id, base + (index < extras ? 1 : 0)]));
  const appearances = new Map(request.players.map((player) => [player.id, 0]));
  const slots = slotsFor(request.playersOnField);

  return Array.from({ length: request.periodCount }, (_, periodIndex) => {
    const used = new Set<number>();
    const assignments: MatchPeriodAssignment[] = slots.map(([slot, role]) => {
      const candidates = request.players.filter((player) => !used.has(player.id));
      candidates.sort((a, b) => {
        const score = (player: RotationPlayer) => {
          const matches = roleMatches(player, role);
          const roleScore = request.rolePolicy === "strict" ? (matches ? 10_000 : -10_000) : matches ? 20 : 0;
          return (remaining.get(player.id) ?? 0) * 100 + roleScore - (appearances.get(player.id) ?? 0) * 2;
        };
        return score(b) - score(a) || a.id - b.id;
      });
      const selected = candidates[0];
      used.add(selected.id);
      remaining.set(selected.id, (remaining.get(selected.id) ?? 0) - 1);
      appearances.set(selected.id, (appearances.get(selected.id) ?? 0) + 1);
      return { slot, playerId: selected.id, role };
    });
    return {
      periodNumber: periodIndex + 1,
      assignments,
      benchPlayerIds: request.players.map((player) => player.id).filter((id) => !used.has(id)),
    };
  });
}
