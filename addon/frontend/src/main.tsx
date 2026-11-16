import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { DatesProvider } from "@mantine/dates";
import "@mantine/dates/styles.css";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import "dayjs/locale/it";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { theme } from "./theme";
import "./index.css";

// Mantine DateInput usa il formato visualizzato anche per l'inserimento manuale.
dayjs.extend(customParseFormat);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={theme} defaultColorScheme="auto">
    <DatesProvider settings={{ locale: "it", firstDayOfWeek: 1 }}>
      <AppErrorBoundary>
        <Notifications position="top-right" />
        <App />
      </AppErrorBoundary>
    </DatesProvider>
  </MantineProvider>,
);
