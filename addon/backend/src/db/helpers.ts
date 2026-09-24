import type {
  Communication,
  CommunicationRow,
  Event,
  EventRow,
  EventTypeDef,
  EventTypeDefRow,
  Player,
  PlayerRow,
} from "../types";

export function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    secondaryRoles: JSON.parse(row.secondary_roles) as string[],
    jerseyNumber: row.jersey_number,
    preferredFoot: row.preferred_foot,
    fitness: row.fitness,
    speed: row.speed,
    technique: row.technique,
    shooting: row.shooting,
    defending: row.defending,
    attacking: row.attacking,
    notes: row.notes,
    archivedAt: row.archived_at,
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
    formationId: row.formation_id,
    attendanceFinalizedAt: row.attendance_finalized_at,
    createdAt: row.created_at,
  };
}

export function rowToCommunication(row: CommunicationRow): Communication {
  return {
    id: row.id,
    eventIds: JSON.parse(row.event_ids) as number[],
    title: row.title,
    googleDocId: row.google_doc_id,
    googleDocUrl: row.google_doc_url,
    createdAt: row.created_at,
  };
}

export function rowToEventTypeDef(row: EventTypeDefRow): EventTypeDef {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    icon: row.icon,
    hasOpponent: row.has_opponent === 1,
    sortOrder: row.sort_order,
  };
}
