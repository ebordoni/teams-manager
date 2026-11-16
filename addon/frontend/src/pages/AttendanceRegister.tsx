import {
  Accordion,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  IconAdjustmentsHorizontal,
  IconClipboardList,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import SectionHeading from "../components/SectionHeading";
import type { AttendanceReport, EventTypeDef } from "../types";
import { formatDisplayDate } from "../utils/date";

export default function AttendanceRegister() {
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [types, setTypes] = useState<EventTypeDef[]>([]);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reportRes, typesRes] = await Promise.all([
        api.getAttendanceReport({
          from: from ? dayjs(from).format("YYYY-MM-DD") : undefined,
          to: to ? dayjs(to).format("YYYY-MM-DD") : undefined,
          type: type ?? undefined,
        }),
        api.getEventTypes(),
      ]);
      setReport(reportRes.data);
      setTypes(typesRes.data);
    } catch {
      setError("Impossibile caricare il registro presenze.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const recordMap = useMemo(
    () =>
      new Map(
        (report?.records ?? []).map((record) => [
          `${record.playerId}:${record.eventId}`,
          record.status,
        ]),
      ),
    [report],
  );
  const typeLabel = (key: string) =>
    types.find((item) => item.key === key)?.label ?? key;
  const presentFor = (id: number) =>
    report?.events.filter(
      (event) => recordMap.get(`${id}:${event.id}`) === "present",
    ).length ?? 0;
  const statusLabel = (status?: string) =>
    status === "present"
      ? "Presente"
      : status === "excused"
        ? "Giustificato"
        : status === "absent"
          ? "Assente"
          : "Non registrato";
  const statusColor = (status?: string) =>
    status === "present"
      ? "green"
      : status === "excused"
        ? "orange"
        : status === "absent"
          ? "red"
          : "gray";

  return (
    <Stack gap="lg">
      <PageHeader
        title="Registro presenze"
        description="La continuità di ogni giocatore, allenamento dopo allenamento."
      />
      <Card withBorder>
        <SectionHeading
          title="Consulta i registri"
          description="Sono inclusi soltanto gli eventi con presenze confermate."
          icon={<IconAdjustmentsHorizontal size={18} />}
        />
        <div className="app-filter-grid">
          <DateInput
            label="Dal"
            value={from}
            onChange={(value) => setFrom(value ? new Date(value) : null)}
            valueFormat="DD-MM-YYYY"
            clearable
          />
          <DateInput
            label="Al"
            value={to}
            onChange={(value) => setTo(value ? new Date(value) : null)}
            valueFormat="DD-MM-YYYY"
            clearable
          />
          <Select
            label="Tipo evento"
            placeholder="Tutti gli eventi"
            clearable
            data={types.map((item) => ({ value: item.key, label: item.label }))}
            value={type}
            onChange={setType}
          />
          <Button onClick={() => void load()} loading={loading}>
            Applica filtri
          </Button>
        </div>
      </Card>
      {error && (
        <Alert color="red" title="Errore">
          {error}
        </Alert>
      )}
      {loading ? (
        <Loader />
      ) : !report || report.events.length === 0 ? (
        <Card withBorder>
          <EmptyState
            title="Nessun registro da consultare"
            description="Conferma le presenze nel dettaglio di un evento oppure modifica i filtri."
            icon={<IconClipboardList size={24} stroke={1.5} />}
          />
        </Card>
      ) : (
        <>
          <SectionHeading
            title="Il riepilogo della rosa"
            action={
              <Group gap="xs">
                <Badge color="gray">
                  {report.events.length} eventi confermati
                </Badge>
                <Badge color="gray">{report.players.length} giocatori</Badge>
              </Group>
            }
          />
          <div className="attendance-desktop-table app-table-card">
            <Table.ScrollContainer minWidth={720}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Giocatore</Table.Th>
                    <Table.Th>Presenze</Table.Th>
                    {report.events.map((event) => (
                      <Table.Th
                        key={event.id}
                        title={`${formatDisplayDate(event.date)} · ${typeLabel(event.type)}${event.opponent ? ` · ${event.opponent}` : ""}`}
                      >
                        {formatDisplayDate(event.date)}
                        <Text size="xs" c="dimmed">
                          {typeLabel(event.type)}
                        </Text>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.players.map((player) => {
                    const present = presentFor(player.id);
                    return (
                      <Table.Tr key={player.id}>
                        <Table.Td fw={500}>{player.name}</Table.Td>
                        <Table.Td>
                          <Badge
                            color={
                              present === report.events.length
                                ? "green"
                                : "orange"
                            }
                          >
                            {present}/{report.events.length} ·{" "}
                            {Math.round((present / report.events.length) * 100)}
                            %
                          </Badge>
                        </Table.Td>
                        {report.events.map((event) => {
                          const status = recordMap.get(
                            `${player.id}:${event.id}`,
                          );
                          return (
                            <Table.Td key={event.id}>
                              <Badge
                                size="sm"
                                color={statusColor(status)}
                                aria-label={statusLabel(status)}
                              >
                                {status === "present" ? "✓" : "—"}
                              </Badge>
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </div>
          <Accordion
            multiple
            variant="separated"
            radius="md"
            className="attendance-mobile-list"
          >
            {report.players.map((player) => (
              <Accordion.Item key={player.id} value={String(player.id)}>
                <Accordion.Control>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar
                      name={player.name}
                      color="brand"
                      radius="md"
                      size={34}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={500}>
                        {player.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {presentFor(player.id)} presenze su{" "}
                        {report.events.length}
                      </Text>
                    </div>
                    <Badge
                      color={
                        presentFor(player.id) === report.events.length
                          ? "green"
                          : "orange"
                      }
                    >
                      {Math.round(
                        (presentFor(player.id) / report.events.length) * 100,
                      )}
                      %
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {report.events.map((event) => {
                      const status = recordMap.get(`${player.id}:${event.id}`);
                      return (
                        <Group
                          key={event.id}
                          justify="space-between"
                          wrap="nowrap"
                          gap="xs"
                        >
                          <div>
                            <Text size="xs" fw={500}>
                              {formatDisplayDate(event.date)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {typeLabel(event.type)}
                              {event.opponent ? ` · ${event.opponent}` : ""}
                            </Text>
                          </div>
                          <Badge color={statusColor(status)}>
                            {statusLabel(status)}
                          </Badge>
                        </Group>
                      );
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </>
      )}
    </Stack>
  );
}
