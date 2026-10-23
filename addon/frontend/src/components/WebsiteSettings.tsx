import { Alert, Button, Card, Checkbox, Group, Modal, PasswordInput, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { WebsiteInput, WebsiteStatus } from "../types";

const initial: WebsiteInput = { accountId: "", workerName: "teams-manager", token: "", active: false, includeNotes: false, autoPublish: true, introduction: "Appuntamenti, orari e novità della squadra.", notice: "", information: "" };
const fromStatus = (data: WebsiteStatus): WebsiteInput => ({ accountId: data.accountId, workerName: data.workerName, token: "", active: data.active, includeNotes: data.includeNotes, autoPublish: data.autoPublish, introduction: data.introduction, notice: data.notice, information: data.information });

export default function WebsiteSettings() {
  const [status, setStatus] = useState<WebsiteStatus | null>(null);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState<"save" | "verify" | "preview" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ color: "red" | "green"; text: string } | null>(null);
  const report = (error: unknown) => setMessage({ color: "red", text: (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Operazione sito non riuscita." });
  useEffect(() => {
    api.getWebsiteSettings().then(({ data }) => { setStatus(data); setForm(fromStatus(data)); }).catch(report);
    const refresh = () => { api.getWebsiteSettings().then(({ data }) => { setStatus(data); setForm((current) => ({ ...current, active: data.active })); }).catch(report); };
    window.addEventListener("communication-provider-changed", refresh);
    return () => window.removeEventListener("communication-provider-changed", refresh);
  }, []);
  function change(next: Partial<WebsiteInput>) { setForm((current) => ({ ...current, ...next })); setDirty(true); setMessage(null); }
  async function save() {
    setBusy("save"); setMessage(null);
    try {
      const { data } = await api.saveWebsiteSettings({ ...form, token: form.token?.trim() || undefined });
      setStatus(data); setForm(fromStatus(data)); setDirty(false);
      setMessage({ color: "green", text: data.active ? "Configurazione salvata. Verifica accesso e anteprima, poi pubblica da Comunicazioni. La prima pubblicazione richiede conferma." : "Configurazione salvata. Il sito non è la destinazione attiva." });
      window.dispatchEvent(new Event("communication-provider-changed"));
    } catch (error) { report(error); } finally { setBusy(null); }
  }
  async function verify() {
    setBusy("verify"); setMessage(null);
    try { const { data } = await api.verifyWebsite(); setMessage({ color: "green", text: data.message }); setStatus((current) => current ? { ...current, url: data.url } : current); }
    catch (error) { report(error); } finally { setBusy(null); }
  }
  async function showPreview() {
    setBusy("preview");
    try { setPreview((await api.previewWebsite()).data.html); }
    catch (error) { report(error); } finally { setBusy(null); }
  }
  return <Card withBorder padding="md" radius="md"><Stack gap="sm">
    <Title order={5}>Sito pubblico · Cloudflare</Title>
    <Text size="sm" c="dimmed">Pubblica gli appuntamenti sul tuo sito, senza esporre Home Assistant. Il collegamento usa lo stesso Worker del prototipo.</Text>
    <TextInput label="Cloudflare Account ID" value={form.accountId} onChange={(event) => change({ accountId: event.currentTarget.value })} disabled={busy !== null} />
    <TextInput label="Nome Worker" value={form.workerName} onChange={(event) => change({ workerName: event.currentTarget.value })} disabled={busy !== null} />
    <PasswordInput label="Token API Cloudflare" placeholder={status?.configured ? "Token salvato · lascia vuoto per mantenerlo" : "Workers Scripts → Edit sul tuo account"} autoComplete="off" value={form.token} onChange={(event) => change({ token: event.currentTarget.value })} disabled={busy !== null} />
    <Checkbox label="Usa il sito per gli appuntamenti" description="Una sola destinazione attiva: Notion e Google Docs restano disponibili ma non vengono aggiornati mentre è attivo il sito." checked={form.active} onChange={(event) => change({ active: event.currentTarget.checked })} disabled={busy !== null} />
    <Checkbox label="Aggiorna automaticamente" description="Dopo la prima pubblicazione riuscita: modifiche agli eventi, riavvio e pulizia giornaliera alle 03:05. Disattiva per pubblicare solo manualmente." checked={form.autoPublish} onChange={(event) => change({ autoPublish: event.currentTarget.checked })} disabled={busy !== null} />
    <Textarea label="Introduzione in home" value={form.introduction} maxLength={1000} onChange={(event) => change({ introduction: event.currentTarget.value })} disabled={busy !== null} autosize minRows={2} />
    <Textarea label="Avviso pubblico" description="Compare in home e nella pagina Avvisi; lascia vuoto per non mostrare avvisi." maxLength={5000} value={form.notice} onChange={(event) => change({ notice: event.currentTarget.value })} disabled={busy !== null} autosize minRows={2} />
    <Textarea label="Pagina Informazioni" maxLength={10000} value={form.information} onChange={(event) => change({ information: event.currentTarget.value })} disabled={busy !== null} autosize minRows={2} />
    <Checkbox label="Pubblica anche le note degli eventi" description="Attenzione: rende pubbliche le note gestionali degli eventi inclusi. Controllale prima di abilitare questa opzione." checked={form.includeNotes} onChange={(event) => change({ includeNotes: event.currentTarget.checked })} disabled={busy !== null} />
    <Alert color="orange">Il sito è accessibile a chiunque abbia il link. In questa prima integrazione nomi dei giocatori, presenze e formazioni non vengono pubblicati. Gli altri testi inseriti qui sono pubblici: non includere dati riservati.</Alert>
    <Group><Button onClick={save} loading={busy === "save"} disabled={!status || busy !== null || !form.accountId.trim()}>Salva</Button><Button variant="light" onClick={verify} loading={busy === "verify"} disabled={!status?.configured || dirty || busy !== null}>Verifica accesso</Button><Button variant="light" onClick={showPreview} loading={busy === "preview"} disabled={!status || dirty || busy !== null}>Anteprima home</Button></Group>
    {status?.url && <Text component="a" href={status.url} target="_blank" rel="noopener noreferrer" size="sm">{status.url}</Text>}
    {message && <Alert color={message.color}>{message.text}</Alert>}
    <Modal opened={preview !== null} onClose={() => setPreview(null)} fullScreen title="Anteprima home statica · nessuna pubblicazione"><iframe title="Anteprima sito pubblico" srcDoc={preview ?? ""} sandbox="" style={{ width: "100%", height: "85vh", border: 0 }} /></Modal>
  </Stack></Card>;
}
