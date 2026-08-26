import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Player } from "../types";

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [showForm, setShowForm] = useState(false);

  function loadPlayers() {
    setLoading(true);
    api
      .getPlayers()
      .then((res) => setPlayers(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createPlayer({ name: name.trim(), role: role.trim() || null });
    setName("");
    setRole("");
    setShowForm(false);
    loadPlayers();
  }

  async function handleDelete(id: number) {
    await api.deletePlayer(id);
    loadPlayers();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Giocatori</h2>
        <button
          className="bg-gips-green text-white text-sm px-3 py-1.5 rounded"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Annulla" : "+ Nuovo giocatore"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow p-4 flex gap-3"
        >
          <input
            type="text"
            placeholder="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-2 py-1 flex-1"
          />
          <input
            type="text"
            placeholder="Ruolo"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border rounded px-2 py-1 flex-1"
          />
          <button
            type="submit"
            className="bg-gips-green text-white text-sm px-3 py-1.5 rounded"
          >
            Salva
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Caricamento…</p>
      ) : players.length === 0 ? (
        <p className="text-gray-500">Nessun giocatore in anagrafica.</p>
      ) : (
        <ul className="divide-y bg-white rounded-lg shadow">
          {players.map((player) => (
            <li
              key={player.id}
              className="p-3 flex justify-between items-center"
            >
              <span>
                <span className="font-medium">{player.name}</span>
                {player.role && (
                  <span className="ml-2 text-sm text-gray-500">
                    {player.role}
                  </span>
                )}
              </span>
              <button
                onClick={() => handleDelete(player.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Elimina
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
