import { AppShell, Burger, Group, NavLink as MantineNavLink, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendarEvent,
  IconFileText,
  IconLayoutList,
  IconLayoutDashboard,
  IconSettings,
  IconRobot,
  IconUsers,
} from "@tabler/icons-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { to: "/calendar", label: "Calendario", icon: IconCalendarEvent },
  { to: "/players", label: "Giocatori", icon: IconUsers },
  { to: "/formations", label: "Formazioni", icon: IconLayoutList },
  { to: "/communications", label: "Comunicazioni", icon: IconFileText },
  { to: "/ai-settings", label: "Intelligenza artificiale", icon: IconRobot },
  { to: "/settings", label: "Impostazioni", icon: IconSettings },
];

export default function Layout() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 230, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
      styles={{ main: { minWidth: 0 } }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3} fz={{ base: "h4", sm: "h3" }}>⚽ GIPS Calcio</Title>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        {navItems.map((item) => (
          <MantineNavLink
            key={item.to}
            component={NavLink}
            to={item.to}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={location.pathname.startsWith(item.to)}
            onClick={close}
            variant="filled"
            style={{ borderRadius: 6 }}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
