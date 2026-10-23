import { Router } from "express";
import { z } from "zod";
import { configureWebsite } from "../services/communication.service";
import { previewWebsite, verifyWebsite, websiteSettings } from "../services/public-site.service";
import { queueLiveCommunicationRefresh } from "../services/live-communication-scheduler.service";

const router = Router();
const schema = z.object({
  accountId: z.string().trim().regex(/^[a-f0-9]{32}$/i),
  workerName: z.string().trim().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  token: z.string().trim().min(1).max(500).regex(/^\S+$/).optional(), active: z.boolean(),
  includeNotes: z.boolean().default(false), autoPublish: z.boolean().default(true),
  introduction: z.string().trim().max(1000).default(""), notice: z.string().trim().max(5000).default(""), information: z.string().trim().max(10000).default(""),
}).strict();
router.get("/", (_req, res) => res.json(websiteSettings()));
router.put("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Controlla Account ID, nome Worker e campi del sito." }); return; }
  try { res.json(await configureWebsite(parsed.data)); queueLiveCommunicationRefresh(); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Configurazione non valida." }); }
});
router.post("/verify", async (_req, res) => {
  try { res.json(await verifyWebsite()); }
  catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : "Verifica Cloudflare non riuscita." }); }
});
router.get("/preview", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { res.json(await previewWebsite()); }
  catch { res.status(500).json({ error: "Anteprima non disponibile." }); }
});
export default router;
