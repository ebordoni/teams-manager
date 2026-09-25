import {
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { EventTypeDef } from "../types";
import { EventTypeIcon } from "./EventTypeIcon";

interface FormState {
  type: string;
  date: Date | null;
  startTime: string;
  endTime: string;
  meetingTime: string;
  location: string;
  opponent: string;
  venue: "home" | "away" | "neutral";
  notes: string;
  repeatWeekly: boolean;
  recurrenceEndDate: Date | null;
}

const EMPTY_FORM: FormState = {
  type: "",
  date: null,
  startTime: "",
  endTime: "",
  meetingTime: "",
  location: "",
  opponent: "",
  venue: "home",
  notes: "",
  repeatWeekly: false,
  recurrenceEndDate: null,
};

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, index) => {
  const hours = String(Math.floor(index / 12)).padStart(2, "0");
  const minutes = String((index % 12) * 5).padStart(2, "0");
  const value = `${hours}:${minutes}`;
  return { value, label: value };
});

interface EventCreationModalProps {
  opened: boolean;
  eventTypes: EventTypeDef[];
  initialDate: string | null;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Stato e rendering del form restano isolati dal calendario mensile: digitare
 * in un input non deve ridisegnare le celle, l'agenda e le sue anteprime.
 */
export default function EventCreationModal({
  opened,
  eventTypes,
  initialDate,
  onClose,
  onCreated,
}: EventCreationModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setForm({
      ...EMPTY_FORM,
      type: eventTypes[0]?.key ?? "",
      date: initialDate ? dayjs(initialDate).toDate() : null,
    });
  }, [opened, initialDate, eventTypes]);

  const selectedType = eventTypes.find((type) => type.key === form.type);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.date) return;
    if (form.repeatWeekly && !form.recurrenceEndDate) {
      notifications.show({ color: "red", message: "Seleziona la data finale della ricorrenza" });
      return;
    }

    const newEvent = {
      type: form.type,
      date: dayjs(form.date).format("YYYY-MM-DD"),
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      meetingTime: form.meetingTime || null,
      location: form.location || null,
      opponent: selectedType?.hasOpponent ? form.opponent || null : null,
      venue: form.venue,
      notes: form.notes || null,
    };

    setSaving(true);
    try {
      if (form.repeatWeekly && form.recurrenceEndDate) {
        const response = await api.createRecurringEvent({
          ...newEvent,
          recurrence: { frequency: "weekly", until: dayjs(form.recurrenceEndDate).format("YYYY-MM-DD") },
        });
        notifications.show({ color: "green", message: `Creati ${response.data.created.length} appuntamenti settimanali` });
      } else {
        await api.createEvent(newEvent);
        notifications.show({ color: "green", message: "Evento creato" });
      }
      onClose();
      onCreated();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      notifications.show({ color: "red", message: message ?? "Impossibile creare l'evento" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Crea evento" size="lg" centered>
      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs value={form.type} onChange={(value) => setForm((current) => ({ ...current, type: value ?? current.type }))} variant="pills">
            <Tabs.List style={{ flexWrap: "nowrap", overflowX: "auto", overflowY: "hidden" }}>
              {eventTypes.map((type) => (
                <Tabs.Tab key={type.key} value={type.key} leftSection={<EventTypeIcon name={type.icon} size={16} />} style={{ flex: "0 0 auto" }}>
                  {type.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          <Textarea label="Descrizione" placeholder="Aggiungi informazioni sull'evento" minRows={3} autosize value={form.notes} onChange={(event) => {
            const notes = event.currentTarget.value;
            setForm((current) => ({ ...current, notes }));
          }} />

          {selectedType?.hasOpponent && (
            <TextInput label="Avversario" placeholder="Nome della squadra avversaria" value={form.opponent} onChange={(event) => {
              const opponent = event.currentTarget.value;
              setForm((current) => ({ ...current, opponent }));
            }} />
          )}

          <Stack gap="sm">
            <Text fw={600}>Data e orari</Text>
            <div>
              <Text size="sm" fw={500} mb={6}>Durata dell'evento</Text>
              <Button.Group>
                <Button type="button" variant={!form.repeatWeekly ? "filled" : "default"} onClick={() => setForm((current) => ({ ...current, repeatWeekly: false, recurrenceEndDate: null }))}>Unico</Button>
                <Button type="button" variant={form.repeatWeekly ? "filled" : "default"} onClick={() => setForm((current) => ({ ...current, repeatWeekly: true }))}>Ricorrente</Button>
              </Button.Group>
            </div>
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
              <DateInput label="Data" required value={form.date} onChange={(value) => setForm((current) => ({ ...current, date: value ? new Date(value) : null }))} valueFormat="DD-MM-YYYY" />
              <Select label="Ora di inizio" placeholder="Non indicata" data={TIME_OPTIONS} value={form.startTime || null} onChange={(value) => setForm((current) => ({ ...current, startTime: value ?? "" }))} searchable clearable />
              <Select label="Ora di fine" placeholder="Non indicata" data={TIME_OPTIONS} value={form.endTime || null} onChange={(value) => setForm((current) => ({ ...current, endTime: value ?? "" }))} searchable clearable />
              <Select label="Ora di ritrovo" placeholder="Non indicata" data={TIME_OPTIONS} value={form.meetingTime || null} onChange={(value) => setForm((current) => ({ ...current, meetingTime: value ?? "" }))} searchable clearable />
            </SimpleGrid>
            {form.repeatWeekly && <DateInput label="Ripeti fino al" description="Ogni appuntamento potrà poi essere modificato singolarmente." required value={form.recurrenceEndDate} minDate={form.date ?? undefined} onChange={(value) => setForm((current) => ({ ...current, recurrenceEndDate: value ? new Date(value) : null }))} valueFormat="DD-MM-YYYY" maw={300} />}
          </Stack>

          <Stack gap="sm">
            <Text fw={600}>Luogo</Text>
            <div>
              <Text size="sm" fw={500} mb={6}>Sede della partita</Text>
              <Button.Group>
                <Button type="button" variant={form.venue === "home" ? "filled" : "default"} onClick={() => setForm((current) => ({ ...current, venue: "home" }))}>In casa</Button>
                <Button type="button" variant={form.venue === "away" ? "filled" : "default"} onClick={() => setForm((current) => ({ ...current, venue: "away" }))}>Trasferta</Button>
                <Button type="button" variant={form.venue === "neutral" ? "filled" : "default"} onClick={() => setForm((current) => ({ ...current, venue: "neutral" }))}>Neutro</Button>
              </Button.Group>
            </div>
            <TextInput label="Luogo dell'evento" placeholder="Es. Centro sportivo comunale" value={form.location} onChange={(event) => {
              const location = event.currentTarget.value;
              setForm((current) => ({ ...current, location }));
            }} />
          </Stack>

          <Group justify="flex-end" wrap="wrap-reverse">
            <Button type="button" variant="default" onClick={onClose}>Annulla</Button>
            <Button type="submit" loading={saving}>{form.repeatWeekly ? "Crea appuntamenti" : "Crea evento"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
