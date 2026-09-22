import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import type { Event, EventTypeDef } from "../../types";

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    response?: { status?: unknown };
  };
  return candidate.code === 404 || candidate.response?.status === 404;
}

function eventResource(event: Event, type: EventTypeDef | undefined) {
  // Il campo `icon` contiene il nome di un'icona Tabler (es. "IconRun"): non è
  // rappresentabile su Google Calendar, quindi il titolo usa solo l'etichetta.
  const summary = `${type?.label ?? event.type}${
    event.opponent ? ` – ${event.opponent}` : ""
  }`;
  const details = [
    event.status !== "scheduled"
      ? `Stato: ${event.status === "cancelled" ? "annullato" : "modificato"}`
      : null,
    event.meetingTime ? `Ritrovo: ${event.meetingTime}` : null,
    event.notes,
    "Gestito da GIPS Calcio",
  ]
    .filter(Boolean)
    .join("\n");
  const location =
    [event.location, event.address].filter(Boolean).join(" – ") || undefined;

  if (!event.startTime) {
    const nextDay = new Date(`${event.date}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      summary,
      description: details,
      location,
      start: { date: event.date },
      end: { date: nextDay.toISOString().slice(0, 10) },
    };
  }

  return {
    summary,
    description: details,
    location,
    start: {
      dateTime: `${event.date}T${event.startTime}:00`,
      timeZone: "Europe/Rome",
    },
    end: {
      dateTime: `${event.date}T${event.endTime ?? event.startTime}:00`,
      timeZone: "Europe/Rome",
    },
  };
}

export async function upsertCalendarEvent(
  auth: OAuth2Client,
  calendarId: string,
  event: Event,
  type: EventTypeDef | undefined,
  googleEventId: string | undefined,
): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth });
  const requestBody = eventResource(event, type);

  if (googleEventId) {
    try {
      const updated = await calendar.events.update({
        calendarId,
        eventId: googleEventId,
        requestBody,
      });
      if (updated.data.id) return updated.data.id;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }

  const created = await calendar.events.insert({ calendarId, requestBody });
  if (!created.data.id)
    throw new Error("Google Calendar non ha restituito l'id dell'evento");
  return created.data.id;
}
