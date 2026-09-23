import { Alert, Badge, Button, Card, Group, Loader, Select, Stack, Table, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AttendanceReport, EventTypeDef } from "../types";

export default function AttendanceRegister() {
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [types, setTypes] = useState<EventTypeDef[]>([]);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [reportRes, typesRes] = await Promise.all([
        api.getAttendanceReport({ from: from ? dayjs(from).format("YYYY-MM-DD") : undefined, to: to ? dayjs(to).format("YYYY-MM-DD") : undefined, type: type ?? undefined }),
        api.getEventTypes(),
      ]);
      setReport(reportRes.data); setTypes(typesRes.data);
    } catch { setError("Impossibile caricare il registro presenze."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const recordMap = useMemo(() => new Map((report?.records ?? []).map((record) => [`${record.playerId}:${record.eventId}`, record.status])), [report]);
  const typeLabel = (key: string) => types.find((item) => item.key === key)?.label ?? key;

  return <Stack gap="lg">
    <div><Title order={3}>Registro presenze</Title><Text c="dimmed">Consulta esclusivamente gli eventi con presenze confermate.</Text></div>
    <Card withBorder padding="md"><Group align="flex-end" wrap="wrap">
      <DateInput label="Dal" value={from} onChange={(value) => setFrom(value ? new Date(value) : null)} valueFormat="DD/MM/YYYY" clearable />
      <DateInput label="Al" value={to} onChange={(value) => setTo(value ? new Date(value) : null)} valueFormat="DD/MM/YYYY" clearable />
      <Select label="Tipo evento" placeholder="Tutti" clearable data={types.map((item) => ({ value: item.key, label: item.label }))} value={type} onChange={setType} />
      <Button onClick={() => void load()} loading={loading}>Applica filtri</Button>
    </Group></Card>
    {error && <Alert color="red" title="Errore">{error}</Alert>}
    {loading ? <Loader /> : !report || report.events.length === 0 ? <Text c="dimmed">Nessun registro confermato per i filtri selezionati.</Text> : <>
      <Card withBorder padding="md"><Text fw={600}>{report.events.length} eventi confermati · {report.players.length} giocatori</Text></Card>
      <Table.ScrollContainer minWidth={720}><Table withTableBorder striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Giocatore</Table.Th><Table.Th>Presenze</Table.Th>{report.events.map((event) => <Table.Th key={event.id} title={`${event.date} · ${typeLabel(event.type)}${event.opponent ? ` · ${event.opponent}` : ""}`}>{dayjs(event.date).format("DD/MM")}<Text size="xs" c="dimmed">{typeLabel(event.type)}</Text></Table.Th>)}</Table.Tr></Table.Thead><Table.Tbody>{report.players.map((player) => {
        const present = report.events.filter((event) => recordMap.get(`${player.id}:${event.id}`) === "present").length;
        return <Table.Tr key={player.id}><Table.Td fw={600}>{player.name}</Table.Td><Table.Td><Badge color={present === report.events.length ? "green" : "yellow"}>{present}/{report.events.length} · {Math.round((present / report.events.length) * 100)}%</Badge></Table.Td>{report.events.map((event) => { const status = recordMap.get(`${player.id}:${event.id}`); return <Table.Td key={event.id}><Badge size="sm" color={status === "present" ? "green" : "red"}>{status === "present" ? "✓" : "—"}</Badge></Table.Td>; })}</Table.Tr>;
      })}</Table.Tbody></Table></Table.ScrollContainer>
    </>}
  </Stack>;
}
