import { Router } from "express";
import { z } from "zod";
import { AIService } from "../services/ai.service";
import { AI_PROVIDERS, DEFAULT_AI_MODELS, getAIConfig, updateAIConfig } from "../services/ai-config.service";

const router = Router();
const ConfigSchema = z.object({
  provider: z.enum(AI_PROVIDERS as [string, ...string[]]).optional(),
  model: z.string().trim().max(120).optional(),
  fallbackProviders: z.array(z.enum(AI_PROVIDERS as [string, ...string[]])).optional(),
  defaultPeriodCount: z.number().int().min(1).max(12).optional(),
  defaultMinutesPerPeriod: z.number().int().min(1).max(90).optional(),
  defaultPlayersOnField: z.number().int().min(2).max(11).optional(),
  defaultRolePolicy: z.enum(["strict", "preferred", "free"]).optional(),
});

router.get("/config", (_req, res) => {
  res.json({ ...getAIConfig(), defaultModels: DEFAULT_AI_MODELS });
});

router.put("/config", (req, res) => {
  const parsed = ConfigSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  res.json(updateAIConfig(parsed.data as Parameters<typeof updateAIConfig>[0]));
});

router.post("/test", async (_req, res) => {
  try {
    res.json(await new AIService().testConnection());
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Connessione AI non riuscita" });
  }
});

export default router;
