# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e il versioning segue [Semantic Versioning](https://semver.org/).

---

## [0.12.0] — 2026-09-22

### Aggiunto

- Generazione AI multi-provider dei piani partita, con una formazione per ogni tempo e minimizzazione deterministica delle differenze di minutaggio.
- Pagina di configurazione AI con provider, modello, fallback, test connessione e valori predefiniti della partita.
- Pagina piano partita con storico, modifica manuale, panchina, riepilogo minuti, conferma e cancellazione.
- Motore locale di fallback, validazione di giocatori, ruoli e portiere, persistenza dei piani e test API dedicati.

### Sicurezza

- I provider AI ricevono soltanto pseudonimi e ruoli; nomi e chiavi API non vengono inviati al browser.

## [0.11.0] — 2026-09-22

### Modificato

- Calendario più leggibile su desktop e mobile, correzioni a tipi evento, presenze, Google Calendar e gestione degli errori OAuth.
- Nuovi smoke test per presenze, stati evento e ricollegamento Google.

## [0.10.0] — 2026-09-22

### Modificato

- Selettore delle icone dei tipi evento ampliato a 33 icone Tabler, ricercabile in italiano e con anteprima immediata dell’icona selezionata e delle opzioni.

## [0.9.0] — 2026-09-22

### Aggiunto

- Pagine frontend caricate su richiesta, schermata di caricamento uniforme e boundary di recupero dagli errori di rendering.
- Smoke test API eseguiti in CI: healthcheck, flusso giocatore/evento/convocazione e validazione del tipo evento.

### Modificato

- Bundle frontend suddiviso per pagina e libreria: eliminato il warning di build sul chunk oltre 500 kB e migliorata la fruizione iniziale su mobile.
- Avvio del server separato dalla costruzione dell'app Express, con chiusura esplicita della connessione SQLite per test e shutdown ordinati.

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
