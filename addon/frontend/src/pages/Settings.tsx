import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import {
  EventTypeIcon,
  EventTypeIconPicker,
} from "../components/EventTypeIcon";
import PageLoader from "../components/PageLoader";
import type { EventTypeDef, GoogleStatus } from "../types";

function apiErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error ?? fallback
  );
}

/** Rispecchia la normalizzazione applicata dal backend (vedi routes/event-types.ts). */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function Settings() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventTypes, setEventTypes] = useState<EventTypeDef[]>([]);
  const [newType, setNewType] = useState({
    label: "",
    icon: "IconBallFootball",
    hasOpponent: false,
  });
  const [typeError, setTypeError] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<EventTypeDef | null>(null);

  const [templateDocId, setTemplateDocId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [calendarId, setCalendarId] = useState("primary");
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [testingCalendar, setTestingCalendar] = useState(false);
  const [calendarTest, setCalendarTest] = useState<{ color: "green" | "red"; message: string } | null>(null);
  const [teamName, setTeamName] = useState("");
  const [savingTeamName, setSavingTeamName] = useState(false);
  const [teamNameSaved, setTeamNameSaved] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([api.getGoogleStatus(), api.getEventTypes(), api.getSettings()])
      .then(([statusRes, typesRes, settingsRes]) => {
        setStatus(statusRes.data);
        setEventTypes(typesRes.data);
        setTemplateDocId(settingsRes.data.googleTemplateDocId ?? "");
        setCalendarId(settingsRes.data.googleCalendarId);
        setTeamName(settingsRes.data.teamName);
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
    const label = newType.label.trim();
    const key = slugify(label);
    if (!key) {
      setTypeError("Inserisci un nome valido");
      return;
    }
    try {
      await api.createEventType({
        key,
        label,
        icon: newType.icon.trim() || "IconBallFootball",
        hasOpponent: newType.hasOpponent,
        sortOrder: eventTypes.length,
      });
      setNewType({ label: "", icon: "IconBallFootball", hasOpponent: false });
      loadAll();
    } catch (err) {
      setTypeError(
        apiErrorMessage(err, "Errore durante la creazione del tipo"),
      );
    }
  }

  async function handleToggleOpponent(type: EventTypeDef) {
    await api.updateEventType(type.id, { hasOpponent: !type.hasOpponent });
    loadAll();
  }

  async function handleSaveType(e: React.FormEvent) {
    e.preventDefault();
    if (!editingType) return;
    setTypeError(null);
    try {
      await api.updateEventType(editingType.id, {
        label: editingType.label.trim(),
        icon: editingType.icon.trim() || "IconBallFootball",
        hasOpponent: editingType.hasOpponent,
      });
      setEditingType(null);
      loadAll();
    } catch (err) {
      setTypeError(
        apiErrorMessage(err, "Errore durante il salvataggio del tipo"),
      );
    }
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

  async function handleSaveCalendar() {
    setSavingCalendar(true);
    setCalendarTest(null);
    try {
      await api.updateSettings({
        googleCalendarId: calendarId.trim() || "primary",
      });
      setCalendarId(calendarId.trim() || "primary");
    } finally {
      setSavingCalendar(false);
    }
  }

  async function handleTestCalendar() {
    setTestingCalendar(true);
    setCalendarTest(null);
    try {
      const response = await api.verifyGoogleCalendar(calendarId.trim() || "primary");
      setCalendarTest({
        color: "green",
        message: `Accesso verificato per il calendario “${response.data.calendarId}”.`,
      });
    } catch (err) {
      setCalendarTest({
        color: "red",
        message: apiErrorMessage(
          err,
          "Impossibile verificare l'accesso al calendario.",
        ),
      });
    } finally {
      setTestingCalendar(false);
    }
  }

  async function handleSaveTeamName() {
    const nextTeamName = teamName.trim();
    if (!nextTeamName) return;
    setSavingTeamName(true);
    setTeamNameSaved(false);
    try {
      const response = await api.updateSettings({ teamName: nextTeamName });
      setTeamName(response.data.teamName);
      setTeamNameSaved(true);
    } finally {
      setSavingTeamName(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <Stack gap="xl">
      <Title order={4}>Impostazioni</Title>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Title order={5}>Squadra</Title>
          <Text size="sm" c="dimmed">
            Il nome viene usato nelle pagine partita e nelle comunicazioni per i genitori.
          </Text>
          <Group align="flex-end">
            <TextInput
              label="Nome squadra"
              required
              maxLength={100}
              value={teamName}
              onChange={(event) => {
                setTeamName(event.currentTarget.value);
                setTeamNameSaved(false);
              }}
              style={{ flex: 1 }}
            />
            <Button onClick={handleSaveTeamName} loading={savingTeamName} disabled={!teamName.trim()}>
              Salva
            </Button>
          </Group>
          {teamNameSaved && <Text size="sm" c="green">Nome squadra salvato.</Text>}
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Title order={5}>Google (Docs, Drive e Calendar)</Title>
          <Text size="sm" c="dimmed">
            Collega il tuo account Google per generare automaticamente il
            documento delle comunicazioni ai genitori.
          </Text>

          {!status?.configured && (
            <Alert color="orange" title="Configurazione mancante">
              Client ID/Secret Google non configurati: impostali nelle opzioni
              dell'addon (Impostazioni → Add-on → Teams Manager →
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
          {status?.connected && !status.calendarConnected && (
            <Alert color="blue" title="Autorizzazione Calendar necessaria">
              Ricollega Google per abilitare l'esportazione unidirezionale degli
              eventi su Google Calendar.
            </Alert>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Title order={5}>Google Calendar</Title>
          <Text size="sm" c="dimmed">
            L'esportazione dalla pagina Calendario è manuale e unidirezionale:
            ripetendola, gli eventi già esportati vengono aggiornati. Non
            importiamo né eliminiamo eventi da Google Calendar.
          </Text>
          <Group align="flex-end">
            <TextInput
              label="ID calendario"
              description={
                'Usa "primary" per il calendario principale, oppure l\'ID di un calendario condiviso.'
              }
              value={calendarId}
              onChange={(e) => setCalendarId(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={handleSaveCalendar} loading={savingCalendar}>Salva</Button>
            <Button variant="light" onClick={handleTestCalendar} loading={testingCalendar}>
              Verifica accesso
            </Button>
          </Group>
          {calendarTest && <Alert color={calendarTest.color} title={calendarTest.color === "green" ? "Calendario raggiungibile" : "Verifica non riuscita"}>{calendarTest.message}</Alert>}
          <Text size="xs" c="dimmed">
            Se la verifica fallisce, controlla l'ID e che il calendario sia
            condiviso con l'account Google collegato. Dopo aver cambiato gli
            scope o le credenziali, disconnetti e ricollega Google.
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Title order={5}>Template Google Doc (opzionale)</Title>
          <Text size="sm" c="dimmed">
            Incolla il link (o l'id) di un Google Doc con i placeholder{" "}
            <code>{"{{TITOLO}}"}</code>, <code>{"{{SETTIMANA}}"}</code>,{" "}
            <code>{"{{PARTITE}}"}</code>, <code>{"{{ALLENAMENTI}}"}</code>,{" "}
            <code>{"{{FORMAZIONI}}"}</code> e <code>{"{{PRESENZE}}"}</code>. Se
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
            avversario per quel tipo. L’icona è ricercabile e viene mostrata in
            anteprima prima del salvataggio.
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
                  <EventTypeIcon name={type.icon} /> {type.label}{" "}
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
                    variant="subtle"
                    onClick={() => setEditingType({ ...type })}
                    aria-label="Modifica tipo"
                  >
                    <IconPencil size={18} />
                  </ActionIcon>
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

          {editingType && (
            <form onSubmit={handleSaveType}>
              <Card withBorder padding="sm" radius="sm">
                <Stack gap="xs">
                  <Text fw={600}>Modifica tipo: {editingType.key}</Text>
                  <Group align="flex-end">
                    <TextInput
                      label="Nome"
                      required
                      value={editingType.label}
                      onChange={(e) =>
                        setEditingType({
                          ...editingType,
                          label: e.currentTarget.value,
                        })
                      }
                      style={{ flex: 1 }}
                    />
                    <EventTypeIconPicker
                      label="Icona"
                      value={editingType.icon}
                      onChange={(icon) =>
                        setEditingType({
                          ...editingType,
                          icon: icon ?? "IconBallFootball",
                        })
                      }
                      style={{ width: 180 }}
                    />
                    <Checkbox
                      label="Ha avversario"
                      mb={8}
                      checked={editingType.hasOpponent}
                      onChange={(e) =>
                        setEditingType({
                          ...editingType,
                          hasOpponent: e.currentTarget.checked,
                        })
                      }
                    />
                    <Button type="submit">Salva</Button>
                    <Button
                      variant="subtle"
                      onClick={() => setEditingType(null)}
                    >
                      Annulla
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </form>
          )}

          <Divider label="Nuovo tipo" labelPosition="left" />

          <form onSubmit={handleAddType}>
            <Group align="flex-end">
              <TextInput
                label="Nome"
                description={
                  newType.label.trim()
                    ? `Chiave: ${slugify(newType.label)}`
                    : undefined
                }
                placeholder="es. Amichevole"
                required
                value={newType.label}
                onChange={(e) =>
                  setNewType({ ...newType, label: e.currentTarget.value })
                }
                style={{ flex: 1 }}
              />
              <EventTypeIconPicker
                label="Icona"
                value={newType.icon}
                onChange={(icon) =>
                  setNewType({ ...newType, icon: icon ?? "IconBallFootball" })
                }
                style={{ width: 180 }}
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
