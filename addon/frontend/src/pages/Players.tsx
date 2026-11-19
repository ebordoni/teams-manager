import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconChartBar,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import SectionHeading from "../components/SectionHeading";
import PlayerPhotoField from "../components/PlayerPhotoField";
import { romeToday } from "../utils/rome-day";
import type { Dispatch, SetStateAction } from "react";
import type {
  AttendanceHistoryItem,
  Player,
  PlayerStatistics,
  PreferredFoot,
} from "../types";
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
  | "photo"
  | "birthDate"
  | "birthdayPublicName"
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
  photo: null,
  birthDate: null,
  birthdayPublicName: null,
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

function playerError(error: unknown): string {
  const detail = (error as { response?: { data?: { error?: unknown } } })
    ?.response?.data?.error;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "fieldErrors" in detail) {
    const messages = Object.values(
      (detail as { fieldErrors: Record<string, string[]> }).fieldErrors,
    ).flat();
    if (messages.length) return messages.join(". ");
  }
  return "Impossibile salvare il giocatore. Controlla i dati e riprova.";
}

function PlayerFields({
  value,
  onChange,
  includeNotes = false,
  onPhotoBusy,
}: {
  value: PlayerDraft;
  onChange: Dispatch<SetStateAction<PlayerDraft>>;
  onPhotoBusy: (busy: boolean) => void;
  includeNotes?: boolean;
}) {
  const roles = [value.role, ...value.secondaryRoles].filter(
    Boolean,
  ) as string[];
  function toggleRole(role: string) {
    const nextRoles = roles.includes(role)
      ? roles.filter((current) => current !== role)
      : [...roles, role];
    onChange({
      ...value,
      role: nextRoles[0] ?? null,
      secondaryRoles: nextRoles.slice(1),
    });
  }

  return (
    <Stack gap="lg">
      <PlayerPhotoField
        value={value.photo}
        name={value.name}
        onChange={(photo) => onChange((current) => ({ ...current, photo }))}
        onBusyChange={onPhotoBusy}
      />
      <TextInput
        label="Nome"
        required
        size="md"
        placeholder="Nome e cognome del giocatore"
        value={value.name}
        onChange={(event) =>
          onChange({ ...value, name: event.currentTarget.value })
        }
      />
      <TextInput
        label="Data di nascita"
        type="date"
        min="1900-01-01"
        max={romeToday()}
        value={value.birthDate ?? ""}
        onChange={(event) => {
          const birthDate = event.currentTarget.value || null;
          onChange({
            ...value,
            birthDate,
            birthdayPublicName: birthDate ? value.birthdayPublicName : null,
          });
        }}
        description="La data completa resta privata. Il compleanno viene ricordato nella dashboard."
      />
      <Checkbox
        label="Mostra gli auguri sul sito pubblico"
        description="Pubblica solo il nome scelto qui sotto. Foto, data completa ed età restano private."
        disabled={!value.birthDate}
        checked={value.birthdayPublicName !== null}
        onChange={(event) =>
          onChange({
            ...value,
            birthdayPublicName: event.currentTarget.checked ? "" : null,
          })
        }
      />
      {value.birthdayPublicName !== null && (
        <TextInput
          label="Nome pubblico per gli auguri"
          description="Scegli un nome o nomignolo, ad esempio Luca. Sarà visibile a chiunque apra il sito."
          maxLength={60}
          required
          value={value.birthdayPublicName}
          onChange={(event) =>
            onChange({
              ...value,
              birthdayPublicName: event.currentTarget.value,
            })
          }
        />
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput
          label="Numero di maglia"
          placeholder="Es. 10"
          value={value.jerseyNumber ?? ""}
          min={1}
          max={99}
          clampBehavior="strict"
          onChange={(jerseyNumber) =>
            onChange({ ...value, jerseyNumber: optionalNumber(jerseyNumber) })
          }
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
      </SimpleGrid>

      <div>
        <Text fw={500} size="sm" mb="xs">
          Ruoli
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Il primo ruolo selezionato è quello principale.
        </Text>
        <Group gap="xs">
          {ROLES.map((role) => (
            <Button
              key={role}
              type="button"
              size="compact-sm"
              radius="xl"
              variant={
                roles.includes(role)
                  ? roles[0] === role
                    ? "filled"
                    : "light"
                  : "default"
              }
              onClick={() => toggleRole(role)}
            >
              {role}
            </Button>
          ))}
        </Group>
      </div>

      <Divider label="Caratteristiche tecniche" labelPosition="left" />
      <SimpleGrid cols={{ base: 2, sm: 3 }}>
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
      </SimpleGrid>
      {includeNotes && (
        <Textarea
          label="Note"
          autosize
          minRows={2}
          placeholder="Annotazioni facoltative sul giocatore"
          value={value.notes ?? ""}
          onChange={(event) =>
            onChange({ ...value, notes: event.currentTarget.value || null })
          }
        />
      )}
    </Stack>
  );
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftPhotoBusy, setDraftPhotoBusy] = useState(false);
  const [editPhotoBusy, setEditPhotoBusy] = useState(false);
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
    if (!draft.name.trim() || draftPhotoBusy || saving) return;
    setSaving("create");
    setError(null);
    try {
      await api.createPlayer({ ...draft, name: draft.name.trim() });
      setDraft(EMPTY_PLAYER);
      closeForm();
      loadPlayers();
    } catch (err) {
      setError(playerError(err));
    } finally {
      setSaving(null);
    }
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !editing.name.trim() || editPhotoBusy || saving) return;
    setSaving("edit");
    setError(null);
    try {
      await api.updatePlayer(editing.id, {
        ...editing,
        name: editing.name.trim(),
      });
      setEditing(null);
      loadPlayers();
    } catch (err) {
      setError(playerError(err));
    } finally {
      setSaving(null);
    }
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
      <PageHeader
        title="Rosa giocatori"
        description="Ogni giocatore, le sue caratteristiche e il suo percorso."
        action={
          <Button
            onClick={toggleForm}
            leftSection={!showForm ? <IconPlus size={17} /> : undefined}
          >
            {showForm ? "Annulla" : "Nuovo giocatore"}
          </Button>
        }
      />
      {error && (
        <Alert
          color="red"
          title="Salvataggio non riuscito"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      {editing && (
        <Card
          withBorder
          padding="lg"
          radius="md"
          className="player-edit-panel"
          style={{ borderColor: "var(--mantine-primary-color-filled)" }}
        >
          <form onSubmit={handleUpdate}>
            <Stack gap="lg">
              <Group justify="space-between">
                <div>
                  <Title order={4}>Modifica giocatore</Title>
                  <Text size="sm" c="dimmed">
                    Aggiorna i dati anagrafici e le caratteristiche tecniche.
                  </Text>
                </div>
              </Group>
              <PlayerFields
                key={editing.id}
                value={editing}
                onChange={(next) =>
                  setEditing((current) =>
                    current
                      ? {
                          ...current,
                          ...(typeof next === "function"
                            ? next(current)
                            : next),
                        }
                      : null,
                  )
                }
                onPhotoBusy={setEditPhotoBusy}
                includeNotes
              />
              <Group>
                <Button
                  type="submit"
                  loading={saving === "edit"}
                  disabled={editPhotoBusy}
                >
                  Salva modifiche
                </Button>
                <Button
                  variant="subtle"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Annulla
                </Button>
              </Group>
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
              <Badge color="blue" size="lg">
                {history.statistics.goals} gol
              </Badge>
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
        <Card withBorder padding="lg" radius="md">
          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              <div>
                <Title order={4}>Aggiungi giocatore</Title>
                <Text size="sm" c="dimmed">
                  Inserisci i dati disponibili per il nuovo componente della
                  rosa.
                </Text>
              </div>
              <Divider label="Giocatore" labelPosition="left" />
              <PlayerFields
                value={draft}
                onChange={setDraft}
                onPhotoBusy={setDraftPhotoBusy}
                includeNotes
              />
              <Group>
                <Button
                  type="submit"
                  loading={saving === "create"}
                  disabled={draftPhotoBusy}
                >
                  Aggiungi giocatore
                </Button>
                <Button variant="subtle" type="button" onClick={closeForm}>
                  Annulla
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Collapse>
      {loading ? (
        <Loader />
      ) : players.length === 0 ? (
        <Card withBorder>
          <EmptyState
            title="La rosa parte da qui"
            description="Aggiungi il primo giocatore per preparare formazioni e registrare le presenze."
            icon={<IconUsers size={24} stroke={1.5} />}
          />
        </Card>
      ) : (
        <Stack gap="md">
          <SectionHeading
            title="La tua rosa"
            action={
              <Badge variant="light" color="gray">
                {players.length} giocatori
              </Badge>
            }
          />
          <div className="player-grid">
            {players.map((player) => (
              <Card key={player.id} withBorder className="player-card">
                <div className="player-card-head">
                  <Avatar
                    src={player.photo}
                    name={player.name}
                    color="brand"
                    radius="lg"
                    size={48}
                    alt={`Avatar di ${player.name}`}
                  />
                  <div className="player-card-main">
                    <Text fw={600} size="sm" lineClamp={2}>
                      {player.name}
                    </Text>
                    <Text size="xs" c="dimmed" mt={5} lineClamp={2}>
                      {[player.role, ...player.secondaryRoles]
                        .filter(Boolean)
                        .join(" · ") || "Ruoli non assegnati"}
                    </Text>
                  </div>
                  {player.jerseyNumber !== null && (
                    <Badge size="lg" color="gray" variant="light">
                      #{player.jerseyNumber}
                    </Badge>
                  )}
                </div>
                <div className="player-card-footer">
                  <Text size="xs" c="dimmed">
                    Piede {FOOT_LABEL[player.preferredFoot].toLowerCase()}
                  </Text>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      loading={
                        loadingHistory && history?.player.id !== player.id
                      }
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
                </div>
              </Card>
            ))}
          </div>
        </Stack>
      )}
    </Stack>
  );
}
