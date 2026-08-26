import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  Attendance,
  AttendanceStatus,
  Callup,
  EventStatus,
  EventTypeDef,
  TeamEvent,
} from "../types";

const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: "Programmato",
  modified: "Modificato",
  cancelled: "Annullato",
};

const STATUS_COLOR: Record<EventStatus, string> = {
  scheduled: "green",
  modified: "orange",
  cancelled: "red",
};

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Presente",
  absent: "Assente",
  excused: "Giustificato",
};

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const [event, setEvent] = useState<TeamEvent | null>(null);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [callups, setCallups] = useState<Callup[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCallups, setSavingCallups] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [statusDraft, setStatusDraft] = useState<EventStatus>("scheduled");
  const [notesDraft, setNotesDraft] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.getEvent(eventId),
      api.getCallups(eventId),
      api.getAttendance(eventId),
      api.getEventTypes(),
    ])
      .then(([eventRes, callupsRes, attendanceRes, typesRes]) => {
        setEvent(eventRes.data);
        setCallups(callupsRes.data);
        setAttendance(attendanceRes.data);
        setEventTypes(typesRes.data);
        setStatusDraft(eventRes.data.status);
        setNotesDraft(eventRes.data.notes ?? "");
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  function toggleCallup(playerId: number) {
    setCallups((prev) =>
      prev.map((c) =>
        c.playerId === playerId ? { ...c, calledUp: !c.calledUp } : c,
      ),
    );
  }

  async function handleSaveCallups() {
    setSavingCallups(true);
    try {
      const playerIds = callups
        .filter((c) => c.calledUp)
        .map((c) => c.playerId);
      await api.setCallups(eventId, playerIds);
      // Ricarica le presenze: la lista dipende dai convocati appena salvati.
      const attendanceRes = await api.getAttendance(eventId);
      setAttendance(attendanceRes.data);
    } finally {
      setSavingCallups(false);
    }
  }

  function setAttendanceStatus(playerId: number, status: AttendanceStatus) {
    setAttendance((prev) =>
      prev.map((a) => (a.playerId === playerId ? { ...a, status } : a)),
    );
  }

  async function handleSaveAttendance() {
    setSavingAttendance(true);
    try {
      await api.setAttendance(
        eventId,
        attendance.map((a) => ({ playerId: a.playerId, status: a.status })),
      );
    } finally {
      setSavingAttendance(false);
    }
  }

  async function handleSaveStatus() {
    setStatusError(null);
    if (statusDraft !== "scheduled" && !notesDraft.trim()) {
      setStatusError(
        "Le note sono obbligatorie quando l'evento è modificato o annullato",
      );
      return;
    }
    setSavingStatus(true);
    try {
      const res = await api.updateEvent(eventId, {
        status: statusDraft,
        notes: notesDraft,
      });
      setEvent(res.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Errore durante il salvataggio";
      setStatusError(message);
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) return <Loader />;
  if (!event) return <Text c="dimmed">Evento non trovato.</Text>;

  const type = eventTypes.find((t) => t.key === event.type);

  return (
    <Stack gap="lg">
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap">
            <Title order={4}>
              {type?.icon} {type?.label ?? event.type}
              {event.opponent ? ` vs ${event.opponent}` : ""}
            </Title>
            <Badge color={STATUS_COLOR[event.status]}>
              {EVENT_STATUS_LABEL[event.status]}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {event.date} {event.startTime ?? ""}
            {event.location ? ` · ${event.location}` : ""}
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} pt="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
            <Select
              label="Stato evento"
              data={[
                { value: "scheduled", label: "Programmato" },
                { value: "modified", label: "Modificato" },
                { value: "cancelled", label: "Annullato" },
              ]}
              value={statusDraft}
              onChange={(value) => setStatusDraft((value ?? "scheduled") as EventStatus)}
              allowDeselect={false}
            />
            <TextInput
              label="Note"
              required={statusDraft !== "scheduled"}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.currentTarget.value)}
              placeholder="Motivo della modifica/annullamento"
            />
          </SimpleGrid>
          {statusError && (
            <Alert color="red" title="Errore">
              {statusError}
            </Alert>
          )}
          <Button
            onClick={handleSaveStatus}
            loading={savingStatus}
            style={{ alignSelf: "flex-start" }}
          >
            Aggiorna stato evento
          </Button>
        </Stack>
      </Card>

      <div>
        <Group justify="space-between" mb="xs">
          <Title order={5}>Convocazioni</Title>
          <Button onClick={handleSaveCallups} loading={savingCallups} size="sm">
            Salva convocazioni
          </Button>
        </Group>
        {callups.length === 0 ? (
          <Text c="dimmed">
            Nessun giocatore in anagrafica: aggiungili dalla pagina Giocatori.
          </Text>
        ) : (
          <Stack gap="xs">
            {callups.map((c) => (
              <Card key={c.playerId} withBorder padding="sm" radius="md">
                <Group justify="space-between">
                  <Text>{c.playerName}</Text>
                  <Checkbox
                    checked={c.calledUp}
                    onChange={() => toggleCallup(c.playerId)}
                  />
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </div>

      <div>
        <Group justify="space-between" mb="xs">
          <Title order={5}>Presenze</Title>
          <Button
            onClick={handleSaveAttendance}
            loading={savingAttendance}
            disabled={attendance.length === 0}
            size="sm"
          >
            Salva presenze
          </Button>
        </Group>
        {attendance.length === 0 ? (
          <Text c="dimmed">
            Salva prima le convocazioni: le presenze si registrano solo per i
            giocatori convocati.
          </Text>
        ) : (
          <Stack gap="xs">
            {attendance.map((a) => (
              <Card key={a.playerId} withBorder padding="sm" radius="md">
                <Group justify="space-between">
                  <Text>{a.playerName}</Text>
                  <Select
                    data={Object.entries(ATTENDANCE_LABEL).map(
                      ([value, label]) => ({ value, label }),
                    )}
                    value={a.status}
                    onChange={(value) =>
                      setAttendanceStatus(
                        a.playerId,
                        (value ?? "present") as AttendanceStatus,
                      )
                    }
                    allowDeselect={false}
                    w={160}
                  />
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </div>
    </Stack>
  );
}
