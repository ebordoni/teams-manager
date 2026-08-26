# Changelog

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
- Fase 5 (Google): OAuth 2.0 con account personale (`services/google/auth.ts`), Google Drive API (cartella "GIPS Calcio/Comunicazioni", condivisione link), Google Docs API (creazione documento con appuntamenti formattati)
- Endpoint `GET /api/google/status`, `GET /api/google/oauth/url`, `GET /api/google/oauth/callback`, `POST /api/google/disconnect`
- Endpoint `GET/POST /api/communications` per generare e storicizzare le comunicazioni ai genitori
- Pagina "Impostazioni" per collegare/scollegare l'account Google
- Calendario: selezione multipla eventi + pulsante "Genera comunicazione" con link al documento e messaggio WhatsApp precompilato da copiare
- Porta diretta `8101/tcp` esposta (oltre a Ingress) necessaria per il redirect URI OAuth di Google
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
