import axios from "axios";
import type {
  Attendance,
  AttendanceStatus,
  AppSettings,
  Communication,
  EventFilters,
  EventTypeDef,
  GeneratedCommunication,
  GoogleStatus,
  Player,
  TeamEvent,
  AIConfig,
  MatchPeriod,
  MatchPlan,
  RolePolicy,
} from "../types";

// Use a relative base URL (no leading slash) so the browser resolves it
// relative to the document URL — works both in local dev and under any
// HA Ingress path without any path-guessing.
const apiClient = axios.create({
  baseURL: "api",
  timeout: 30_000,
});

export const api = {
  health: () =>
    apiClient.get<{ status: string; version: string; timestamp: string }>(
      "/health",
    ),

  // ── Players ────────────────────────────────────────────────────────────
  getPlayers: () => apiClient.get<Player[]>("/players"),
  getPlayer: (id: number) => apiClient.get<Player>(`/players/${id}`),
  createPlayer: (data: Partial<Player>) =>
    apiClient.post<Player>("/players", data),
  updatePlayer: (id: number, data: Partial<Player>) =>
    apiClient.put<Player>(`/players/${id}`, data),
  deletePlayer: (id: number) => apiClient.delete(`/players/${id}`),
  exportData: () => apiClient.get("/data/export", { responseType: "blob" }),

  // ── Events ─────────────────────────────────────────────────────────────
  getEvents: (filters?: EventFilters) =>
    apiClient.get<TeamEvent[]>("/events", { params: filters }),
  getEvent: (id: number) => apiClient.get<TeamEvent>(`/events/${id}`),
  createEvent: (data: Partial<TeamEvent>) =>
    apiClient.post<TeamEvent>("/events", data),
  createRecurringEvent: (data: Partial<TeamEvent> & { recurrence: { frequency: "weekly"; until: string } }) =>
    apiClient.post<{ created: TeamEvent[] }>("/events/recurring", data),
  updateEvent: (id: number, data: Partial<TeamEvent>) =>
    apiClient.put<TeamEvent>(`/events/${id}`, data),
  deleteEvent: (id: number) => apiClient.delete(`/events/${id}`),

  // ── Attendance ─────────────────────────────────────────────────────────
  getAttendance: (eventId: number) =>
    apiClient.get<Attendance[]>(`/events/${eventId}/attendance`),
  setAttendance: (
    eventId: number,
    records: { playerId: number; status: AttendanceStatus }[],
  ) =>
    apiClient.put<{ eventId: number; recordCount: number }>(
      `/events/${eventId}/attendance`,
      { records },
    ),
  getAttendanceStatus: (eventId: number) =>
    apiClient.get<{ finalizedAt: string | null }>(`/events/${eventId}/attendance/status`),
  finalizeAttendance: (eventId: number, records: { playerId: number; status: AttendanceStatus }[]) =>
    apiClient.post<{ eventId: number; finalizedAt: string; recordCount: number }>(`/events/${eventId}/attendance/finalize`, { records }),
  reopenAttendance: (eventId: number) =>
    apiClient.post(`/events/${eventId}/attendance/reopen`),
  getPlayerAttendanceHistory: (playerId: number) =>
    apiClient.get<import("../types").AttendanceHistoryItem[]>(`/players/${playerId}/attendance-history`),
  getAttendanceReport: (filters?: { from?: string; to?: string; type?: string }) =>
    apiClient.get<import("../types").AttendanceReport>("/reports/attendance", { params: filters }),
  getTeamSummary: () =>
    apiClient.get<import("../types").TeamSummary>("/reports/summary"),

  getMatchResult: (eventId: number) =>
    apiClient.get<import("../types").MatchResult | null>(`/events/${eventId}/result`),
  saveMatchResult: (eventId: number, data: { teamScore: number; opponentScore: number; venue: "home" | "away" | "neutral"; scorers?: import("../types").MatchScorer[]; notes?: string | null }) =>
    apiClient.put<import("../types").MatchResult>(`/events/${eventId}/result`, data),
  deleteMatchResult: (eventId: number) =>
    apiClient.delete(`/events/${eventId}/result`),

  // ── Google ─────────────────────────────────────────────────────────────
  getGoogleStatus: () => apiClient.get<GoogleStatus>("/google/status"),
  getGoogleAuthUrl: () => apiClient.get<{ url: string }>("/google/oauth/url"),
  disconnectGoogle: () => apiClient.post("/google/disconnect"),

  // ── Comunicazioni ──────────────────────────────────────────────────────
  generateCommunication: (eventIds: number[]) =>
    apiClient.post<GeneratedCommunication>("/communications", { eventIds }),
  getCommunications: () =>
    apiClient.get<Communication[]>("/communications"),
  deleteCommunication: (id: number) =>
    apiClient.delete(`/communications/${id}`),
  exportToGoogleCalendar: (eventIds: number[]) =>
    apiClient.post<{ exported: number }>("/google/calendar/export", { eventIds }),
  verifyGoogleCalendar: (calendarId: string) =>
    apiClient.post<{ calendarId: string; valid: true }>("/google/calendar/test", { calendarId }),

  // ── Tipi evento ────────────────────────────────────────────────────────
  getEventTypes: () => apiClient.get<EventTypeDef[]>("/event-types"),
  createEventType: (data: Partial<EventTypeDef>) =>
    apiClient.post<EventTypeDef>("/event-types", data),
  updateEventType: (id: number, data: Partial<EventTypeDef>) =>
    apiClient.put<EventTypeDef>(`/event-types/${id}`, data),
  deleteEventType: (id: number) => apiClient.delete(`/event-types/${id}`),
  getFormations: () => apiClient.get<import("../types").Formation[]>("/formations"),
  createFormation: (data: { name: string; assignments: Record<string, number | null> }) => apiClient.post<import("../types").Formation>("/formations", data),
  deleteFormation: (id: number) => apiClient.delete(`/formations/${id}`),
  updateFormation: (id: number, data: { name: string; assignments: Record<string, number | null> }) => apiClient.put(`/formations/${id}`, data),

  // ── Impostazioni app ───────────────────────────────────────────────────
  getSettings: () =>
    apiClient.get<AppSettings>("/settings"),
  updateSettings: (data: Partial<AppSettings>) =>
    apiClient.put<AppSettings>("/settings", data),

  // ── Intelligenza artificiale e piani partita ───────────────────────────
  getAIConfig: () => apiClient.get<AIConfig>("/ai/config"),
  updateAIConfig: (data: Partial<AIConfig>) => apiClient.put<AIConfig>("/ai/config", data),
  testAI: () => apiClient.post<{ provider: string; model: string; message: string }>("/ai/test"),
  getMatchPlans: (eventId: number) => apiClient.get<MatchPlan[]>(`/events/${eventId}/match-plans`),
  generateMatchPlan: (eventId: number, data: { name?: string; periodCount: number; minutesPerPeriod: number; playersOnField: number; system?: string; rolePolicy: RolePolicy }) =>
    apiClient.post<MatchPlan>(`/events/${eventId}/match-plans/generate`, data),
  updateMatchPlan: (eventId: number, planId: number, data: { name?: string; periods?: MatchPeriod[] }) =>
    apiClient.put<MatchPlan>(`/events/${eventId}/match-plans/${planId}`, data),
  confirmMatchPlan: (eventId: number, planId: number) =>
    apiClient.post<MatchPlan>(`/events/${eventId}/match-plans/${planId}/confirm`),
  exportMatchPlan: (eventId: number, planId: number) =>
    apiClient.post<import("../types").GeneratedMatchPlanExport>(`/events/${eventId}/match-plans/${planId}/export`),
  deleteMatchPlan: (eventId: number, planId: number) =>
    apiClient.delete(`/events/${eventId}/match-plans/${planId}`),
};
