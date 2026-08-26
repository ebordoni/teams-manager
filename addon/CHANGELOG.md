# Changelog

## [Unreleased]

### Added

- Presenze (F04): tabella `attendance`, endpoint `GET/PUT /api/events/:id/attendance`, UI di registrazione presenze nel dettaglio evento
- Validazione stato evento: le note sono obbligatorie quando un evento viene segnato come modificato o annullato, con badge di stato in calendario e dettaglio
- UI responsive: menu a hamburger su mobile, form del calendario a colonna singola su schermi piccoli

## [0.1.0] - 2026-08-26

### Added

- Boilerplate iniziale dell'addon Home Assistant: backend Express + SQLite, frontend React + Vite, packaging Docker/Ingress
- Schema dati per giocatori, eventi (allenamenti/partite/tornei) e convocazioni
- API CRUD per giocatori ed eventi, gestione convocazioni
- Dashboard, calendario, anagrafica giocatori e dettaglio evento (scheletro UI)
