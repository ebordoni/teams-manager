import { Router } from "express";
import { z } from "zod";
import { GoogleAuthRequiredError } from "../services/google/auth";
import { exportMatchPlan } from "../services/match-plan-export.service";
import { confirmMatchPlan, deleteMatchPlan, generateMatchPlan, getMatchPlan, listMatchPlans, updateMatchPlan } from "../services/match-plan.service";

const router = Router({ mergeParams: true });
const ParamsSchema = z.object({ id: z.coerce.number().int().positive(), planId: z.coerce.number().int().positive().optional() });
const AssignmentSchema = z.object({ slot: z.string().min(1), playerId: z.number().int().positive(), role: z.string().min(1) });
const PeriodSchema = z.object({ periodNumber: z.number().int().positive(), assignments: z.array(AssignmentSchema), benchPlayerIds: z.array(z.number().int().positive()) });
const GenerateSchema = z.object({
  name: z.string().trim().max(120).optional(), periodCount: z.number().int().min(1).max(12),
  minutesPerPeriod: z.number().int().min(1).max(90), playersOnField: z.number().int().min(2).max(11),
  system: z.string().trim().max(30).optional(), rolePolicy: z.enum(["strict", "preferred", "free"]),
});

/** Estrae il messaggio utile da Gaxios/Google senza esporre token o payload. */
function exportErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown;
      response?: { data?: { error?: { message?: unknown } | unknown } };
    };
    const googleError = candidate.response?.data?.error;
    if (
      typeof googleError === "object" &&
      googleError !== null &&
      typeof (googleError as { message?: unknown }).message === "string"
    ) {
      return (googleError as { message: string }).message;
    }
    if (typeof candidate.message === "string") return candidate.message;
  }
  return "Errore sconosciuto durante l'esportazione Google";
}

router.get("/", (req, res) => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) return void res.status(400).json({ error: "Id evento non valido" });
  res.json(listMatchPlans(parsed.data.id));
});

router.post("/generate", async (req, res) => {
  const params = ParamsSchema.safeParse(req.params); const body = GenerateSchema.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ error: body.success ? "Id evento non valido" : body.error.flatten() });
  try { res.status(201).json(await generateMatchPlan(params.data.id, body.data)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Generazione non riuscita" }); }
});

router.get("/:planId", (req, res) => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success || !parsed.data.planId) return void res.status(400).json({ error: "Id non valido" });
  const plan = getMatchPlan(parsed.data.id, parsed.data.planId);
  if (!plan) return void res.status(404).json({ error: "Piano partita non trovato" });
  res.json(plan);
});

router.put("/:planId", (req, res) => {
  const params = ParamsSchema.safeParse(req.params);
  const body = z.object({ name: z.string().trim().max(120).optional(), periods: z.array(PeriodSchema).optional() }).safeParse(req.body);
  if (!params.success || !params.data.planId || !body.success) return void res.status(400).json({ error: "Dati non validi" });
  try { res.json(updateMatchPlan(params.data.id, params.data.planId, body.data)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Aggiornamento non riuscito" }); }
});

router.post("/:planId/confirm", (req, res) => {
  const params = ParamsSchema.safeParse(req.params);
  if (!params.success || !params.data.planId) return void res.status(400).json({ error: "Id non valido" });
  try { res.json(confirmMatchPlan(params.data.id, params.data.planId)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Conferma non riuscita" }); }
});

router.post("/:planId/export", async (req, res) => {
  const params = ParamsSchema.safeParse(req.params);
  if (!params.success || !params.data.planId) return void res.status(400).json({ error: "Id non valido" });
  try {
    res.status(201).json(await exportMatchPlan(params.data.id, params.data.planId));
  } catch (error) {
    if (error instanceof GoogleAuthRequiredError) return void res.status(403).json({ error: error.message });
    if (error instanceof Error && /non trovato/.test(error.message)) return void res.status(404).json({ error: error.message });
    console.error("[match-plans] Export Google Docs fallito", error);
    res.status(502).json({
      error: `Impossibile esportare il piano partita in Google Docs: ${exportErrorMessage(error)}`,
    });
  }
});

router.delete("/:planId", (req, res) => {
  const params = ParamsSchema.safeParse(req.params);
  if (!params.success || !params.data.planId) return void res.status(400).json({ error: "Id non valido" });
  if (!deleteMatchPlan(params.data.id, params.data.planId)) return void res.status(404).json({ error: "Piano partita non trovato" });
  res.status(204).send();
});

export default router;
