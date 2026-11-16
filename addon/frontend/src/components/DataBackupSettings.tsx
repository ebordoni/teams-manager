import { Alert, Button, Card, Checkbox, FileButton, Group, Stack, Table, Text, Title } from "@mantine/core";
import { IconDownload, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { DataImportPreview, DataImportResult } from "../types";
import { formatDisplayDateTime } from "../utils/date";

const labels = {
  players: "Giocatori", eventTypes: "Tipi evento", events: "Eventi", attendance: "Presenze",
  results: "Risultati", formations: "Formazioni", matchPlans: "Piani partita", matchPeriods: "Tempi partita",
} as const;
const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

export default function DataBackupSettings({ onImported }: { onImported: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState<"checking" | "importing" | null>(null);
  const [selection, setSelection] = useState<{ name: string; backup: unknown; preview: DataImportPreview } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DataImportResult | null>(null);
  const resetFile = useRef<() => void>(null);

  async function exportData() {
    setExporting(true);
    setError(null);
    try {
      const response = await api.exportData();
      const url = URL.createObjectURL(response.data as Blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `teams-manager-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
      } finally { URL.revokeObjectURL(url); }
    } catch (err) { setError(errorMessage(err, "Impossibile esportare i dati. Riprova.")); }
    finally { setExporting(false); }
  }

  async function selectFile(file: File | null) {
    if (!file) return;
    setSelection(null);
    setResult(null);
    setError(null);
    setConfirmed(false);
    setBusy("checking");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Il file supera il limite di 5 MB.");
      let backup: unknown;
      try { backup = JSON.parse((await file.text()).replace(/^\uFEFF/, "")); }
      catch { throw new Error("Il file non contiene JSON valido. Seleziona un export di Teams Manager."); }
      const { data: preview } = await api.previewDataImport(backup);
      setSelection({ name: file.name, backup, preview });
    } catch (err) {
      setError(errorMessage(err, err instanceof Error ? err.message : "Impossibile verificare il file."));
    } finally {
      setBusy(null);
      resetFile.current?.();
    }
  }

  async function importData() {
    if (!selection || !confirmed || busy) return;
    setBusy("importing");
    setError(null);
    try {
      const { data } = await api.importData(selection.backup, selection.preview.expectedRevision);
      setResult(data);
      setSelection(null);
      setConfirmed(false);
      onImported();
    } catch (err) {
      setConfirmed(false);
      setError(errorMessage(err, "Impossibile verificare l'esito dell'importazione. Controlla i dati prima di riprovare."));
    } finally { setBusy(null); }
  }

  return <Card withBorder padding="md" radius="md">
    <Stack gap="sm">
      <Title order={5}>Backup e ripristino dati</Title>
      <Text size="sm" c="dimmed">Esporta o ripristina rosa, tipi evento, eventi, presenze, risultati, formazioni e piani partita. Impostazioni della squadra, collegamenti e credenziali delle integrazioni non sono inclusi nel file e non vengono sostituiti.</Text>
      <Group>
        <Button variant="light" leftSection={<IconDownload size={16} />} onClick={exportData} loading={exporting} disabled={busy !== null}>Esporta dati JSON</Button>
        <FileButton onChange={selectFile} accept=".json,application/json" resetRef={resetFile}>
          {(props) => <Button {...props} variant="light" leftSection={<IconUpload size={16} />} loading={busy === "checking"} disabled={busy !== null || exporting}>Importa dati JSON</Button>}
        </FileButton>
      </Group>
      {error && <Alert color="red" title="Operazione non completata" role="alert">{error}</Alert>}
      {result && <Alert color="green" title="Importazione completata" role="status">
        <Stack gap="xs">
          <Text size="sm">Ripristinati {result.imported.players} giocatori e {result.imported.events} eventi, insieme agli altri dati del file.</Text>
          <Text size="sm">Backup di sicurezza salvato nella cartella dati dell'applicazione:</Text>
          <Text size="xs" style={{ overflowWrap: "anywhere" }}>{result.backupFile}</Text>
          <Text size="sm">Gli aggiornamenti automatici delle comunicazioni sono sospesi. Controlla i dati, poi usa Aggiorna ora per riattivarli.</Text>
          <Button component={Link} to="/communications" size="compact-sm" variant="subtle" style={{ alignSelf: "flex-start" }}>Vai a Comunicazioni</Button>
        </Stack>
      </Alert>}
      {selection && <Stack gap="sm">
        <Text size="sm" fw={600} mt="sm">Verifica il ripristino</Text>
        <Text size="sm" fw={600} style={{ overflowWrap: "anywhere" }}>{selection.name}</Text>
        <Text size="sm" c="dimmed">Esportato il {formatDisplayDateTime(selection.preview.exportedAt)} · massimo 5 MB</Text>
        <Table withTableBorder striped>
          <Table.Thead><Table.Tr><Table.Th>Dati</Table.Th><Table.Th>Attuali</Table.Th><Table.Th>Nel file</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{(Object.keys(labels) as Array<keyof typeof labels>).map((key) => <Table.Tr key={key}>
            <Table.Td>{labels[key]}</Table.Td><Table.Td>{selection.preview.currentCounts[key]}</Table.Td><Table.Td>{selection.preview.counts[key]}</Table.Td>
          </Table.Tr>)}</Table.Tbody>
        </Table>
        <Alert color="orange" title="Sostituzione completa, non unione">
          <Text size="sm">Tutti i dati gestionali attuali saranno sostituiti con quelli del file, anche se vuoto. Prima verrà creato un backup automatico. Le impostazioni e le credenziali rimangono invariate.</Text>
          <Text size="sm" mt="xs">Nessun aggiornamento viene inviato a sito, Notion o Google Docs. Le sincronizzazioni automatiche rimarranno sospese fino al prossimo aggiornamento manuale in Comunicazioni.</Text>
          <Text size="sm" mt="xs">Gli eventi già presenti su Google Calendar restano invariati. I collegamenti di esportazione locali vengono azzerati: esportarli di nuovo potrebbe creare duplicati.</Text>
        </Alert>
        <Checkbox label="Confermo di sostituire i dati attuali con quelli del file." checked={confirmed} disabled={busy !== null} onChange={(event) => setConfirmed(event.currentTarget.checked)} />
        <Group>
          <Button color="red" onClick={importData} disabled={!confirmed || busy === "checking"} loading={busy === "importing"}>Sostituisci e importa</Button>
          <Button variant="subtle" disabled={busy !== null} onClick={() => { setSelection(null); setConfirmed(false); setError(null); }}>Annulla</Button>
        </Group>
      </Stack>}
    </Stack>
  </Card>;
}
