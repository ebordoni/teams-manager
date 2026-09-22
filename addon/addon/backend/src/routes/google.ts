import { Request, Response, Router } from "express";
import { z } from "zod";
import {
  disconnectGoogle,
  getAuthUrl,
  isGoogleConfigured,
  isGoogleConnected,
  hasGoogleCalendarAccess,
  exchangeCodeForTokens,
  consumeOAuthState,
  createOAuthState,
} from "../services/google/auth";

const router = Router();

const OAuthCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
});

// GET /api/google/status
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    configured: isGoogleConfigured(),
    connected: isGoogleConfigured() && isGoogleConnected(),
    calendarConnected: isGoogleConfigured() && hasGoogleCalendarAccess(),
  });
});

// GET /api/google/oauth/url
router.get("/oauth/url", (_req: Request, res: Response) => {
  if (!isGoogleConfigured()) {
    res.status(400).json({
      error:
        "Google non configurato: imposta client id/secret nelle opzioni dell'addon",
    });
    return;
  }
  res.json({ url: getAuthUrl(createOAuthState()) });
});

// GET /api/google/oauth/callback — Google reindirizza qui dopo il consenso.
// Deve essere raggiunto dal browser sulla porta diretta dell'addon (non Ingress).
router.get("/oauth/callback", async (req: Request, res: Response) => {
  const parse = OAuthCallbackSchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).send("Parametri OAuth non validi");
    return;
  }
  const { code, error, state } = parse.data;

  // Va verificato anche in caso di errore restituito da Google, così lo stato
  // non resta valido dopo un tentativo di consenso annullato.
  if (!state || !consumeOAuthState(state)) {
    res.status(400).send("Richiesta OAuth non valida o scaduta: riprova il collegamento");
    return;
  }

  if (error) {
    res.status(400).send(`Autorizzazione Google rifiutata: ${error}`);
    return;
  }
  if (!code) {
    res.status(400).send("Parametro 'code' mancante");
    return;
  }

  try {
    await exchangeCodeForTokens(code);
    res.send(
      "<html><body><h3>Google collegato con successo ✅</h3>" +
        "<p>Puoi chiudere questa finestra e tornare all'app GIPS Calcio.</p></body></html>",
    );
  } catch (err) {
    console.error("[google] OAuth callback error", err);
    res.status(500).send("Errore durante lo scambio del codice OAuth");
  }
});

// POST /api/google/disconnect
router.post("/disconnect", (_req: Request, res: Response) => {
  disconnectGoogle();
  res.status(204).send();
});

export default router;
