import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput, TimeInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { EventTypeDef, GeneratedCommunication, TeamEvent } from "../types";

const STATUS_COLOR: Record<TeamEvent["status"], string> = {
  scheduled: "green",
  modified: "orange",
  cancelled: "red",
};

interface FormState {
  type: string;
  date: Date | null;
  startTime: string;
  location: string;
  opponent: string;
}

const EMPTY_FORM: FormState = {
  type: "",
  date: null,
  startTime: "",
  location: "",
  opponent: "",
};

export default function Calendar() {
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, { toggle: toggleForm, close: closeForm }] =
    useDisclosure(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedCommunication | null>(
    null,
  );

  function loadEvents() {
    setLoading(true);
    Promise.all([api.getEvents(), api.getEventTypes()])
      .then(([eventsRes, typesRes]) => {
        setEvents(eventsRes.data);
        setEventTypes(typesRes.data);
        setForm((f) => ({ ...f, type: f.type || typesRes.data[0]?.key || "" }));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const selectedType = eventTypes.find((t) => t.key === form.type);
  const typeOf = (key: string) => eventTypes.find((t) => t.key === key);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date) return;
    await api.createEvent({
      type: form.type,
      date: form.date.toISOString().slice(0, 10),
      startTime: form.startTime || null,
      location: form.location || null,
      opponent: selectedType?.hasOpponent ? form.opponent || null : null,
    });
    setForm({ ...EMPTY_FORM, type: form.type });
    closeForm();
    loadEvents();
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerateCommunication() {
    setGenerateError(null);
    setGenerating(true);
    try {
      const res = await api.generateCommunication(Array.from(selectedIds));
      setGenerated(res.data);
      setSelectedIds(new Set());
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Errore durante la generazione della comunicazione";
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyWhatsapp() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.whatsappMessage);
    notifications.show({ message: "Messaggio copiato negli appunti", color: "green" });
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Calendario</Title>
        <Button onClick={toggleForm}>
          {showForm ? "Annulla" : "+ Nuovo evento"}
        </Button>
      </Group>

      <Collapse expanded={showForm}>
        <Card withBorder padding="md" radius="md">
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Tipo"
                  data={eventTypes.map((t) => ({
                    value: t.key,
                    label: `${t.icon} ${t.label}`,
                  }))}
                  value={form.type}
                  onChange={(value) => setForm({ ...form, type: value ?? "" })}
                  allowDeselect={false}
                />
                <DateInput
                  label="Data"
                  required
                  value={form.date}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      date: value ? new Date(value) : null,
                    })
                  }
                  valueFormat="DD/MM/YYYY"
                />
                <TimeInput
                  label="Ora"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.currentTarget.value })
                  }
                />
                <TextInput
                  label="Luogo"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.currentTarget.value })
                  }
                />
                {selectedType?.hasOpponent && (
                  <TextInput
                    label="Avversario"
                    value={form.opponent}
                    onChange={(e) =>
                      setForm({ ...form, opponent: e.currentTarget.value })
                    }
                    style={{ gridColumn: "1 / -1" }}
                  />
                )}
              </SimpleGrid>
              <Button type="submit" style={{ alignSelf: "flex-start" }}>
                Salva
              </Button>
            </Stack>
          </form>
        </Card>
      </Collapse>

      {selectedIds.size > 0 && (
        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="sm">{selectedIds.size} evento/i selezionato/i</Text>
            <Button onClick={handleGenerateCommunication} loading={generating}>
              📄 Genera comunicazione
            </Button>
          </Group>
        </Card>
      )}
      {generateError && (
        <Alert color="red" title="Errore">
          {generateError}
        </Alert>
      )}
      {generated && (
        <Card withBorder padding="md" radius="md">
          <Stack gap="xs">
            <Text fw={600}>✅ Comunicazione generata</Text>
            <Text
              component="a"
              href={generated.googleDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              c="blue"
            >
              🔗 Apri documento
            </Text>
            <Button variant="subtle" onClick={handleCopyWhatsapp} style={{ alignSelf: "flex-start" }}>
              📋 Copia messaggio WhatsApp
            </Button>
          </Stack>
        </Card>
      )}

      {loading ? (
        <Loader />
      ) : events.length === 0 ? (
        <Text c="dimmed">Nessun evento in calendario.</Text>
      ) : (
        <Stack gap="xs">
          {events.map((event) => {
            const type = typeOf(event.type);
            return (
              <Card key={event.id} withBorder padding="sm" radius="md">
                <Group wrap="nowrap" gap="sm">
                  <Checkbox
                    checked={selectedIds.has(event.id)}
                    onChange={() => toggleSelected(event.id)}
                  />
                  <Link
                    to={`/events/${event.id}`}
                    style={{ flex: 1, textDecoration: "none", color: "inherit" }}
                  >
                    <Group justify="space-between">
                      <Text truncate>
                        {type?.icon} <Text span fw={600}>{type?.label ?? event.type}</Text>{" "}
                        {event.opponent ? `vs ${event.opponent}` : ""}
                        {event.status !== "scheduled" && (
                          <Badge ml="xs" size="sm" color={STATUS_COLOR[event.status]}>
                            {event.status}
                          </Badge>
                        )}
                      </Text>
                      <Badge variant="light" color="gray">
                        {event.date} {event.startTime ?? ""}
                      </Badge>
                    </Group>
                  </Link>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
