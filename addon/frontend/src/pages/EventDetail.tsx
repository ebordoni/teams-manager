import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconRobot, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { EventTypeIcon } from "../components/EventTypeIcon";
import PageLoader from "../components/PageLoader";
import type {
  Attendance,
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

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = Number(id);
  const [event, setEvent] = useState<TeamEvent | null>(null);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
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
      api.getAttendance(eventId),
      api.getEventTypes(),
      api.getFormations(),
    ])
      .then(
        ([eventRes, attendanceRes, typesRes, formationsRes]) => {
          setEvent(eventRes.data);
          setAttendance(attendanceRes.data);
          setEventTypes(typesRes.data);
          setFormations(formationsRes.data);
          setStatusDraft(eventRes.data.status);
          setNotesDraft(eventRes.data.notes ?? "");
          setTypeDraft(eventRes.data.type);
          setDateDraft(eventRes.data.date);
          setStartTimeDraft(eventRes.data.startTime ?? "");
          setEndTimeDraft(eventRes.data.endTime ?? "");
          setLocationDraft(eventRes.data.location ?? "");
          setAddressDraft(eventRes.data.address ?? "");
          setOpponentDraft(eventRes.data.opponent ?? "");
          setMeetingTimeDraft(eventRes.data.meetingTime ?? "");
          setFormationDraft(
            eventRes.data.formationId
              ? String(eventRes.data.formationId)
              : null,
          );
        },
      )
      .finally(() => setLoading(false));
  }, [eventId]);

  function setPlayerPresent(playerId: number, present: boolean) {
    setAttendance((prev) =>
      prev.map((a) =>
        a.playerId === playerId
          ? { ...a, status: present ? "present" : "absent" }
          : a,
      ),
    );
  }

  async function handleSaveAttendance() {
    setSavingAttendance(true);
    try {
      await api.setAttendance(
        eventId,
        attendance.map((a) => ({ playerId: a.playerId, status: a.status })),
      );
      setAttendance((prev) => prev.map((a) => ({ ...a, recorded: true })));
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
        type: typeDraft,
        date: dateDraft,
        startTime: startTimeDraft || null,
        endTime: endTimeDraft || null,
        location: locationDraft || null,
        address: addressDraft || null,
        opponent: opponentDraft || null,
        meetingTime: meetingTimeDraft || null,
        formationId: formationDraft ? Number(formationDraft) : null,
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
        `Eliminare questo evento del ${event.date}? Verranno eliminate anche le presenze collegate.`,
      )
    ) {
      return;
    }
    await api.deleteEvent(eventId);
    navigate("/calendar");
  }

  if (loading) return <PageLoader />;
  if (!event) return <Text c="dimmed">Evento non trovato.</Text>;

  const type = eventTypes.find((t) => t.key === event.type);
  const selectedFormation = formations.find(
    (formation) => formation.id === event.formationId,
  );
  const formationPlayerIds = selectedFormation
    ? Object.values(selectedFormation.assignments).filter(
        (playerId): playerId is number => playerId !== null,
      )
    : [];
  const presentAttendance = attendance.filter(
    (record) => record.status === "present",
  ).length;

  return (
    <Stack gap="lg">
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} />
              <Title order={4}>
                {type?.label ?? event.type}
                {event.opponent ? ` vs ${event.opponent}` : ""}
              </Title>
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
            <Select
              label="Tipo"
              data={eventTypes.map((item) => ({
                value: item.key,
                label: item.label,
              }))}
              value={typeDraft}
              onChange={(value) => setTypeDraft(value ?? "")}
              allowDeselect={false}
            />
            <TextInput
              label="Data"
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.currentTarget.value)}
            />
            <TextInput
              label="Inizio"
              type="time"
              value={startTimeDraft}
              onChange={(e) => setStartTimeDraft(e.currentTarget.value)}
            />
            <TextInput
              label="Fine"
              type="time"
              value={endTimeDraft}
              onChange={(e) => setEndTimeDraft(e.currentTarget.value)}
            />
            <TextInput
              label="Ritrovo"
              type="time"
              value={meetingTimeDraft}
              onChange={(e) => setMeetingTimeDraft(e.currentTarget.value)}
            />
            <TextInput
              label="Luogo"
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.currentTarget.value)}
            />
            <TextInput
              label="Indirizzo"
              value={addressDraft}
              onChange={(e) => setAddressDraft(e.currentTarget.value)}
            />
            <TextInput
              label="Avversario"
              value={opponentDraft}
              onChange={(e) => setOpponentDraft(e.currentTarget.value)}
            />
            <Select
              label="Formazione"
              placeholder="Nessuna"
              clearable
              data={formations.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
              value={formationDraft}
              onChange={setFormationDraft}
            />
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
            Salva modifiche
          </Button>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Group justify="space-between">
          <div><Title order={5}>Rotazioni della partita</Title><Text size="sm" c="dimmed">Genera una formazione per ogni tempo bilanciando automaticamente il minutaggio.</Text></div>
          <Button component={Link} to={`/events/${eventId}/match-plan`} leftSection={<IconRobot size={18} />}>Apri piano partita AI</Button>
        </Group>
      </Card>

      {selectedFormation && (
        <Card withBorder padding="md" radius="md">
          <Group justify="space-between" mb="xs">
            <div>
              <Title order={5}>Formazione titolare</Title>
              <Text size="sm" c="dimmed">
                {selectedFormation.name}
              </Text>
            </div>
            <Badge color={formationPlayerIds.length === 7 ? "green" : "yellow"}>
              {formationPlayerIds.length}/7 giocatori
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Tutta la rosa è inclusa automaticamente nell'evento.
          </Text>
        </Card>
      )}

      <div>
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Title order={5}>Presenze</Title>
            {attendance.length > 0 && (
              <Badge
                variant="light"
                color={
                  presentAttendance === attendance.length ? "green" : "yellow"
                }
              >
                {presentAttendance}/{attendance.length} presenti
              </Badge>
            )}
          </Group>
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
            Nessun giocatore in anagrafica: aggiungili dalla pagina Giocatori.
          </Text>
        ) : (
          <Stack gap="xs">
            {attendance.map((a) => (
              <Card key={a.playerId} withBorder padding="sm" radius="md">
                <Group justify="space-between">
                  <Text>{a.playerName}</Text>
                  <Checkbox
                    label="Presente"
                    checked={a.status === "present"}
                    onChange={(event) =>
                      setPlayerPresent(a.playerId, event.currentTarget.checked)
                    }
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
