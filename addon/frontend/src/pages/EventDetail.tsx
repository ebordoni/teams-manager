import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  Attendance,
  AttendanceStatus,
  Callup,
  EventStatus,
  TeamEvent,
} from "../types";

const EVENT_TYPE_LABEL: Record<TeamEvent["type"], string> = {
  training: "Allenamento",
  match: "Partita",
  tournament: "Torneo",
};

const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: "Programmato",
  modified: "Modificato",
  cancelled: "Annullato",
};

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Presente",
  absent: "Assente",
  excused: "Giustificato",
};

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const [event, setEvent] = useState<TeamEvent | null>(null);
  const [callups, setCallups] = useState<Callup[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCallups, setSavingCallups] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [statusDraft, setStatusDraft] = useState<EventStatus>("scheduled");
  const [notesDraft, setNotesDraft] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.getEvent(eventId),
      api.getCallups(eventId),
      api.getAttendance(eventId),
    ])
      .then(([eventRes, callupsRes, attendanceRes]) => {
        setEvent(eventRes.data);
        setCallups(callupsRes.data);
        setAttendance(attendanceRes.data);
        setStatusDraft(eventRes.data.status);
        setNotesDraft(eventRes.data.notes ?? "");
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

  async function handleSaveCallups() {
    setSavingCallups(true);
    try {
      const playerIds = callups
        .filter((c) => c.calledUp)
        .map((c) => c.playerId);
      await api.setCallups(eventId, playerIds);
      // Ricarica le presenze: la lista dipende dai convocati appena salvati.
      const attendanceRes = await api.getAttendance(eventId);
      setAttendance(attendanceRes.data);
    } finally {
      setSavingCallups(false);
    }
  }

  function setAttendanceStatus(playerId: number, status: AttendanceStatus) {
    setAttendance((prev) =>
      prev.map((a) => (a.playerId === playerId ? { ...a, status } : a)),
    );
  }

  async function handleSaveAttendance() {
    setSavingAttendance(true);
    try {
      await api.setAttendance(
        eventId,
        attendance.map((a) => ({ playerId: a.playerId, status: a.status })),
      );
    } finally {
      setSavingAttendance(false);
    }
  }

  async function handleSaveStatus() {
    setStatusError(null);
    if (statusDraft !== "scheduled" && !notesDraft.trim()) {
      setStatusError(
        "Le note sono obbligatorie quando l'evento è modificato o annullato",
      );
      return;
    }
    setSavingStatus(true);
    try {
      const res = await api.updateEvent(eventId, {
        status: statusDraft,
        notes: notesDraft,
      });
      setEvent(res.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Errore durante il salvataggio";
      setStatusError(message);
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) return <p className="text-gray-500">Caricamento…</p>;
  if (!event) return <p className="text-gray-500">Evento non trovato.</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {EVENT_TYPE_LABEL[event.type]}
            {event.opponent ? ` vs ${event.opponent}` : ""}
          </h2>
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${
              event.status === "scheduled"
                ? "bg-green-100 text-green-800"
                : event.status === "modified"
                  ? "bg-orange-100 text-orange-800"
                  : "bg-red-100 text-red-800"
            }`}
          >
            {EVENT_STATUS_LABEL[event.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {event.date} {event.startTime ?? ""}
          {event.location ? ` · ${event.location}` : ""}
        </p>

        <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col text-sm">
            Stato evento
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as EventStatus)}
              className="border rounded px-2 py-1"
            >
              <option value="scheduled">Programmato</option>
              <option value="modified">Modificato</option>
              <option value="cancelled">Annullato</option>
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Note {statusDraft !== "scheduled" && (
              <span className="text-red-600">*</span>
            )}
            <input
              type="text"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Motivo della modifica/annullamento"
              className="border rounded px-2 py-1"
            />
          </label>
        </div>
        {statusError && <p className="text-sm text-red-600">{statusError}</p>}
        <button
          onClick={handleSaveStatus}
          disabled={savingStatus}
          className="bg-gips-green text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
        >
          {savingStatus ? "Salvataggio…" : "Aggiorna stato evento"}
        </button>
      </div>

      <section>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Convocazioni</h3>
          <button
            onClick={handleSaveCallups}
            disabled={savingCallups}
            className="bg-gips-green text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
          >
            {savingCallups ? "Salvataggio…" : "Salva convocazioni"}
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

      <section>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Presenze</h3>
          <button
            onClick={handleSaveAttendance}
            disabled={savingAttendance || attendance.length === 0}
            className="bg-gips-green text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
          >
            {savingAttendance ? "Salvataggio…" : "Salva presenze"}
          </button>
        </div>
        {attendance.length === 0 ? (
          <p className="text-gray-500">
            Salva prima le convocazioni: le presenze si registrano solo per i
            giocatori convocati.
          </p>
        ) : (
          <ul className="divide-y bg-white rounded-lg shadow">
            {attendance.map((a) => (
              <li
                key={a.playerId}
                className="p-3 flex items-center justify-between gap-2"
              >
                <span>{a.playerName}</span>
                <select
                  value={a.status}
                  onChange={(e) =>
                    setAttendanceStatus(
                      a.playerId,
                      e.target.value as AttendanceStatus,
                    )
                  }
                  className="border rounded px-2 py-1 text-sm"
                >
                  {Object.entries(ATTENDANCE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
