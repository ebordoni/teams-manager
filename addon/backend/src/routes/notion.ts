import { Router } from "express";
import { z } from "zod";
import { NotionError, notionErrorResponse, notionMode, notionStatus, verifyNotion } from "../services/notion.service";
import { configureNotion } from "../services/communication.service";

const router = Router();
router.get("/", (_req, res) => { res.json(notionStatus()); });
const schema = z.object({ token: z.string().trim().max(500).optional(), page: z.string().trim().min(1).max(2000), publicUrl: z.string().trim().max(2000).default(""), active: z.boolean(), mode: z.enum(["page", "database"]).optional() });
router.put("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Controlla token e link della pagina Notion." }); return; }
  try { res.json(await configureNotion(parsed.data)); }
  catch (error) { res.status(400).json({ error: error instanceof NotionError ? error.message : "Link Notion non valido." }); }
});
router.post("/verify", async (_req, res) => {
  try { await verifyNotion(); res.json({ message: `${notionMode() === "database" ? "Database accessibile" : "Pagina accessibile"}. Per verificare la scrittura usa Aggiorna ora in Comunicazioni.` }); }
  catch (error) { res.status(502).json(error instanceof NotionError ? notionErrorResponse(error) : { error: "Verifica Notion non riuscita." }); }
});
export default router;
