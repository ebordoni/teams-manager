import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCalendarPlus,
  IconClipboardCheck,
  IconFileText,
  IconLayoutList,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EventTypeIcon } from "../components/EventTypeIcon";
import PageLoader from "../components/PageLoader";
import type {
  Attendance,
  Communication,
  EventTypeDef,
  Player,
  TeamEvent,
} from "../types";

type EventChecklist = { attendance: Attendance[] };

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<TeamEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [checklist, setChecklist] = useState<EventChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [playersRes, eventsRes, typesRes, communicationsRes] =
          await Promise.all([
            api.getPlayers(),
            api.getEvents({ from: today }),
            api.getEventTypes(),
            api.getCommunications(),
          ]);
        const events = eventsRes.data.slice(0, 5);
        setPlayers(playersRes.data);
        setUpcomingEvents(events);
        setEventTypes(typesRes.data);
        setCommunications(communicationsRes.data);
        if (events[0]) {
          const attendanceRes = await api.getAttendance(events[0].id);
          setChecklist({ attendance: attendanceRes.data });
        } else setChecklist(null);
      } catch {
        setError(
          "Impossibile caricare la panoramica della squadra. Riprova tra poco.",
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <PageLoader />;
  const nextEvent = upcomingEvents[0];
  const typeOf = (key: string) => eventTypes.find((type) => type.key === key);
  const presentCount =
    checklist?.attendance.filter((record) => record.status === "present").length ?? 0;
  const hasCommunication = nextEvent
    ? communications.some((communication) =>
        communication.eventIds.includes(nextEvent.id),
      )
    : false;

  return (
    <Stack gap="lg">
      <div>
        <Title order={3}>Gestione squadra</Title>
        <Text c="dimmed">
          Una vista operativa per preparare il prossimo appuntamento.
        </Text>
      </div>
      {error && (
        <Alert color="red" title="Caricamento non riuscito">
          {error}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Card withBorder padding="md">
          <Group justify="space-between">
            <div>
              <Text size="sm" c="dimmed">
                Giocatori
              </Text>
              <Text size="xl" fw={700}>
                {players.length}
              </Text>
            </div>
            <ThemeIcon variant="light" color="blue" size="lg">
              <IconUsersGroup />
            </ThemeIcon>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Group justify="space-between">
            <div>
              <Text size="sm" c="dimmed">
                Prossimo evento
              </Text>
              <Text size="lg" fw={700}>
                {nextEvent ? nextEvent.date : "—"}
              </Text>
            </div>
            <ThemeIcon variant="light" color="green" size="lg">
              <IconClipboardCheck />
            </ThemeIcon>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Group justify="space-between">
            <div>
              <Text size="sm" c="dimmed">
                Rosa coinvolta
              </Text>
              <Text size="xl" fw={700}>
                {nextEvent ? `${players.length}/${players.length}` : "—"}
              </Text>
            </div>
            <ThemeIcon variant="light" color="orange" size="lg">
              <IconUsersGroup />
            </ThemeIcon>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Group justify="space-between">
            <div>
              <Text size="sm" c="dimmed">
                Presenze
              </Text>
              <Text size="xl" fw={700}>
                {nextEvent ? `${presentCount}/${players.length}` : "—"}
              </Text>
            </div>
            <ThemeIcon variant="light" color="violet" size="lg">
              <IconClipboardCheck />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="lg">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Azioni rapide</Title>
        </Group>
        <Group>
          <Button
            component={Link}
            to="/calendar"
            leftSection={<IconCalendarPlus size={18} />}
          >
            Nuovo appuntamento
          </Button>
          <Button
            component={Link}
            to="/formations"
            variant="light"
            leftSection={<IconLayoutList size={18} />}
          >
            Prepara formazione
          </Button>
          <Button
            component={Link}
            to="/communications"
            variant="light"
            leftSection={<IconFileText size={18} />}
          >
            Comunicazioni
          </Button>
        </Group>
      </Card>

      {nextEvent && (
        <Alert
          color={hasCommunication ? "green" : "blue"}
          title="Preparazione prossimo appuntamento"
        >
          {!hasCommunication
              ? "La rosa è inclusa automaticamente: genera ora la comunicazione per i genitori dal calendario."
              : "La comunicazione per il prossimo evento è già stata generata."}
          <Button
            component={Link}
            to={`/events/${nextEvent.id}`}
            size="compact-sm"
            variant="subtle"
            ml="xs"
          >
            Apri evento
          </Button>
        </Alert>
      )}

      <div>
        <Group justify="space-between" mb="sm">
          <Title order={4}>Prossimi appuntamenti</Title>
          <Button
            component={Link}
            to="/calendar"
            variant="subtle"
            size="compact-sm"
          >
            Apri calendario
          </Button>
        </Group>
        {upcomingEvents.length === 0 ? (
          <Text c="dimmed">
            Nessun evento in programma. Crea il primo appuntamento della
            squadra.
          </Text>
        ) : (
          <Stack gap="xs">
            {upcomingEvents.map((event) => {
              const type = typeOf(event.type);
              return (
                <Card
                  key={event.id}
                  component={Link}
                  to={`/events/${event.id}`}
                  withBorder
                  padding="sm"
                  radius="md"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group wrap="nowrap">
                      <ThemeIcon variant="light" color="blue" size="md">
                        <EventTypeIcon
                          name={type?.icon ?? "IconCalendarEvent"}
                          size={18}
                        />
                      </ThemeIcon>
                      <div>
                        <Text fw={600}>
                          {type?.label ?? event.type}
                          {event.opponent ? ` · vs ${event.opponent}` : ""}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {event.location ?? "Luogo da definire"}
                        </Text>
                      </div>
                    </Group>
                    <Badge
                      variant="light"
                      color={
                        event.status === "cancelled"
                          ? "red"
                          : event.status === "modified"
                            ? "orange"
                            : "gray"
                      }
                    >
                      {event.date} {event.startTime ?? ""}
                    </Badge>
                  </Group>
                </Card>
              );
            })}
          </Stack>
        )}
      </div>
    </Stack>
  );
}
