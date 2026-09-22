import { Request, Response, Router } from "express";
import { z } from "zod";
import { getDb } from "../db/schema";
import type { Formation, FormationRow } from "../types";

const router = Router();
const slots = ["portiere", "difensoreSinistro", "difensoreDestro", "centrale", "fasciaSinistra", "fasciaDestra", "attaccante"] as const;
const FormationSchema = z.object({
  name: z.string().trim().min(1),
  assignments: z.record(z.enum(slots), z.number().int().positive().nullable()),
});
const toFormation = (row: FormationRow): Formation => ({ id: row.id, name: row.name, system: row.system, assignments: JSON.parse(row.assignments), createdAt: row.created_at });

router.get("/", (_req: Request, res: Response) => {
  res.json((getDb().prepare("SELECT * FROM formations ORDER BY created_at DESC").all() as unknown as FormationRow[]).map(toFormation));
});
router.post("/", (req: Request, res: Response) => {
  const parsed = FormationSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  const result = getDb().prepare("INSERT INTO formations (name, assignments) VALUES (?, ?)").run(parsed.data.name, JSON.stringify(parsed.data.assignments));
  const row = getDb().prepare("SELECT * FROM formations WHERE id = ?").get(result.lastInsertRowid) as unknown as FormationRow;
  res.status(201).json(toFormation(row));
});
router.put("/:id", (req: Request, res: Response) => {
  const parsed = FormationSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  const result = getDb().prepare("UPDATE formations SET name = ?, assignments = ? WHERE id = ?").run(parsed.data.name, JSON.stringify(parsed.data.assignments), req.params.id);
  if (!result.changes) return void res.status(404).json({ error: "Formazione non trovata" });
  const row = getDb().prepare("SELECT * FROM formations WHERE id = ?").get(req.params.id) as unknown as FormationRow;
  res.json(toFormation(row));
});
router.delete("/:id", (req: Request, res: Response) => {
  const changes = getDb().prepare("DELETE FROM formations WHERE id = ?").run(req.params.id).changes;
  if (!changes) return void res.status(404).json({ error: "Formazione non trovata" });
  res.status(204).send();
});
export default router;
