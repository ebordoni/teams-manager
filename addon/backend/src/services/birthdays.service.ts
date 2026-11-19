import { z } from "zod";
import { getDb } from "../db/schema";

export function romeDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data di nascita non valida")
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value &&
      value >= "1900-01-01" &&
      value <= romeDay()
    );
  }, "Inserisci una data di nascita valida, non futura");
export const birthdayPublicNameSchema = z
  .string()
  .trim()
  .min(1, "Indica il nome da usare negli auguri pubblici")
  .max(60)
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Nome pubblico non valido",
  );

export function isBirthdayOn(birthDate: string, day: string): boolean {
  if (birthDate.slice(5) === day.slice(5)) return true;
  // Un promemoria ogni anno anche per chi è nato il 29 febbraio.
  const year = Number(day.slice(0, 4));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return !leap && birthDate.slice(5) === "02-29" && day.slice(5) === "02-28";
}

export function birthdaySettingsError(
  birthDate: string | null,
  publicName: string | null,
): string | null {
  return publicName !== null && !birthDate
    ? "Inserisci la data di nascita prima di abilitare gli auguri pubblici."
    : null;
}

export function birthdaysToday(now = new Date()) {
  const date = romeDay(now);
  const rows = getDb()
    .prepare(
      "SELECT id,name,photo,birth_date FROM players WHERE archived_at IS NULL AND birth_date IS NOT NULL ORDER BY name,id",
    )
    .all() as Array<{
    id: number;
    name: string;
    photo: string | null;
    birth_date: string;
  }>;
  return {
    date,
    players: rows
      .filter((row) => isBirthdayOn(row.birth_date, date))
      .map(({ id, name, photo }) => ({ id, name, photo })),
  };
}

/** Il modello pubblico non contiene mai anagrafica, foto, età o anno di nascita. */
export function publicBirthdaysToday(now = new Date()) {
  const day = romeDay(now);
  const rows = getDb()
    .prepare(
      "SELECT birth_date,birthday_public_name FROM players WHERE archived_at IS NULL AND birth_date IS NOT NULL AND birthday_public_name IS NOT NULL ORDER BY birthday_public_name,id",
    )
    .all() as Array<{ birth_date: string; birthday_public_name: string }>;
  const names = rows
    .filter((row) => isBirthdayOn(row.birth_date, day))
    .map((row) => row.birthday_public_name);
  return names.length ? { day, names } : null;
}
