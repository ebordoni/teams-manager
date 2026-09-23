// Il tipo evento fa riferimento alla chiave (`key`) di un EventTypeDef,
// configurabile dall'utente nelle Impostazioni.
export type EventType = string;
export type EventStatus = "scheduled" | "modified" | "cancelled";
export type PreferredFoot = "right" | "left" | "both";

export interface EventTypeDef {
  id: number;
  key: string;
  label: string;
  icon: string;
  hasOpponent: boolean;
  sortOrder: number;
}

export interface Player {
  id: number;
  name: string;
  role: string | null;
  secondaryRoles: string[];
  preferredFoot: PreferredFoot;
  fitness: number;
  speed: number;
  technique: number;
  shooting: number;
  defending: number;
  attacking: number;
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
  formationId: number | null;
  createdAt: string;
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  calendarConnected: boolean;
}

export interface AppSettings {
  teamName: string;
  googleTemplateDocId: string | null;
  googleCalendarId: string;
}

export interface Communication {
  id: number;
  eventIds: number[];
  title: string;
  googleDocId: string;
  googleDocUrl: string;
  createdAt: string;
}

/** Risposta di POST /api/communications: non include eventIds/createdAt. */
export interface GeneratedCommunication {
  id: number;
  title: string;
  googleDocId: string;
  googleDocUrl: string;
  whatsappMessage: string;
}

export interface GeneratedMatchPlanExport {
  title: string;
  googleDocId: string;
  googleDocUrl: string;
}

export type AttendanceStatus = "present" | "absent" | "excused";

export interface Attendance {
  playerId: number;
  playerName: string;
  status: AttendanceStatus;
  /** false quando lo stato è solo il default proposto e non è mai stato salvato */
  recorded: boolean;
}

export interface EventFilters {
  from?: string;
  to?: string;
  type?: EventType;
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
  defaultModels: Record<AIProvider, string>;
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
