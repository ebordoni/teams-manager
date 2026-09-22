# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e il versioning segue [Semantic Versioning](https://semver.org/).

---

## [0.8.0] — 2026-09-22

### Aggiunto

- Comunicazioni per genitori più complete: documento automatico con formazione associata e presenze registrate.
- Nuovi placeholder Google Docs opzionali: `{{FORMAZIONI}}` e `{{PRESENZE}}`.

## [0.7.0] — 2026-09-22

### Aggiunto

- Gestione professionale delle formazioni 7vs7: anteprima su campo 2-3-1, duplicazione e verifica di sette titolari distinti.
- Dashboard operativa con prossimo appuntamento, stato convocazioni/presenze, comunicazioni e azioni rapide.

### Modificato

- Le formazioni associate a un evento sono validate e la scheda partita segnala i titolari non convocati.

## [0.6.0] — 2026-09-22

### Modificato

- CRUD professionale: giocatori, formazioni e appuntamenti sono ora modificabili; le formazioni possono essere associate a un evento.

## [0.4.0] — 2026-09-21

### Aggiunto

- Modifica dei tipi evento dalle Impostazioni e calendario interattivo con anteprime giornaliere e creazione rapida dal giorno selezionato.
- Export unidirezionale e aggiornabile degli eventi selezionati verso Google Calendar.

## [0.3.0] — 2026-09-21

### Aggiunto

- Calendario Mantine a tutta larghezza, con indicatori degli eventi, agenda della giornata selezionata e caricamento mensile.
- Generazione automatica di Google Doc con gerarchia tipografica per appuntamenti, dettagli e convocati.

### Sviluppo

- Controllo centralizzato dell'allineamento delle versioni, CI di build e guida al rilascio dell'add-on.

Per il dettaglio storico dell'add-on, vedi [`addon/CHANGELOG.md`](addon/CHANGELOG.md).
