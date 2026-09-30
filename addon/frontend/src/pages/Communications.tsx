import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconExternalLink, IconFilePlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Communication, LiveCommunication } from "../types";
import { formatDisplayDateTime } from "../utils/date";

export default function Communications() {
  const [live, setLive] = useState<LiveCommunication | null>(null);
  const [items, setItems] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.getLiveCommunication(), api.getCommunications()])
      .then(([liveResponse, itemsResponse]) => {
        setLive(liveResponse.data);
        setItems(itemsResponse.data);
      })
      .catch(() => setError("Impossibile caricare le comunicazioni"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRefresh() {
    setError(null);
    setRefreshing(true);
    try {
      const response = await api.refreshLiveCommunication();
      setLive(response.data);
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Impossibile aggiornare il documento",
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRecreate() {
    if (!window.confirm("Ricreare il documento appuntamenti? Verrà generato un nuovo link da condividere.")) return;
    setError(null);
    setRecreating(true);
    try {
      const response = await api.recreateLiveCommunication();
      setLive(response.data);
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Impossibile ricreare il documento",
      );
    } finally {
      setRecreating(false);
    }
  }

  async function handleDelete(item: Communication) {
    if (!window.confirm(`Eliminare "${item.title}"? Verrà rimosso anche il documento da Google Drive.`)) return;
    setError(null);
    setDeletingId(item.id);
    try {
      await api.deleteCommunication(item.id);
      setItems((previous) => previous.filter((current) => current.id !== item.id));
      if (item.googleDocId === live?.googleDocId) setLive(null);
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Errore durante l'eliminazione",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Stack gap="md">
      <Title order={4}>Comunicazioni</Title>

      {error && <Alert color="red" title="Errore">{error}</Alert>}

      {loading ? <Loader /> : (
        <>
          <Card withBorder padding="md" radius="md">
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Text fw={600}>Documento appuntamenti</Text>
                  <Text size="sm" c="dimmed">
                    {live
                      ? `Ultimo aggiornamento: ${formatDisplayDateTime(live.updatedAt)}`
                      : "Crea il documento unico da condividere con la squadra."}
                  </Text>
                </div>
                <Group gap="xs">
                  {live && (
                    <Button component="a" href={live.googleDocUrl} target="_blank" rel="noopener noreferrer" variant="light" leftSection={<IconExternalLink size={16} />}>
                      Apri documento
                    </Button>
                  )}
                  <Button onClick={handleRefresh} loading={refreshing} leftSection={<IconRefresh size={16} />}>
                    {live ? "Aggiorna ora" : "Crea documento"}
                  </Button>
                  {live && (
                    <Button color="orange" variant="light" onClick={handleRecreate} loading={recreating} leftSection={<IconFilePlus size={16} />}>
                      Ricrea documento
                    </Button>
                  )}
                </Group>
              </Group>
              <Text size="sm" c="dimmed">
                Lo stesso link viene aggiornato automaticamente dopo ogni modifica agli eventi e ogni giorno alle 03:05. Il documento conserva soltanto l'ultimo appuntamento passato, in grigio e barrato, e quelli da oggi in avanti.
              </Text>
            </Stack>
          </Card>

          {items.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" fw={600}>Documenti precedenti</Text>
              {items.filter((item) => item.googleDocId !== live?.googleDocId).map((item) => (
                <Card key={item.id} withBorder padding="sm" radius="md">
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text fw={600}>{item.title}</Text>
                      <Text size="sm" c="dimmed">{formatDisplayDateTime(item.createdAt)}</Text>
                    </div>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon component="a" href={item.googleDocUrl} target="_blank" rel="noopener noreferrer" variant="subtle" aria-label="Apri documento"><IconExternalLink size={18} /></ActionIcon>
                      <ActionIcon color="red" variant="subtle" loading={deletingId === item.id} onClick={() => handleDelete(item)} aria-label="Elimina"><IconTrash size={18} /></ActionIcon>
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
