import { Request, Response, Router } from "express";
import { z } from "zod";
import { areMatchCallupsEnabled, getSetting, getTeamName, setSetting, SETTINGS_KEYS } from "../services/settings.service";
import { queueLiveCommunicationRefresh } from "../services/live-communication-scheduler.service";

const router = Router();

const UpdateSchema = z.object({
  teamName: z.string().trim().min(1).max(100).optional(),
  googleCalendarId: z.string().trim().min(1).optional().nullable(),
  matchCallupsEnabled: z.boolean().optional(),
});

// GET /api/settings
router.get("/", (_req: Request, res: Response) => {
  res.json({
    teamName: getTeamName(),
    googleCalendarId: getSetting(SETTINGS_KEYS.googleCalendarId) ?? "primary",
    matchCallupsEnabled: areMatchCallupsEnabled(),
  });
});

// PUT /api/settings
router.put("/", (req: Request, res: Response) => {
  const parse = UpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const { teamName } = parse.data;
  if (teamName !== undefined) {
    setSetting(SETTINGS_KEYS.teamName, teamName);
  }
  if (parse.data.googleCalendarId !== undefined) {
    setSetting(
      SETTINGS_KEYS.googleCalendarId,
      parse.data.googleCalendarId?.trim() || "primary",
    );
  }
  if (parse.data.matchCallupsEnabled !== undefined) {
    setSetting(
      SETTINGS_KEYS.matchCallupsEnabled,
      parse.data.matchCallupsEnabled ? "true" : "false",
    );
    queueLiveCommunicationRefresh();
  }
  res.json({
    teamName: getTeamName(),
    googleCalendarId: getSetting(SETTINGS_KEYS.googleCalendarId) ?? "primary",
    matchCallupsEnabled: areMatchCallupsEnabled(),
  });
});

export default router;
