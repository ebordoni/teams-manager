import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Calendar from "./pages/Calendar";
import Communications from "./pages/Communications";
import Dashboard from "./pages/Dashboard";
import EventDetail from "./pages/EventDetail";
import Formations from "./pages/Formations";
import Players from "./pages/Players";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/players" element={<Players />} />
          <Route path="/formations" element={<Formations />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/communications" element={<Communications />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
