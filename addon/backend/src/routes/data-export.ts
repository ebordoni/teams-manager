import { Router } from "express";
import { z } from "zod";
import { createDataExport, DataImportError, importData, previewDataImport } from "../services/data-transfer.service";

const router = Router();

/** Esporta i dati gestionali, escludendo token OAuth, chiavi AI e stato di consenso. */
router.get("/export", (_req, res) => {
  const payload = createDataExport();
  const stamp = payload.exportedAt.slice(0, 10);
  res
    .status(200)
    .type("application/json")
    .setHeader("Content-Disposition", `attachment; filename="teams-manager-${stamp}.json"`)
    .send(JSON.stringify(payload, null, 2));
});

router.post("/import/preview", (req, res, next) => {
  try { res.json(previewDataImport(req.body)); }
  catch (error) {
    if (error instanceof DataImportError) return void res.status(error.status).json({ error: error.message });
    next(error);
  }
});

const importRequest = z.object({
  backup: z.unknown(), confirmReplace: z.literal(true), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
router.post("/import", (req, res, next) => {
  const parsed = importRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Verifica il file e conferma esplicitamente la sostituzione dei dati prima di importare." });
  try { res.json(importData(parsed.data.backup, parsed.data.expectedRevision)); }
  catch (error) {
    if (error instanceof DataImportError) return void res.status(error.status).json({ error: error.message });
    next(error);
  }
});

export default router;
