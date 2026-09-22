import { ActionIcon, Button, Card, Group, Loader, Select, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Formation, Player } from "../types";

const slots = [
  ["portiere", "Portiere"], ["difensoreSinistro", "Difensore sinistro"], ["difensoreDestro", "Difensore destro"],
  ["centrale", "Centrocampista centrale"], ["fasciaSinistra", "Fascia sinistra"], ["fasciaDestra", "Fascia destra"], ["attaccante", "Attaccante"],
] as const;
const emptyAssignments = () => Object.fromEntries(slots.map(([key]) => [key, null])) as Record<string, number | null>;

export default function Formations() {
  const [players, setPlayers] = useState<Player[]>([]); const [formations, setFormations] = useState<Formation[]>([]); const [name, setName] = useState("Formazione 2-3-1"); const [assignments, setAssignments] = useState(emptyAssignments()); const [editingId, setEditingId] = useState<number | null>(null); const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); Promise.all([api.getPlayers(), api.getFormations()]).then(([p, f]) => { setPlayers(p.data); setFormations(f.data); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const options = players.map((p) => ({ value: String(p.id), label: `${p.name}${p.secondaryRoles.length ? ` · ${p.secondaryRoles.join(", ")}` : ""}` }));
  const save = async (e: React.FormEvent) => { e.preventDefault(); if (editingId) await api.updateFormation(editingId, { name, assignments }); else await api.createFormation({ name, assignments }); setAssignments(emptyAssignments()); setName("Formazione 2-3-1"); setEditingId(null); load(); };
  if (loading) return <Loader />;
  return <Stack gap="md"><Title order={4}>Formazioni</Title><Text c="dimmed" size="sm">Schema base 2-3-1: portiere, due difensori, centrale, due fasce e attaccante.</Text>
    <Card withBorder><form onSubmit={save}><Stack><TextInput label="Nome formazione" value={name} onChange={(e) => setName(e.currentTarget.value)} required /><SimpleGrid cols={{ base: 1, sm: 2 }}>
      {slots.map(([key, label]) => <Select key={key} label={label} placeholder="Seleziona giocatore" data={options} value={assignments[key] ? String(assignments[key]) : null} onChange={(value) => setAssignments({ ...assignments, [key]: value ? Number(value) : null })} clearable />)}
    </SimpleGrid><Group><Button type="submit">{editingId ? "Aggiorna formazione" : "Salva formazione"}</Button>{editingId && <Button variant="subtle" onClick={() => { setEditingId(null); setAssignments(emptyAssignments()); setName("Formazione 2-3-1"); }}>Annulla</Button>}</Group></Stack></form></Card>
    {formations.map((formation) => <Card key={formation.id} withBorder><Group justify="space-between"><div><Text fw={600}>{formation.name}</Text><Text size="sm" c="dimmed">{slots.map(([key, label]) => { const player = players.find((p) => p.id === formation.assignments[key]); return player ? `${label}: ${player.name}` : null; }).filter(Boolean).join(" · ")}</Text></div><Group><ActionIcon onClick={() => { setEditingId(formation.id); setName(formation.name); setAssignments({ ...emptyAssignments(), ...formation.assignments }); }}><IconPencil size={18} /></ActionIcon><ActionIcon color="red" onClick={async () => { await api.deleteFormation(formation.id); load(); }}><IconTrash size={18} /></ActionIcon></Group></Group></Card>)}
  </Stack>;
}
