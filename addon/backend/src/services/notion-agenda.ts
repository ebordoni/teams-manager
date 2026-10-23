import type { CommunicationContent, CommunicationParagraph } from "./communication-content";

interface AgendaEntry {
  date: CommunicationParagraph;
  details: CommunicationParagraph[];
}

// Enhanced Markdown v1: i dettagli rimangono tutti visibili, anche su smartphone.
// Le nuove righe dei testi utente non devono creare blocchi o uscire dal callout.
function escape(text: string): string {
  return text.replace(/[\\*~`$\[\]<>{}|^#]/g, "\\$&").replace(/\r\n?|\n/g, "<br>");
}

function renderParagraph(paragraph: CommunicationParagraph): string {
  let text = escape(paragraph.text);
  if (["event", "match", "date"].includes(paragraph.kind)) text = `**${text}**`;
  if (paragraph.kind === "note") text = `*${text}*`;
  return paragraph.past ? `~~${text}~~ {color="gray"}` : text;
}

function renderEntry(entry: AgendaEntry): string {
  const date = escape(entry.date.text);
  const heading = entry.date.past ? `### ~~${date}~~ {color="gray"}` : `### ${date}`;
  return [heading, ...entry.details.map(renderParagraph)].join("\n\n");
}

export function renderNotionMarkdown(content: CommunicationContent): string {
  const header: string[] = [];
  const entries: AgendaEntry[] = [];
  let current: AgendaEntry | undefined;
  for (const paragraph of content.paragraphs) {
    if (!paragraph.text) continue;
    if (paragraph.kind === "date") {
      current = { date: paragraph, details: [] };
      entries.push(current);
    } else if (current) {
      current.details.push(paragraph);
    } else {
      header.push(`${paragraph.kind === "title" ? "# " : ""}${escape(paragraph.text)}`);
    }
  }

  const upcoming = entries.filter((entry) => !entry.date.past);
  const next = upcoming.find((entry) => entry.date.event?.status !== "cancelled");
  const remaining = upcoming.filter((entry) => entry !== next);
  const past = entries.filter((entry) => entry.date.past).slice(-1);
  const sections = [...header];
  if (next) {
    // Ogni blocco figlio è indentato con un tab, come richiesto da Notion.
    const card = ["**Prossimo appuntamento**", renderEntry(next)].join("\n\n");
    sections.push(`<callout icon="📅" color="blue_bg">\n${card.split("\n").map((line) => `\t${line}`).join("\n")}\n</callout>`);
  } else {
    sections.push("Nessun appuntamento in programma.");
  }
  if (remaining.length) {
    sections.push("## Altri appuntamenti", remaining.map(renderEntry).join("\n\n---\n\n"));
  }
  if (past.length) {
    sections.push('## Ultimo appuntamento passato {color="gray"}', renderEntry(past[0]));
  }
  return sections.join("\n\n");
}
