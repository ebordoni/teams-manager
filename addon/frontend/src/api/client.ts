import axios from "axios";
import type {
  Callup,
  EventFilters,
  Player,
  TeamEvent,
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

  // ── Events ─────────────────────────────────────────────────────────────
  getEvents: (filters?: EventFilters) =>
    apiClient.get<TeamEvent[]>("/events", { params: filters }),
  getEvent: (id: number) => apiClient.get<TeamEvent>(`/events/${id}`),
  createEvent: (data: Partial<TeamEvent>) =>
    apiClient.post<TeamEvent>("/events", data),
  updateEvent: (id: number, data: Partial<TeamEvent>) =>
    apiClient.put<TeamEvent>(`/events/${id}`, data),
  deleteEvent: (id: number) => apiClient.delete(`/events/${id}`),

  // ── Callups ────────────────────────────────────────────────────────────
  getCallups: (eventId: number) =>
    apiClient.get<Callup[]>(`/events/${eventId}/callups`),
  setCallups: (eventId: number, playerIds: number[]) =>
    apiClient.put<{ eventId: number; callupCount: number }>(
      `/events/${eventId}/callups`,
      { playerIds },
    ),
};
