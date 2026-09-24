import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconMinus, IconPlus, IconRobot, IconTrash } from "@tabler/icons-react";
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
  const [resultDraft, setResultDraft] = useState({ teamScore: 0, opponentScore: 0, venue: "home" as MatchResult["venue"], scorers: [] as MatchScorer[], notes: "" });
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [attendanceOpened, setAttendanceOpened] = useState(false);
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
            if (resultRes.data) setResultDraft({ teamScore: resultRes.data.teamScore, opponentScore: resultRes.data.opponentScore, venue: resultRes.data.venue, scorers: resultRes.data.scorers ?? [], notes: resultRes.data.notes ?? "" });
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
  const supportsResult = Boolean(type?.hasOpponent);
  const supportsOpponentDraft = Boolean(eventTypes.find((item) => item.key === typeDraft)?.hasOpponent);
  const scorerPlayerOptions = attendance.filter((record) => record.status === "present").map((record) => ({ value: String(record.playerId), label: record.playerName }));
  const assignedScorerGoals = scorerGoals(resultDraft.scorers);

  return (
    <Stack gap="lg">
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} />
              <div><Title order={4}>{type?.label ?? event.type}</Title>{supportsResult && <Text size="sm" fw={600} c="dimmed">{teamName} – {event.opponent ?? "Squadra avversaria da indicare"}</Text>}</div>
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
        <Card withBorder padding="lg" radius="md"><Stack gap="md">
          <Group justify="space-between"><div><Title order={5}>Risultato partita</Title><Text size="sm" c="dimmed">Tocca + o − per aggiornare rapidamente il punteggio.</Text></div>{result && <Badge color="green">Salvato</Badge>}</Group>
          <SimpleGrid cols={{ base: 3 }} spacing="xs" verticalSpacing="xs">
            <Stack align="center" gap={2}><Text size="sm" fw={600} ta="center" lineClamp={2}>{teamName}</Text><Group gap="xs" wrap="nowrap"><ActionIcon size={44} variant="light" aria-label="Diminuisci gol squadra" onClick={() => changeTeamScore(-1)} disabled={resultDraft.teamScore <= assignedScorerGoals}><IconMinus size={20} /></ActionIcon><Text fw={800} size="3rem" lh={1}>{resultDraft.teamScore}</Text><ActionIcon size={44} variant="filled" aria-label="Aumenta gol squadra" onClick={() => changeTeamScore(1)}><IconPlus size={20} /></ActionIcon></Group></Stack>
            <Stack align="center" justify="center" gap={2}><Text size="xs" c="dimmed">RISULTATO</Text><Text fw={700} size="xl">–</Text><Select aria-label="Campo" size="xs" w={112} data={[{ value: "home", label: "Casa" }, { value: "away", label: "Trasferta" }, { value: "neutral", label: "Neutro" }]} value={resultDraft.venue} onChange={(value) => setResultDraft((draft) => ({ ...draft, venue: (value ?? "home") as MatchResult["venue"] }))} allowDeselect={false} /></Stack>
            <Stack align="center" gap={2}><Text size="sm" fw={600} ta="center" lineClamp={2}>{opponentDraft || event.opponent || "Avversario"}</Text><Group gap="xs" wrap="nowrap"><ActionIcon size={44} variant="light" aria-label="Diminuisci gol avversario" onClick={() => changeOpponentScore(-1)} disabled={resultDraft.opponentScore === 0}><IconMinus size={20} /></ActionIcon><Text fw={800} size="3rem" lh={1}>{resultDraft.opponentScore}</Text><ActionIcon size={44} variant="filled" aria-label="Aumenta gol avversario" onClick={() => changeOpponentScore(1)}><IconPlus size={20} /></ActionIcon></Group></Stack>
          </SimpleGrid>
          <Divider />
          <Stack gap="xs"><Group justify="space-between"><div><Text fw={600}>Marcatori {teamName}</Text><Text size="xs" c="dimmed">Assegna i gol ai giocatori della rosa.</Text></div><Badge variant="light" color={assignedScorerGoals === resultDraft.teamScore ? "green" : "gray"}>{assignedScorerGoals}/{resultDraft.teamScore} assegnati</Badge></Group>
            <Select placeholder="Aggiungi un marcatore" data={scorerPlayerOptions.filter((option) => !resultDraft.scorers.some((scorer) => scorer.playerId === Number(option.value)))} value={null} onChange={(value) => value && changeScorer(Number(value), 1)} searchable clearable />
            {resultDraft.scorers.length === 0 ? <Text size="sm" c="dimmed">Nessun marcatore indicato.</Text> : <Stack gap="xs">{resultDraft.scorers.map((scorer) => { const player = attendance.find((record) => record.playerId === scorer.playerId); return <Group key={scorer.playerId} justify="space-between" wrap="nowrap"><Text size="sm">{player?.playerName ?? "Giocatore non disponibile"}</Text><Group gap="xs" wrap="nowrap"><ActionIcon variant="light" size="md" aria-label="Diminuisci gol marcatore" onClick={() => changeScorer(scorer.playerId, -1)}><IconMinus size={16} /></ActionIcon><Badge size="lg" variant="filled">{scorer.goals}</Badge><ActionIcon variant="filled" size="md" aria-label="Aumenta gol marcatore" onClick={() => changeScorer(scorer.playerId, 1)} disabled={resultDraft.teamScore >= 99}><IconPlus size={16} /></ActionIcon></Group></Group>; })}</Stack>}
            {assignedScorerGoals < resultDraft.teamScore && <Text size="xs" c="dimmed">{resultDraft.teamScore - assignedScorerGoals} gol senza marcatore assegnato.</Text>}
          </Stack>
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

      <Card withBorder padding="md" radius="md">
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
          <Button variant="subtle" size="sm" onClick={() => setAttendanceOpened((opened) => !opened)} rightSection={attendanceOpened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}>
            {attendanceOpened ? "Nascondi" : "Apri"}
          </Button>
        </Group>
        <Collapse expanded={attendanceOpened}>
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
          </Stack>
        </Collapse>
      </Card>
    </Stack>
  );
}
