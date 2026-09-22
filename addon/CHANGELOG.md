# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e il versioning segue [Semantic Versioning](https://semver.org/).

---

## [0.11.0] — 2026-09-22

### Modificato

- Celle del calendario ridisegnate: numero del giorno in evidenza, icona dell'evento leggibile e orario in secondo piano; i giorni con appuntamenti hanno un contorno, oggi è evidenziato e su schermi stretti resta la sola icona (gli orari si leggono nell'agenda del giorno).
- Il colore nelle celle segnala solo le eccezioni: gli eventi modificati o annullati, questi ultimi con orario barrato.

### Corretto

- Pagina Impostazioni di nuovo raggiungibile: il catalogo icone conteneva una voce duplicata e Mantine interrompe il rendering in presenza di opzioni con lo stesso valore.
- Le azioni di modifica ed eliminazione dei giocatori sono allineate a destra, come nelle altre liste.
- Comunicazioni ed export su Google Calendar: quando il consenso Google non è più valido (`invalid_grant`) l'app lo segnala, rimuove il collegamento scaduto e propone di ricollegare l'account dalle Impostazioni, invece di restituire un errore tecnico.
- Gli errori delle comunicazioni distinguono richiesta non valida (400), collegamento Google da rifare (403) e problemi lato Google (502).
- Le note sono obbligatorie anche quando un evento viene creato già modificato o annullato.
- La Dashboard conta solo le presenze effettivamente salvate; il dettaglio evento mostra quante ne sono state registrate.
- Il titolo degli eventi esportati su Google Calendar non contiene più il nome tecnico dell'icona.

### Sviluppo

- Nuovi smoke test API su presenze, note di stato obbligatorie e richiesta di ricollegamento Google.

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
