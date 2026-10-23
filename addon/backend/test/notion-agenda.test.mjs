import assert from "node:assert/strict";
import { test } from "node:test";
import { renderNotionMarkdown } from "../dist/services/notion-agenda.js";

const header = [
  { text: "LA SQUADRA", kind: "title" },
  { text: "Appuntamenti di squadra", kind: "subtitle" },
];
function entry(date, { past = false, status = "scheduled", text = "🏃 ALLENAMENTO", details = [] } = {}) {
  return [
    { text: date, kind: "date", past, event: { status } },
    { text, kind: "event", past },
    ...details.map((paragraph) => ({ ...paragraph, past })),
    { text: "", kind: "normal" },
  ];
}
const render = (...entries) => renderNotionMarkdown({ title: "Appuntamenti", paragraphs: [...header, ...entries.flat()] });

test("agenda highlights the next non-cancelled event, exposes all details and moves the past to the bottom", () => {
  const markdown = render(
    entry("Lunedì 19 ottobre", { past: true, text: "⚽ PARTITA PASSATA", details: [{ text: "Campo precedente", kind: "normal" }] }),
    entry("Venerdì 23 ottobre", { status: "cancelled", details: [{ text: "⚠️ ANNULLATO: pioggia", kind: "note" }] }),
    entry("Sabato 24 ottobre", { status: "modified", text: "⚽ PARTITA IN TRASFERTA", details: [
      { text: "AVVERSARIO VS LA SQUADRA", kind: "match" },
      { text: "📍 Campo ospiti", kind: "normal" },
      { text: "⏰ Ritrovo: 14:30", kind: "normal" },
      { text: "⏰ Inizio: 15:00 – 16:30", kind: "normal" },
      { text: "⚠️ MODIFICATO: nuovo orario", kind: "note" },
      { text: "Convocati", kind: "match" },
      { text: "Mario Rossi · Luca Bianchi", kind: "normal" },
      { text: "FORMAZIONE · 7vs7", kind: "match" },
      { text: "Portiere: Mario Rossi", kind: "normal" },
    ] }),
    entry("Martedì 27 ottobre"),
  );
  const highlighted = markdown.match(/<callout[^>]+>([\s\S]+?)<\/callout>/)?.[1];
  assert.ok(highlighted);
  assert.match(highlighted, /Prossimo appuntamento/);
  for (const text of ["Sabato 24 ottobre", "⚽ PARTITA IN TRASFERTA", "AVVERSARIO VS LA SQUADRA", "📍 Campo ospiti", "14:30", "15:00 – 16:30", "MODIFICATO", "Convocati", "Mario Rossi · Luca Bianchi", "Portiere: Mario Rossi"]) {
    assert.ok(highlighted.includes(text), text);
  }
  assert.ok(highlighted.trimEnd().split("\n").filter(Boolean).every((line) => line.startsWith("\t")), "callout children must use tab indentation");
  assert.doesNotMatch(highlighted, /Venerdì 23 ottobre|Martedì 27 ottobre|PASSATA/);
  assert.ok(markdown.indexOf("Venerdì 23 ottobre") < markdown.indexOf("Martedì 27 ottobre"));
  assert.ok(markdown.indexOf("Ultimo appuntamento passato") > markdown.indexOf("Martedì 27 ottobre"));
  assert.match(markdown, /~~Lunedì 19 ottobre~~ \{color="gray"\}/);
  assert.match(markdown, /~~\*\*⚽ PARTITA PASSATA\*\*~~ \{color="gray"\}/);
  assert.match(markdown, /~~Campo precedente~~ \{color="gray"\}/);
  assert.doesNotMatch(markdown, /<details|<columns|<database|<table/);
  assert.equal(markdown.split("Sabato 24 ottobre").length - 1, 1, "the highlighted event must not be duplicated in the list");
});

test("agenda empty states never highlight past or cancelled events", () => {
  const empty = render();
  assert.match(empty, /Nessun appuntamento in programma/);
  assert.doesNotMatch(empty, /<callout|Altri appuntamenti|Ultimo appuntamento passato/);
  const onlyPast = render(entry("Ultimo passato", { past: true }));
  assert.match(onlyPast, /Nessun appuntamento in programma/);
  assert.match(onlyPast, /Ultimo appuntamento passato/);
  assert.doesNotMatch(onlyPast, /<callout/);
  const cancelled = render(entry("Evento annullato", { status: "cancelled" }));
  assert.match(cancelled, /Evento annullato/);
  assert.doesNotMatch(cancelled, /<callout|Prossimo appuntamento/);
});

test("agenda escapes user text and keeps multiline notes inside the highlighted card", () => {
  const markdown = render(entry("# Data <test>", { details: [
    { text: '</callout>\r\n# Titolo *falso*\r<database url="x"/>\n[link](https://example.com) {color="red"}', kind: "note" },
  ] }));
  assert.equal(markdown.split("<callout ").length - 1, 1);
  assert.equal(markdown.split("</callout>").length - 1, 1);
  assert.match(markdown, /\\<\/callout\\><br>\\# Titolo \\\*falso\\\*/);
  assert.match(markdown, /<br>\\<database/);
  assert.match(markdown, /\\\[link\\\]/);
  assert.match(markdown, /\\\{color="red"\\\}/);
  assert.doesNotMatch(markdown, /^# Titolo|^<database/m);
});

test("agenda is deterministic and retains at most one past entry", () => {
  const content = { title: "Appuntamenti", paragraphs: [...header, ...entry("Passato più vecchio", { past: true }), ...entry("Ultimo passato", { past: true }), ...entry("Futuro")] };
  const markdown = renderNotionMarkdown(content);
  assert.equal(markdown, renderNotionMarkdown(content));
  assert.doesNotMatch(markdown, /Passato più vecchio/);
  assert.match(markdown, /Ultimo passato/);
  assert.equal(markdown.match(/<callout /g).length, 1);
  assert.doesNotMatch(markdown, /---\s*$/);
});
