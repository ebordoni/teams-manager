import { Alert, Button, Card, Checkbox, Group, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { NotionStatus } from "../types";

function formFromStatus(status: NotionStatus) {
  return {
    token: "",
    page: status.requiresPageSetup ? "" : status.pageUrl,
    publicUrl: status.requiresPageSetup ? "" : status.publicUrl,
    active: status.configured ? status.active : true,
  };
}

export default function NotionSettings() {
  const [status, setStatus] = useState<NotionStatus | null>(null);
  const [form, setForm] = useState({ token: "", page: "", publicUrl: "", active: true });
  const [busy, setBusy] = useState<"save" | "verify" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ color: "red" | "green"; text: string } | null>(null);
  const report = (error: unknown) => setMessage({ color: "red", text: (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Operazione Notion non riuscita." });
  useEffect(() => {
    api.getNotionSettings().then(({ data }) => {
      setStatus(data);
      setForm(formFromStatus(data));
    }).catch(report);
    const refresh = () => { api.getNotionSettings().then(({ data }) => { setStatus(data); setForm((current) => ({ ...current, active: data.active })); }).catch(report); };
    window.addEventListener("communication-provider-changed", refresh);
    return () => window.removeEventListener("communication-provider-changed", refresh);
  }, []);
  function change(next: Partial<typeof form>) { setForm((current) => ({ ...current, ...next })); setDirty(true); setMessage(null); }
  async function save() {
    setBusy("save"); setMessage(null);
    try {
      const { data } = await api.saveNotionSettings({
        ...form,
        token: form.token || undefined,
        page: form.page.trim() || (!form.active && status?.requiresPageSetup ? status.pageUrl : ""),
      });
      setStatus(data); setForm(formFromStatus(data)); setDirty(false);
      window.dispatchEvent(new Event("communication-provider-changed"));
      setMessage({ color: "green", text: data.active
        ? "Configurazione salvata. Verifica l'accesso, poi usa Aggiorna ora in Comunicazioni per pubblicare l'agenda."
        : "Configurazione salvata. Notion non è la destinazione attiva." });
    } catch (error) { report(error); } finally { setBusy(null); }
  }
  async function verify() {
    setBusy("verify"); setMessage(null);
    try { const { data } = await api.verifyNotion(); setMessage({ color: "green", text: data.message }); }
    catch (error) { report(error); } finally { setBusy(null); }
  }
  return <Card withBorder padding="md" radius="md"><Stack gap="sm">
    <Title order={5}>Notion · Agenda della squadra</Title>
    <Text size="sm" c="dimmed">Collega una pagina Notion normale, dedicata agli appuntamenti. L'agenda mostra il prossimo evento in evidenza e tutti i dettagli direttamente nell'elenco, anche da smartphone.</Text>
    <Text size="sm" c="dimmed">Crea una connessione interna con permessi di lettura e aggiornamento, poi aggiungila alla pagina dal menu Connessioni. Il contenuto della pagina verrà sostituito a ogni pubblicazione.</Text>
    {status?.requiresPageSetup && <Alert color="orange" title="Collega una pagina per la nuova agenda">Il calendario su database non viene più aggiornato, ma rimane intatto su Notion. Crea una pagina normale oppure riutilizza la precedente pagina elenco e incolla qui il suo link. Il token già salvato viene mantenuto; dopo il salvataggio pubblica l'agenda da Comunicazioni.</Alert>}
    <Text component="a" href="https://www.notion.so/profile/integrations" target="_blank" rel="noopener noreferrer" size="sm">Gestisci le connessioni Notion</Text>
    <PasswordInput label="Token della connessione interna" placeholder={status?.configured ? "Token salvato · lascia vuoto per mantenerlo" : "Inserisci il token Notion"} value={form.token} onChange={(event) => change({ token: event.currentTarget.value })} autoComplete="off" disabled={busy !== null} />
    <TextInput label="Pagina Notion" description="Incolla il link della pagina nel workspace oppure il suo ID. Non usare un database." value={form.page} onChange={(event) => change({ page: event.currentTarget.value })} disabled={busy !== null} />
    <TextInput label="Link pubblico da condividere" description="Facoltativo. Copialo da Notion dopo Condividi → Pubblica: è diverso dal link del workspace." value={form.publicUrl} onChange={(event) => change({ publicUrl: event.currentTarget.value })} disabled={busy !== null} />
    <Checkbox label="Usa Notion per gli appuntamenti" description="Sostituisce l'aggiornamento del Google Doc. Google Calendar e i piani partita restano disponibili." checked={form.active} onChange={(event) => change({ active: event.currentTarget.checked })} disabled={busy !== null} />
    <Group><Button onClick={save} loading={busy === "save"} disabled={!status || busy === "verify" || (!form.page.trim() && (form.active || !status.requiresPageSetup))}>Salva</Button><Button variant="light" onClick={verify} loading={busy === "verify"} disabled={!status?.configured || status.requiresPageSetup || dirty || busy === "save"}>Verifica accesso</Button></Group>
    {message && <Alert color={message.color}>{message.text}</Alert>}
  </Stack></Card>;
}
