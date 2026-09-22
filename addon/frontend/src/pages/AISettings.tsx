import { Alert, Badge, Button, Card, Group, MultiSelect, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlugConnected, IconRobot } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import PageLoader from "../components/PageLoader";
import type { AIConfig, AIProvider, RolePolicy } from "../types";

const PROVIDERS: Array<{ value: AIProvider; label: string }> = [
  { value: "openai", label: "OpenAI" }, { value: "google", label: "Google Gemini" },
  { value: "anthropic", label: "Anthropic" }, { value: "groq", label: "Groq" }, { value: "xai", label: "xAI" },
];

export default function AISettings() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getAIConfig().then((response) => setConfig(response.data)).catch(() => setError("Impossibile caricare la configurazione AI")).finally(() => setLoading(false)); }, []);

  if (loading) return <PageLoader />;
  if (!config) return <Alert color="red">{error ?? "Configurazione AI non disponibile"}</Alert>;
  const providerOptions = PROVIDERS.map((provider) => ({ ...provider, disabled: !config.configuredProviders.includes(provider.value) && provider.value !== config.provider }));

  const save = async () => {
    setSaving(true); setError(null);
    try { const response = await api.updateAIConfig(config); setConfig({ ...config, ...response.data }); notifications.show({ color: "green", message: "Configurazione AI salvata" }); }
    catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Salvataggio non riuscito"); }
    finally { setSaving(false); }
  };
  const test = async () => {
    setTesting(true); setError(null);
    try { const response = await api.testAI(); notifications.show({ color: "green", title: `${response.data.provider}/${response.data.model}`, message: response.data.message }); }
    catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Connessione AI non riuscita"); }
    finally { setTesting(false); }
  };

  return <Stack gap="lg">
    <div><Group gap="xs"><IconRobot /><Title order={3}>Intelligenza artificiale</Title></Group><Text c="dimmed">Configura il servizio che prepara le rotazioni dei giocatori per le partite.</Text></div>
    <Alert color="blue" title="Privacy dei giocatori">Al provider vengono inviati soltanto pseudonimi e ruoli. Nomi e altre informazioni dei bambini rimangono nell’add-on.</Alert>
    {error && <Alert color="red" title="Errore">{error}</Alert>}
    <Card withBorder padding="lg"><Stack>
      <Group justify="space-between"><Title order={4}>Provider e modello</Title><Group gap="xs">{PROVIDERS.map((provider) => <Badge key={provider.value} color={config.configuredProviders.includes(provider.value) ? "green" : "gray"} variant="light">{provider.label}</Badge>)}</Group></Group>
      <Text size="sm" c="dimmed">Le chiavi API si impostano nelle opzioni protette dell’add-on Home Assistant e non vengono mai restituite al browser.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select label="Provider principale" data={providerOptions} value={config.provider} onChange={(value) => { const provider = (value ?? "openai") as AIProvider; setConfig({ ...config, provider, model: config.defaultModels[provider] }); }} allowDeselect={false} />
        <TextInput label="Modello" value={config.model} onChange={(event) => setConfig({ ...config, model: event.currentTarget.value })} />
      </SimpleGrid>
      <MultiSelect label="Provider di fallback" data={providerOptions.filter((item) => item.value !== config.provider)} value={config.fallbackProviders} onChange={(values) => setConfig({ ...config, fallbackProviders: values as AIProvider[] })} />
      {!config.configuredProviders.includes(config.provider) && <Alert color="yellow">Manca la chiave API per il provider selezionato. La generazione userà il motore locale di fallback.</Alert>}
      <Button variant="light" leftSection={<IconPlugConnected size={18} />} onClick={test} loading={testing} disabled={!config.configuredProviders.includes(config.provider)} style={{ alignSelf: "flex-start" }}>Verifica connessione</Button>
    </Stack></Card>
    <Card withBorder padding="lg"><Stack><Title order={4}>Valori predefiniti delle partite</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <NumberInput label="Numero tempi" min={1} max={12} value={config.defaultPeriodCount} onChange={(value) => setConfig({ ...config, defaultPeriodCount: Number(value) })} />
        <NumberInput label="Minuti per tempo" min={1} max={90} value={config.defaultMinutesPerPeriod} onChange={(value) => setConfig({ ...config, defaultMinutesPerPeriod: Number(value) })} />
        <NumberInput label="Giocatori in campo" min={2} max={11} value={config.defaultPlayersOnField} onChange={(value) => setConfig({ ...config, defaultPlayersOnField: Number(value) })} />
        <Select label="Vincolo ruoli" data={[{ value: "strict", label: "Rigido" }, { value: "preferred", label: "Preferenziale" }, { value: "free", label: "Libero" }]} value={config.defaultRolePolicy} onChange={(value) => setConfig({ ...config, defaultRolePolicy: (value ?? "preferred") as RolePolicy })} allowDeselect={false} />
      </SimpleGrid>
      <Button onClick={save} loading={saving} style={{ alignSelf: "flex-start" }}>Salva configurazione</Button>
    </Stack></Card>
  </Stack>;
}
