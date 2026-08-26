import { Request, Response, Router } from "express";
import {
  disconnectGoogle,
  getAuthUrl,
  isGoogleConfigured,
  isGoogleConnected,
  exchangeCodeForTokens,
} from "../services/google/auth";

const router = Router();

// GET /api/google/status
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    configured: isGoogleConfigured(),
    connected: isGoogleConfigured() && isGoogleConnected(),
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
  res.json({ url: getAuthUrl() });
});

// GET /api/google/oauth/callback — Google reindirizza qui dopo il consenso.
// Deve essere raggiunto dal browser sulla porta diretta dell'addon (non Ingress).
router.get("/oauth/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

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
