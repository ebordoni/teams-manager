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
  IconCalendar,
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

function nextIsoDay(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

function shortDay(date: string): { weekday: string; day: string; month: string } {
  const value = new Date(`${date}T12:00:00`);
  return {
    weekday: new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(value).replace(".", ""),
    day: new Intl.DateTimeFormat("it-IT", { day: "2-digit" }).format(value),
    month: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(value).replace(".", ""),
  };
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
  const tomorrow = nextIsoDay(today);
  const todayEvents = events.filter((event) => event.date === today);
  const tomorrowEvents = events.filter((event) => event.date === tomorrow);
  const typeOf = (key: string) => eventTypes.find((type) => type.key === key);

  function renderEventOverview(event: TeamEvent) {
    const type = typeOf(event.type);
    const isMatch = type?.hasOpponent;
    return (
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon variant="light" color="gray" size="lg">
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
        <Group justify="flex-end" gap="xs">
          <Button component={Link} to={`/events/${event.id}`} variant="subtle" size="sm" rightSection={<IconChevronRight size={15} />}>
            Vedi l'evento
          </Button>
        </Group>
      </Stack>
    );
  }

  function renderDayAgenda(date: string, label: "Oggi" | "Domani", dayEvents: TeamEvent[]) {
    const day = shortDay(date);
    return <Stack gap="sm" style={{ minWidth: 0 }}>
      <Text size="sm" fw={700} tt="capitalize">{day.weekday}</Text>
      <Group gap="xs" align="center">
        <Text fw={800} fz="xl" c={label === "Oggi" ? "blue.3" : undefined} style={label === "Oggi" ? { background: "var(--mantine-color-blue-filled)", color: "white", borderRadius: "var(--mantine-radius-sm)", padding: "0 7px", lineHeight: 1.25 } : undefined}>{day.day}</Text>
        <Text size="sm" fw={700} tt="uppercase">{day.month}</Text>
        <Text size="xs" c="dimmed">{label}</Text>
      </Group>
      <Stack gap="xs" mt="xs">
        {dayEvents.length === 0 ? <Text size="sm" c="dimmed" style={{ borderLeft: "2px solid var(--mantine-color-blue-6)", paddingLeft: 10 }}>✓ Nessun evento</Text> : dayEvents.map((event) => {
          const type = typeOf(event.type);
          const title = `${type?.label ?? event.type}${event.opponent ? ` · vs ${event.opponent}` : ""}`;
          return <Link key={event.id} to={`/events/${event.id}`} style={{ color: "inherit", textDecoration: "none", borderLeft: `2px solid var(--mantine-color-${event.status === "cancelled" ? "red" : event.status === "modified" ? "orange" : "blue"}-6)`, paddingLeft: 10 }}>
            <Text size="sm" fw={650} lineClamp={2}>{title}</Text>
            <Group gap={5}><EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} size={14} /><Text size="sm" c="dimmed">{event.startTime ?? "Orario da definire"}</Text>{event.location && <Text size="sm" c="dimmed" truncate>· {event.location}</Text>}</Group>
          </Link>;
        })}
      </Stack>
    </Stack>;
  }

  return (
    <Stack gap="lg">
      <Group className="app-page-header" justify="space-between" align="center" gap="md" wrap="wrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Title order={2} className="app-page-title">{teamName}</Title>
          <Text c="dimmed" size="sm">Calcio · Gestione squadra</Text>
        </Stack>
        <Group gap={0} wrap="wrap" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-md)", overflow: "hidden" }}>
          <TeamMetric value={players.length} label="Giocatori" />
          <TeamMetric value={summary?.results.played ?? 0} label="Partite" withBorder />
          <TeamMetric value={summary?.results.goalsFor ?? 0} label="Reti" withBorder />
        </Group>
      </Group>

      {error && <Alert color="red" title="Caricamento non riuscito">{error}</Alert>}

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between" mb="md"><Group gap="xs"><IconCalendar size={20} /><Title order={4}>Calendario</Title></Group><Button component={Link} to="/calendar" variant="subtle" size="compact-sm">Vedi tutto</Button></Group>
          <Title order={2} mb="lg">Oggi e domani</Title>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xl">
            {renderDayAgenda(today, "Oggi", todayEvents)}
            {renderDayAgenda(tomorrow, "Domani", tomorrowEvents)}
          </SimpleGrid>
        </Card>
        <Card withBorder padding="lg" radius="md">
          <Title order={4} mb="md">Ultimo evento</Title>
          {lastEvent ? renderEventOverview(lastEvent) : (
            <Text c="dimmed">Nessun evento passato da mostrare.</Text>
          )}
        </Card>
      </SimpleGrid>

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

      <Group gap="sm" wrap="wrap">
        <Button component={Link} to="/calendar" leftSection={<IconCalendarPlus size={18} />}>Nuovo appuntamento</Button>
        <Button component={Link} to="/formations" variant="light" leftSection={<IconLayoutList size={18} />}>Formazioni</Button>
        <Button component={Link} to="/communications" variant="light" leftSection={<IconFileText size={18} />}>Comunicazioni</Button>
      </Group>
    </Stack>
  );
}

function TeamMetric({ value, label, withBorder = false }: { value: number; label: string; withBorder?: boolean }) {
  return <Stack gap={0} px="md" py="xs" style={withBorder ? { borderLeft: "1px solid var(--mantine-color-default-border)" } : undefined}>
    <Text fw={800} fz="lg">{value}</Text>
    <Text size="xs" c="dimmed">{label}</Text>
  </Stack>;
}
