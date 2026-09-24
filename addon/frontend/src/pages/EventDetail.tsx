import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
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
import { formatDisplayDate, formatDisplayDateTime } from "../utils/date";
import type {
  Attendance,
  EventStatus,
  EventTypeDef,
  Formation,
  MatchResult,
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
  const [attendanceFinalizedAt, setAttendanceFinalizedAt] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [resultDraft, setResultDraft] = useState({ teamScore: 0, opponentScore: 0, venue: "home" as MatchResult["venue"], notes: "" });
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
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
      api.getAttendanceStatus(eventId),
      api.getEventTypes(),
      api.getFormations(),
    ])
      .then(
        async ([eventRes, attendanceRes, attendanceStatusRes, typesRes, formationsRes]) => {
          setEvent(eventRes.data);
          setAttendance(attendanceRes.data);
          setAttendanceFinalizedAt(attendanceStatusRes.data.finalizedAt);
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
          if (typesRes.data.some((item) => item.key === eventRes.data.type && item.hasOpponent)) {
            const resultRes = await api.getMatchResult(eventId);
            setResult(resultRes.data);
            if (resultRes.data) setResultDraft({ teamScore: resultRes.data.teamScore, opponentScore: resultRes.data.opponentScore, venue: resultRes.data.venue, notes: resultRes.data.notes ?? "" });
          }
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
    setAttendanceError(null);
    setSavingAttendance(true);
    try {
      await api.setAttendance(
        eventId,
        attendance.map((a) => ({ playerId: a.playerId, status: a.status })),
      );
      setAttendance((prev) => prev.map((a) => ({ ...a, recorded: true })));
    } catch (err) {
      setAttendanceError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Errore durante il salvataggio delle presenze");
    } finally {
      setSavingAttendance(false);
    }
  }

  async function handleFinalizeAttendance() {
    setAttendanceError(null); setSavingAttendance(true);
    try {
      const response = await api.finalizeAttendance(eventId, attendance.map((a) => ({ playerId: a.playerId, status: a.status })));
      setAttendanceFinalizedAt(response.data.finalizedAt);
      setAttendance((prev) => prev.map((a) => ({ ...a, recorded: true })));
    } catch (err) {
      setAttendanceError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Errore durante la chiusura del registro");
    } finally { setSavingAttendance(false); }
  }

  async function handleReopenAttendance() {
    if (!window.confirm("Riaprire il registro? Le presenze storiche potranno essere modificate.")) return;
    setAttendanceError(null); setSavingAttendance(true);
    try { await api.reopenAttendance(eventId); setAttendanceFinalizedAt(null); }
    catch (err) { setAttendanceError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Errore durante la riapertura del registro"); }
    finally { setSavingAttendance(false); }
  }

  async function handleSaveResult() {
    setResultError(null); setSavingResult(true);
    try { const response = await api.saveMatchResult(eventId, resultDraft); setResult(response.data); }
    catch (err) { setResultError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Errore durante il salvataggio del risultato"); }
    finally { setSavingResult(false); }
  }

  async function handleDeleteResult() {
    if (!window.confirm("Eliminare il risultato salvato?")) return;
    await api.deleteMatchResult(eventId); setResult(null); setResultDraft({ teamScore: 0, opponentScore: 0, venue: "home", notes: "" });
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
        `Eliminare questo evento del ${formatDisplayDate(event.date)}? Verranno eliminate anche le presenze collegate.`,
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
  const supportsResult = Boolean(type?.hasOpponent);

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
            {formatDisplayDate(event.date)} {event.startTime ?? ""}
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

      {supportsResult && (
        <Card withBorder padding="md" radius="md"><Stack gap="sm">
          <Group justify="space-between"><div><Title order={5}>Risultato partita</Title><Text size="sm" c="dimmed">Registra il risultato finale della partita.</Text></div>{result && <Badge color="green">Salvato</Badge>}</Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <NumberInput label="Gol squadra" min={0} max={99} value={resultDraft.teamScore} onChange={(value) => setResultDraft((draft) => ({ ...draft, teamScore: Number(value) || 0 }))} />
            <NumberInput label="Gol avversario" min={0} max={99} value={resultDraft.opponentScore} onChange={(value) => setResultDraft((draft) => ({ ...draft, opponentScore: Number(value) || 0 }))} />
            <Select label="Campo" data={[{ value: "home", label: "Casa" }, { value: "away", label: "Trasferta" }, { value: "neutral", label: "Campo neutro" }]} value={resultDraft.venue} onChange={(value) => setResultDraft((draft) => ({ ...draft, venue: (value ?? "home") as MatchResult["venue"] }))} allowDeselect={false} />
          </SimpleGrid>
          <TextInput label="Note sul risultato" value={resultDraft.notes} onChange={(event) => setResultDraft((draft) => ({ ...draft, notes: event.currentTarget.value }))} />
          {resultError && <Alert color="red" title="Errore">{resultError}</Alert>}
          <Group><Button onClick={handleSaveResult} loading={savingResult}>Salva risultato</Button>{result && <Button color="red" variant="subtle" onClick={handleDeleteResult}>Elimina risultato</Button>}</Group>
        </Stack></Card>
      )}

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
            {attendanceFinalizedAt && <Badge color="green">Registro chiuso</Badge>}
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
          {attendanceFinalizedAt ? <Button onClick={handleReopenAttendance} loading={savingAttendance} size="sm">Riapri registro</Button> : <Group gap="xs"><Button
            onClick={handleSaveAttendance}
            loading={savingAttendance}
            disabled={attendance.length === 0}
            size="sm"
          >
            Salva presenze
          </Button><Button color="green" onClick={handleFinalizeAttendance} loading={savingAttendance} disabled={attendance.length === 0}>Conferma registro</Button></Group>}
        </Group>
        {attendanceError && <Alert color="red" title="Errore">{attendanceError}</Alert>}
        {attendanceFinalizedAt && <Text size="sm" c="dimmed" mb="xs">Presenze storicizzate il {formatDisplayDateTime(attendanceFinalizedAt)}.</Text>}
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
                    disabled={Boolean(attendanceFinalizedAt)}
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
