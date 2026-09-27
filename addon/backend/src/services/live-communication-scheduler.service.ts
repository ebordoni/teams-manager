import { getLiveCommunication, refreshLiveCommunication } from "./communication.service";

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let dailyTimer: ReturnType<typeof setTimeout> | undefined;

function refreshInBackground(reason: string): void {
  // Il primo documento è una scelta esplicita dell'utente; da quel momento
  // tutti gli aggiornamenti successivi sono automatici.
  if (!getLiveCommunication()) return;
  void refreshLiveCommunication().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[communications] Aggiornamento automatico (${reason}) non riuscito: ${message}`);
  });
}

/** Raggruppa più modifiche vicine (per esempio una ricorrenza) in un solo refresh. */
export function queueLiveCommunicationRefresh(): void {
  if (process.env.NODE_ENV === "test") return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    refreshInBackground("modifica eventi");
  }, 1_000);
}

function millisecondsUntilNextDailyRefresh(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const currentSeconds = value("hour") * 3600 + value("minute") * 60 + value("second");
  const targetSeconds = 3 * 3600 + 5 * 60;
  let delay = (targetSeconds - currentSeconds) * 1_000 - now.getMilliseconds();
  if (delay <= 0) delay += 24 * 60 * 60 * 1_000;
  return delay;
}

/** Aggiorna ogni giorno il documento, così gli appuntamenti scaduti spariscono. */
export function startLiveCommunicationScheduler(): void {
  if (dailyTimer) return;
  const scheduleNext = () => {
    dailyTimer = setTimeout(() => {
      dailyTimer = undefined;
      refreshInBackground("pulizia giornaliera");
      scheduleNext();
    }, millisecondsUntilNextDailyRefresh());
  };
  scheduleNext();
}
