import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { EventTypeDef, GoogleStatus } from "../types";

function apiErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error ?? fallback
  );
}

export default function Settings() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [newType, setNewType] = useState({
    key: "",
    label: "",
    icon: "⚽",
    hasOpponent: false,
  });
  const [typeError, setTypeError] = useState<string | null>(null);

  const [templateDocId, setTemplateDocId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([api.getGoogleStatus(), api.getEventTypes(), api.getSettings()])
      .then(([statusRes, typesRes, settingsRes]) => {
        setStatus(statusRes.data);
        setEventTypes(typesRes.data);
        setTemplateDocId(settingsRes.data.googleTemplateDocId ?? "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await api.getGoogleAuthUrl();
      // Apre l'URL di consenso Google in una nuova scheda: il redirect_uri
      // punta alla porta diretta dell'addon (fuori dall'iframe di Ingress).
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          "Errore durante la richiesta dell'URL di autorizzazione",
        ),
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await api.disconnectGoogle();
    loadAll();
  }

  async function handleAddType(e: React.FormEvent) {
    e.preventDefault();
    setTypeError(null);
    try {
      await api.createEventType({
        key: newType.key.trim(),
        label: newType.label.trim(),
        icon: newType.icon.trim() || "⚽",
        hasOpponent: newType.hasOpponent,
        sortOrder: eventTypes.length,
      });
      setNewType({ key: "", label: "", icon: "⚽", hasOpponent: false });
      loadAll();
    } catch (err) {
      setTypeError(apiErrorMessage(err, "Errore durante la creazione del tipo"));
    }
  }

  async function handleToggleOpponent(type: EventTypeDef) {
    await api.updateEventType(type.id, { hasOpponent: !type.hasOpponent });
    loadAll();
  }

  async function handleDeleteType(type: EventTypeDef) {
    setTypeError(null);
    try {
      await api.deleteEventType(type.id);
      loadAll();
    } catch (err) {
      setTypeError(
        apiErrorMessage(err, "Errore durante l'eliminazione del tipo"),
      );
    }
  }

  async function handleSaveTemplate() {
    setSavingTemplate(true);
    setTemplateSaved(false);
    try {
      await api.updateSettings({
        googleTemplateDocId: templateDocId.trim() || null,
      });
      setTemplateSaved(true);
    } finally {
      setSavingTemplate(false);
    }
  }

  if (loading) return <Loader />;

  return (
    <Stack gap="xl">
      <Title order={4}>Impostazioni</Title>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Title order={5}>Google (Docs + Drive)</Title>
          <Text size="sm" c="dimmed">
            Collega il tuo account Google per generare automaticamente il
            documento delle comunicazioni ai genitori.
          </Text>

          {!status?.configured && (
            <Alert color="orange" title="Configurazione mancante">
              Client ID/Secret Google non configurati: impostali nelle opzioni
              dell'addon (Impostazioni → Add-on → GIPS Calcio →
              Configurazione).
            </Alert>
          )}

          {status?.configured && (
            <Group>
              <Badge color={status.connected ? "green" : "gray"}>
                {status.connected ? "Collegato" : "Non collegato"}
              </Badge>
              {status.connected ? (
                <Button
                  color="red"
                  variant="subtle"
                  size="sm"
                  onClick={handleDisconnect}
                >
                  Disconnetti
                </Button>
              ) : (
                <Button size="sm" onClick={handleConnect} loading={connecting}>
                  Collega Google
                </Button>
              )}
            </Group>
          )}

          {error && (
            <Alert color="red" title="Errore">
              {error}
            </Alert>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Title order={5}>Template Google Doc (opzionale)</Title>
          <Text size="sm" c="dimmed">
            Incolla il link (o l'id) di un Google Doc con i placeholder{" "}
            <code>{"{{TITOLO}}"}</code>, <code>{"{{SETTIMANA}}"}</code>,{" "}
            <code>{"{{PARTITE}}"}</code> e <code>{"{{ALLENAMENTI}}"}</code>. Se
            lasciato vuoto, il documento viene generato automaticamente senza
            template.
          </Text>
          <Group align="flex-end">
            <TextInput
              placeholder="https://docs.google.com/document/d/..."
              value={templateDocId}
              onChange={(e) => {
                setTemplateDocId(e.currentTarget.value);
                setTemplateSaved(false);
              }}
              style={{ flex: 1 }}
            />
            <Button onClick={handleSaveTemplate} loading={savingTemplate}>
              Salva
            </Button>
          </Group>
          {templateSaved && (
            <Text size="sm" c="green">
              Salvato.
            </Text>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Title order={5}>Tipi di evento</Title>
          <Text size="sm" c="dimmed">
            Gestisci i tipi disponibili nel calendario (es. Allenamento,
            Partita, Torneo, Amichevole…). "Ha avversario" mostra il campo
            avversario e le convocazioni per quel tipo.
          </Text>

          {typeError && (
            <Alert color="red" title="Errore">
              {typeError}
            </Alert>
          )}

          <Stack gap="xs">
            {eventTypes.map((type) => (
              <Group key={type.id} justify="space-between" wrap="nowrap">
                <Text>
                  {type.icon} {type.label}{" "}
                  <Text span c="dimmed" size="sm">
                    ({type.key})
                  </Text>
                </Text>
                <Group gap="xs" wrap="nowrap">
                  <Checkbox
                    label="Ha avversario"
                    checked={type.hasOpponent}
                    onChange={() => handleToggleOpponent(type)}
                  />
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleDeleteType(type)}
                    aria-label="Elimina tipo"
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
          </Stack>

          <Divider label="Nuovo tipo" labelPosition="left" />

          <form onSubmit={handleAddType}>
            <Group align="flex-end">
              <TextInput
                label="Chiave"
                placeholder="es. friendly"
                required
                value={newType.key}
                onChange={(e) =>
                  setNewType({ ...newType, key: e.currentTarget.value })
                }
                style={{ width: 130 }}
              />
              <TextInput
                label="Nome"
                placeholder="es. Amichevole"
                required
                value={newType.label}
                onChange={(e) =>
                  setNewType({ ...newType, label: e.currentTarget.value })
                }
                style={{ flex: 1 }}
              />
              <TextInput
                label="Icona"
                value={newType.icon}
                onChange={(e) =>
                  setNewType({ ...newType, icon: e.currentTarget.value })
                }
                style={{ width: 80 }}
              />
              <Checkbox
                label="Ha avversario"
                mb={8}
                checked={newType.hasOpponent}
                onChange={(e) =>
                  setNewType({
                    ...newType,
                    hasOpponent: e.currentTarget.checked,
                  })
                }
              />
              <Button type="submit">Aggiungi</Button>
            </Group>
          </form>
        </Stack>
      </Card>
    </Stack>
  );
}

