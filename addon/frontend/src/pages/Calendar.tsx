import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { EventType, GeneratedCommunication, TeamEvent } from "../types";

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  training: "Allenamento",
  match: "Partita",
  tournament: "Torneo",
};

const EMPTY_FORM = {
  type: "training" as EventType,
  date: "",
  startTime: "",
  location: "",
  opponent: "",
};

export default function Calendar() {
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedCommunication | null>(
    null,
  );

  function loadEvents() {
    setLoading(true);
    api
      .getEvents()
      .then((res) => setEvents(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await api.createEvent({
      type: form.type,
      date: form.date,
      startTime: form.startTime || null,
      location: form.location || null,
      opponent: form.type === "match" ? form.opponent || null : null,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    loadEvents();
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerateCommunication() {
    setGenerateError(null);
    setGenerating(true);
    try {
      const res = await api.generateCommunication(Array.from(selectedIds));
      setGenerated(res.data);
      setSelectedIds(new Set());
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Errore durante la generazione della comunicazione";
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyWhatsapp() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.whatsappMessage);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Calendario</h2>
        <button
          className="bg-gips-green text-white text-sm px-3 py-1.5 rounded"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Annulla" : "+ Nuovo evento"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">
              Tipo
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as EventType })
                }
                className="border rounded px-2 py-1"
              >
                <option value="training">Allenamento</option>
                <option value="match">Partita</option>
                <option value="tournament">Torneo</option>
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Data
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              Ora
              <input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              Luogo
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="border rounded px-2 py-1"
              />
            </label>
            {form.type === "match" && (
              <label className="flex flex-col text-sm col-span-2">
                Avversario
                <input
                  type="text"
                  value={form.opponent}
                  onChange={(e) =>
                    setForm({ ...form, opponent: e.target.value })
                  }
                  className="border rounded px-2 py-1"
                />
              </label>
            )}
          </div>
          <button
            type="submit"
            className="bg-gips-green text-white text-sm px-3 py-1.5 rounded"
          >
            Salva
          </button>
        </form>
      )}

      {selectedIds.size > 0 && (
        <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between gap-3">
          <span className="text-sm">
            {selectedIds.size} evento/i selezionato/i
          </span>
          <button
            onClick={handleGenerateCommunication}
            disabled={generating}
            className="bg-gips-green text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
          >
            {generating ? "Generazione…" : "📄 Genera comunicazione"}
          </button>
        </div>
      )}
      {generateError && <p className="text-sm text-red-600">{generateError}</p>}
      {generated && (
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <p className="font-medium">✅ Comunicazione generata</p>
          <a
            href={generated.googleDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline block"
          >
            🔗 Apri documento
          </a>
          <button
            onClick={handleCopyWhatsapp}
            className="text-sm text-gips-green hover:underline"
          >
            📋 Copia messaggio WhatsApp
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Caricamento…</p>
      ) : events.length === 0 ? (
        <p className="text-gray-500">Nessun evento in calendario.</p>
      ) : (
        <ul className="divide-y bg-white rounded-lg shadow">
          {events.map((event) => (
            <li key={event.id} className="p-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(event.id)}
                onChange={() => toggleSelected(event.id)}
                className="w-5 h-5 shrink-0"
              />
              <Link
                to={`/events/${event.id}`}
                className="flex-1 flex justify-between items-center"
              >
                <span>
                  <span className="font-medium">
                    {EVENT_TYPE_LABEL[event.type]}
                  </span>{" "}
                  {event.opponent ? `vs ${event.opponent}` : ""}
                  {event.status !== "scheduled" && (
                    <span className="ml-2 text-xs text-orange-600">
                      ({event.status})
                    </span>
                  )}
                </span>
                <span className="text-sm text-gray-500">
                  {event.date} {event.startTime ?? ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
