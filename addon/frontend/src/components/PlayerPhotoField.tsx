import {
  Alert,
  Avatar,
  Button,
  FileButton,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { IconCamera, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { preparePlayerPhoto } from "../utils/player-photo";

export default function PlayerPhotoField({
  value,
  name,
  onChange,
  onBusyChange,
}: {
  value: string | null;
  name: string;
  onChange: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const resetFile = useRef<() => void>(null);
  useEffect(
    () => () => {
      generation.current++;
      onBusyChange(false);
    },
    [onBusyChange],
  );
  async function select(file: File | null) {
    if (!file) return;
    const request = ++generation.current;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      const photo = await preparePlayerPhoto(file);
      if (generation.current === request) onChange(photo);
    } catch (err) {
      if (generation.current === request)
        setError(
          err instanceof Error ? err.message : "Caricamento foto non riuscito.",
        );
    } finally {
      if (generation.current === request) {
        setBusy(false);
        onBusyChange(false);
        resetFile.current?.();
      }
    }
  }
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Foto profilo
      </Text>
      <Group wrap="nowrap" align="flex-start" gap="md">
        <Avatar
          src={value}
          name={name}
          size={80}
          radius="lg"
          color="brand"
          alt={`Foto profilo di ${name || "nuovo giocatore"}`}
        />
        <Stack gap="xs" style={{ minWidth: 0 }}>
          <Group gap="xs">
            <FileButton
              accept="image/jpeg,image/png,image/webp"
              onChange={select}
              resetRef={resetFile}
            >
              {(props) => (
                <Button
                  {...props}
                  variant="light"
                  leftSection={
                    busy ? <Loader size={16} /> : <IconCamera size={16} />
                  }
                  disabled={busy}
                >
                  Carica foto
                </Button>
              )}
            </FileButton>
            {value && (
              <Button
                variant="subtle"
                color="red"
                disabled={busy}
                leftSection={<IconTrash size={15} />}
                onClick={() => {
                  generation.current++;
                  onChange(null);
                  setError(null);
                }}
              >
                Rimuovi foto
              </Button>
            )}
          </Group>
        </Stack>
      </Group>
      <Text size="xs" c="dimmed">
        JPG, PNG o WebP · massimo 8 MB e 20 MP. Ritaglio centrale
        automatico, fino a 512 px e 80 KB salvati.
      </Text>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
    </Stack>
  );
}
