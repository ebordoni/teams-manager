import { Center, Loader, Text } from "@mantine/core";

export default function PageLoader() {
  return (
    <Center mih={220} aria-live="polite">
      <Loader aria-label="Caricamento pagina" />
      <Text ml="sm" c="dimmed" size="sm">Caricamento…</Text>
    </Center>
  );
}
