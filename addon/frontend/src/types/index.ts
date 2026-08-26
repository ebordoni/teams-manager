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

export interface TeamEvent {
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

export interface Callup {
  playerId: number;
  playerName: string;
  calledUp: boolean;
}

export interface EventFilters {
  from?: string;
  to?: string;
  type?: EventType;
}
