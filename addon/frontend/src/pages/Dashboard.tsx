import { Alert, Badge, Button, Card, Stack, Text } from "@mantine/core";
import {
  IconBallFootball,
  IconCalendar,
  IconCalendarPlus,
  IconCheck,
  IconChevronRight,
  IconFileText,
  IconLayoutList,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import EventSummary from "../components/EventPresentation";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import PageLoader from "../components/PageLoader";
import SectionHeading from "../components/SectionHeading";
import type { EventTypeDef, Player, TeamEvent, TeamSummary } from "../types";
import { formatDisplayDate } from "../utils/date";
import type { ReactNode } from "react";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function tomorrowIso(today: string): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [teamName, setTeamName] = useState("La squadra");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([
      api.getPlayers(),
      api.getEvents(),
      api.getEventTypes(),
      api.getTeamSummary(),
      api.getSettings(),
    ])
      .then(([playersRes, eventsRes, typesRes, summaryRes, settingsRes]) => {
        setPlayers(playersRes.data);
        setEvents(eventsRes.data);
        setEventTypes(typesRes.data);
        setSummary(summaryRes.data);
        setTeamName(settingsRes.data.teamName);
      })
      .catch(() =>
        setError(
          "Impossibile caricare la panoramica della squadra. Riprova tra poco.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <PageLoader />;
  const today = todayIso();
  const tomorrow = tomorrowIso(today);
  const pastEvents = events.filter((event) => event.date < today);
  const lastEvent = pastEvents[pastEvents.length - 1];
  const typeOf = (key: string) => eventTypes.find((type) => type.key === key);

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="La tua squadra, ogni giorno"
        title="Panoramica"
        description={teamName}
        action={
          <Button
            component={Link}
            to="/calendar"
            leftSection={<IconCalendarPlus size={17} />}
          >
            Nuovo appuntamento
          </Button>
        }
      />
      {error && (
        <Alert color="red" title="Caricamento non riuscito">
          {error}
        </Alert>
      )}
      <div className="dashboard-metrics">
        <Metric
          value={error ? "—" : players.length}
          label="Giocatori in rosa"
          icon={<IconUsers size={23} stroke={1.6} />}
        />
        <Metric
          value={error ? "—" : (summary?.results.played ?? 0)}
          label="Partite giocate"
          icon={<IconTrophy size={23} stroke={1.6} />}
        />
        <Metric
          value={error ? "—" : (summary?.results.goalsFor ?? 0)}
          label="Reti segnate"
          icon={<IconBallFootball size={23} stroke={1.6} />}
        />
      </div>
      <div className="dashboard-main-grid">
        <Stack gap="lg">
          <Card withBorder>
            <SectionHeading
              title="L'agenda della squadra"
              description="Oggi e domani, a colpo d'occhio."
              icon={<IconCalendar size={18} />}
              action={
                <Link
                  to="/calendar"
                  className="app-section-link"
                  aria-label="Apri calendario"
                >
                  <span>Calendario</span>
                  <IconChevronRight size={16} />
                </Link>
              }
            />
            {[
              { date: today, label: "Oggi" },
              { date: tomorrow, label: "Domani" },
            ].map((day) => {
              const items = events.filter((event) => event.date === day.date);
              return (
                <section
                  className="dashboard-agenda-day"
                  key={day.date}
                  aria-label={`Agenda di ${day.label.toLowerCase()}`}
                >
                  <div className="dashboard-day-label">
                    <strong>{day.label}</strong>
                    <span>
                      {new Intl.DateTimeFormat("it-IT", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                      }).format(new Date(`${day.date}T12:00:00`))}
                    </span>
                  </div>
                  {items.length ? (
                    items.map((event) => (
                      <EventSummary
                        key={event.id}
                        event={event}
                        type={typeOf(event.type)}
                        highlighted={day.date === today}
                      />
                    ))
                  ) : (
                    <div className="dashboard-no-events">
                      <IconCheck size={17} stroke={1.5} />
                      <span>Nessun evento in programma.</span>
                    </div>
                  )}
                </section>
              );
            })}
          </Card>
          <Card withBorder>
            <SectionHeading
              title="Strumenti di squadra"
              description="Dalla preparazione del campo alle comunicazioni."
            />
            <Link className="dashboard-shortcut" to="/formations">
              <IconLayoutList size={21} stroke={1.6} />
              <div>
                <Text size="sm" fw={500}>
                  Prepara una formazione
                </Text>
                <Text size="xs" c="dimmed">
                  Schieramenti e assegnazioni sul campo
                </Text>
              </div>
              <IconChevronRight size={17} />
            </Link>
            <Link className="dashboard-shortcut" to="/communications">
              <IconFileText size={21} stroke={1.6} />
              <div>
                <Text size="sm" fw={500}>
                  Condividi gli appuntamenti
                </Text>
                <Text size="xs" c="dimmed">
                  Pubblica le comunicazioni della squadra
                </Text>
              </div>
              <IconChevronRight size={17} />
            </Link>
          </Card>
        </Stack>
        <Stack gap="lg">
          <Card withBorder>
            <SectionHeading
              title="Ultimo evento"
              icon={<IconCalendar size={18} />}
            />
            {lastEvent ? (
              <>
                <EventSummary event={lastEvent} type={typeOf(lastEvent.type)} />
                {lastEvent.opponent && (
                  <Text size="xs" c="dimmed">
                    {teamName} · {lastEvent.opponent}
                  </Text>
                )}
              </>
            ) : (
              <EmptyState
                title="Si comincia da qui"
                description="Gli eventi trascorsi compariranno in questa sezione."
              />
            )}
          </Card>
          <Card withBorder>
            <SectionHeading
              title="Ultimi risultati"
              icon={<IconTrophy size={18} />}
            />
            {summary?.recentResults.length ? (
              summary.recentResults.map((match) => (
                <Link
                  className="dashboard-result"
                  key={match.eventId}
                  to={`/events/${match.eventId}`}
                >
                  <div>
                    <Text size="sm" fw={500}>
                      {match.opponent ? `vs ${match.opponent}` : "Partita"}
                    </Text>
                    <Text size="xs" c="dimmed" mt={3}>
                      {formatDisplayDate(match.date)}
                    </Text>
                  </div>
                  <Badge
                    className="dashboard-result-score"
                    size="lg"
                    color={
                      match.teamScore > match.opponentScore
                        ? "green"
                        : match.teamScore < match.opponentScore
                          ? "red"
                          : "gray"
                    }
                  >
                    {match.teamScore} – {match.opponentScore}
                  </Badge>
                </Link>
              ))
            ) : (
              <EmptyState
                title="Ancora nessun risultato"
                description="I risultati delle partite saranno raccolti qui."
                icon={<IconTrophy size={24} stroke={1.5} />}
              />
            )}
          </Card>
        </Stack>
      </div>
    </Stack>
  );
}

function Metric({
  value,
  label,
  icon,
}: {
  value: number | string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <div className="dashboard-metric">
      <span className="dashboard-metric-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
