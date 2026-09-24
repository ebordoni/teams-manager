import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Collapse,
  DataList,
  Group,
  Indicator,
  Loader,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChartBar, IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AttendanceHistoryItem, Player, PlayerStatistics, PreferredFoot } from "../types";
import { formatDisplayDate } from "../utils/date";

const ROLES = [
  "Portiere",
  "Difensore",
  "Centrocampista",
  "Esterno",
  "Attaccante",
];
const FOOT_OPTIONS = [
  { value: "right", label: "Destro" },
  { value: "left", label: "Sinistro" },
  { value: "both", label: "Ambidestro" },
];
const FOOT_LABEL: Record<PreferredFoot, string> = {
  right: "Destro",
  left: "Sinistro",
  both: "Ambidestro",
};
const SKILLS = [
  ["fitness", "Forma fisica"],
  ["speed", "Velocità"],
  ["technique", "Tecnica"],
  ["shooting", "Tiro"],
  ["defending", "Difesa"],
  ["attacking", "Attacco"],
] as const;
type PlayerDraft = Pick<
  Player,
  | "name"
  | "role"
  | "secondaryRoles"
  | "jerseyNumber"
  | "preferredFoot"
  | "fitness"
  | "speed"
  | "technique"
  | "shooting"
  | "defending"
  | "attacking"
  | "notes"
>;
const EMPTY_PLAYER: PlayerDraft = {
  name: "",
  role: null,
  secondaryRoles: [],
  jerseyNumber: null,
  preferredFoot: "both",
  fitness: 50,
  speed: 50,
  technique: 50,
  shooting: 50,
  defending: 50,
  attacking: 50,
  notes: null,
};

function numericValue(value: string | number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalNumber(value: string | number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function PlayerFields({
  value,
  onChange,
  includeNotes = false,
}: {
  value: PlayerDraft;
  onChange: (next: PlayerDraft) => void;
  includeNotes?: boolean;
}) {
  const roles = [value.role, ...value.secondaryRoles].filter(
    Boolean,
  ) as string[];
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
      <TextInput
        label="Nome e Cognome"
        required
        value={value.name}
        onChange={(event) =>
          onChange({ ...value, name: event.currentTarget.value })
        }
      />
      <NumberInput
        label="Numero di maglia"
        value={value.jerseyNumber ?? ""}
        min={1}
        max={99}
        clampBehavior="strict"
        onChange={(jerseyNumber) =>
          onChange({ ...value, jerseyNumber: optionalNumber(jerseyNumber) })
        }
      />
      <MultiSelect
        label="Ruoli"
        data={ROLES}
        value={roles}
        onChange={(nextRoles) =>
          onChange({
            ...value,
            role: nextRoles[0] ?? null,
            secondaryRoles: nextRoles.slice(1),
          })
        }
        searchable
      />
      <Select
        label="Piede preferito"
        data={FOOT_OPTIONS}
        value={value.preferredFoot}
        onChange={(preferredFoot) =>
          onChange({
            ...value,
            preferredFoot: (preferredFoot ?? "both") as PreferredFoot,
          })
        }
        allowDeselect={false}
      />
      {SKILLS.map(([key, label]) => (
        <NumberInput
          key={key}
          label={label}
          description="0–100"
          value={value[key]}
          min={0}
          max={100}
          clampBehavior="strict"
          onChange={(nextValue) =>
            onChange({ ...value, [key]: numericValue(nextValue) })
          }
        />
      ))}
      {includeNotes && (
        <TextInput
          label="Note"
          value={value.notes ?? ""}
          onChange={(event) =>
            onChange({ ...value, notes: event.currentTarget.value || null })
          }
        />
      )}
    </SimpleGrid>
  );
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<PlayerDraft>(EMPTY_PLAYER);
  const [editing, setEditing] = useState<Player | null>(null);
  const [history, setHistory] = useState<{
    player: Player;
    items: AttendanceHistoryItem[];
    statistics: PlayerStatistics;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showForm, { toggle: toggleForm, close: closeForm }] =
    useDisclosure(false);

  function loadPlayers() {
    setLoading(true);
    api
      .getPlayers()
      .then((res) => setPlayers(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    await api.createPlayer({ ...draft, name: draft.name.trim() });
    setDraft(EMPTY_PLAYER);
    closeForm();
    loadPlayers();
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !editing.name.trim()) return;
    await api.updatePlayer(editing.id, {
      ...editing,
      name: editing.name.trim(),
    });
    setEditing(null);
    loadPlayers();
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Eliminare questo giocatore?")) return;
    await api.deletePlayer(id);
    if (editing?.id === id) setEditing(null);
    loadPlayers();
  }

  function startEditing(player: Player) {
    setEditing({ ...player, secondaryRoles: [...player.secondaryRoles] });
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  async function showHistory(player: Player) {
    if (history?.player.id === player.id) {
      setHistory(null);
      return;
    }
    setLoadingHistory(true);
    try {
      const [historyResponse, statisticsResponse] = await Promise.all([
        api.getPlayerAttendanceHistory(player.id),
        api.getPlayerStatistics(player.id),
      ]);
      setHistory({
        player,
        items: historyResponse.data,
        statistics: statisticsResponse.data,
      });
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Giocatori</Title>
        <Button onClick={toggleForm}>
          {showForm ? "Annulla" : "+ Nuovo giocatore"}
        </Button>
      </Group>
      {editing && (
        <Card
          withBorder
          padding="md"
          radius="md"
          style={{ borderColor: "var(--mantine-primary-color-filled)" }}
        >
          <form onSubmit={handleUpdate}>
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Title order={5}>Modifica giocatore</Title>
                  <Text size="sm" c="dimmed">
                    Aggiorna ruolo, piede preferito e caratteristiche tecniche.
                  </Text>
                </div>
                <Button variant="subtle" onClick={() => setEditing(null)}>
                  Annulla
                </Button>
              </Group>
              <PlayerFields
                value={editing}
                onChange={(next) => setEditing({ ...editing, ...next })}
                includeNotes
              />
              <Button type="submit" style={{ alignSelf: "flex-start" }}>
                Salva modifiche
              </Button>
            </Stack>
          </form>
        </Card>
      )}
      {history && (
        <Card withBorder padding="md" radius="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <div>
                <Title order={5}>Statistiche · {history.player.name}</Title>
              </div>
              <Button variant="subtle" onClick={() => setHistory(null)}>
                Chiudi
              </Button>
            </Group>
            <Group gap="xs">
              <Badge color="blue" size="lg">{history.statistics.goals} gol</Badge>
              <Text size="sm" c="dimmed">
                in {history.statistics.matchesScored} partite a segno
              </Text>
            </Group>
            {history.items.length === 0 ? (
              <Text c="dimmed">Nessuna presenza storicizzata.</Text>
            ) : (
              <>
                <Text fw={600}>
                  {
                    history.items.filter((item) => item.status === "present")
                      .length
                  }
                  /{history.items.length} presenze (
                  {Math.round(
                    (history.items.filter((item) => item.status === "present")
                      .length /
                      history.items.length) *
                      100,
                  )}
                  %)
                </Text>
                {history.items.map((item) => (
                  <Group key={item.eventId} justify="space-between">
                    <Text size="sm">
                      {formatDisplayDate(item.date)} · {item.type}
                      {item.opponent ? ` · ${item.opponent}` : ""}
                    </Text>
                    <Badge color={item.status === "present" ? "green" : "red"}>
                      {item.status === "present" ? "Presente" : "Assente"}
                    </Badge>
                  </Group>
                ))}
              </>
            )}
          </Stack>
        </Card>
      )}
      <Collapse expanded={showForm}>
        <Card withBorder padding="md" radius="md">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <Title order={5}>Nuovo giocatore</Title>
              <PlayerFields value={draft} onChange={setDraft} includeNotes />
              <Button type="submit" style={{ alignSelf: "flex-start" }}>
                Salva
              </Button>
            </Stack>
          </form>
        </Card>
      </Collapse>
      {loading ? (
        <Loader />
      ) : players.length === 0 ? (
        <Text c="dimmed">Nessun giocatore in anagrafica.</Text>
      ) : (
        <Stack gap="xs">
          {players.map((player) => (
            <Card key={player.id} withBorder padding="sm" radius="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Indicator
                  inline
                  label={player.jerseyNumber}
                  disabled={player.jerseyNumber === null}
                  size={18}
                  position="top-end"
                  offset={5}
                  color="blue"
                  withBorder
                >
                  <Avatar
                    name={player.name}
                    color="initials"
                    radius="xl"
                    size="lg"
                    alt={`Avatar di ${player.name}`}
                  />
                </Indicator>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={600} truncate>
                    {player.name}
                  </Text>
                  <DataList size="sm" mt={4} style={{ maxWidth: 440 }}>
                    <DataList.Item>
                      <DataList.ItemLabel>Piede</DataList.ItemLabel>
                      <DataList.ItemValue>
                        {FOOT_LABEL[player.preferredFoot]}
                      </DataList.ItemValue>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.ItemLabel>Ruoli</DataList.ItemLabel>
                      <DataList.ItemValue>
                        {[player.role, ...player.secondaryRoles]
                          .filter(Boolean)
                          .join(", ") || "Non assegnati"}
                      </DataList.ItemValue>
                    </DataList.Item>
                  </DataList>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    loading={loadingHistory && history?.player.id !== player.id}
                    onClick={() => void showHistory(player)}
                    aria-label={`Storico presenze ${player.name}`}
                  >
                    <IconChartBar size={18} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => startEditing(player)}
                    aria-label={`Modifica ${player.name}`}
                  >
                    <IconPencil size={18} />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleDelete(player.id)}
                    aria-label={`Elimina ${player.name}`}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
