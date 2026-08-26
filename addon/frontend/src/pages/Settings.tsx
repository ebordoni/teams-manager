import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { GoogleStatus } from "../types";

export default function Settings() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadStatus() {
    setLoading(true);
    api
      .getGoogleStatus()
      .then((res) => setStatus(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await api.getGoogleAuthUrl();
      // Apre l'URL di consenso Google in una nuova scheda: il redirect_uri
      // punta alla porta diretta dell'addon (fuori dall'iframe di Ingress).
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Errore durante la richiesta dell'URL di autorizzazione";
      setError(message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await api.disconnectGoogle();
    loadStatus();
  }

  if (loading) return <p className="text-gray-500">Caricamento…</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Impostazioni</h2>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="font-semibold">Google (Docs + Drive)</h3>
        <p className="text-sm text-gray-500">
          Collega il tuo account Google per generare automaticamente il
          documento delle comunicazioni ai genitori.
        </p>

        {!status?.configured && (
          <p className="text-sm text-orange-600">
            Client ID/Secret Google non configurati: impostali nelle opzioni
            dell'addon (Impostazioni → Add-on → GIPS Calcio → Configurazione).
          </p>
        )}

        {status?.configured && (
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2 py-1 rounded ${
                status.connected
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {status.connected ? "Collegato" : "Non collegato"}
            </span>
            {status.connected ? (
              <button
                onClick={handleDisconnect}
                className="text-sm text-red-600 hover:underline"
              >
                Disconnetti
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-gips-green text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
              >
                {connecting ? "Attendere…" : "Collega Google"}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
