import { Request, Response, Router } from "express";
import { z } from "zod";
import { getSetting, setSetting, SETTINGS_KEYS } from "../services/settings.service";

const router = Router();

const UpdateSchema = z.object({
  googleTemplateDocId: z.string().trim().optional().nullable(),
  googleCalendarId: z.string().trim().min(1).optional().nullable(),
});

/** Accetta sia l'id nudo del documento sia un link completo di Google Docs. */
function extractDocId(input: string): string {
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input;
}

// GET /api/settings
router.get("/", (_req: Request, res: Response) => {
  res.json({
    googleTemplateDocId: getSetting(SETTINGS_KEYS.googleTemplateDocId),
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
  const { googleTemplateDocId } = parse.data;
  if (googleTemplateDocId !== undefined) {
    const value = googleTemplateDocId?.trim()
      ? extractDocId(googleTemplateDocId.trim())
      : null;
    setSetting(SETTINGS_KEYS.googleTemplateDocId, value);
  }
  if (parse.data.googleCalendarId !== undefined) {
    setSetting(
      SETTINGS_KEYS.googleCalendarId,
      parse.data.googleCalendarId?.trim() || "primary",
    );
  }
  res.json({
    googleTemplateDocId: getSetting(SETTINGS_KEYS.googleTemplateDocId),
    googleCalendarId: getSetting(SETTINGS_KEYS.googleCalendarId) ?? "primary",
  });
});

export default router;
