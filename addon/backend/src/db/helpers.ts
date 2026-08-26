import type { EventRow, Event, PlayerRow, Player } from "../types";

export function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    secondaryRoles: JSON.parse(row.secondary_roles) as string[],
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    address: row.address,
    opponent: row.opponent,
    meetingTime: row.meeting_time,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}
