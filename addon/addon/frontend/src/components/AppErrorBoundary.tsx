import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[frontend] Errore non gestito", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Center mih="100vh" p="md">
        <Stack align="center" maw={420} ta="center">
          <Title order={2}>Si è verificato un problema</Title>
          <Text c="dimmed">Ricarica l’applicazione. Se l’errore persiste, controlla i log dell’add-on.</Text>
          <Button onClick={() => window.location.reload()}>Ricarica</Button>
        </Stack>
      </Center>
    );
  }
}
