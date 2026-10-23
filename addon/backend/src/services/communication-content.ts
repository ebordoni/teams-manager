import { rowToEvent, rowToEventTypeDef } from "../db/helpers";
import { getDb } from "../db/schema";
import type { Event, EventRow, EventTypeDef, EventTypeDefRow, FormationRow } from "../types";
import { areMatchCallupsEnabled, getTeamName } from "./settings.service";

export type ParagraphKind = "title" | "subtitle" | "date" | "event" | "note" | "match" | "normal";
export interface CommunicationParagraph {
  text: string;
  kind: ParagraphKind;
  past?: boolean;
  /** Metadati sull'intestazione data, per impaginare l'agenda senza analizzare il testo. */
  event?: Pick<Event, "id" | "date" | "status">;
}
export interface CommunicationContent { title: string; paragraphs: CommunicationParagraph[] }
class ContentBuilder {
  paragraphs: CommunicationParagraph[] = [];
  addParagraph(text: string, style: ParagraphKind | Omit<CommunicationParagraph, "text">) {
    this.paragraphs.push({ text, ...(typeof style === "string" ? { kind: style } : style) });
    return this;
  }
  addEmptyLine() { return this.addParagraph("", "normal"); }
}

const FORMATION_SLOTS: Array<[string, string]> = [
  ["portiere", "Portiere"],
  ["difensoreSinistro", "Difensore sinistro"],
  ["difensoreDestro", "Difensore destro"],
  ["centrale", "Centrocampista"],
  ["fasciaSinistra", "Fascia sinistra"],
  ["fasciaDestra", "Fascia destra"],
  ["attaccante", "Attaccante"],
];

export function loadEventTypes(): Map<string, EventTypeDef> {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM event_types")
    .all() as unknown as EventTypeDefRow[];
  return new Map(rows.map((r) => [r.key, rowToEventTypeDef(r)]));
}

const WEEKDAYS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];
const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function formatDateIt(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function getTeamPlayerNames(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT name FROM players ORDER BY name ASC")
    .all() as unknown as { name: string }[];
  return rows.map((r) => r.name);
}

function getFormationLines(event: Event): string[] {
  if (!event.formationId) return [];
  const db = getDb();
  const formation = db
    .prepare("SELECT * FROM formations WHERE id = ?")
    .get(event.formationId) as FormationRow | undefined;
  if (!formation) return [];
  const assignments = JSON.parse(formation.assignments) as Record<
    string,
    number | null
  >;
  const playerIds = Object.values(assignments).filter(
    (id): id is number => id !== null,
  );
  if (playerIds.length === 0) return [];
  const players = db
    .prepare(
      `SELECT id, name FROM players WHERE id IN (${playerIds.map(() => "?").join(", ")})`,
    )
    .all(...playerIds) as Array<{ id: number; name: string }>;
  const playerNames = new Map(
    players.map((player) => [player.id, player.name]),
  );
  const lineup = FORMATION_SLOTS.flatMap(([slot, label]) => {
    const name = assignments[slot]
      ? playerNames.get(assignments[slot]!)
      : undefined;
    return name ? [`${label}: ${name}`] : [];
  });
  return lineup.length
    ? [`FORMAZIONE · ${formation.name}`, ...lineup.map((item) => `- ${item}`)]
    : [];
}

// Le pagine pubblicate non usano le icone Tabler: le traduciamo
// quindi in emoji equivalenti, mantenendo distinguibili i tipi configurati.
const COMMUNICATION_EVENT_ICONS: Record<string, string> = {
  IconBallFootball: "⚽",
  IconRun: "🏃",
  IconTrophy: "🏆",
  IconMedal: "🏅",
  IconAward: "🏆",
  IconFlag: "🚩",
  IconPennant: "🚩",
  IconBuildingStadium: "🏟️",
  IconShirtSport: "👕",
  IconTargetArrow: "🎯",
  IconSwords: "⚔️",
  IconCalendarEvent: "📅",
  IconClock: "🕒",
  IconClipboardCheck: "✅",
  IconUsersGroup: "👥",
  IconHeartHandshake: "🤝",
  IconMessageCircle: "💬",
  IconBell: "🔔",
  IconSpeakerphone: "📣",
  IconMapPin: "📍",
  IconBus: "🚌",
  IconCar: "🚗",
  IconHome: "🏠",
  IconSchool: "🏫",
  IconSun: "☀️",
  IconCloudRain: "🌧️",
  IconFirstAidKit: "🩹",
  IconStethoscope: "🩺",
  IconBottle: "🧴",
  IconMoodSmile: "😊",
  IconCamera: "📷",
  IconVideo: "🎥",
  IconBallBasketball: "🏀",
};

export function eventIcon(icon?: string): string {
  return COMMUNICATION_EVENT_ICONS[icon ?? ""] ?? "📅";
}

export function buildCommunicationContent(
  events: Event[],
  eventTypes: Map<string, EventTypeDef>,
): CommunicationContent {
  const sorted = events
    .filter((event) => eventTypes.get(event.type)?.includeInGoogleDoc ?? true)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  const teamName = getTeamName();
  const today = todayIso();
  const title = `${teamName} – Appuntamenti`;
  const builder = new ContentBuilder()
    .addParagraph(teamName.toLocaleUpperCase("it-IT"), "title")
    .addParagraph(
      "Appuntamenti di squadra",
      "subtitle",
    );

  for (const event of sorted) {
    const typeDef = eventTypes.get(event.type);
    const eventLabel = (typeDef?.label ?? event.type).toUpperCase();
    const eventTitle = typeDef?.hasOpponent
      ? `${eventLabel} ${
          event.venue === "away"
            ? "IN TRASFERTA"
            : event.venue === "neutral"
              ? "IN CAMPO NEUTRO"
              : "IN CASA"
        }`
      : eventLabel;
    const style = (kind: ParagraphKind) => ({ kind, past: event.date < today });

    builder
      .addParagraph(formatDateIt(event.date), {
        ...style("date"), event: { id: event.id, date: event.date, status: event.status },
      })
      .addParagraph(
        `${eventIcon(typeDef?.icon)} ${eventTitle}`,
        style("event"),
      );

    if (event.status !== "scheduled") {
      const status = event.status === "cancelled" ? "ANNULLATO" : "MODIFICATO";
      builder.addParagraph(
        `⚠️ ${status}${event.notes ? `: ${event.notes}` : ""}`,
        style("note"),
      );
    }

    if (typeDef?.hasOpponent && event.opponent) {
      const homeTeam = event.venue === "away" ? event.opponent : teamName;
      const awayTeam = event.venue === "away" ? teamName : event.opponent;
      builder.addParagraph(
        `${homeTeam.toLocaleUpperCase("it-IT")} VS ${awayTeam.toLocaleUpperCase("it-IT")}`,
        style("match"),
      );
    }
    if (event.location)
      builder.addParagraph(`📍 ${event.location}`, style("normal"));
    if (event.meetingTime)
      builder.addParagraph(
        `⏰ Ritrovo: ${event.meetingTime}`,
        style("normal"),
      );
    if (event.startTime) {
      builder.addParagraph(
        `⏰ Inizio: ${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`,
        style("normal"),
      );
    }
    if (event.notes && event.status === "scheduled") {
      builder.addParagraph(event.notes, style("note"));
    }

    if (typeDef?.hasOpponent && areMatchCallupsEnabled()) {
      const teamPlayers = getTeamPlayerNames();
      if (teamPlayers.length > 0) {
        builder
          .addParagraph("Convocati", style("match"))
          .addParagraph(teamPlayers.join(" · "), style("normal"));
      }
    }

    const formation = getFormationLines(event);
    if (formation.length > 0) {
      builder.addParagraph(formation[0], style("match"));
      builder.addParagraph(
        formation.slice(1).join(" · "),
        style("normal"),
      );
    }
    builder.addEmptyLine();
  }

  return { title, paragraphs: builder.paragraphs };
}
function todayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function loadLiveEvents(): Event[] {
  const db = getDb();
  const today = todayIso();
  const allowed = loadEventTypes();
  const included = (row: EventRow) => allowed.get(row.type)?.includeInGoogleDoc ?? true;
  const recentPast = db
    .prepare(
      "SELECT * FROM events WHERE date < ? ORDER BY date DESC, start_time DESC",
    )
    .all(today) as unknown as EventRow[];
  const currentAndFuture = db
    .prepare(
      "SELECT * FROM events WHERE date >= ? ORDER BY date ASC, start_time ASC",
    )
    .all(today) as unknown as EventRow[];
  return [...recentPast.filter(included).slice(0, 1), ...currentAndFuture.filter(included)].map(rowToEvent);
}
