import { createHash } from "node:crypto";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const dateLabel = (date) => new Intl.DateTimeFormat("it-IT", { dateStyle: "full", timeZone: "Europe/Rome" }).format(new Date(`${date}T12:00:00Z`));
const isoDay = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function demoEvents(now = new Date()) {
  const today = isoDay(now);
  const day = (offset) => {
    const value = new Date(`${today}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  return [
    { id: 1, date: day(-1), type: "training", title: "Allenamento", icon: "🏃", start: "17:45", end: "19:15", location: "Campo dimostrativo", note: "Evento passato di esempio", past: true },
    { id: 2, date: day(1), type: "training", title: "Allenamento", icon: "🏃", start: "17:45", end: "19:15", location: "Campo dimostrativo", note: "Portare borraccia e abbigliamento da allenamento." },
    { id: 3, date: day(3), type: "match", title: "Partita in trasferta", icon: "⚽", match: "SQUADRA OSPITANTE VS SQUADRA DEMO", start: "10:00", end: "11:30", meeting: "09:30", location: "Centro sportivo di esempio", note: "Gli orari sono dimostrativi, non indicazioni per la squadra reale." },
    { id: 4, date: day(5), type: "training", title: "Allenamento annullato", icon: "🏃", start: "17:45", location: "Campo dimostrativo", note: "Annullato · esempio di comunicazione ben visibile", cancelled: true },
  ];
}

function eventCard(event, featured = false) {
  return `<article id="evento-${event.id}" class="event ${featured ? "featured" : ""} ${event.past ? "past" : ""}" data-type="${escape(event.type)}">
    ${featured ? '<span class="eyebrow">Il prossimo appuntamento</span>' : ""}
    <p class="date">${escape(dateLabel(event.date))}</p>
    <h${featured ? "2" : "3"}>${escape(event.icon)} ${escape(event.title)}</h${featured ? "2" : "3"}>
    ${event.match ? `<p class="match">${escape(event.match)}</p>` : ""}
    <dl>${event.meeting ? `<div><dt>Ritrovo</dt><dd>${escape(event.meeting)}</dd></div>` : ""}${event.start ? `<div><dt>Orario</dt><dd>${escape(event.start)}${event.end ? ` – ${escape(event.end)}` : ""}</dd></div>` : ""}${event.location ? `<div><dt>Luogo</dt><dd>${escape(event.location)}</dd></div>` : ""}</dl>
    ${event.note ? `<p class="note ${event.cancelled ? "cancelled" : ""}">${escape(event.note).replace(/\r?\n/g, "<br>")}</p>` : ""}
  </article>`;
}

function page(title, content, active, updatedAt, { teamName, demo }) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="Sito dimostrativo Teams Manager, senza dati reali."><title>${escape(title)} · Squadra demo</title><link rel="stylesheet" href="/style.css"><script src="/site.js" defer></script></head><body>
  <a class="skip" href="#contenuto">Vai al contenuto</a>${demo ? '<div class="demo">PROTOTIPO · Dati fittizi, nessun appuntamento reale</div>' : ""}
  <header><a class="brand" href="/"><span class="crest" aria-hidden="true">TM</span><span>${escape(teamName)}<small>La squadra, sempre vicina</small></span></a><nav aria-label="Menu principale">${[["/", "Bacheca"], ["/avvisi/", "Avvisi"], ["/informazioni/", "Informazioni"]].map(([url, label]) => `<a href="${url}"${active === url ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav></header>
  <main id="contenuto">${content}</main><footer><strong>${escape(teamName)}</strong><span>Ultimo aggiornamento: ${escape(updatedAt)}</span><span>${demo ? "Prototipo Teams Manager · nessun dato personale" : "Appuntamenti di squadra"}</span></footer></body></html>`
    .replace('content="Sito dimostrativo Teams Manager, senza dati reali."', () => `content="${escape(teamName)} · Appuntamenti di squadra"`)
    .replace("· Squadra demo</title>", () => `· ${escape(teamName)}</title>`);
}

export function buildDemo(now = new Date()) {
  return buildSite({ events: demoEvents(now), teamName: "Squadra demo", demo: true, intro: "Appuntamenti, orari e novità. Tutto quello che serve, in un unico posto.", notice: "Benvenuti nella nuova bacheca. Questa pagina contiene soltanto dati fittizi.", information: "Le informazioni qui presenti sono inventate. Il prototipo non legge il database, non pubblica nomi dei giocatori e non richiede un account ai visitatori." }, now);
}

export function buildSite(model, now = new Date()) {
  const { events, teamName, demo, intro, notice, information } = model;
  const upcoming = events.filter((event) => !event.past);
  const next = upcoming.find((event) => !event.cancelled);
  const updatedAt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(now);
  const hero = `<section class="intro"><span class="eyebrow">La bacheca della squadra</span><h1>Ci vediamo<br>in campo.</h1><p>Appuntamenti, orari e novità.<br>Tutto quello che serve, in un unico posto.</p></section>`;
  const typeOptions = [...new Map(upcoming.map((event) => [event.type, event.typeLabel ?? event.type])).entries()].map(([value, label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join("");
  const text = (value) => escape(value).replace(/\r?\n/g, "<br>");
  const past = events.filter((event) => event.past).slice(-1)[0];
  const agenda = `${hero.replace("Appuntamenti, orari e novità.<br>Tutto quello che serve, in un unico posto.", () => text(intro))}${notice ? `<aside class="event"><h2>Avviso di squadra</h2><p>${text(notice)}</p></aside><br>` : ""}${next ? eventCard(next, true) : '<article class="event"><h2>Nessun appuntamento in programma</h2></article>'}<section class="agenda"><div class="section-title"><h2>In programma</h2><label>Mostra <select id="tipo"><option value="all">Tutti gli eventi</option>${typeOptions}</select></label></div><p id="filter-status" class="sr-only" aria-live="polite"></p><div class="events">${upcoming.filter((event) => event !== next).map((event) => eventCard(event)).join("")}</div></section>${past ? `<section class="history"><h2>L'ultimo appuntamento</h2>${eventCard(past)}</section>` : ""}`;
  const wrap = (title, body, active) => page(title, body, active, updatedAt, { teamName, demo });
  const files = new Map([
    ["/index.html", wrap("Bacheca", agenda, "/")],
    ["/robots.txt", "User-agent: *\nDisallow: /\n"],
  ]);
  files.set("/avvisi/index.html", wrap("Avvisi", `<section class="intro compact"><h1>Avvisi di squadra</h1></section><article class="event"><p>${text(notice || "Nessun avviso pubblicato.")}</p></article>`, "/avvisi/"));
  files.set("/informazioni/index.html", wrap("Informazioni", `<section class="intro compact"><h1>${escape(teamName)}</h1></section><article class="event"><p>${text(information || "Nessuna informazione aggiuntiva pubblicata.")}</p></article>`, "/informazioni/"));
  files.set("/404.html", wrap("Pagina non trovata", '<section class="intro"><h1>Pagina non trovata</h1><a href="/">Torna alla bacheca</a></section>', ""));
  const revision = createHash("sha256").update([...files.values()].join("\n")).digest("hex");
  files.set("/manifest.json", JSON.stringify({ prototype: Boolean(demo), revision, generatedAt: now.toISOString() }));
  return files;
}
