# Changelog

## [0.18.1] — 2026-09-23

### Added

- The match-plan page now keeps a visible, clickable link to the Google Doc just exported.
- `npm run version:bump -- <patch|minor|major|X.Y.Z>` updates versions, lockfiles, Home Assistant artifacts and changelogs.

### Changed

- Version verification now also covers README, specs, changelogs and the add-on package.
- Fixed the “Panchina” style in the Google Docs export and return the API diagnostic when an export fails.

## [0.18.0] — 2026-09-23

### Added

- Esportazione del piano partita in Google Docs con schieramento per tempo, panchina, ruoli e minutaggio complessivo.
- Controllo dell'accesso al Google Calendar impostato, disponibile dalla schermata Impostazioni.

### Changed

- UI Calendar chiarita: l'export è manuale, unidirezionale e aggiorna gli eventi già presenti quando rieseguito.

## [0.17.0] — 2026-09-23

### Added

- Profilo tecnico sintetico nell'elenco giocatori per gli schermi desktop ampi.

### Changed

- Identità, package, repository, CI e configurazione Home Assistant rinominati in Teams Manager.
- Nuove installazioni usano `teams-manager.db`; il database storico viene mantenuto automaticamente per gli aggiornamenti esistenti.

## [0.16.0] — 2026-09-23

### Added

- Impostazione persistente del nome squadra, riutilizzata in piano partita e comunicazioni per i genitori.

### Changed

- Branding tecnico di Google Calendar e Drive aggiornato a Teams Manager.

## [0.15.0] — 2026-09-23

### Added

- Piede preferito e valutazioni 0–100 per forma fisica, velocità, tecnica, tiro, difesa e attacco nella scheda giocatore.
- Pianificazione AI e fallback locale sensibili a piede, ruoli e profilo tecnico per preferire destra/sinistra e rendere equilibrati i tempi.

### Changed

- Il pannello di modifica giocatore viene mostrato sopra l'elenco e raggiunto automaticamente con scroll fluido.

## [0.14.0] — 2026-09-23

### Changed

- Eventi nel calendario resi più visibili con etichetta, icona, orario e accento di stato.
- Convocazioni manuali rimosse: l'intera rosa è automaticamente inclusa in eventi, comunicazioni e piani partita AI.
- Presenze a checkbox, tutte selezionate inizialmente; si deselezionano solo gli assenti.
- Rimossa la doppia registrazione dei router API e i riferimenti client alla vecchia funzionalità convocazioni.

## [0.13.0] — 2026-09-22

### Modificato

- Eliminati file duplicati

## [0.12.0] — 2026-09-22

### Aggiunto

- Piani partita AI per più tempi con provider OpenAI, Google, Anthropic, Groq e xAI.
- Distribuzione bilanciata dei minuti, vincoli sui ruoli, fallback locale validato e tutela dei nomi tramite pseudonimi.
- Configurazione AI dedicata e gestione completa dei piani dalla scheda evento.

### Sviluppo

- Tabelle `match_plans`/`match_periods`, API CRUD e smoke test del flusso senza dipendenze esterne.

## [0.11.0] — 2026-09-22

- La pagina Impostazioni non va più in errore: il selettore icone conteneva un valore duplicato, non ammesso da Mantine.
- Azioni di modifica ed eliminazione allineate a destra nell'elenco giocatori.
- Google: il consenso non più valido (`invalid_grant`) viene riconosciuto, il collegamento scaduto rimosso e l'interfaccia invita a ricollegare l'account; gli errori di comunicazioni ed export distinguono 400/403/502.
- Note obbligatorie anche creando un evento già modificato o annullato.
- Presenze: la Dashboard conta solo quelle salvate davvero, il dettaglio evento mostra il totale registrato.
- Il titolo degli eventi su Google Calendar non riporta più il nome tecnico dell'icona.

### Changed

- Calendario più leggibile: giorno in evidenza, icona dell'evento più grande, orario secondario, contorno sui giorni impegnati ed evidenziazione di oggi; su mobile la cella mostra la sola icona.
- Nelle celle il colore resta riservato agli eventi modificati o annullati (orario barrato).

## [0.10.0] - 2026-09-22

### Changed

- Catalogo delle icone evento ampliato, ricercabile e con anteprima nel selettore e nel valore scelto.

## [0.9.0] - 2026-09-22

### Added

- Caricamento lazy delle pagine, indicatore uniforme e recupero da errori di rendering.
- Smoke test API integrati nel comando di qualità e nella CI.

### Changed

- Bundle frontend diviso per pagina e libreria, senza warning per chunk oltre 500 kB; avvio Express e database resi testabili e chiudibili correttamente.

## [0.8.0] - 2026-09-22

### Added

- Comunicazioni arricchite con formazione, convocati e presenze effettivamente registrate.
- Placeholder template Google Docs `{{FORMAZIONI}}` e `{{PRESENZE}}`.

## [0.7.0] - 2026-09-22

### Added

- Formazioni 7vs7 con anteprima visuale del campo 2-3-1, duplicazione e validazione di sette giocatori univoci.
- Dashboard operativa per il prossimo appuntamento, con indicatori di convocazioni, presenze, comunicazione e azioni rapide.

### Changed

- Le formazioni collegate agli eventi sono verificate lato API; la scheda evento evidenzia i titolari non convocati.

## [0.6.0] - 2026-09-22

### Changed

- Il dettaglio evento consente di modificare tipo, data, orari, ritrovo, luogo, indirizzo, avversario, note, stato e formazione associata. Giocatori e formazioni hanno ora anche l'azione di modifica.

## [0.4.0] - 2026-09-21

### Added

- Modifica di nome, icona e flag "ha avversario" dei tipi evento dalle Impostazioni.
- Calendario con anteprime degli eventi nella giornata, creazione rapida sui giorni vuoti e aggiunta dall'agenda del giorno selezionato.
- Export unidirezionale degli eventi selezionati su Google Calendar, con aggiornamento idempotente delle esportazioni successive e calendario di destinazione configurabile.

## [0.3.0] - 2026-09-21

### Added

- Calendario Mantine a tutta larghezza: navigazione mensile, indicatori di stato e agenda contestuale del giorno selezionato; gli eventi sono caricati per il solo mese visualizzato.
- Generazione automatica di Google Doc formattati: titolo, sezioni per data, dettagli dell'evento e convocati usano gli stili tipografici del nuovo builder.

### Changed

- Processo di sviluppo e rilascio: versioni centralmente verificate, CI con build backend/frontend e build Docker dell'add-on.

## [0.2.3] - 2026-09-21

### Fixed

- Tipi evento: non è più possibile rinominare la chiave di un tipo già usato, evitando eventi privi di tipo associato; gli ID delle operazioni di modifica ed eliminazione sono validati.
- Google OAuth: il callback ora verifica un parametro `state` monouso con scadenza, proteggendo il collegamento dell'account da richieste forgiate.
- Comunicazioni: lo storico locale viene eliminato solo dopo la rimozione riuscita del documento da Google Drive; un file già assente viene gestito come pulizia legittima, mentre gli altri errori consentono di riprovare.

### Added

- Base riutilizzabile per costruire documenti Google Docs con segmenti e stili tipografici, pronta per la successiva integrazione nel generatore di comunicazioni.

## [0.2.2] - 2026-08-26

### Added

- Possibilità di eliminare un evento dal Calendario (icona cestino nella lista e nel dettaglio evento), con conferma ed eliminazione a cascata di convocazioni e presenze collegate

## [0.2.1] - 2026-08-26

### Fixed

- Tipi di evento: la chiave non viene più richiesta/validata manualmente ma generata automaticamente (slugify) dal nome inserito, sia nel backend (`event-types.ts`) che nel form di Impostazioni, evitando il rifiuto di caratteri come accenti o spazi

## [0.2.0] - 2026-08-26

### Added

- **Migrazione UI a Mantine 9** (React 19): AppShell con navbar responsive, form, tabelle e notifiche con Mantine al posto di Tailwind
- **Tipi di evento configurabili**: tabella `event_types`, endpoint `GET/POST/PUT/DELETE /api/event-types`, sezione "Tipi di evento" nelle Impostazioni (crea/elimina, flag "ha avversario"). Il campo "Tipo" nel Calendario è ora popolato dinamicamente
- **Generazione documento da template Google Doc** (opzionale): impostabile in Impostazioni incollando il link del documento; supporta i placeholder `{{TITOLO}}`, `{{SETTIMANA}}`, `{{PARTITE}}`, `{{ALLENAMENTI}}` sostituiti via `batchUpdate`. Se non configurato, si usa la generazione automatica esistente
- **Pagina "Comunicazioni"**: storico dei documenti generati con apertura e **eliminazione** (rimuove anche il file da Google Drive tramite `DELETE /api/communications/:id`)
- Fase 5 (Google): OAuth 2.0 con account personale (`services/google/auth.ts`), Google Drive API (cartella "Teams Manager/Comunicazioni", condivisione link), Google Docs API (creazione documento con appuntamenti formattati)
- Endpoint `GET /api/google/status`, `GET /api/google/oauth/url`, `GET /api/google/oauth/callback`, `POST /api/google/disconnect`
- Endpoint `GET/POST /api/communications` per generare e storicizzare le comunicazioni ai genitori
- Pagina "Impostazioni" per collegare/scollegare l'account Google
- Calendario: selezione multipla eventi + pulsante "Genera comunicazione" con link al documento e messaggio WhatsApp precompilato da copiare
- Porta diretta `8102/tcp` esposta (oltre a Ingress) necessaria per il redirect URI OAuth di Google
- Presenze (F04): tabella `attendance`, endpoint `GET/PUT /api/events/:id/attendance`, UI di registrazione presenze nel dettaglio evento
- Validazione stato evento: le note sono obbligatorie quando un evento viene segnato come modificato o annullato, con badge di stato in calendario e dettaglio
- UI responsive: menu a hamburger su mobile, form del calendario a colonna singola su schermi piccoli

### Changed

- Aggiornato React da 18 a 19 per compatibilità con Mantine 9

## [0.1.0] - 2026-08-26

### Added

- Boilerplate iniziale dell'addon Home Assistant: backend Express + SQLite, frontend React + Vite, packaging Docker/Ingress
- Schema dati per giocatori, eventi (allenamenti/partite/tornei) e convocazioni
- API CRUD per giocatori ed eventi, gestione convocazioni
- Dashboard, calendario, anagrafica giocatori e dettaglio evento (scheletro UI)
