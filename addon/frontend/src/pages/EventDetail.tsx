import {
  ActionIcon,
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
import { IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { EventTypeIcon } from "../components/EventTypeIcon";
import type {
  Attendance,
  AttendanceStatus,
  Callup,
  EventStatus,
  EventTypeDef,
  Formation,
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
  const navigate = useNavigate();
  const eventId = Number(id);
  const [event, setEvent] = useState<TeamEvent | null>(null);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [callups, setCallups] = useState<Callup[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCallups, setSavingCallups] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [statusDraft, setStatusDraft] = useState<EventStatus>("scheduled");
  const [notesDraft, setNotesDraft] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [typeDraft, setTypeDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [startTimeDraft, setStartTimeDraft] = useState("");
  const [endTimeDraft, setEndTimeDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [opponentDraft, setOpponentDraft] = useState("");
  const [meetingTimeDraft, setMeetingTimeDraft] = useState("");
  const [formationDraft, setFormationDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.getEvent(eventId),
      api.getCallups(eventId),
      api.getAttendance(eventId),
      api.getEventTypes(),
      api.getFormations(),
    ])
      .then(([eventRes, callupsRes, attendanceRes, typesRes, formationsRes]) => {
        setEvent(eventRes.data);
        setCallups(callupsRes.data);
        setAttendance(attendanceRes.data);
        setEventTypes(typesRes.data);
        setFormations(formationsRes.data);
        setStatusDraft(eventRes.data.status);
        setNotesDraft(eventRes.data.notes ?? "");
        setTypeDraft(eventRes.data.type); setDateDraft(eventRes.data.date); setStartTimeDraft(eventRes.data.startTime ?? ""); setEndTimeDraft(eventRes.data.endTime ?? ""); setLocationDraft(eventRes.data.location ?? ""); setAddressDraft(eventRes.data.address ?? ""); setOpponentDraft(eventRes.data.opponent ?? ""); setMeetingTimeDraft(eventRes.data.meetingTime ?? ""); setFormationDraft(eventRes.data.formationId ? String(eventRes.data.formationId) : null);
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
        type: typeDraft, date: dateDraft, startTime: startTimeDraft || null, endTime: endTimeDraft || null,
        location: locationDraft || null, address: addressDraft || null, opponent: opponentDraft || null,
        meetingTime: meetingTimeDraft || null, formationId: formationDraft ? Number(formationDraft) : null,
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

  async function handleDelete() {
    if (!event) return;
    if (
      !window.confirm(
        `Eliminare questo evento del ${event.date}? Verranno eliminate anche convocazioni e presenze collegate.`,
      )
    ) {
      return;
    }
    await api.deleteEvent(eventId);
    navigate("/calendar");
  }

  if (loading) return <Loader />;
  if (!event) return <Text c="dimmed">Evento non trovato.</Text>;

  const type = eventTypes.find((t) => t.key === event.type);
  const selectedFormation = formations.find((formation) => formation.id === event.formationId);
  const formationPlayerIds = selectedFormation
    ? Object.values(selectedFormation.assignments).filter((playerId): playerId is number => playerId !== null)
    : [];
  const calledUpIds = new Set(callups.filter((callup) => callup.calledUp).map((callup) => callup.playerId));
  const missingCallups = callups.filter((callup) => formationPlayerIds.includes(callup.playerId) && !calledUpIds.has(callup.playerId));

  return (
    <Stack gap="lg">
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} />
              <Title order={4}>{type?.label ?? event.type}{event.opponent ? ` vs ${event.opponent}` : ""}</Title>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Badge color={STATUS_COLOR[event.status]}>
                {EVENT_STATUS_LABEL[event.status]}
              </Badge>
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={handleDelete}
                aria-label="Elimina evento"
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          </Group>
          <Text size="sm" c="dimmed">
            {event.date} {event.startTime ?? ""}
            {event.location ? ` · ${event.location}` : ""}
          </Text>

          <SimpleGrid
            cols={{ base: 1, sm: 2, lg: 3 }}
            pt="sm"
            style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
          >
            <Select label="Tipo" data={eventTypes.map((item) => ({ value: item.key, label: item.label }))} value={typeDraft} onChange={(value) => setTypeDraft(value ?? "")} allowDeselect={false} />
            <TextInput label="Data" type="date" value={dateDraft} onChange={(e) => setDateDraft(e.currentTarget.value)} />
            <TextInput label="Inizio" type="time" value={startTimeDraft} onChange={(e) => setStartTimeDraft(e.currentTarget.value)} />
            <TextInput label="Fine" type="time" value={endTimeDraft} onChange={(e) => setEndTimeDraft(e.currentTarget.value)} />
            <TextInput label="Ritrovo" type="time" value={meetingTimeDraft} onChange={(e) => setMeetingTimeDraft(e.currentTarget.value)} />
            <TextInput label="Luogo" value={locationDraft} onChange={(e) => setLocationDraft(e.currentTarget.value)} />
            <TextInput label="Indirizzo" value={addressDraft} onChange={(e) => setAddressDraft(e.currentTarget.value)} />
            <TextInput label="Avversario" value={opponentDraft} onChange={(e) => setOpponentDraft(e.currentTarget.value)} />
            <Select label="Formazione" placeholder="Nessuna" clearable data={formations.map((item) => ({ value: String(item.id), label: item.name }))} value={formationDraft} onChange={setFormationDraft} />
            <Select
              label="Stato evento"
              data={[
                { value: "scheduled", label: "Programmato" },
                { value: "modified", label: "Modificato" },
                { value: "cancelled", label: "Annullato" },
              ]}
              value={statusDraft}
              onChange={(value) =>
                setStatusDraft((value ?? "scheduled") as EventStatus)
              }
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

      {selectedFormation && (
        <Card withBorder padding="md" radius="md">
          <Group justify="space-between" mb="xs">
            <div><Title order={5}>Formazione titolare</Title><Text size="sm" c="dimmed">{selectedFormation.name}</Text></div>
            <Badge color={formationPlayerIds.length === 7 ? "green" : "yellow"}>{formationPlayerIds.length}/7 giocatori</Badge>
          </Group>
          {missingCallups.length > 0 ? <Alert color="yellow">Convoca anche: {missingCallups.map((callup) => callup.playerName).join(", ")}.</Alert> : <Text size="sm" c="dimmed">La formazione è coerente con le convocazioni attuali.</Text>}
        </Card>
      )}

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
