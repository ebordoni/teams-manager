import { Suspense, lazy } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import PageLoader from "./components/PageLoader";

const Calendar = lazy(() => import("./pages/Calendar"));
const Communications = lazy(() => import("./pages/Communications"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const Formations = lazy(() => import("./pages/Formations"));
const Players = lazy(() => import("./pages/Players"));
const Settings = lazy(() => import("./pages/Settings"));

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </HashRouter>
  );
}
