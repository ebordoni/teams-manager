import { getDb } from "../db/schema";
import type { AppSettingRow } from "../types";

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as AppSettingRow | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export const SETTINGS_KEYS = {
  teamName: "team_name",
  googleTemplateDocId: "google_template_doc_id",
  googleCalendarId: "google_calendar_id",
  // Valore temporaneo per proteggere il redirect OAuth da callback forgiati.
  // Non viene mai esposto dall'endpoint delle impostazioni.
  googleOAuthState: "google_oauth_state",
  googleOAuthStateCreatedAt: "google_oauth_state_created_at",
  aiProvider: "ai_provider",
  aiModel: "ai_model",
  aiFallbackProviders: "ai_fallback_providers",
  aiDefaultPeriodCount: "ai_default_period_count",
  aiDefaultMinutesPerPeriod: "ai_default_minutes_per_period",
  aiDefaultPlayersOnField: "ai_default_players_on_field",
  aiDefaultRolePolicy: "ai_default_role_policy",
} as const;

/** Nome mostrato in comunicazioni e pagine di partita; mantiene retrocompatibilità con le comunicazioni esistenti. */
export function getTeamName(): string {
  return getSetting(SETTINGS_KEYS.teamName)?.trim() || "GIPS Salizzole";
}
