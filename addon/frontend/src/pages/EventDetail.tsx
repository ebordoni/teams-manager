import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconCalendarEvent, IconClock, IconMapPin, IconMinus, IconPlus, IconRobot, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EventTypeIcon } from "../components/EventTypeIcon";
import PageLoader from "../components/PageLoader";
import PageHeader from "../components/PageHeader";
import EventTimeInput from "../components/EventTimeInput";
import { formatDisplayDate, formatDisplayDateTime } from "../utils/date";
import type {
  Attendance,
  EventStatus,
  EventTypeDef,
  Formation,
  MatchResult,
  MatchScorer,
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
  const [searchParams] = useSearchParams();
  const eventId = Number(id);
  const [event, setEvent] = useState<TeamEvent | null>(null);
  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [savedAttendance, setSavedAttendance] = useState<Record<number, Attendance["status"]>>({});
  const [loading, setLoading] = useState(true);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceFinalizedAt, setAttendanceFinalizedAt] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [resultDraft, setResultDraft] = useState({ teamScore: 0, opponentScore: 0, venue: "home" as MatchResult["venue"], scorers: [] as MatchScorer[], notes: "" });
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("La squadra");
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
      api.getSettings(),
    ])
      .then(
        async ([eventRes, attendanceRes, attendanceStatusRes, typesRes, formationsRes, settingsRes]) => {
          setEvent(eventRes.data);
          setAttendance(attendanceRes.data);
          setSavedAttendance(Object.fromEntries(attendanceRes.data.map((item) => [item.playerId, item.status])));
          setAttendanceFinalizedAt(attendanceStatusRes.data.finalizedAt);
          setEventTypes(typesRes.data);
          setFormations(formationsRes.data);
          setTeamName(settingsRes.data.teamName);
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
            setResultDraft(resultRes.data
              ? { teamScore: resultRes.data.teamScore, opponentScore: resultRes.data.opponentScore, venue: resultRes.data.venue, scorers: resultRes.data.scorers ?? [], notes: resultRes.data.notes ?? "" }
              : { teamScore: 0, opponentScore: 0, venue: eventRes.data.venue, scorers: [], notes: "" });
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
      setSavedAttendance(Object.fromEntries(attendance.map((item) => [item.playerId, item.status])));
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
      setSavedAttendance(Object.fromEntries(attendance.map((item) => [item.playerId, item.status])));
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
    await api.deleteMatchResult(eventId); setResult(null); setResultDraft({ teamScore: 0, opponentScore: 0, venue: "home", scorers: [], notes: "" });
  }

  function scorerGoals(scorers: MatchScorer[]) {
    return scorers.reduce((total, scorer) => total + scorer.goals, 0);
  }

  function changeTeamScore(delta: number) {
    setResultDraft((draft) => ({
      ...draft,
      teamScore: Math.max(scorerGoals(draft.scorers), Math.min(99, draft.teamScore + delta)),
    }));
  }

  function changeOpponentScore(delta: number) {
    setResultDraft((draft) => ({ ...draft, opponentScore: Math.max(0, Math.min(99, draft.opponentScore + delta)) }));
  }

  function changeScorer(playerId: number, delta: number) {
    setResultDraft((draft) => {
      const existing = draft.scorers.find((scorer) => scorer.playerId === playerId);
      const nextGoals = (existing?.goals ?? 0) + delta;
      const scorers = nextGoals <= 0
        ? draft.scorers.filter((scorer) => scorer.playerId !== playerId)
        : existing
          ? draft.scorers.map((scorer) => scorer.playerId === playerId ? { ...scorer, goals: nextGoals } : scorer)
          : [...draft.scorers, { playerId, goals: nextGoals }];
      return { ...draft, scorers, teamScore: Math.max(draft.teamScore, scorerGoals(scorers)) };
    });
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
  const attendanceDirty = attendance.some((record) => savedAttendance[record.playerId] !== record.status);
  const supportsResult = Boolean(type?.hasOpponent);
  const venue = result?.venue ?? event.venue;
  const supportsOpponentDraft = Boolean(eventTypes.find((item) => item.key === typeDraft)?.hasOpponent);
  const scorerPlayerOptions = attendance.filter((record) => record.status === "present").map((record) => ({ value: String(record.playerId), label: record.playerName }));
  const assignedScorerGoals = scorerGoals(resultDraft.scorers);

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Calendario / Evento"
        title={type?.label ?? event.type}
        description="Consulta l'appuntamento e gestisci i dettagli operativi."
        action={<>
          <Button component={Link} to="/calendar" variant="subtle" leftSection={<IconArrowLeft size={17} />}>Calendario</Button>
          <Button color="red" variant="subtle" onClick={handleDelete} leftSection={<IconTrash size={17} />}>Elimina evento</Button>
        </>}
      />

      <div className="app-detail-summary">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
            <Group gap="xs" wrap="nowrap">
              <EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} size={26} />
              <div>
                <Title order={3}>{supportsResult ? `${venue === "away" ? event.opponent ?? "Avversario" : teamName} – ${venue === "away" ? teamName : event.opponent ?? "Avversario da indicare"}` : type?.label ?? event.type}</Title>
                <Text size="sm" c="dimmed">{supportsResult ? (venue === "away" ? "In trasferta" : venue === "neutral" ? "Campo neutro" : "In casa") : "Appuntamento di squadra"}</Text>
              </div>
            </Group>
            <Badge color={STATUS_COLOR[event.status]} variant="light" size="lg">
                {EVENT_STATUS_LABEL[event.status]}
            </Badge>
          </Group>
          <Group gap="lg" c="dimmed" wrap="wrap">
            <Group gap={6}><IconCalendarEvent size={16} /><Text size="sm">{formatDisplayDate(event.date)}</Text></Group>
            {event.startTime && <Group gap={6}><IconClock size={16} /><Text size="sm">{event.startTime}{event.endTime ? `–${event.endTime}` : ""}</Text></Group>}
            {event.location && <Group gap={6}><IconMapPin size={16} /><Text size="sm">{event.location}</Text></Group>}
          </Group>
        </Stack>
      </div>

      <Tabs defaultValue={searchParams.get("tab") === "attendance" ? "attendance" : "details"} className="app-detail-tabs" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="details">Dettagli</Tabs.Tab>
          {supportsResult && <Tabs.Tab value="match">Partita</Tabs.Tab>}
          <Tabs.Tab value="attendance" rightSection={<Badge size="xs" variant="light">{presentAttendance}/{attendance.length}</Badge>}>Presenze</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details">
          <Card withBorder padding="lg" radius="md">
            <Stack gap="lg">
              <div><Title order={4}>Modifica evento</Title><Text size="sm" c="dimmed">Tipo, data, orari e informazioni condivise.</Text></div>
              <Divider label="Appuntamento" labelPosition="left" />

          <SimpleGrid
            cols={{ base: 1, sm: 2, lg: 3 }}
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
            <EventTimeInput
              label="Inizio"
              value={startTimeDraft}
              onChange={setStartTimeDraft}
            />
            <EventTimeInput
              label="Fine"
              value={endTimeDraft}
              onChange={setEndTimeDraft}
            />
            <EventTimeInput
              label="Ritrovo"
              value={meetingTimeDraft}
              onChange={setMeetingTimeDraft}
            />
          </SimpleGrid>
          <Divider label="Luogo e squadra" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
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
            {supportsOpponentDraft && <TextInput
              label="Squadra avversaria"
              placeholder="es. Bovolone"
              value={opponentDraft}
              onChange={(e) => setOpponentDraft(e.currentTarget.value)}
            />}
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
          </SimpleGrid>
          <Divider label="Stato e note" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
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
            </Stack>
          </Card>
          <Group className="mobile-form-actions" mt="md">
            <Button onClick={handleSaveStatus} loading={savingStatus}>
              Salva modifiche
            </Button>
          </Group>
        </Tabs.Panel>

        {supportsResult && <Tabs.Panel value="match"><Stack gap="md">
        <Card withBorder padding="lg" radius="md">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
              <div>
                <Title order={5}>Risultato partita</Title>
                <Text size="sm" c="dimmed">Aggiorna il punteggio e assegna i gol.</Text>
              </div>
              {result && <Badge color="green">Salvato</Badge>}
            </Group>

            <Select
              label="Campo"
              description="Indica dove si è giocata la partita"
              data={[
                { value: "home", label: "Casa" },
                { value: "away", label: "Trasferta" },
                { value: "neutral", label: "Campo neutro" },
              ]}
              value={resultDraft.venue}
              onChange={(value) => setResultDraft((draft) => ({
                ...draft,
                venue: (value ?? "home") as MatchResult["venue"],
              }))}
              allowDeselect={false}
              maw={260}
            />

            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text size="sm" fw={700} ta="center" lineClamp={2}>{teamName}</Text>
                  <Group justify="center" gap="md" wrap="nowrap">
                    <ActionIcon size={44} variant="light" aria-label="Diminuisci gol squadra" onClick={() => changeTeamScore(-1)} disabled={resultDraft.teamScore <= assignedScorerGoals}>
                      <IconMinus size={20} />
                    </ActionIcon>
                    <Text fw={800} size="3rem" lh={1} aria-label={`${teamName}: ${resultDraft.teamScore}`}>{resultDraft.teamScore}</Text>
                    <ActionIcon size={44} variant="filled" aria-label="Aumenta gol squadra" onClick={() => changeTeamScore(1)}>
                      <IconPlus size={20} />
                    </ActionIcon>
                  </Group>
                </Stack>
              </Paper>
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text size="sm" fw={700} ta="center" lineClamp={2}>{opponentDraft || event.opponent || "Avversario"}</Text>
                  <Group justify="center" gap="md" wrap="nowrap">
                    <ActionIcon size={44} variant="light" aria-label="Diminuisci gol avversario" onClick={() => changeOpponentScore(-1)} disabled={resultDraft.opponentScore === 0}>
                      <IconMinus size={20} />
                    </ActionIcon>
                    <Text fw={800} size="3rem" lh={1} aria-label={`Avversario: ${resultDraft.opponentScore}`}>{resultDraft.opponentScore}</Text>
                    <ActionIcon size={44} variant="filled" aria-label="Aumenta gol avversario" onClick={() => changeOpponentScore(1)}>
                      <IconPlus size={20} />
                    </ActionIcon>
                  </Group>
                </Stack>
              </Paper>
            </SimpleGrid>
          <Divider />
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
              <div>
                <Text fw={600}>Marcatori {teamName}</Text>
                <Text size="xs" c="dimmed">Assegna i gol ai giocatori presenti.</Text>
              </div>
              <Badge variant="light" color={assignedScorerGoals === resultDraft.teamScore ? "green" : "gray"}>{assignedScorerGoals}/{resultDraft.teamScore} assegnati</Badge>
            </Group>
            <Select label="Aggiungi un marcatore" placeholder="Scegli un giocatore" data={scorerPlayerOptions.filter((option) => !resultDraft.scorers.some((scorer) => scorer.playerId === Number(option.value)))} value={null} onChange={(value) => value && changeScorer(Number(value), 1)} searchable clearable />
            {resultDraft.scorers.length === 0 ? <Text size="sm" c="dimmed">Nessun marcatore indicato.</Text> : <Stack gap="xs">{resultDraft.scorers.map((scorer) => { const player = attendance.find((record) => record.playerId === scorer.playerId); return <Paper key={scorer.playerId} withBorder p="xs" radius="sm"><Group justify="space-between" align="center" wrap="nowrap" gap="xs"><Text size="sm" fw={500} style={{ minWidth: 0 }} lineClamp={2}>{player?.playerName ?? "Giocatore non disponibile"}</Text><Group gap="xs" wrap="nowrap"><ActionIcon variant="light" size={40} aria-label={`Diminuisci gol di ${player?.playerName ?? "questo giocatore"}`} onClick={() => changeScorer(scorer.playerId, -1)}><IconMinus size={18} /></ActionIcon><Badge size="lg" variant="filled" miw={36} ta="center">{scorer.goals}</Badge><ActionIcon variant="filled" size={40} aria-label={`Aumenta gol di ${player?.playerName ?? "questo giocatore"}`} onClick={() => changeScorer(scorer.playerId, 1)} disabled={resultDraft.teamScore >= 99}><IconPlus size={18} /></ActionIcon></Group></Group></Paper>; })}</Stack>}
            {assignedScorerGoals < resultDraft.teamScore && <Alert color="blue" variant="light" py="xs">{resultDraft.teamScore - assignedScorerGoals} gol senza marcatore assegnato.</Alert>}
          </Stack>
          <TextInput label="Note sul risultato" placeholder="Ad esempio: partita sospesa, supplementari…" value={resultDraft.notes} onChange={(event) => setResultDraft((draft) => ({ ...draft, notes: event.currentTarget.value }))} />
          {resultError && <Alert color="red" title="Errore">{resultError}</Alert>}
          <Stack gap="xs">
            <Button onClick={handleSaveResult} loading={savingResult} fullWidth>Salva risultato</Button>
            {result && <Button color="red" variant="subtle" onClick={handleDeleteResult} fullWidth>Elimina risultato</Button>}
          </Stack>
        </Stack>
        </Card>

      <Card withBorder padding="md" radius="md">
        <Group justify="space-between">
          <div><Title order={5}>Rotazioni della partita</Title><Text size="sm" c="dimmed">Genera una formazione per ogni tempo bilanciando automaticamente il minutaggio.</Text></div>
          <Button component={Link} to={`/events/${eventId}/match-plan`} leftSection={<IconRobot size={18} />}>Apri piano partita</Button>
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

        </Stack></Tabs.Panel>}

        <Tabs.Panel value="attendance">
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Title order={5}>Presenze</Title>
            {attendanceFinalizedAt && <Badge color="green">Registro chiuso</Badge>}
            {!attendanceFinalizedAt && attendanceDirty && <Badge color="orange">Modifiche da salvare</Badge>}
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
        </Group>
          <Stack gap="sm" mt="md">
            {attendanceFinalizedAt ? <Button onClick={handleReopenAttendance} loading={savingAttendance} size="sm" style={{ alignSelf: "flex-start" }}>Riapri registro</Button> : <Group gap="xs"><Button
              onClick={handleSaveAttendance}
              loading={savingAttendance}
              disabled={attendance.length === 0}
              size="sm"
            >
              Salva presenze
            </Button><Button color="green" onClick={handleFinalizeAttendance} loading={savingAttendance} disabled={attendance.length === 0}>Conferma registro</Button></Group>}
            {attendanceError && <Alert color="red" title="Errore">{attendanceError}</Alert>}
            {attendanceFinalizedAt && <Text size="sm" c="dimmed">Presenze storicizzate il {formatDisplayDateTime(attendanceFinalizedAt)}.</Text>}
            {attendance.length === 0 ? (
              <Text c="dimmed">
                Nessun giocatore in anagrafica: aggiungili dalla pagina Giocatori.
              </Text>
            ) : (
              <Stack gap="xs">
                {attendance.map((a) => (
                  <Card
                    key={a.playerId}
                    component="button"
                    type="button"
                    withBorder
                    padding="sm"
                    radius="md"
                    disabled={Boolean(attendanceFinalizedAt)}
                    aria-label={`${a.playerName}: ${a.status === "present" ? "presente" : a.status === "excused" ? "giustificato" : "assente"}${attendanceFinalizedAt ? "" : ". Tocca per cambiare"}`}
                    aria-pressed={a.status === "present"}
                    onClick={() => setPlayerPresent(a.playerId, a.status !== "present")}
                    className="attendance-row"
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Text fw={600}>{a.playerName}</Text>
                      <Badge color={a.status === "present" ? "green" : a.status === "excused" ? "yellow" : "gray"} variant="light" size="lg">
                        {a.status === "present" ? "Presente" : a.status === "excused" ? "Giustificato" : "Assente"}
                      </Badge>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
      </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
