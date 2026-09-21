import {
  ActionIcon,
  Alert,
  Badge,
  Box,
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
import { Calendar as MantineCalendar, DateInput, TimeInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { EventTypeDef, GeneratedCommunication, GoogleStatus, TeamEvent } from "../types";

const STATUS_COLOR: Record<TeamEvent["status"], string> = {
  scheduled: "green",
  modified: "orange",
  cancelled: "red",
};

const STATUS_DOT_COLOR: Record<TeamEvent["status"], string> = {
  scheduled: "var(--mantine-color-green-6)",
  modified: "var(--mantine-color-orange-6)",
  cancelled: "var(--mantine-color-red-6)",
};

function formatDayLabel(date: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

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
  const [showForm, { open: openForm, close: closeForm }] =
    useDisclosure(false);
  const [displayedDate, setDisplayedDate] = useState(() =>
    dayjs().format("YYYY-MM-DD"),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedCommunication | null>(
    null,
  );
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [exporting, setExporting] = useState(false);

  function loadEvents(date = displayedDate) {
    setLoading(true);
    const month = dayjs(date);
    Promise.all([
      api.getEvents({
        from: month.startOf("month").format("YYYY-MM-DD"),
        to: month.endOf("month").format("YYYY-MM-DD"),
      }),
      api.getEventTypes(),
      api.getGoogleStatus(),
    ])
      .then(([eventsRes, typesRes, googleRes]) => {
        setEvents(eventsRes.data);
        setEventTypes(typesRes.data);
        setGoogleStatus(googleRes.data);
        setForm((f) => ({ ...f, type: f.type || typesRes.data[0]?.key || "" }));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadEvents();
  }, [displayedDate]);

  const selectedType = eventTypes.find((t) => t.key === form.type);
  const typeOf = (key: string) => eventTypes.find((t) => t.key === key);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date) return;
    await api.createEvent({
      type: form.type,
      date: dayjs(form.date).format("YYYY-MM-DD"),
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

  async function handleExportCalendar() {
    setGenerateError(null);
    setExporting(true);
    try {
      const res = await api.exportToGoogleCalendar(Array.from(selectedIds));
      notifications.show({ message: `${res.data.exported} evento/i esportato/i su Google Calendar`, color: "green" });
    } catch (err) {
      setGenerateError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Errore durante l'esportazione su Google Calendar",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyWhatsapp() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.whatsappMessage);
    notifications.show({
      message: "Messaggio copiato negli appunti",
      color: "green",
    });
  }

  async function handleDelete(event: TeamEvent) {
    const type = typeOf(event.type);
    if (
      !window.confirm(
        `Eliminare l'evento "${type?.label ?? event.type}" del ${event.date}? Verranno eliminate anche convocazioni e presenze collegate.`,
      )
    ) {
      return;
    }
    await api.deleteEvent(event.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(event.id);
      return next;
    });
    loadEvents();
  }

  function handleOpenForm() {
    setForm((current) => ({
      ...current,
      date: current.date ?? (selectedDay ? dayjs(selectedDay).toDate() : null),
    }));
    openForm();
  }

  function handleDayClick(date: string, eventCount: number) {
    setSelectedDay(date);
    if (eventCount === 0) {
      setForm((current) => ({ ...current, date: dayjs(date).toDate() }));
      openForm();
    }
  }

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, TeamEvent[]>();
    for (const event of events) {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    }
    return grouped;
  }, [events]);
  const selectedDayEvents = selectedDay ? eventsByDate.get(selectedDay) ?? [] : [];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Calendario</Title>
        <Button onClick={showForm ? closeForm : handleOpenForm}>
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
            <Button
              variant="light"
              onClick={handleExportCalendar}
              loading={exporting}
              disabled={!googleStatus?.calendarConnected}
            >
              📅 Esporta in Google Calendar
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
            <Button
              variant="subtle"
              onClick={handleCopyWhatsapp}
              style={{ alignSelf: "flex-start" }}
            >
              📋 Copia messaggio WhatsApp
            </Button>
          </Stack>
        </Card>
      )}

      {loading ? (
        <Loader />
      ) : (
        <>
          <Card withBorder padding="md" radius="md">
            <MantineCalendar
              fullWidth
              date={displayedDate}
              onDateChange={(date) => {
                setDisplayedDate(date);
                setSelectedDay(null);
              }}
              getDayProps={(date) => {
                const dayEvents = eventsByDate.get(date) ?? [];
                return {
                  selected: date === selectedDay,
                  onClick: () => handleDayClick(date, dayEvents.length),
                  "aria-label": `${formatDayLabel(date)}: ${dayEvents.length} evento/i`,
                };
              }}
              renderDay={(date) => {
                const dayEvents = eventsByDate.get(date) ?? [];
                return (
                  <Stack gap={2} align="center">
                    <Text inherit>{dayjs(date).date()}</Text>
                    {dayEvents.slice(0, 2).map((event) => {
                      const type = typeOf(event.type);
                      return (
                        <Group key={event.id} gap={3} justify="center" wrap="nowrap">
                          <Box aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_DOT_COLOR[event.status] }} />
                          <Text size="xs" truncate="end">{event.startTime ? `${event.startTime} ` : ""}{type?.icon ?? "⚽"}</Text>
                        </Group>
                      );
                    })}
                    {dayEvents.length > 2 && <Text size="xs" fw={700}>+{dayEvents.length - 2}</Text>}
                  </Stack>
                );
              }}
            />
          </Card>

          {selectedDay ? (
            <Stack gap="xs">
              <Group justify="space-between">
                <Title order={5}>{formatDayLabel(selectedDay)}</Title>
                <Button size="xs" variant="light" onClick={handleOpenForm}>+ Aggiungi evento</Button>
              </Group>
              {selectedDayEvents.length === 0 ? (
                <Text c="dimmed">Nessun evento in questa giornata.</Text>
              ) : (
                selectedDayEvents.map((event) => {
                  const type = typeOf(event.type);
                  return (
                    <Card key={event.id} withBorder padding="sm" radius="md">
                      <Group wrap="nowrap" gap="sm">
                        <Checkbox
                          checked={selectedIds.has(event.id)}
                          onChange={() => toggleSelected(event.id)}
                          aria-label={`Seleziona ${type?.label ?? event.type}`}
                        />
                        <Link
                          to={`/events/${event.id}`}
                          style={{ flex: 1, textDecoration: "none", color: "inherit" }}
                        >
                          <Group justify="space-between">
                            <Text truncate>
                              {type?.icon} <Text span fw={600}>{type?.label ?? event.type}</Text>{" "}
                              {event.opponent ? `vs ${event.opponent}` : ""}
                            </Text>
                            <Group gap="xs" wrap="nowrap">
                              {event.status !== "scheduled" && (
                                <Badge size="sm" color={STATUS_COLOR[event.status]}>{event.status}</Badge>
                              )}
                              {event.startTime && <Badge variant="light" color="gray">{event.startTime}</Badge>}
                            </Group>
                          </Group>
                        </Link>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => handleDelete(event)}
                          aria-label="Elimina"
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  );
                })
              )}
            </Stack>
          ) : (
            <Text c="dimmed">Seleziona un giorno per vedere gli eventi.</Text>
          )}
        </>
      )}
    </Stack>
  );
}
