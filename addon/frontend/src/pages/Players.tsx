import {
  ActionIcon,
  Button,
  Card,
  Collapse,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  MultiSelect,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Player } from "../types";

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createPlayer({ name: name.trim(), role: roles[0] ?? null, secondaryRoles: roles.slice(1) });
    setName("");
    setRoles([]);
    closeForm();
    loadPlayers();
  }

  async function handleDelete(id: number) {
    await api.deletePlayer(id);
    loadPlayers();
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Giocatori</Title>
        <Button onClick={toggleForm}>
          {showForm ? "Annulla" : "+ Nuovo giocatore"}
        </Button>
      </Group>

      <Collapse expanded={showForm}>
        <Card withBorder padding="md" radius="md">
          <form onSubmit={handleSubmit}>
            <Group align="flex-end">
              <TextInput
                label="Nome"
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <MultiSelect
                label="Ruoli"
                data={["Portiere", "Difensore", "Centrocampista", "Esterno", "Attaccante"]}
                value={roles}
                onChange={setRoles}
                searchable
                style={{ flex: 1 }}
              />
              <Button type="submit">Salva</Button>
            </Group>
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
              <Group justify="space-between">
                <Text>
                  <Text span fw={600}>
                    {player.name}
                  </Text>
                  {(player.role || player.secondaryRoles.length > 0) && (
                    <Text span c="dimmed" ml="xs">
                      {[player.role, ...player.secondaryRoles].filter(Boolean).join(", ")}
                    </Text>
                  )}
                </Text>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => handleDelete(player.id)}
                  aria-label="Elimina"
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
