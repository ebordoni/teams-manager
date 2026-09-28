import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconBallFootball,
  IconCalendarEvent,
  IconCalendarPlus,
  IconChevronRight,
  IconFileText,
  IconLayoutList,
  IconMapPin,
  IconTrophy,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EventTypeIcon } from "../components/EventTypeIcon";
import PageLoader from "../components/PageLoader";
import type { EventTypeDef, Player, TeamEvent, TeamSummary } from "../types";
import { formatDisplayDate } from "../utils/date";

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

function formatFullDate(date: string, time?: string | null): string {
  const formatted = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
  return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}${time ? ` alle ${time}` : ""}`;
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
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [playersRes, eventsRes, typesRes, summaryRes, settingsRes] = await Promise.all([
          api.getPlayers(),
          api.getEvents(),
          api.getEventTypes(),
          api.getTeamSummary(),
          api.getSettings(),
        ]);
        setPlayers(playersRes.data);
        setEvents(eventsRes.data);
        setEventTypes(typesRes.data);
        setSummary(summaryRes.data);
        setTeamName(settingsRes.data.teamName);
      } catch {
        setError("Impossibile caricare la panoramica della squadra. Riprova tra poco.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <PageLoader />;

  const today = todayIso();
  const pastEvents = events.filter((event) => event.date < today);
  const lastEvent = pastEvents[pastEvents.length - 1];
  const nextEvent = events.find((event) => event.date >= today);
  const upcomingEvents = events.filter((event) => event.date >= today).slice(0, 4);
  const typeOf = (key: string) => eventTypes.find((type) => type.key === key);

  function renderEventOverview(event: TeamEvent, variant: "last" | "next") {
    const type = typeOf(event.type);
    const isMatch = type?.hasOpponent;
    return (
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon variant="light" color={variant === "next" ? "blue" : "gray"} size="lg">
              <EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} size={20} />
            </ThemeIcon>
            <div>
              <Text fw={700}>{type?.label ?? event.type}</Text>
              <Text size="sm" c="dimmed">{formatFullDate(event.date, event.startTime)}</Text>
            </div>
          </Group>
          {event.status !== "scheduled" && (
            <Badge color={event.status === "cancelled" ? "red" : "orange"} variant="light">
              {event.status === "cancelled" ? "Annullato" : "Modificato"}
            </Badge>
          )}
        </Group>
        <Divider />
        {isMatch && (
          <Group justify="space-between" wrap="nowrap">
            <Text>{teamName}</Text>
            <Text fw={600}>{event.opponent ?? "Avversario da definire"}</Text>
          </Group>
        )}
        {event.location && (
          <Group gap={6} c="dimmed">
            <IconMapPin size={16} />
            <Text size="sm">{event.location}</Text>
          </Group>
        )}
        <Button component={Link} to={`/events/${event.id}`} variant="subtle" size="compact-sm" rightSection={<IconChevronRight size={15} />} style={{ alignSelf: "flex-end" }}>
          Vedi l'evento
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2} c="red.7">Dashboard</Title>
        <Text c="dimmed">Una panoramica chiara di squadra, appuntamenti e risultati.</Text>
      </div>

      {error && <Alert color="red" title="Caricamento non riuscito">{error}</Alert>}

      <Card withBorder padding={0} radius="md" style={{ overflow: "hidden" }}>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={0}>
          <div style={{ minHeight: 190, display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--mantine-color-red-7), var(--mantine-color-orange-6))" }}>
            <ThemeIcon size={88} radius="xl" variant="white" color="red">
              <IconBallFootball size={52} />
            </ThemeIcon>
          </div>
          <Stack gap="md" p="lg" style={{ gridColumn: "span 2" }}>
            <div>
              <Title order={3}>{teamName.toUpperCase()}</Title>
              <Text c="dimmed">Calcio · Gestione squadra</Text>
            </div>
            <Group gap="xl" wrap="wrap">
              <div><Text size="xl" fw={700}>{players.length}</Text><Text size="sm" c="dimmed">Giocatori</Text></div>
              <Divider orientation="vertical" />
              <div><Text size="xl" fw={700}>{summary?.results.played ?? 0}</Text><Text size="sm" c="dimmed">Partite</Text></div>
              <Divider orientation="vertical" />
              <div><Text size="xl" fw={700}>{summary?.results.goalsFor ?? 0}</Text><Text size="sm" c="dimmed">Reti</Text></div>
            </Group>
          </Stack>
        </SimpleGrid>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder padding="lg" radius="md">
          <Title order={4} mb="md">Ultimo evento</Title>
          {lastEvent ? renderEventOverview(lastEvent, "last") : (
            <Text c="dimmed">Nessun evento passato da mostrare.</Text>
          )}
        </Card>
        <Card withBorder padding="lg" radius="md">
          <Title order={4} mb="md">Prossimo evento</Title>
          {nextEvent ? renderEventOverview(nextEvent, "next") : (
            <Stack align="center" justify="center" py="xl" gap="xs" c="dimmed">
              <IconCalendarEvent size={30} />
              <Text>Nessun evento futuro</Text>
              <Button component={Link} to="/calendar" variant="subtle" size="compact-sm">Vedi il calendario</Button>
            </Stack>
          )}
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Ultimi risultati</Title>
            <ThemeIcon variant="light" color="yellow"><IconTrophy size={18} /></ThemeIcon>
          </Group>
          {summary?.recentResults.length ? (
            <Stack gap="xs">
              {summary.recentResults.map((match) => (
                <Group key={match.eventId} justify="space-between">
                  <Text size="sm">{formatDisplayDate(match.date)}{match.opponent ? ` · vs ${match.opponent}` : ""}</Text>
                  <Badge color={match.teamScore > match.opponentScore ? "green" : match.teamScore < match.opponentScore ? "red" : "gray"}>{match.teamScore}–{match.opponentScore}</Badge>
                </Group>
              ))}
            </Stack>
          ) : <Text c="dimmed">Nessun risultato registrato.</Text>}
        </Card>
        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>In programma</Title>
            <Button component={Link} to="/calendar" variant="subtle" size="compact-sm">Calendario</Button>
          </Group>
          {upcomingEvents.length ? (
            <Stack gap="xs">
              {upcomingEvents.map((event) => {
                const type = typeOf(event.type);
                return <Link key={event.id} to={`/events/${event.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap"><EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} size={17} /><Text size="sm" truncate>{type?.label ?? event.type}{event.opponent ? ` · vs ${event.opponent}` : ""}</Text></Group>
                    <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatDisplayDate(event.date)}</Text>
                  </Group>
                </Link>;
              })}
            </Stack>
          ) : <Text c="dimmed">Nessun appuntamento in programma.</Text>}
        </Card>
      </SimpleGrid>

      <Group gap="sm" wrap="wrap">
        <Button component={Link} to="/calendar" leftSection={<IconCalendarPlus size={18} />}>Nuovo appuntamento</Button>
        <Button component={Link} to="/formations" variant="light" leftSection={<IconLayoutList size={18} />}>Formazioni</Button>
        <Button component={Link} to="/communications" variant="light" leftSection={<IconFileText size={18} />}>Comunicazioni</Button>
      </Group>
    </Stack>
  );
}
