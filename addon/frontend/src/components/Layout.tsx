import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/calendar", label: "Calendario" },
  { to: "/players", label: "Giocatori" },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gips-green text-white px-4 py-3 shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">⚽ GIPS Calcio</h1>
          <nav className="hidden sm:flex gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? "underline" : "opacity-80 hover:opacity-100"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            className="sm:hidden text-2xl leading-none"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
        {menuOpen && (
          <nav className="sm:hidden mt-3 flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? "underline" : "opacity-80 hover:opacity-100"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
