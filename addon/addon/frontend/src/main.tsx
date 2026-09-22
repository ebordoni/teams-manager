import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./index.css";

const theme = {
  primaryColor: "green",
  fontFamily: "Roboto, Arial, sans-serif",
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </AppErrorBoundary>,
);
