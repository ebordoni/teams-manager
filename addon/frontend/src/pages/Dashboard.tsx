import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Player, TeamEvent } from "../types";

const EVENT_TYPE_LABEL: Record<TeamEvent["type"], string> = {
  training: "Allenamento",
  match: "Partita",
  tournament: "Torneo",
};

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([api.getPlayers(), api.getEvents({ from: today })])
      .then(([playersRes, eventsRes]) => {
        setPlayers(playersRes.data);
        setUpcomingEvents(eventsRes.data.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500">Caricamento…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Giocatori</p>
          <p className="text-2xl font-bold">{players.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Prossimi eventi</p>
          <p className="text-2xl font-bold">{upcomingEvents.length}</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Prossimi appuntamenti</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-500">Nessun evento in programma.</p>
        ) : (
          <ul className="divide-y bg-white rounded-lg shadow">
            {upcomingEvents.map((event) => (
              <li key={event.id} className="p-3">
                <Link
                  to={`/events/${event.id}`}
                  className="flex justify-between items-center"
                >
                  <span>
                    <span className="font-medium">
                      {EVENT_TYPE_LABEL[event.type]}
                    </span>{" "}
                    {event.opponent ? `vs ${event.opponent}` : ""}
                  </span>
                  <span className="text-sm text-gray-500">
                    {event.date} {event.startTime ?? ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
