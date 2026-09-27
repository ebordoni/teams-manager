import { Request, Response, Router } from "express";
import { z } from "zod";
import { getSetting, getTeamName, setSetting, SETTINGS_KEYS } from "../services/settings.service";

const router = Router();

const UpdateSchema = z.object({
  teamName: z.string().trim().min(1).max(100).optional(),
  googleCalendarId: z.string().trim().min(1).optional().nullable(),
});

// GET /api/settings
router.get("/", (_req: Request, res: Response) => {
  res.json({
    teamName: getTeamName(),
    googleCalendarId: getSetting(SETTINGS_KEYS.googleCalendarId) ?? "primary",
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
  res.json({
    teamName: getTeamName(),
    googleCalendarId: getSetting(SETTINGS_KEYS.googleCalendarId) ?? "primary",
  });
});

export default router;
