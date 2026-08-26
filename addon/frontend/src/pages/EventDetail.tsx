import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Callup, TeamEvent } from "../types";

const EVENT_TYPE_LABEL: Record<TeamEvent["type"], string> = {
  training: "Allenamento",
  match: "Partita",
  tournament: "Torneo",
};

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const [event, setEvent] = useState<TeamEvent | null>(null);
  const [callups, setCallups] = useState<Callup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([api.getEvent(eventId), api.getCallups(eventId)])
      .then(([eventRes, callupsRes]) => {
        setEvent(eventRes.data);
        setCallups(callupsRes.data);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  function toggleCallup(playerId: number) {
    setCallups((prev) =>
      prev.map((c) =>
        c.playerId === playerId ? { ...c, calledUp: !c.calledUp } : c,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const playerIds = callups.filter((c) => c.calledUp).map((c) => c.playerId);
      await api.setCallups(eventId, playerIds);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500">Caricamento…</p>;
  if (!event) return <p className="text-gray-500">Evento non trovato.</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold">
          {EVENT_TYPE_LABEL[event.type]}
          {event.opponent ? ` vs ${event.opponent}` : ""}
        </h2>
        <p className="text-sm text-gray-500">
          {event.date} {event.startTime ?? ""}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {event.notes && <p className="mt-2 text-sm">{event.notes}</p>}
      </div>

      <section>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Convocazioni</h3>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gips-green text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
          >
            {saving ? "Salvataggio…" : "Salva convocazioni"}
          </button>
        </div>
        {callups.length === 0 ? (
          <p className="text-gray-500">
            Nessun giocatore in anagrafica: aggiungili dalla pagina Giocatori.
          </p>
        ) : (
          <ul className="divide-y bg-white rounded-lg shadow">
            {callups.map((c) => (
              <li
                key={c.playerId}
                className="p-3 flex items-center justify-between"
              >
                <span>{c.playerName}</span>
                <input
                  type="checkbox"
                  checked={c.calledUp}
                  onChange={() => toggleCallup(c.playerId)}
                  className="w-5 h-5"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
