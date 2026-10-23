import { Alert, Button, Card, Checkbox, Group, PasswordInput, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { NotionStatus } from "../types";

export default function NotionSettings() {
  const [status, setStatus] = useState<NotionStatus | null>(null);
  const [form, setForm] = useState({ token: "", page: "", publicUrl: "", active: true, mode: "database" as "page" | "database" });
  const [busy, setBusy] = useState<"save" | "verify" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ color: "red" | "green"; text: string } | null>(null);
  const report = (error: unknown) => setMessage({ color: "red", text: (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Operazione Notion non riuscita." });
  useEffect(() => {
    api.getNotionSettings().then(({ data }) => {
      setStatus(data);
      setForm({ token: "", page: data.pageUrl, publicUrl: data.publicUrl, active: data.configured ? data.active : true, mode: data.configured ? data.mode : "database" });
    }).catch(report);
  }, []);
  function change(next: Partial<typeof form>) { setForm((current) => ({ ...current, ...next })); setDirty(true); setMessage(null); }
  async function save() {
    setBusy("save"); setMessage(null);
    try {
      const { data } = await api.saveNotionSettings({ ...form, token: form.token || undefined });
      setStatus(data); setForm({ token: "", page: data.pageUrl, publicUrl: data.publicUrl, active: data.active, mode: data.mode }); setDirty(false);
      setMessage({ color: "green", text: "Configurazione salvata. Verifica l'accesso, poi usa Aggiorna ora in Comunicazioni per pubblicare gli appuntamenti." });
    } catch (error) { report(error); } finally { setBusy(null); }
  }
  async function verify() {
    setBusy("verify"); setMessage(null);
    try { const { data } = await api.verifyNotion(); setMessage({ color: "green", text: data.message }); }
    catch (error) { report(error); } finally { setBusy(null); }
  }
  return <Card withBorder padding="md" radius="md"><Stack gap="sm">
    <Title order={5}>Notion · Appuntamenti</Title>
    <Text size="sm" c="dimmed">Crea una connessione interna Notion con permessi di lettura, inserimento e aggiornamento, poi aggiungila alla pagina o al database dal menu Connessioni.</Text>
    <Select label="Visualizzazione appuntamenti" value={form.mode} allowDeselect={false} data={[{ value: "database", label: "Calendario ed elenco (database)" }, { value: "page", label: "Pagina unica con appuntamenti" }]} onChange={(value) => change({ mode: value === "database" ? "database" : "page" })} />
    <Text size="sm" c="dimmed">{form.mode === "database" ? "Ogni evento ha una scheda aggiornata dall'app. Collega un database dedicato con una sola origine dati; le voci manuali non vengono rimosse. Al primo aggiornamento vengono aggiunte le proprietà necessarie." : "Usa una pagina dedicata: il contenuto viene sostituito a ogni pubblicazione."}</Text>
    <Text component="a" href="https://www.notion.so/profile/integrations" target="_blank" rel="noopener noreferrer" size="sm">Gestisci le connessioni Notion</Text>
    <PasswordInput label="Token della connessione interna" placeholder={status?.configured ? "Token salvato · lascia vuoto per mantenerlo" : "Inserisci il token Notion"} value={form.token} onChange={(event) => change({ token: event.currentTarget.value })} autoComplete="off" />
    <TextInput label={form.mode === "database" ? "Database Notion" : "Pagina Notion"} description="Incolla il link nel workspace oppure il suo ID." value={form.page} onChange={(event) => change({ page: event.currentTarget.value })} />
    <TextInput label="Link pubblico da condividere" description="Facoltativo. Copialo da Notion dopo Condividi → Pubblica: è diverso dal link del workspace." value={form.publicUrl} onChange={(event) => change({ publicUrl: event.currentTarget.value })} />
    <Checkbox label="Usa Notion per gli appuntamenti" description="Sostituisce l'aggiornamento del Google Doc. Google Calendar e i piani partita restano disponibili." checked={form.active} onChange={(event) => change({ active: event.currentTarget.checked })} />
    {form.mode === "database" && <Alert color="blue">In Notion aggiungi una vista Elenco ordinata per data crescente e una vista Calendario basata sulla proprietà data del database. Le due viste mostrano gli stessi appuntamenti. Il link pubblico si configura da Notion.</Alert>}
    <Group><Button onClick={save} loading={busy === "save"} disabled={!status || busy === "verify" || !form.page.trim()}>Salva</Button><Button variant="light" onClick={verify} loading={busy === "verify"} disabled={!status?.configured || dirty || busy === "save"}>Verifica accesso</Button></Group>
    {message && <Alert color={message.color}>{message.text}</Alert>}
  </Stack></Card>;
}
