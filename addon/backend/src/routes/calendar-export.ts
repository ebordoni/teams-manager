import { Request, Response, Router } from "express";
import { z } from "zod";
import { rowToEvent, rowToEventTypeDef } from "../db/helpers";
import { getDb } from "../db/schema";
import {
  GoogleAuthRequiredError,
  hasGoogleCalendarAccess,
  withGoogleAuth,
} from "../services/google/auth";
import { upsertCalendarEvent } from "../services/google/calendar";
import { getSetting, SETTINGS_KEYS } from "../services/settings.service";
import type { EventRow, EventTypeDefRow } from "../types";

const router = Router();
const ExportSchema = z.object({
  eventIds: z.array(z.number().int().positive()).min(1),
});

router.post("/export", async (req: Request, res: Response) => {
  const parse = ExportSchema.safeParse(req.body);
  if (!parse.success)
    return void res.status(400).json({ error: parse.error.flatten() });
  if (!hasGoogleCalendarAccess()) {
    return void res
      .status(403)
      .json({ error: "Ricollega Google per autorizzare l'accesso a Calendar" });
  }

  const db = getDb();
  const calendarId = getSetting(SETTINGS_KEYS.googleCalendarId) ?? "primary";
  const eventTypes = new Map(
    (
      db
        .prepare("SELECT * FROM event_types")
        .all() as unknown as EventTypeDefRow[]
    ).map((row) => {
      const type = rowToEventTypeDef(row);
      return [type.key, type] as const;
    }),
  );
  let exported = 0;

  try {
    await withGoogleAuth(async (auth) => {
      for (const eventId of new Set(parse.data.eventIds)) {
        const row = db
          .prepare("SELECT * FROM events WHERE id = ?")
          .get(eventId) as EventRow | undefined;
        if (!row) continue;
        const event = rowToEvent(row);
        const mapping = db
          .prepare(
            "SELECT google_event_id FROM google_calendar_exports WHERE event_id = ?",
          )
          .get(eventId) as { google_event_id: string } | undefined;
        const googleEventId = await upsertCalendarEvent(
          auth,
          calendarId,
          event,
          eventTypes.get(event.type),
          mapping?.google_event_id,
        );
        db.prepare(
          `INSERT INTO google_calendar_exports (event_id, google_event_id, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(event_id) DO UPDATE SET google_event_id = excluded.google_event_id, updated_at = CURRENT_TIMESTAMP`,
        ).run(eventId, googleEventId);
        exported += 1;
      }
    });
    res.json({ exported });
  } catch (error) {
    if (error instanceof GoogleAuthRequiredError) {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error("[calendar] Export Google Calendar fallito", error);
    res
      .status(502)
      .json({ error: "Impossibile esportare gli eventi su Google Calendar" });
  }
});

export default router;
