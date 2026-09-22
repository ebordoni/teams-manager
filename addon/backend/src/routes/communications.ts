import { Request, Response, Router } from "express";
import { z } from "zod";
import { rowToCommunication } from "../db/helpers";
import {
  CommunicationRequestError,
  deleteCommunication,
  DriveDeletionError,
  generateCommunication,
  listCommunications,
} from "../services/communication.service";
import { GoogleAuthRequiredError } from "../services/google/auth";

const router = Router();

/**
 * Traduce gli errori del servizio: 403 se serve (ri)collegare Google, 400 se la
 * richiesta non è valida, 502 se Google ha risposto male.
 */
function sendServiceError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof GoogleAuthRequiredError) {
    res.status(403).json({ error: err.message });
    return;
  }
  if (err instanceof CommunicationRequestError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof DriveDeletionError) {
    res.status(502).json({ error: err.message });
    return;
  }
  console.error("[communications]", err instanceof Error ? err.message : err);
  res.status(502).json({ error: fallback });
}

const GenerateSchema = z.object({
  eventIds: z.array(z.number().int().positive()).min(1),
});
const CommunicationIdSchema = z.coerce.number().int().positive();

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
    sendServiceError(
      res,
      err,
      "Impossibile generare la comunicazione su Google Docs. Riprova più tardi.",
    );
  }
});

// DELETE /api/communications/:id — elimina il documento da Drive e dallo storico
router.delete("/:id", async (req: Request, res: Response) => {
  const idParse = CommunicationIdSchema.safeParse(req.params.id);
  if (!idParse.success) {
    res.status(400).json({ error: "Id comunicazione non valido" });
    return;
  }

  try {
    await deleteCommunication(idParse.data);
    res.status(204).send();
  } catch (err) {
    sendServiceError(
      res,
      err,
      "Impossibile eliminare la comunicazione. Riprova più tardi.",
    );
  }
});

export default router;
