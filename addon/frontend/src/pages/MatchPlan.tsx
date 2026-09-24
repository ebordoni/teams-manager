import { ActionIcon, Alert, Badge, Button, Card, Group, NumberInput, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconExternalLink, IconFileExport, IconRobot, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import PageLoader from "../components/PageLoader";
import type { GeneratedMatchPlanExport, MatchPeriod, MatchPlan as MatchPlanType, Player, RolePolicy, TeamEvent } from "../types";
import { formatDatesInText, formatDisplayDate } from "../utils/date";

const SLOT_LABELS: Record<string, string> = {
  portiere: "Portiere", difensoreSinistro: "Difensore sinistro", difensoreDestro: "Difensore destro",
  centrale: "Centrocampista", fasciaSinistra: "Fascia sinistra", fasciaDestra: "Fascia destra", attaccante: "Attaccante",
};

export default function MatchPlan() {
  const eventId = Number(useParams<{ id: string }>().id);
  const [event, setEvent] = useState<TeamEvent | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamName, setTeamName] = useState("");
  const [plans, setPlans] = useState<MatchPlanType[]>([]);
  const [selected, setSelected] = useState<MatchPlanType | null>(null);
  const [draftPeriods, setDraftPeriods] = useState<MatchPeriod[]>([]);
  const [form, setForm] = useState({ name: "", periodCount: 3, minutesPerPeriod: 20, playersOnField: 7, rolePolicy: "preferred" as RolePolicy });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportedDocument, setExportedDocument] = useState<GeneratedMatchPlanExport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [eventRes, playersRes, plansRes, configRes, settingsRes] = await Promise.all([
      api.getEvent(eventId), api.getPlayers(), api.getMatchPlans(eventId), api.getAIConfig(), api.getSettings(),
    ]);
    setEvent(eventRes.data); setPlayers(playersRes.data); setPlans(plansRes.data); setTeamName(settingsRes.data.teamName);
    setForm((current) => ({ ...current, periodCount: configRes.data.defaultPeriodCount, minutesPerPeriod: configRes.data.defaultMinutesPerPeriod, playersOnField: configRes.data.defaultPlayersOnField, rolePolicy: configRes.data.defaultRolePolicy }));
    const first = plansRes.data[0] ?? null; setSelected(first); setDraftPeriods(first ? structuredClone(first.periods) : []);
  };
  useEffect(() => { load().catch(() => setError("Impossibile caricare i dati della partita")).finally(() => setLoading(false)); }, [eventId]);
  const playerOptions = players.map((player) => ({ value: String(player.id), label: player.name }));

  const selectPlan = (plan: MatchPlanType) => { setSelected(plan); setDraftPeriods(structuredClone(plan.periods)); setExportedDocument(null); setError(null); };
  const generate = async () => {
    setGenerating(true); setError(null);
    try {
      const response = await api.generateMatchPlan(eventId, form);
      setPlans((current) => [response.data, ...current]); selectPlan(response.data);
      notifications.show({ color: response.data.source === "ai" ? "green" : "yellow", message: response.data.source === "ai" ? "Piano generato dall’AI" : "Applicata la rotazione automatica locale" });
    } catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Generazione non riuscita"); }
    finally { setGenerating(false); }
  };
  const changePlayer = (periodIndex: number, assignmentIndex: number, playerId: number) => {
    setDraftPeriods((current) => current.map((period, index) => {
      if (index !== periodIndex) return period;
      const assignments = period.assignments.map((assignment, itemIndex) => itemIndex === assignmentIndex ? { ...assignment, playerId } : assignment);
      const used = new Set(assignments.map((assignment) => assignment.playerId));
      return { ...period, assignments, benchPlayerIds: players.map((player) => player.id).filter((id) => !used.has(id)) };
    }));
  };
  const saveManual = async () => {
    if (!selected) return; setSaving(true); setError(null);
    try { const response = await api.updateMatchPlan(eventId, selected.id, { periods: draftPeriods }); setSelected(response.data); setPlans((current) => current.map((plan) => plan.id === response.data.id ? response.data : plan)); notifications.show({ color: "green", message: "Modifiche salvate" }); }
    catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Rotazione non valida"); }
    finally { setSaving(false); }
  };
  const confirm = async () => { if (!selected) return; setError(null); try { const response = await api.confirmMatchPlan(eventId, selected.id); setSelected(response.data); setPlans((current) => current.map((plan) => plan.id === response.data.id ? response.data : plan)); notifications.show({ color: "green", message: "Piano partita confermato" }); } catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Conferma non riuscita"); } };
  const exportPlan = async () => { if (!selected) return; setExporting(true); setError(null); try { const response = await api.exportMatchPlan(eventId, selected.id); setExportedDocument(response.data); notifications.show({ color: "green", message: "Piano partita esportato in Google Docs" }); } catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Esportazione in Google Docs non riuscita"); } finally { setExporting(false); } };
  const remove = async (plan: MatchPlanType) => { if (!window.confirm(`Eliminare “${plan.name}”?`)) return; await api.deleteMatchPlan(eventId, plan.id); const next = plans.filter((item) => item.id !== plan.id); setPlans(next); const nextSelected = next[0] ?? null; setSelected(nextSelected); setDraftPeriods(nextSelected ? structuredClone(nextSelected.periods) : []); };

  const summary = players.map((player) => {
    const appearances = draftPeriods.reduce((count, period) => count + (period.assignments.some((assignment) => assignment.playerId === player.id) ? 1 : 0), 0);
    const roles = [...new Set(draftPeriods.flatMap((period) => period.assignments.filter((assignment) => assignment.playerId === player.id).map((assignment) => assignment.role)))];
    return { player, appearances, minutes: appearances * (selected?.minutesPerPeriod ?? form.minutesPerPeriod), roles };
  });

  if (loading) return <PageLoader />;
  return <Stack gap="lg">
    <Group justify="space-between"><div><Title order={3}>Piano partita AI</Title><Text c="dimmed">{formatDisplayDate(event?.date)}{event?.opponent ? ` · ${teamName} vs ${event.opponent}` : ""}</Text></div><Button component={Link} to={`/events/${eventId}`} variant="subtle">Torna all’evento</Button></Group>
    {error && <Alert color="red" title="Errore">{error}</Alert>}
    <Card withBorder padding="lg"><Stack><Group><IconRobot /><Title order={4}>Genera una proposta</Title></Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
        <TextInput label="Nome" placeholder="Piano partita" value={form.name} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })} />
        <NumberInput label="Tempi" min={1} max={12} value={form.periodCount} onChange={(value) => setForm({ ...form, periodCount: Number(value) })} />
        <NumberInput label="Minuti/tempo" min={1} max={90} value={form.minutesPerPeriod} onChange={(value) => setForm({ ...form, minutesPerPeriod: Number(value) })} />
        <NumberInput label="In campo" min={2} max={11} value={form.playersOnField} onChange={(value) => setForm({ ...form, playersOnField: Number(value) })} />
        <Select label="Ruoli" data={[{ value: "strict", label: "Rigidi" }, { value: "preferred", label: "Preferiti" }, { value: "free", label: "Liberi" }]} value={form.rolePolicy} onChange={(value) => setForm({ ...form, rolePolicy: (value ?? "preferred") as RolePolicy })} />
      </SimpleGrid>
      <Text size="sm" c="dimmed">{players.length} giocatori nella rosa. I cambi vengono effettuati soltanto tra un tempo e il successivo.</Text>
      <Button onClick={generate} loading={generating} disabled={players.length < form.playersOnField} style={{ alignSelf: "flex-start" }}>Genera rotazioni</Button>
    </Stack></Card>

    {plans.length > 0 && <Group align="flex-start" wrap="wrap"><Stack gap="xs" w={{ base: "100%", md: 250 }}>{plans.map((plan) => <Card key={plan.id} withBorder onClick={() => selectPlan(plan)} style={{ cursor: "pointer", borderColor: selected?.id === plan.id ? "var(--mantine-primary-color-filled)" : undefined }}><Group justify="space-between" wrap="nowrap"><div><Text fw={600}>{formatDatesInText(plan.name)}</Text><Group gap={4}><Badge size="xs" color={plan.source === "ai" ? "green" : plan.source === "manual" ? "blue" : "yellow"}>{plan.source}</Badge><Badge size="xs" variant="light">{plan.status}</Badge></Group></div><ActionIcon color="red" variant="subtle" onClick={(event) => { event.stopPropagation(); void remove(plan); }}><IconTrash size={16} /></ActionIcon></Group></Card>)}</Stack>
      {selected && <Stack style={{ flex: 1, minWidth: 0 }}>
        {selected.warnings.map((warning) => <Alert key={warning} color="yellow">{warning}</Alert>)}
        <SimpleGrid cols={{ base: 1, lg: 2 }}>{draftPeriods.map((period, periodIndex) => <Card key={period.periodNumber} withBorder><Title order={5} mb="sm">Tempo {period.periodNumber} · {selected.minutesPerPeriod} minuti</Title><Stack gap="xs">{period.assignments.map((assignment, assignmentIndex) => <Select key={assignment.slot} label={SLOT_LABELS[assignment.slot] ?? assignment.role} data={playerOptions} value={String(assignment.playerId)} onChange={(value) => value && changePlayer(periodIndex, assignmentIndex, Number(value))} searchable allowDeselect={false} />)}<Text size="sm" c="dimmed">Panchina: {period.benchPlayerIds.map((id) => players.find((player) => player.id === id)?.name).filter(Boolean).join(", ") || "nessuno"}</Text></Stack></Card>)}</SimpleGrid>
        <Card withBorder><Title order={5} mb="sm">Riepilogo minutaggio</Title><Table.ScrollContainer minWidth={500}><Table striped><Table.Thead><Table.Tr><Table.Th>Giocatore</Table.Th><Table.Th>Tempi</Table.Th><Table.Th>Minuti</Table.Th><Table.Th>Ruoli</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{summary.map((row) => <Table.Tr key={row.player.id}><Table.Td>{row.player.name}</Table.Td><Table.Td>{row.appearances}</Table.Td><Table.Td>{row.minutes}</Table.Td><Table.Td>{row.roles.join(", ") || "—"}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Card>
        <Group><Button onClick={saveManual} loading={saving}>Salva modifiche</Button><Button color="green" leftSection={<IconCheck size={18} />} onClick={confirm} disabled={selected.status === "confirmed"}>Conferma piano</Button><Button variant="light" leftSection={<IconFileExport size={18} />} onClick={exportPlan} loading={exporting}>Esporta in Google Docs</Button></Group>
        {exportedDocument && <Alert color="green" title="Piano partita esportato"><Text size="sm" mb="xs">{exportedDocument.title}</Text><Button component="a" href={exportedDocument.googleDocUrl} target="_blank" rel="noopener noreferrer" size="compact-sm" variant="light" rightSection={<IconExternalLink size={15} />}>Apri documento Google</Button></Alert>}
      </Stack>}
    </Group>}
    {plans.length === 0 && <Text c="dimmed">Non è ancora stato generato alcun piano per questa partita.</Text>}
  </Stack>;
}
