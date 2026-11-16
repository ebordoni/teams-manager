import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  createTheme,
  Modal,
  Paper,
  Table,
  Tabs,
} from "@mantine/core";

/** Un solo linguaggio visivo per le schermate gestionali. */
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 6 },
  colors: {
    brand: [
      "#f0f2ff",
      "#e1e6ff",
      "#c3ceff",
      "#9aabff",
      "#788cf4",
      "#5a70e8",
      "#465bd1",
      "#394bb4",
      "#303e92",
      "#293571",
    ],
  },
  fontFamily:
    'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "1.8rem", lineHeight: "1.25" },
      h2: { fontSize: "1.45rem" },
      h3: { fontSize: "1.2rem" },
      h4: { fontSize: "1rem" },
      h5: { fontSize: ".94rem" },
    },
  },
  defaultRadius: "md",
  radius: { xs: "4px", sm: "8px", md: "10px", lg: "16px", xl: "22px" },
  fontSizes: {
    xs: ".73rem",
    sm: ".82rem",
    md: ".9rem",
    lg: "1.05rem",
    xl: "1.3rem",
  },
  components: {
    Card: Card.extend({ defaultProps: { radius: "lg", padding: "lg" } }),
    Paper: Paper.extend({ defaultProps: { radius: "md" } }),
    Button: Button.extend({
      defaultProps: { radius: "md" },
      styles: { root: { fontWeight: 600 } },
    }),
    ActionIcon: ActionIcon.extend({ defaultProps: { radius: "md" } }),
    Badge: Badge.extend({
      defaultProps: { variant: "light", radius: "sm" },
      styles: {
        root: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
      },
    }),
    Alert: Alert.extend({ defaultProps: { radius: "md" } }),
    Modal: Modal.extend({
      defaultProps: {
        radius: "lg",
        overlayProps: { backgroundOpacity: 0.35, blur: 3 },
      },
    }),
    Tabs: Tabs.extend({ defaultProps: { radius: "md" } }),
    Table: Table.extend({
      defaultProps: { verticalSpacing: "md", horizontalSpacing: "md" },
    }),
  },
});
