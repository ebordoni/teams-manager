import type { OAuth2Client } from "google-auth-library";
import crypto from "node:crypto";
import { google } from "googleapis";
import { config } from "../../config";
import { getDb } from "../../db/schema";
import { getSetting, setSetting, SETTINGS_KEYS } from "../settings.service";
import type { GoogleTokensRow } from "../../types";

// Scopes minimi necessari: creare/modificare documenti e gestire nel Drive
// solo i file creati da questa app (non l'intero Drive dell'utente).
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar.events",
];

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function isGoogleConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

function loadStoredTokens(): GoogleTokensRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM google_tokens WHERE id = 1")
    .get() as unknown as GoogleTokensRow | undefined;
}

function saveTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
}): void {
  const db = getDb();
  const existing = loadStoredTokens();
  db.prepare(
    `INSERT INTO google_tokens (id, access_token, refresh_token, scope, token_type, expiry_date, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       scope = excluded.scope,
       token_type = excluded.token_type,
       expiry_date = excluded.expiry_date,
       updated_at = CURRENT_TIMESTAMP`,
  ).run(
    tokens.access_token ?? null,
    // Google invia il refresh_token solo alla prima autorizzazione: se manca,
    // conserviamo quello già salvato per non perdere l'accesso offline.
    tokens.refresh_token ?? existing?.refresh_token ?? null,
    tokens.scope ?? null,
    tokens.token_type ?? null,
    tokens.expiry_date ?? null,
  );
}

export function isGoogleConnected(): boolean {
  const tokens = loadStoredTokens();
  return Boolean(tokens?.refresh_token);
}

export function hasGoogleCalendarAccess(): boolean {
  const scope = loadStoredTokens()?.scope ?? "";
  return scope.split(/\s+/).includes(GOOGLE_CALENDAR_SCOPE);
}

/** Crea e conserva un token monouso per associare consenso e callback OAuth. */
export function createOAuthState(): string {
  const state = crypto.randomBytes(32).toString("base64url");
  setSetting(SETTINGS_KEYS.googleOAuthState, state);
  setSetting(SETTINGS_KEYS.googleOAuthStateCreatedAt, String(Date.now()));
  return state;
}

/** Valida e consuma il token OAuth: non può essere riutilizzato. */
export function consumeOAuthState(state: string): boolean {
  const expected = getSetting(SETTINGS_KEYS.googleOAuthState);
  const createdAt = Number(getSetting(SETTINGS_KEYS.googleOAuthStateCreatedAt));

  // Consuma sempre lo stato, anche se non valido, per evitare callback replay.
  setSetting(SETTINGS_KEYS.googleOAuthState, null);
  setSetting(SETTINGS_KEYS.googleOAuthStateCreatedAt, null);

  if (!expected || !Number.isFinite(createdAt)) return false;
  if (Date.now() - createdAt > OAUTH_STATE_TTL_MS) return false;
  if (state.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected));
}

export function getAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forza il rilascio del refresh_token anche se già concesso in passato
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  saveTokens(tokens);
}

/** Restituisce un client OAuth2 pronto all'uso, con refresh automatico persistito. */
export function getAuthorizedClient(): OAuth2Client {
  const tokens = loadStoredTokens();
  if (!tokens?.refresh_token) {
    throw new Error("Google non collegato: effettua prima l'autorizzazione");
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });

  // Persiste il nuovo access_token (ed eventuale nuovo refresh_token) ogni
  // volta che la libreria lo rinnova automaticamente.
  client.on("tokens", (newTokens) => saveTokens(newTokens));

  return client;
}

export function disconnectGoogle(): void {
  const db = getDb();
  db.prepare("DELETE FROM google_tokens WHERE id = 1").run();
}
