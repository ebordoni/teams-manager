import { rowToEvent } from "../db/helpers";
import { getDb } from "../db/schema";
import type { EventRow, MatchPlan } from "../types";
import { withGoogleAuth } from "./google/auth";
import { createStyledDocument } from "./google/docs";
import { documentStyles } from "./google/document-styles";
import { DocumentBuilder } from "./google/DocumentBuilder";
import {
  ensureMatchPlansFolder,
  makeShareableAndGetLink,
  moveFileToFolder,
} from "./google/drive";
import { getMatchPlan } from "./match-plan.service";
import { getTeamName } from "./settings.service";

const SLOT_LABELS: Record<string, string> = {
  portiere: "Portiere",
  difensoreSinistro: "Difensore sinistro",
  difensoreDestro: "Difensore destro",
  centrale: "Centrocampista",
  fasciaSinistra: "Fascia sinistra",
  fasciaDestra: "Fascia destra",
  attaccante: "Attaccante",
};

export interface GeneratedMatchPlanExport {
  title: string;
  googleDocId: string;
  googleDocUrl: string;
}

function playerNames(plan: MatchPlan): Map<number, string> {
  const ids = [
    ...new Set(
      plan.periods.flatMap((period) => [
        ...period.assignments.map((assignment) => assignment.playerId),
        ...period.benchPlayerIds,
      ]),
    ),
  ];
  if (!ids.length) return new Map();
  const rows = getDb()
    .prepare(
      `SELECT id, name FROM players WHERE id IN (${ids.map(() => "?").join(", ")})`,
    )
    .all(...ids) as Array<{ id: number; name: string }>;
  return new Map(rows.map((player) => [player.id, player.name]));
}

function buildDocument(
  plan: MatchPlan,
  event: { date: string; opponent: string | null },
): { title: string; builder: DocumentBuilder } {
  const teamName = getTeamName();
  const title = `${teamName} – ${plan.name}`;
  const names = playerNames(plan);
  const builder = new DocumentBuilder()
    .addParagraph(teamName.toLocaleUpperCase("it-IT"), documentStyles.title)
    .addParagraph("Piano partita", documentStyles.subtitle)
    .addParagraph(
      `${event.date}${event.opponent ? ` · ${teamName} – ${event.opponent}` : ""}`,
      documentStyles.match,
    )
    .addParagraph(
      `${plan.periodCount} tempi · ${plan.minutesPerPeriod} minuti per tempo · ${plan.playersOnField} in campo`,
      documentStyles.normal,
    )
    .addEmptyLine();

  for (const period of plan.periods) {
    builder.addParagraph(
      `Tempo ${period.periodNumber} · ${plan.minutesPerPeriod} minuti`,
      documentStyles.date,
    );
    for (const assignment of period.assignments) {
      const label = SLOT_LABELS[assignment.slot] ?? assignment.role;
      const playerName =
        names.get(assignment.playerId) ?? "Giocatore non trovato";

      builder
        .addText(`${label}: `, {
          textStyle: {
            ...documentStyles.normal.textStyle,
            bold: true,
          },
        })
        .addParagraph(playerName, documentStyles.normal);
    }
    const bench = period.benchPlayerIds
      .map((id) => names.get(id))
      .filter((name): name is string => Boolean(name));
    builder.addEmptyLine();

    builder
      .addText(`Panchina: `, {
        textStyle: {
          ...documentStyles.note,
          bold: true,
        },
      })
      .addParagraph(
        bench.length ? bench.join(" · ") : "nessuno",
        documentStyles.note,
      );
    builder.addEmptyLine();
  }

  builder.addParagraph("Riepilogo minutaggio", documentStyles.date);
  const summary = [...names.entries()]
    .map(([id, name]) => {
      const appearances = plan.periods.filter((period) =>
        period.assignments.some((assignment) => assignment.playerId === id),
      ).length;
      const roles = [
        ...new Set(
          plan.periods.flatMap((period) =>
            period.assignments
              .filter((assignment) => assignment.playerId === id)
              .map(
                (assignment) => SLOT_LABELS[assignment.slot] ?? assignment.role,
              ),
          ),
        ),
      ];
      return { name, appearances, roles };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  for (const row of summary) {
    builder.addParagraph(
      `${row.name}: ${row.appearances * plan.minutesPerPeriod} minuti (${row.appearances} tempi)${row.roles.length ? ` · ${row.roles.join(", ")}` : ""}`,
      documentStyles.normal,
    );
  }
  if (plan.warnings.length) {
    builder.addEmptyLine().addParagraph("Note", documentStyles.match);
    plan.warnings.forEach((warning) =>
      builder.addParagraph(`• ${warning}`, documentStyles.note),
    );
  }
  return { title, builder };
}

/** Esporta il piano scelto in un Google Doc condivisibile. */
export async function exportMatchPlan(
  eventId: number,
  planId: number,
): Promise<GeneratedMatchPlanExport> {
  const plan = getMatchPlan(eventId, planId);
  if (!plan) throw new Error("Piano partita non trovato");
  const event = getDb()
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(eventId) as EventRow | undefined;
  if (!event) throw new Error("Evento non trovato");
  const eventData = rowToEvent(event);
  const built = buildDocument(plan, eventData);

  return withGoogleAuth(async (auth) => {
    const googleDocId = await createStyledDocument(
      auth,
      built.title,
      built.builder,
    );
    const folderId = await ensureMatchPlansFolder(auth);
    await moveFileToFolder(auth, googleDocId, folderId);
    return {
      title: built.title,
      googleDocId,
      googleDocUrl: await makeShareableAndGetLink(auth, googleDocId),
    };
  });
}
