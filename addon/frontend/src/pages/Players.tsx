import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Collapse,
  Group,
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
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Player, PreferredFoot } from "../types";

const ROLES = ["Portiere", "Difensore", "Centrocampista", "Esterno", "Attaccante"];
const FOOT_OPTIONS = [
  { value: "right", label: "Destro" },
  { value: "left", label: "Sinistro" },
  { value: "both", label: "Ambidestro" },
];
const FOOT_LABEL: Record<PreferredFoot, string> = { right: "Destro", left: "Sinistro", both: "Ambidestro" };
const SKILLS = [
  ["fitness", "Forma fisica"], ["speed", "Velocità"], ["technique", "Tecnica"],
  ["shooting", "Tiro"], ["defending", "Difesa"], ["attacking", "Attacco"],
] as const;
const SKILL_SHORT_LABEL: Record<(typeof SKILLS)[number][0], string> = {
  fitness: "Fis", speed: "Vel", technique: "Tec", shooting: "Tir", defending: "Dif", attacking: "Att",
};

type PlayerDraft = Pick<Player, "name" | "role" | "secondaryRoles" | "preferredFoot" | "fitness" | "speed" | "technique" | "shooting" | "defending" | "attacking" | "notes">;
const EMPTY_PLAYER: PlayerDraft = { name: "", role: null, secondaryRoles: [], preferredFoot: "both", fitness: 50, speed: 50, technique: 50, shooting: 50, defending: 50, attacking: 50, notes: null };

function numericValue(value: string | number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function PlayerFields({ value, onChange, includeNotes = false }: { value: PlayerDraft; onChange: (next: PlayerDraft) => void; includeNotes?: boolean }) {
  const roles = [value.role, ...value.secondaryRoles].filter(Boolean) as string[];
  return <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
    <TextInput label="Nome" required value={value.name} onChange={(event) => onChange({ ...value, name: event.currentTarget.value })} />
    <MultiSelect label="Ruoli" data={ROLES} value={roles} onChange={(nextRoles) => onChange({ ...value, role: nextRoles[0] ?? null, secondaryRoles: nextRoles.slice(1) })} searchable />
    <Select label="Piede preferito" data={FOOT_OPTIONS} value={value.preferredFoot} onChange={(preferredFoot) => onChange({ ...value, preferredFoot: (preferredFoot ?? "both") as PreferredFoot })} allowDeselect={false} />
    {SKILLS.map(([key, label]) => <NumberInput key={key} label={label} description="0–100" value={value[key]} min={0} max={100} clampBehavior="strict" onChange={(nextValue) => onChange({ ...value, [key]: numericValue(nextValue) })} />)}
    {includeNotes && <TextInput label="Note" value={value.notes ?? ""} onChange={(event) => onChange({ ...value, notes: event.currentTarget.value || null })} />}
  </SimpleGrid>;
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<PlayerDraft>(EMPTY_PLAYER);
  const [editing, setEditing] = useState<Player | null>(null);
  const [showForm, { toggle: toggleForm, close: closeForm }] = useDisclosure(false);
  const showTechnicalProfile = useMediaQuery("(min-width: 75em)") ?? false;

  function loadPlayers() {
    setLoading(true);
    api.getPlayers().then((res) => setPlayers(res.data)).finally(() => setLoading(false));
  }

  useEffect(() => { loadPlayers(); }, []);

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
    await api.updatePlayer(editing.id, { ...editing, name: editing.name.trim() });
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
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  return <Stack gap="md">
    <Group justify="space-between"><Title order={4}>Giocatori</Title><Button onClick={toggleForm}>{showForm ? "Annulla" : "+ Nuovo giocatore"}</Button></Group>
    {editing && <Card withBorder padding="md" radius="md" style={{ borderColor: "var(--mantine-primary-color-filled)" }}><form onSubmit={handleUpdate}><Stack gap="md">
      <Group justify="space-between"><div><Title order={5}>Modifica giocatore</Title><Text size="sm" c="dimmed">Aggiorna ruolo, piede preferito e caratteristiche tecniche.</Text></div><Button variant="subtle" onClick={() => setEditing(null)}>Annulla</Button></Group>
      <PlayerFields value={editing} onChange={(next) => setEditing({ ...editing, ...next })} includeNotes />
      <Button type="submit" style={{ alignSelf: "flex-start" }}>Salva modifiche</Button>
    </Stack></form></Card>}
    <Collapse expanded={showForm}><Card withBorder padding="md" radius="md"><form onSubmit={handleSubmit}><Stack gap="md">
      <Title order={5}>Nuovo giocatore</Title><PlayerFields value={draft} onChange={setDraft} includeNotes />
      <Button type="submit" style={{ alignSelf: "flex-start" }}>Salva</Button>
    </Stack></form></Card></Collapse>
    {loading ? <Loader /> : players.length === 0 ? <Text c="dimmed">Nessun giocatore in anagrafica.</Text> : <Stack gap="xs">
      {players.map((player) => <Card key={player.id} withBorder padding="sm" radius="md"><Group justify="space-between" wrap="nowrap">
        <div style={{ minWidth: 0, flex: 1 }}><Text fw={600} truncate>{player.name}</Text><Group gap="xs" mt={3}><Badge variant="light">{FOOT_LABEL[player.preferredFoot]}</Badge>{(player.role || player.secondaryRoles.length > 0) && <Text size="sm" c="dimmed" truncate>{[player.role, ...player.secondaryRoles].filter(Boolean).join(", ")}</Text>}</Group>{showTechnicalProfile && <Group gap={4} mt={6} wrap="nowrap" aria-label={`Profilo tecnico di ${player.name}`}>{SKILLS.map(([key, label]) => <Badge key={key} size="sm" variant="light" color="gray" title={label}>{SKILL_SHORT_LABEL[key]} {player[key]}</Badge>)}</Group>}</div>
        <Group gap="xs" wrap="nowrap"><ActionIcon variant="subtle" onClick={() => startEditing(player)} aria-label={`Modifica ${player.name}`}><IconPencil size={18} /></ActionIcon><ActionIcon color="red" variant="subtle" onClick={() => handleDelete(player.id)} aria-label={`Elimina ${player.name}`}><IconTrash size={18} /></ActionIcon></Group>
      </Group></Card>)}
    </Stack>}
  </Stack>;
}
