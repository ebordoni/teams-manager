import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { IconExternalLink, IconFilePlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import type { Communication, LiveCommunication } from "../types";
import { formatDisplayDateTime } from "../utils/date";
import { Link } from "react-router-dom";

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
    const confirmPublic = live?.provider === "website" && !live.published;
    if (confirmPublic && !window.confirm("Pubblicare gli appuntamenti reali sul sito pubblico? Sostituirà il prototipo. Controlla l'anteprima e le note eventualmente abilitate nelle Impostazioni prima di continuare.")) return;
    setError(null);
    setRefreshing(true);
    try {
      const response = await api.refreshLiveCommunication(confirmPublic);
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
      if (live?.provider === "google" && item.googleDocId === live.documentId) setLive(null);
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
      <PageHeader title="Comunicazioni" description="Pubblica e aggiorna gli appuntamenti della squadra." action={<Button component={Link} to="/settings" variant="light">Configura integrazioni</Button>} />

      {error && <Alert color="red" title="Errore">{error}</Alert>}
      {live?.lastError && !live.requiresPageSetup && !error && <Alert color="red" title="Ultimo aggiornamento non riuscito">{live.lastError}</Alert>}
      {live?.requiresPageSetup && <Alert color="orange" title="Collega una pagina per l'agenda">Il precedente database Notion rimane intatto e non viene più aggiornato. In <Text component={Link} to="/settings" inherit td="underline">Impostazioni → Integrazioni</Text> collega una pagina normale, poi usa Aggiorna ora. Il token già salvato viene mantenuto.</Alert>}

      {loading ? <Loader /> : (
        <>
          <Card withBorder padding="md" radius="md">
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Text fw={600}>{live?.provider === "website" ? "Sito pubblico · Appuntamenti" : live?.provider === "notion" ? "Agenda Notion · Appuntamenti" : "Documento appuntamenti"}</Text>
                  <Text size="sm" c="dimmed">
                    {live?.requiresPageSetup ? "Aggiornamenti sospesi: collega una pagina Notion nelle Impostazioni." : live?.updatedAt
                      ? `Ultimo aggiornamento: ${formatDisplayDateTime(live.updatedAt)}`
                      : live?.provider === "website" ? "Configurazione salvata. Verifica l'anteprima nelle Impostazioni, poi pubblica." : live?.provider === "notion" ? "Pagina collegata. Pubblica gli appuntamenti con Aggiorna ora." : "Crea il documento unico da condividere con la squadra."}
                  </Text>
                </div>
                <Group gap="xs">
                  {live?.url && (
                    <Button component="a" href={live.url} target="_blank" rel="noopener noreferrer" variant="light" leftSection={<IconExternalLink size={16} />}>
                      {live.provider === "website" ? "Apri sito" : live.provider === "notion" ? "Apri in Notion" : "Apri documento"}
                    </Button>
                  )}
                  {live?.provider === "notion" && !live.requiresPageSetup && live.publicUrl && <Button component="a" href={live.publicUrl} target="_blank" rel="noopener noreferrer" variant="light">Apri pagina pubblica</Button>}
                  <Button onClick={handleRefresh} loading={refreshing} disabled={live?.requiresPageSetup} leftSection={<IconRefresh size={16} />}>
                    {live?.provider === "website" && !live.published ? "Pubblica sito" : live ? "Aggiorna ora" : "Crea documento"}
                  </Button>
                  {live?.provider === "google" && (
                    <Button color="orange" variant="light" onClick={handleRecreate} loading={recreating} leftSection={<IconFilePlus size={16} />}>
                      Ricrea documento
                    </Button>
                  )}
                </Group>
              </Group>
              <Text size="sm" c="dimmed">
                {live?.provider === "website" ? live.autoSync ? "Aggiornamenti automatici attivi dopo le modifiche agli eventi e ogni giorno alle 03:05. " : "Gli aggiornamenti automatici si attivano dopo la prima pubblicazione, se abilitati nelle Impostazioni. " : "Lo stesso link viene aggiornato automaticamente dopo ogni modifica agli eventi e ogni giorno alle 03:05. "}Restano gli appuntamenti da oggi in avanti e soltanto l'ultimo passato, in grigio e barrato{live?.provider !== "google" ? " in fondo all'agenda" : ""}.
              </Text>
              {live?.provider === "notion" && !live.requiresPageSetup && <Alert color="blue">Il prossimo appuntamento è in evidenza e tutti i dettagli sono visibili nell'elenco, senza aprire schede. Aggiorna ora sostituisce l'intero contenuto della pagina e ripristina anche una pagina svuotata: le modifiche manuali vengono sovrascritte. Dopo la prima pubblicazione riuscita si attivano gli aggiornamenti automatici.</Alert>}
              {live?.provider === "notion" && !live.requiresPageSetup && !live.publicUrl && <Text size="sm" c="dimmed">Per condividere con i genitori, pubblica la pagina da Notion e salva il link pubblico nelle Impostazioni.</Text>}
              {live?.provider === "website" && <Alert color="blue">Il sito usa il Worker Cloudflare configurato e mantiene lo stesso link. Aggiorna ora sostituisce tutte le pagine gestite dall'app; le modifiche effettuate direttamente su Cloudflare vengono sovrascritte. Nomi dei giocatori e presenze non sono pubblicati. Per controllare i contenuti apri Anteprima home in Impostazioni → Integrazioni.</Alert>}
            </Stack>
          </Card>

          {items.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" fw={600}>Documenti precedenti</Text>
              {items.filter((item) => live?.provider !== "google" || item.googleDocId !== live.documentId).map((item) => (
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
