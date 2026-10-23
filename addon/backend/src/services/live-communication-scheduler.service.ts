import { getLiveCommunication, refreshLiveCommunication } from "./communication.service";
import { isNotionActive, notionStatus } from "./notion.service";
import { isWebsiteActive, websiteSettings } from "./public-site.service";

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let dailyTimer: ReturnType<typeof setTimeout> | undefined;
let firstQueuedAt = 0;

function refreshInBackground(reason: string): void {
  // Il primo documento è una scelta esplicita dell'utente; da quel momento
  // tutti gli aggiornamenti successivi sono automatici.
  if (!getLiveCommunication()) return;
  if (isNotionActive() && !notionStatus().autoSync) return;
  if (isWebsiteActive() && !websiteSettings().autoSync) return;
  void refreshLiveCommunication().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[communications] Aggiornamento automatico (${reason}) non riuscito: ${message}`);
  });
}

/** Raggruppa più modifiche vicine (per esempio una ricorrenza) in un solo refresh. */
export function queueLiveCommunicationRefresh(): void {
  if (process.env.NODE_ENV === "test") return;
  if (!refreshTimer) firstQueuedAt = Date.now();
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    refreshInBackground("modifica eventi");
  }, isWebsiteActive() ? Math.max(0, Math.min(15_000, firstQueuedAt + 60_000 - Date.now())) : 1_000);
}

export function millisecondsUntilNextDailyRefresh(now = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  // Cerca l'istante UTC corrispondente alle 03:05 di Roma: un giorno locale
  // può durare 23 o 25 ore durante il cambio dell'ora legale.
  const nextMinute = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000;
  for (let instant = nextMinute; instant < nextMinute + 48 * 3_600_000; instant += 60_000) {
    if (formatter.format(new Date(instant)) === "03:05:00") return instant - now.getTime();
  }
  return 24 * 3_600_000;
}

/** Aggiorna ogni giorno il documento, così gli appuntamenti scaduti spariscono. */
export function startLiveCommunicationScheduler(): void {
  if (dailyTimer) return;
  if (isWebsiteActive()) refreshInBackground("riavvio");
  const scheduleNext = () => {
    dailyTimer = setTimeout(() => {
      dailyTimer = undefined;
      refreshInBackground("pulizia giornaliera");
      scheduleNext();
    }, millisecondsUntilNextDailyRefresh());
  };
  scheduleNext();
}
