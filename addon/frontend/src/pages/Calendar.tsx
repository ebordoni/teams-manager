import {
  ActionIcon,
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
import {
  DateInput,
  Calendar as MantineCalendar,
  TimeInput,
} from "@mantine/dates";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EventTypeIcon } from "../components/EventTypeIcon";
import { formatDisplayDate } from "../utils/date";
import type {
  EventTypeDef,
  GeneratedCommunication,
  GoogleStatus,
  TeamEvent,
} from "../types";

const STATUS_COLOR: Record<TeamEvent["status"], string> = {
  scheduled: "green",
  modified: "orange",
  cancelled: "red",
};

// Nella cella del calendario gli eventi regolari usano il colore del testo:
// il colore resta un segnale per le sole eccezioni (modificato/annullato).
const STATUS_ACCENT: Record<TeamEvent["status"], string | undefined> = {
  scheduled: undefined,
  modified: "orange.6",
  cancelled: "red.6",
};

/** Eventi mostrati nella cella del giorno prima del contatore "+N". */
const MAX_DAY_PREVIEW = 2;

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
  repeatWeekly: boolean;
  recurrenceEndDate: Date | null;
}

const EMPTY_FORM: FormState = {
  type: "",
  date: null,
  startTime: "",
  location: "",
  opponent: "",
  repeatWeekly: false,
  recurrenceEndDate: null,
};

export default function Calendar() {
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [saving, setSaving] = useState(false);
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
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false);
  // Le etichette restano leggibili anche su schermi stretti: l'agenda sotto
  // il calendario conserva comunque tutti i dettagli della giornata.
  const compactDays = useMediaQuery("(max-width: 48em)") ?? false;

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
    if (form.repeatWeekly && !form.recurrenceEndDate) {
      notifications.show({ color: "red", message: "Seleziona la data finale della ricorrenza" });
      return;
    }
    const event = {
      type: form.type,
      date: dayjs(form.date).format("YYYY-MM-DD"),
      startTime: form.startTime || null,
      location: form.location || null,
      opponent: selectedType?.hasOpponent ? form.opponent || null : null,
    };
    setSaving(true);
    try {
      if (form.repeatWeekly && form.recurrenceEndDate) {
        const response = await api.createRecurringEvent({
          ...event,
          recurrence: { frequency: "weekly", until: dayjs(form.recurrenceEndDate).format("YYYY-MM-DD") },
        });
        notifications.show({ color: "green", message: `Creati ${response.data.created.length} appuntamenti settimanali` });
      } else {
        await api.createEvent(event);
        notifications.show({ color: "green", message: "Evento creato" });
      }
      setForm({ ...EMPTY_FORM, type: form.type });
      closeForm();
      loadEvents();
    } catch (err) {
      const error = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      notifications.show({ color: "red", message: error ?? "Impossibile creare l'evento" });
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Mostra l'errore dell'API; con 403 serve (ri)collegare l'account Google. */
  function reportApiError(err: unknown, fallback: string) {
    const response = (
      err as {
        response?: { status?: number; data?: { error?: string } };
      }
    )?.response;
    setGenerateError(response?.data?.error ?? fallback);
    if (response?.status === 403) {
      setNeedsGoogleAuth(true);
      api.getGoogleStatus().then((res) => setGoogleStatus(res.data));
    }
  }

  async function handleGenerateCommunication() {
    setGenerateError(null);
    setNeedsGoogleAuth(false);
    setGenerating(true);
    try {
      const res = await api.generateCommunication(Array.from(selectedIds));
      setGenerated(res.data);
      setSelectedIds(new Set());
    } catch (err) {
      reportApiError(err, "Errore durante la generazione della comunicazione");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExportCalendar() {
    setGenerateError(null);
    setNeedsGoogleAuth(false);
    setExporting(true);
    try {
      const res = await api.exportToGoogleCalendar(Array.from(selectedIds));
      notifications.show({
        message: `${res.data.exported} evento/i esportato/i su Google Calendar`,
        color: "green",
      });
    } catch (err) {
      reportApiError(err, "Errore durante l'esportazione su Google Calendar");
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
        `Eliminare l'evento "${type?.label ?? event.type}" del ${formatDisplayDate(event.date)}? Verranno eliminate anche le presenze collegate.`,
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
  const selectedDayEvents = selectedDay
    ? (eventsByDate.get(selectedDay) ?? [])
    : [];

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
                    label: t.label,
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
                  valueFormat="DD-MM-YYYY"
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
              <Checkbox
                label="Ripeti ogni settimana"
                description="Verrà creato un evento distinto per ogni settimana, modificabile singolarmente."
                checked={form.repeatWeekly}
                onChange={(event) => setForm({ ...form, repeatWeekly: event.currentTarget.checked })}
              />
              {form.repeatWeekly && (
                <DateInput
                  label="Ripeti fino al"
                  required
                  value={form.recurrenceEndDate}
                  minDate={form.date ?? undefined}
                  onChange={(value) => setForm({ ...form, recurrenceEndDate: value ? new Date(value) : null })}
                  valueFormat="DD-MM-YYYY"
                  w={{ base: "100%", sm: 260 }}
                />
              )}
              <Button type="submit" loading={saving} style={{ alignSelf: "flex-start" }}>
                {form.repeatWeekly ? "Crea appuntamenti" : "Salva"}
              </Button>
            </Stack>
          </form>
        </Card>
      </Collapse>

      {selectedIds.size > 0 && (
        <Card withBorder padding="md" radius="md">
          <Group justify="space-between" wrap="wrap">
            <Text size="sm">{selectedIds.size} evento/i selezionato/i</Text>
            <Group gap="xs" wrap="wrap">
              <Button
                onClick={handleGenerateCommunication}
                loading={generating}
              >
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
          </Group>
        </Card>
      )}
      {generateError && (
        <Alert color="red" title="Errore">
          {generateError}
          {needsGoogleAuth && (
            <Button
              component={Link}
              to="/settings"
              size="compact-sm"
              variant="subtle"
              ml="xs"
            >
              Apri Impostazioni
            </Button>
          )}
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
              highlightToday
              date={displayedDate}
              onDateChange={(date) => {
                setDisplayedDate(date);
                setSelectedDay(null);
              }}
              styles={{
                day: {
                  height: compactDays ? 58 : 70,
                  alignItems: "flex-start",
                  padding: "5px 2px 3px",
                  borderRadius: "var(--mantine-radius-md)",
                },
              }}
              getDayProps={(date) => {
                const dayEvents = eventsByDate.get(date) ?? [];
                return {
                  selected: date === selectedDay,
                  onClick: () => handleDayClick(date, dayEvents.length),
                  "aria-label": `${formatDayLabel(date)}: ${dayEvents.length} evento/i`,
                  // I giorni impegnati si riconoscono a colpo d'occhio anche
                  // quando non sono selezionati.
                  style:
                    dayEvents.length > 0 && date !== selectedDay
                      ? {
                          border:
                            "1px solid var(--mantine-color-default-border)",
                        }
                      : undefined,
                };
              }}
              renderDay={(date) => {
                const dayEvents = eventsByDate.get(date) ?? [];
                const visible = dayEvents.slice(0, MAX_DAY_PREVIEW);
                return (
                  <Stack gap={3} align="center" w="100%">
                    <Text fz={15} fw={600} lh={1}>
                      {dayjs(date).date()}
                    </Text>
                    {visible.map((event) => {
                      const type = typeOf(event.type);
                      return (
                      <Group
                        key={event.id}
                        gap={3}
                        justify="flex-start"
                        wrap="nowrap"
                        w="100%"
                        px={4}
                        py={3}
                        style={{
                          background: "var(--mantine-color-default-hover)",
                          borderLeft: `3px solid var(--mantine-color-${event.status === "scheduled" ? "blue" : STATUS_COLOR[event.status]}-6)`,
                          borderRadius: "var(--mantine-radius-sm)",
                        }}
                        c={STATUS_ACCENT[event.status]}
                      >
                        <EventTypeIcon
                          name={type?.icon ?? "IconBallFootball"}
                          size={compactDays ? 17 : 16}
                        />
                        <Text
                          fz={compactDays ? 10 : 11}
                          fw={700}
                          lh={1.1}
                          truncate
                          td={
                            event.status === "cancelled"
                              ? "line-through"
                              : undefined
                          }
                        >
                          {event.startTime ? `${event.startTime} ` : ""}
                          {event.result ? `${event.result.teamScore}–${event.result.opponentScore} ` : ""}{type?.label ?? event.type}
                        </Text>
                      </Group>
                      );
                    })}
                    {dayEvents.length > visible.length && (
                      <Text fz={10} fw={700} lh={1} opacity={0.7}>
                        +{dayEvents.length - visible.length}
                      </Text>
                    )}
                  </Stack>
                );
              }}
            />
          </Card>

          {selectedDay ? (
            <Stack gap="xs">
              <Group justify="space-between">
                <Title order={5}>{formatDayLabel(selectedDay)}</Title>
                <Button size="xs" variant="light" onClick={handleOpenForm}>
                  + Aggiungi evento
                </Button>
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
                          style={{
                            flex: 1,
                            textDecoration: "none",
                            color: "inherit",
                          }}
                        >
                          <Group justify="space-between">
                            <Text truncate>
                              <EventTypeIcon
                                name={type?.icon ?? "IconCalendarEvent"}
                                size={16}
                              />{" "}
                              <Text span fw={600}>
                                {type?.label ?? event.type}
                              </Text>{" "}
                              {event.opponent ? `vs ${event.opponent}` : ""}
                            </Text>
                            <Group gap="xs" wrap="nowrap">
                              {event.status !== "scheduled" && (
                                <Badge
                                  size="sm"
                                  color={STATUS_COLOR[event.status]}
                                >
                                  {event.status}
                                </Badge>
                              )}
                              {event.startTime && (
                                <Badge variant="light" color="gray">
                                  {event.startTime}
                                </Badge>
                              )}
                              {event.result && <Badge color={event.result.teamScore > event.result.opponentScore ? "green" : event.result.teamScore < event.result.opponentScore ? "red" : "gray"}>{event.result.teamScore}–{event.result.opponentScore}</Badge>}
                              {event.attendanceFinalizedAt && <Badge variant="light" color="violet">Presenze chiuse</Badge>}
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
