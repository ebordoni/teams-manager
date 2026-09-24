// Il tipo evento non è più un enum fisso: fa riferimento alla chiave (`key`)
// di una riga in `event_types`, configurabile dall'utente (vedi EventTypeDef).
export type EventType = string;
export type EventStatus = "scheduled" | "modified" | "cancelled";
export type PreferredFoot = "right" | "left" | "both";

export interface Player {
  id: number;
  name: string;
  role: string | null;
  secondaryRoles: string[];
  jerseyNumber: number | null;
  preferredFoot: PreferredFoot;
  fitness: number;
  speed: number;
  technique: number;
  shooting: number;
  defending: number;
  attacking: number;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface PlayerRow {
  id: number;
  name: string;
  role: string | null;
  secondary_roles: string;
  jersey_number: number | null;
  preferred_foot: PreferredFoot;
  fitness: number;
  speed: number;
  technique: number;
  shooting: number;
  defending: number;
  attacking: number;
  notes: string | null;
  archived_at: string | null;
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
  formationId: number | null;
  attendanceFinalizedAt: string | null;
  result?: MatchResult | null;
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
  formation_id: number | null;
  attendance_finalized_at: string | null;
  created_at: string;
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
  /** false quando lo stato è solo il default proposto e non è mai stato salvato */
  recorded: boolean;
}

export interface AttendanceHistoryItem {
  eventId: number;
  date: string;
  type: string;
  opponent: string | null;
  status: AttendanceStatus;
}

export interface MatchResult {
  eventId: number;
  teamScore: number;
  opponentScore: number;
  venue: "home" | "away" | "neutral";
  notes: string | null;
  completedAt: string;
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

export interface FormationRow {
  id: number;
  name: string;
  system: string;
  assignments: string;
  created_at: string;
}
export interface Formation {
  id: number;
  name: string;
  system: string;
  assignments: Record<string, number | null>;
  createdAt: string;
}

export type AIProvider = "openai" | "google" | "anthropic" | "groq" | "xai";
export type RolePolicy = "strict" | "preferred" | "free";

export interface AIConfig {
  provider: AIProvider;
  model: string;
  fallbackProviders: AIProvider[];
  configuredProviders: AIProvider[];
  defaultPeriodCount: number;
  defaultMinutesPerPeriod: number;
  defaultPlayersOnField: number;
  defaultRolePolicy: RolePolicy;
}

export interface MatchPeriodAssignment {
  slot: string;
  playerId: number;
  role: string;
}

export interface MatchPeriod {
  periodNumber: number;
  assignments: MatchPeriodAssignment[];
  benchPlayerIds: number[];
}

export interface MatchPlanRow {
  id: number;
  event_id: number;
  name: string;
  period_count: number;
  minutes_per_period: number;
  players_on_field: number;
  system: string;
  role_policy: RolePolicy;
  source: "ai" | "fallback" | "manual";
  provider: string | null;
  model: string | null;
  status: "draft" | "confirmed";
  warnings: string;
  created_at: string;
  updated_at: string;
}

export interface MatchPeriodRow {
  id: number;
  match_plan_id: number;
  period_number: number;
  assignments: string;
  bench_player_ids: string;
}

export interface MatchPlan {
  id: number;
  eventId: number;
  name: string;
  periodCount: number;
  minutesPerPeriod: number;
  playersOnField: number;
  system: string;
  rolePolicy: RolePolicy;
  source: "ai" | "fallback" | "manual";
  provider: string | null;
  model: string | null;
  status: "draft" | "confirmed";
  warnings: string[];
  periods: MatchPeriod[];
  createdAt: string;
  updatedAt: string;
}
