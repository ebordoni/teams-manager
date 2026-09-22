import {
  ActionIcon,
  Alert,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconExternalLink, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Communication } from "../types";

export default function Communications() {
  const [items, setItems] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .getCommunications()
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(item: Communication) {
    if (!window.confirm(`Eliminare "${item.title}"? Verrà rimosso anche il documento da Google Drive.`)) {
      return;
    }
    setError(null);
    setDeletingId(item.id);
    try {
      await api.deleteCommunication(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Errore durante l'eliminazione";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Stack gap="md">
      <Title order={4}>Comunicazioni</Title>

      {error && (
        <Alert color="red" title="Errore">
          {error}
        </Alert>
      )}

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Text c="dimmed">
          Nessuna comunicazione generata finora. Vai su Calendario, seleziona
          gli eventi e premi "Genera comunicazione".
        </Text>
      ) : (
        <Stack gap="xs">
          {items.map((item) => (
            <Card key={item.id} withBorder padding="sm" radius="md">
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text fw={600}>{item.title}</Text>
                  <Text size="sm" c="dimmed">
                    {new Date(item.createdAt).toLocaleString("it-IT")}
                  </Text>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <ActionIcon
                    component="a"
                    href={item.googleDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="subtle"
                    aria-label="Apri documento"
                  >
                    <IconExternalLink size={18} />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    loading={deletingId === item.id}
                    onClick={() => handleDelete(item)}
                    aria-label="Elimina"
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
