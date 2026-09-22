import { ActionIcon, Alert, Badge, Box, Button, Card, Group, Select, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconCopy, IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import PageLoader from "../components/PageLoader";
import type { Formation, Player } from "../types";

const slots = [
  ["portiere", "Portiere", "50%", "88%"], ["difensoreSinistro", "Difensore sinistro", "28%", "70%"],
  ["difensoreDestro", "Difensore destro", "72%", "70%"], ["centrale", "Centrocampista", "50%", "51%"],
  ["fasciaSinistra", "Fascia sinistra", "20%", "34%"], ["fasciaDestra", "Fascia destra", "80%", "34%"],
  ["attaccante", "Attaccante", "50%", "15%"],
] as const;
type Slot = (typeof slots)[number][0];
type Assignments = Record<Slot, number | null>;
const emptyAssignments = (): Assignments => Object.fromEntries(slots.map(([key]) => [key, null])) as Assignments;
const formationAssignments = (assignments: Record<string, number | null>): Assignments => ({ ...emptyAssignments(), ...assignments });

function FormationPitch({ assignments, players }: { assignments: Assignments; players: Player[] }) {
  return <Box aria-label="Anteprima della formazione 2-3-1" style={{ minHeight: 430, position: "relative", overflow: "hidden", borderRadius: "var(--mantine-radius-md)", border: "2px solid var(--mantine-color-green-8)", background: "linear-gradient(90deg, #32844c 0%, #3e9b5b 50%, #32844c 100%)" }}>
    <Box style={{ position: "absolute", inset: "50% 0 auto", borderTop: "2px solid rgba(255,255,255,.82)" }} />
    <Box style={{ position: "absolute", width: 112, height: 112, border: "2px solid rgba(255,255,255,.82)", borderRadius: "50%", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
    <Box style={{ position: "absolute", width: "54%", height: 66, border: "2px solid rgba(255,255,255,.82)", borderBottom: 0, bottom: 0, left: "23%" }} />
    <Box style={{ position: "absolute", width: "54%", height: 66, border: "2px solid rgba(255,255,255,.82)", borderTop: 0, top: 0, left: "23%" }} />
    {slots.map(([key, label, left, top]) => {
      const player = players.find((item) => item.id === assignments[key]);
      return <Box key={key} style={{ position: "absolute", left, top, transform: "translate(-50%, -50%)", width: 104, textAlign: "center", zIndex: 1 }}>
        <Box style={{ width: 36, height: 36, margin: "0 auto 4px", borderRadius: "50%", display: "grid", placeItems: "center", background: player ? "var(--mantine-color-blue-7)" : "rgba(255,255,255,.22)", border: "2px solid white", color: "white", fontWeight: 700 }}>{player ? player.name.slice(0, 1).toUpperCase() : "?"}</Box>
        <Text size="xs" c="white" fw={700} lh={1.1}>{player?.name ?? label}</Text>
      </Box>;
    })}
  </Box>;
}

export default function Formations() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [name, setName] = useState("Formazione 2-3-1");
  const [assignments, setAssignments] = useState<Assignments>(emptyAssignments());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { setLoading(true); try { const [playersRes, formationsRes] = await Promise.all([api.getPlayers(), api.getFormations()]); setPlayers(playersRes.data); setFormations(formationsRes.data); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const selectedPlayerIds = Object.values(assignments).filter((id): id is number => id !== null);
  const duplicatePlayerIds = selectedPlayerIds.filter((id, index) => selectedPlayerIds.indexOf(id) !== index);
  const isComplete = selectedPlayerIds.length === slots.length;
  const isValid = isComplete && duplicatePlayerIds.length === 0;
  const options = useMemo(() => players.map((player) => ({ value: String(player.id), label: `${player.name}${player.secondaryRoles.length ? ` · ${player.secondaryRoles.join(", ")}` : ""}` })), [players]);
  const reset = () => { setEditingId(null); setName("Formazione 2-3-1"); setAssignments(emptyAssignments()); setError(null); };
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!isValid) return; setSaving(true); setError(null); try { if (editingId) await api.updateFormation(editingId, { name, assignments }); else await api.createFormation({ name, assignments }); reset(); await load(); } catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Impossibile salvare la formazione"); } finally { setSaving(false); } };
  const edit = (formation: Formation) => { setEditingId(formation.id); setName(formation.name); setAssignments(formationAssignments(formation.assignments)); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const duplicate = async (formation: Formation) => { setError(null); try { await api.createFormation({ name: `Copia di ${formation.name}`, assignments: formationAssignments(formation.assignments) }); await load(); } catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Impossibile duplicare la formazione"); } };
  const remove = async (formation: Formation) => { if (!window.confirm(`Eliminare la formazione “${formation.name}”? Gli eventi collegati resteranno disponibili senza formazione.`)) return; await api.deleteFormation(formation.id); if (editingId === formation.id) reset(); await load(); };
  if (loading) return <PageLoader />;
  return <Stack gap="lg">
    <div><Title order={3}>Formazioni</Title><Text c="dimmed" size="sm">Prepara gli schieramenti 7vs7 nello schema 2-3-1 e riutilizzali nella partita.</Text></div>
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
      <Card withBorder padding="lg"><form onSubmit={save}><Stack gap="md">
        <Group justify="space-between"><Title order={4}>{editingId ? "Modifica formazione" : "Nuova formazione"}</Title><Badge color={isValid ? "green" : "gray"} variant="light">{selectedPlayerIds.length}/7 ruoli</Badge></Group>
        <TextInput label="Nome formazione" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>{slots.map(([key, label]) => <Select key={key} label={label} placeholder="Seleziona giocatore" data={options} value={assignments[key] ? String(assignments[key]) : null} onChange={(value) => setAssignments((current) => ({ ...current, [key]: value ? Number(value) : null }))} clearable searchable />)}</SimpleGrid>
        {!isComplete && <Alert color="yellow">Assegna tutti i sette ruoli prima di salvare.</Alert>}
        {duplicatePlayerIds.length > 0 && <Alert color="red">Ogni giocatore può occupare un solo ruolo nello schieramento.</Alert>}
        {error && <Alert color="red">{error}</Alert>}
        <Group><Button type="submit" loading={saving} disabled={!isValid}>{editingId ? "Aggiorna formazione" : "Salva formazione"}</Button>{editingId && <Button variant="subtle" onClick={reset}>Annulla</Button>}</Group>
      </Stack></form></Card>
      <FormationPitch assignments={assignments} players={players} />
    </SimpleGrid>
    <Stack gap="sm"><Title order={4}>Formazioni salvate</Title>
      {formations.length === 0 ? <Text c="dimmed">Non hai ancora creato una formazione.</Text> : formations.map((formation) => {
        const formationPlayerIds = Object.values(formation.assignments).filter((id): id is number => id !== null);
        return <Card key={formation.id} withBorder padding="md"><Group justify="space-between" align="flex-start"><div><Group gap="xs"><Text fw={700}>{formation.name}</Text><Badge variant="light" color={formationPlayerIds.length === 7 ? "green" : "yellow"}>{formationPlayerIds.length}/7</Badge></Group><Text size="sm" c="dimmed">{slots.map(([key, label]) => { const player = players.find((item) => item.id === formation.assignments[key]); return player ? `${label}: ${player.name}` : null; }).filter(Boolean).join(" · ")}</Text></div><Group gap="xs"><ActionIcon variant="subtle" onClick={() => void duplicate(formation)} aria-label="Duplica formazione"><IconCopy size={18} /></ActionIcon><ActionIcon variant="subtle" onClick={() => edit(formation)} aria-label="Modifica formazione"><IconPencil size={18} /></ActionIcon><ActionIcon color="red" variant="subtle" onClick={() => void remove(formation)} aria-label="Elimina formazione"><IconTrash size={18} /></ActionIcon></Group></Group></Card>;
      })}
    </Stack>
  </Stack>;
}
