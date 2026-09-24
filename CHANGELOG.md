# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e il versioning segue [Semantic Versioning](https://semver.org/).

---

## [0.19.8] — 2026-09-24

### Aggiunto

- Piano partita manuale: crea tempi vuoti senza interrogare l'AI e compila le formazioni in autonomia.
- Editor visuale 2-3-1 con selezione del giocatore al tocco della posizione e panchina aggiornata in tempo reale.
- Navigazione di un tempo alla volta tramite stepper e riepilogo del minutaggio sull'intero piano.

### Modificato

- La pagina “Piano partita AI” è ora “Piano partita”; generazione AI e compilazione manuale sono due flussi affiancati.
- Il campo virtuale è un componente condiviso anche con la sezione Formazioni.

## [0.19.7] — 2026-09-24

### Corretto

- I marcatori vengono ora riletti correttamente dal database dopo il salvataggio e il refresh della scheda evento.

### Aggiunto

- Statistiche giocatore con gol totali e numero di partite in cui è andato a segno.

## [0.19.6] — 2026-09-24

### Aggiunto

- Marcatori della squadra nel risultato partita, con assegnazione dei gol ai giocatori e validazione del totale.

### Modificato

- Scheda evento con avversario esplicito, tabellone risultato ottimizzato per mobile e sezione presenze richiusa inizialmente.

## [0.19.5] — 2026-09-24

### Corretto

- Il proxy API di Vite in Docker Compose raggiunge il servizio backend tramite il DNS di rete `backend:3002`, invece di tentare il localhost del container frontend.

### Modificato

- Il target del proxy è ora configurabile con `VITE_API_PROXY_TARGET`; l'avvio locale nativo conserva `localhost:3002` come predefinito.

## [0.19.4] — 2026-09-24

### Aggiunto

- Avatar con iniziali e numero di maglia per ogni giocatore nell'elenco.
- Campo numero di maglia da 1 a 99, persistito con migrazione SQLite e protetto da unicità.

### Modificato

- Le schede giocatore mostrano piede preferito e ruoli in un elenco dati semantico; le caratteristiche tecniche restano disponibili solo in modifica.

## [0.19.3] — 2026-09-24

### Aggiunto

- Creazione ricorrente settimanale dal calendario: un solo inserimento genera tutti gli appuntamenti fino alla data scelta.
- Validazioni su date, intervallo e limite massimo di 104 occorrenze, con creazione atomica lato server.

### Modificato

- Le occorrenze vengono salvate come eventi indipendenti, per consentire modifica, annullamento, presenze ed export individuali.

## [0.19.2] — 2026-09-24

### Modificato

- Tutte le date di sola visualizzazione usano ora il formato italiano `GG-MM-AAAA`, mantenendo il formato ISO nei dati, nelle API e nel database.
- Calendari Mantine localizzati in italiano, con lunedì come primo giorno della settimana.
- Titoli dei piani partita generati con data ISO resi leggibili nell'interfaccia, senza alterare il dato salvato.

### Documentazione

- Aggiunta alla bacheca tecnica la parte residua dell'hardening: import JSON validato, gestione backup e verifica upgrade reale.

## [0.19.1] — 2026-09-24

### Aggiunto

- Migrazioni SQLite versionate, transazionali e verificabili fino alla versione schema 3.
- Backup automatico con timestamp del database esistente prima di applicare una migrazione.
- Controllo `integrity_check` SQLite all'avvio dopo le migrazioni.
- Export JSON dei dati gestionali dalle Impostazioni, senza token Google, chiavi AI o stato OAuth.

### Modificato

- La cancellazione di un giocatore con presenze confermate lo archivia per preservare lo storico; i giocatori archiviati non compaiono nella rosa attiva.

## [0.19.0] — 2026-09-23

### Aggiunto

- Risultati partita con punteggio, campo, note e operazioni complete di creazione, modifica ed eliminazione.
- Registro presenze chiudibile: alla conferma viene salvata una fotografia esplicita di tutta la rosa e le modifiche successive sono bloccate fino alla riapertura.
- Storico presenze per ciascun giocatore, filtrato sui registri confermati e con percentuale di partecipazione.
- Pagina “Registro presenze” di squadra con filtri per periodo/tipo e matrice giocatori-eventi.
- Dashboard con KPI su risultati, gol e presenze confermate, oltre agli ultimi risultati.

### Modificato

- La pagina evento riunisce risultato, presenze provvisorie e chiusura del registro in un unico flusso operativo.
- Calendario arricchito con punteggio partita e indicazione dei registri presenze chiusi.

## [0.18.2] — 2026-09-23

### Aggiunto

- Fix export piano partita

## [0.18.1] — 2026-09-23

### Aggiunto

- Dopo l'export del piano partita, la pagina mostra un link persistente e cliccabile al Google Doc appena creato.
- Comando `npm run version:bump -- <patch|minor|major|X.Y.Z>` per aggiornare versioni, lockfile, artefatti Home Assistant e changelog.

### Modificato

- Il controllo di coerenza versioni comprende ora README, specifiche, changelog e package dell'add-on oltre agli artefatti di build.
- Corretto lo stile della riga “Panchina” nell'export Google Docs e reso diagnostico l'errore restituito dall'API in caso di fallimento.

## [0.18.0] — 2026-09-23

### Aggiunto

- Export del piano partita in Google Docs, con formazione per ogni tempo, panchina, ruoli e riepilogo del minutaggio.
- Verifica dell'accesso al Google Calendar configurato direttamente dalle Impostazioni.

### Modificato

- Chiarito nella UI il comportamento dell'export Calendar: è unidirezionale, manuale e aggiorna gli eventi già esportati quando viene ripetuto.

## [0.17.0] — 2026-09-23

### Aggiunto

- Profilo tecnico compatto visibile direttamente nell'elenco giocatori sui display larghi.

### Modificato

- Rinominate identità, package, repository, CI e configurazione Home Assistant in Teams Manager.
- Nuove installazioni usano il database `teams-manager.db`; quelle esistenti continuano a leggere automaticamente il database storico senza perdere dati.

## [0.16.0] — 2026-09-23

### Aggiunto

- Impostazione persistente del nome squadra, usata dinamicamente nelle pagine partita e nelle comunicazioni Google.

### Modificato

- Branding tecnico di Google Calendar e Drive aggiornato a Teams Manager.

## [0.15.0] — 2026-09-23

### Aggiunto

- Anagrafica giocatori con piede preferito e valutazioni 0–100 per forma fisica, velocità, tecnica, tiro, difesa e attacco.
- Il pianificatore AI e il fallback locale considerano profilo tecnico e piede per preferire le fasce corrette e distribuire qualità tra i tempi.

### Modificato

- Il pannello di modifica giocatore compare in alto e porta automaticamente la vista all'inizio della pagina.

## [0.14.0] — 2026-09-23

### Modificato

- Calendario: gli eventi nelle celle sono ora mostrati come etichette leggibili con icona, orario e accento di stato.
- Rimossa la gestione manuale delle convocazioni: ogni evento, comunicazione e piano partita usa automaticamente l'intera rosa.
- Presenze semplificate: tutti i giocatori sono presenti per impostazione predefinita e si deselezionano soltanto gli assenti.
- Eliminata la registrazione duplicata dei router API di convocazioni e presenze.

## [0.13.0] — 2026-09-22

### Modificato

- Eliminati file duplicati

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
