// Il tipo evento non è più un enum fisso: fa riferimento alla chiave (`key`)
// di una riga in `event_types`, configurabile dall'utente (vedi EventTypeDef).
export type EventType = string;
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

export type AttendanceStatus = "present" | "absent" | "excused";

export interface AttendanceRow {
  id: number;
  event_id: number;
  player_id: number;
  status: AttendanceStatus;
}

export interface Attendance {
  playerId: number;
  playerName: string;
  status: AttendanceStatus;
}

export interface GoogleTokensRow {
  id: number;
  access_token: string | null;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expiry_date: number | null;
  updated_at: string;
}

export interface CommunicationRow {
  id: number;
  event_ids: string;
  title: string;
  google_doc_id: string;
  google_doc_url: string;
  created_at: string;
}

export interface Communication {
  id: number;
  eventIds: number[];
  title: string;
  googleDocId: string;
  googleDocUrl: string;
  createdAt: string;
}

export interface EventTypeDefRow {
  id: number;
  key: string;
  label: string;
  icon: string;
  has_opponent: number;
  sort_order: number;
}

export interface EventTypeDef {
  id: number;
  key: string;
  label: string;
  icon: string;
  hasOpponent: boolean;
  sortOrder: number;
}

export interface AppSettingRow {
  key: string;
  value: string | null;
}
