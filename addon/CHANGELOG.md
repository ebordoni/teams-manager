# Changelog

## [Unreleased]

### Added

- Fase 5 (Google): OAuth 2.0 con account personale (`services/google/auth.ts`), Google Drive API (cartella "GIPS Calcio/Comunicazioni", condivisione link), Google Docs API (creazione documento con appuntamenti formattati)
- Endpoint `GET /api/google/status`, `GET /api/google/oauth/url`, `GET /api/google/oauth/callback`, `POST /api/google/disconnect`
- Endpoint `GET/POST /api/communications` per generare e storicizzare le comunicazioni ai genitori
- Pagina "Impostazioni" per collegare/scollegare l'account Google
- Calendario: selezione multipla eventi + pulsante "Genera comunicazione" con link al documento e messaggio WhatsApp precompilato da copiare
- Porta diretta `8101/tcp` esposta (oltre a Ingress) necessaria per il redirect URI OAuth di Google
- Presenze (F04): tabella `attendance`, endpoint `GET/PUT /api/events/:id/attendance`, UI di registrazione presenze nel dettaglio evento
- Validazione stato evento: le note sono obbligatorie quando un evento viene segnato come modificato o annullato, con badge di stato in calendario e dettaglio
- UI responsive: menu a hamburger su mobile, form del calendario a colonna singola su schermi piccoli

## [0.1.0] - 2026-08-26

### Added

- Boilerplate iniziale dell'addon Home Assistant: backend Express + SQLite, frontend React + Vite, packaging Docker/Ingress
- Schema dati per giocatori, eventi (allenamenti/partite/tornei) e convocazioni
- API CRUD per giocatori ed eventi, gestione convocazioni
- Dashboard, calendario, anagrafica giocatori e dettaglio evento (scheletro UI)
