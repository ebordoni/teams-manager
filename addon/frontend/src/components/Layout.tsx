import { AppShell, Avatar, Text } from "@mantine/core";
import {
  IconBallFootball,
  IconCalendarEvent,
  IconChevronRight,
  IconClipboardList,
  IconLayoutDashboard,
  IconLayoutList,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/client";

const navItems = [
  {
    to: "/dashboard",
    label: "Panoramica",
    mobileLabel: "Home",
    icon: IconLayoutDashboard,
  },
  {
    to: "/calendar",
    label: "Calendario",
    mobileLabel: "Calendario",
    icon: IconCalendarEvent,
  },
  {
    to: "/players",
    label: "Rosa giocatori",
    mobileLabel: "Rosa",
    icon: IconUsers,
  },
  {
    to: "/attendance",
    label: "Registro presenze",
    mobileLabel: "Presenze",
    icon: IconClipboardList,
  },
  {
    to: "/formations",
    label: "Formazioni",
    mobileLabel: "Formazioni",
    icon: IconLayoutList,
  },
];

export default function Layout() {
  const { pathname } = useLocation();
  const [teamName, setTeamName] = useState("La tua squadra");
  const settingsActive = ["/settings", "/communications", "/ai-settings"].some(
    (path) => pathname.startsWith(path),
  );
  const isActive = (to: string) =>
    pathname.startsWith(to) ||
    (to === "/calendar" && pathname.startsWith("/events/"));
  const pageName = pathname.includes("match-plan")
    ? "Piano partita"
    : pathname.startsWith("/events/")
      ? "Dettaglio evento"
      : pathname.startsWith("/communications")
        ? "Comunicazioni"
        : pathname.startsWith("/ai-settings")
          ? "Intelligenza artificiale"
          : settingsActive
            ? "Impostazioni"
            : (navItems.find((item) => isActive(item.to))?.label ??
              "La squadra");
  useEffect(() => {
    let active = true;
    void api
      .getSettings()
      .then(({ data }) => {
        if (active) setTeamName(data.teamName);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <AppShell
      layout="alt"
      header={{ height: { base: 64, sm: 76 } }}
      navbar={{ width: 244, breakpoint: "sm", collapsed: { mobile: true } }}
      padding={0}
      className="app-shell"
    >
      <a
        className="app-skip-link"
        href="#app-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("app-content")?.focus();
        }}
      >
        Vai al contenuto
      </a>
      <AppShell.Navbar className="app-navbar" visibleFrom="sm">
        <Link
          to="/dashboard"
          className="app-brand"
          aria-label="Teams Manager, panoramica"
        >
          <span className="app-brand-mark">
            <IconBallFootball size={26} stroke={1.6} />
          </span>
          <span>
            Teams<span className="app-brand-light">Manager</span>
            <small>Il tuo spazio in squadra</small>
          </span>
        </Link>
        <div className="app-team-identity">
          <Avatar name={teamName} color="brand" radius="md" size={38} />
          <div>
            <Text size="xs" c="dimmed">
              LA TUA SQUADRA
            </Text>
            <Text size="sm" fw={600} lineClamp={2}>
              {teamName}
            </Text>
          </div>
        </div>
        <Text className="app-nav-label">Gestione squadra</Text>
        <nav aria-label="Navigazione principale" className="app-desktop-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`app-nav-link${isActive(item.to) ? " is-active" : ""}`}
              aria-current={isActive(item.to) ? "page" : undefined}
            >
              <item.icon size={21} stroke={1.7} />
              <span>{item.label}</span>
              {isActive(item.to) && <span className="app-nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="app-sidebar-bottom">
          <Link
            to="/settings"
            className={`app-nav-link${settingsActive ? " is-active" : ""}`}
            aria-current={settingsActive ? "page" : undefined}
          >
            <IconSettings size={21} stroke={1.7} />
            <span>Impostazioni</span>
          </Link>
          <Text size="xs" c="dimmed" px="md" mt="lg">
            Meno organizzazione.
            <br />
            Più tempo sul campo.
          </Text>
        </div>
      </AppShell.Navbar>
      <AppShell.Header className="app-topbar">
        <div className="app-mobile-brand">
          <span className="app-brand-mark">
            <IconBallFootball size={22} stroke={1.6} />
          </span>
          <div>
            <small>TEAMS MANAGER</small>
            <Text fw={600} size="sm" truncate>
              {teamName}
            </Text>
          </div>
        </div>
        <div className="app-breadcrumb">
          <span>La squadra</span>
          <IconChevronRight size={13} />
          <strong>{pageName}</strong>
        </div>
        <div className="app-topbar-date">
          {new Intl.DateTimeFormat("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Europe/Rome",
          }).format(new Date())}
        </div>
        <Link
          to="/settings"
          className={`app-settings-shortcut${settingsActive ? " is-active" : ""}`}
          aria-label="Impostazioni"
        >
          <IconSettings size={22} stroke={1.7} />
        </Link>
      </AppShell.Header>
      <AppShell.Main>
        <div
          id="app-content"
          tabIndex={-1}
          className={`app-page page-${pathname.includes("match-plan") ? "match-plan" : pathname.split("/")[1] || "dashboard"}`}
        >
          <Outlet />
        </div>
      </AppShell.Main>
      <nav className="app-mobile-nav" aria-label="Navigazione mobile">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={isActive(item.to) ? "page" : undefined}
            className={`app-mobile-nav-link${isActive(item.to) ? " is-active" : ""}`}
          >
            <item.icon size={21} stroke={1.7} />
            <span>{item.mobileLabel}</span>
          </Link>
        ))}
      </nav>
    </AppShell>
  );
}
