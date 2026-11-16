import {
  AppShell,
  NavLink as MantineNavLink,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconClipboardList,
  IconLayoutDashboard,
  IconLayoutList,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { to: "/calendar", label: "Calendario", icon: IconCalendarEvent },
  { to: "/players", label: "Giocatori", icon: IconUsers },
  { to: "/attendance", label: "Registro presenze", icon: IconClipboardList },
  { to: "/formations", label: "Formazioni", icon: IconLayoutList },
  { to: "/settings", label: "Impostazioni", icon: IconSettings },
];

export default function Layout() {
  const location = useLocation();
  const settingsActive = ["/settings", "/communications", "/ai-settings"].some((path) => location.pathname.startsWith(path));

  return (
    <AppShell
      header={{ height: { base: 56, sm: 0 } }}
      navbar={{ width: 230, breakpoint: "sm", collapsed: { mobile: true } }}
      padding={{ base: "sm", sm: "lg" }}
      className="app-shell"
      styles={{ main: { minWidth: 0 } }}
    >
      <AppShell.Header hiddenFrom="sm">
        <nav className="app-mobile-nav" aria-label="Navigazione principale">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} title={item.label} aria-label={item.label} className={({ isActive }) => `app-mobile-nav-link${(item.to === "/settings" ? settingsActive : isActive) ? " is-active" : ""}`}>
              <item.icon size={22} aria-hidden="true" />
            </NavLink>
          ))}
        </nav>
      </AppShell.Header>
      <AppShell.Navbar p="md" className="app-navbar">
        {navItems.map((item) => (
          <MantineNavLink
            key={item.to}
            component={NavLink}
            to={item.to}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={item.to === "/settings" ? settingsActive : location.pathname.startsWith(item.to)}
            variant="filled"
            style={{ borderRadius: 6 }}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <div className="app-page"><Outlet /></div>
      </AppShell.Main>
    </AppShell>
  );
}
