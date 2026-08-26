import {
  Badge,
  Card,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { EventTypeDef, Player, TeamEvent } from "../types";

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<TeamEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      api.getPlayers(),
      api.getEvents({ from: today }),
      api.getEventTypes(),
    ])
      .then(([playersRes, eventsRes, typesRes]) => {
        setPlayers(playersRes.data);
        setUpcomingEvents(eventsRes.data.slice(0, 5));
        setEventTypes(typesRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const typeOf = (key: string) => eventTypes.find((t) => t.key === key);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Giocatori
          </Text>
          <Text size="xl" fw={700}>
            {players.length}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Prossimi eventi
          </Text>
          <Text size="xl" fw={700}>
            {upcomingEvents.length}
          </Text>
        </Card>
      </SimpleGrid>

      <div>
        <Title order={4} mb="sm">
          Prossimi appuntamenti
        </Title>
        {upcomingEvents.length === 0 ? (
          <Text c="dimmed">Nessun evento in programma.</Text>
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
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Text truncate>
                      {type?.icon} <Text span fw={600}>{type?.label ?? event.type}</Text>{" "}
                      {event.opponent ? `vs ${event.opponent}` : ""}
                    </Text>
                    <Badge variant="light" color="gray">
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
