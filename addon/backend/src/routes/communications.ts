import { Request, Response, Router } from "express";
import { z } from "zod";
import { rowToCommunication } from "../db/helpers";
import {
  deleteCommunication,
  generateCommunication,
  listCommunications,
} from "../services/communication.service";

const router = Router();

const GenerateSchema = z.object({
  eventIds: z.array(z.number().int().positive()).min(1),
});

// GET /api/communications — storico delle comunicazioni generate (F10)
router.get("/", (_req: Request, res: Response) => {
  res.json(listCommunications().map(rowToCommunication));
});

// POST /api/communications — genera un Google Doc per gli eventi indicati (F07/F09)
router.post("/", async (req: Request, res: Response) => {
  const parse = GenerateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  try {
    const result = await generateCommunication(parse.data.eventIds);
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    res.status(400).json({ error: message });
  }
});

// DELETE /api/communications/:id — elimina il documento da Drive e dallo storico
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await deleteCommunication(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    res.status(400).json({ error: message });
  }
});

export default router;
