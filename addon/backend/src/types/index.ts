export type EventType = "training" | "match" | "tournament";
export type EventStatus = "scheduled" | "modified" | "cancelled";

export interface Player {
  id: number;
  name: string;
  role: string | null;
  secondaryRoles: string[];
  notes: string | null;
  createdAt: string;
}

export interface PlayerRow {
  id: number;
  name: string;
  role: string | null;
  secondary_roles: string;
  notes: string | null;
  created_at: string;
}

export interface Event {
  id: number;
  type: EventType;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  address: string | null;
  opponent: string | null;
  meetingTime: string | null;
  notes: string | null;
  status: EventStatus;
  createdAt: string;
}

export interface EventRow {
  id: number;
  type: EventType;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  address: string | null;
  opponent: string | null;
  meeting_time: string | null;
  notes: string | null;
  status: EventStatus;
  created_at: string;
}

export interface CallupRow {
  id: number;
  event_id: number;
  player_id: number;
  called_up: number;
}

export interface Callup {
  playerId: number;
  playerName: string;
  calledUp: boolean;
}
