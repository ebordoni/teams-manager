# GIPS Calcio — Specifiche Applicative

> Documento vivo — da aggiornare progressivamente man mano che raccogliamo i requisiti.
> Stato attuale: **boilerplate iniziale (v0.1.0)** — infrastruttura pronta, funzionalità da sviluppare.
> Fonte: documento di progettazione iniziale (2026-08-26).

---

## 1. Obiettivo

Realizzare un **Home Assistant Addon** che permetta di gestire gli appuntamenti della squadra di
calcio (allenamenti, partite, tornei), l'anagrafica dei giocatori e le convocazioni, e che generi su
richiesta un **Google Document** da condividere con i genitori tramite WhatsApp.

Il database (SQLite) rimane locale all'addon: Google Docs è solo il formato di **pubblicazione /
condivisione** della comunicazione verso i genitori, non lo storage principale.

---

## 2. Architettura generale

```
                    HOME ASSISTANT
                          │
                          ▼
              ┌─────────────────────┐
              │  App "GIPS Calcio"  │
              │                     │
              │  ┌───────────────┐  │
              │  │ Database      │  │
              │  │ appuntamenti  │  │
              │  └───────┬───────┘  │
              │          │          │
              │  ┌───────▼────────┐ │
              │  │ Web interface   │ │
              │  │ calendario      │ │
              │  │ giocatori       │ │
              │  │ partite         │ │
              │  └───────┬────────┘ │
              │          │          │
              │  ┌───────▼────────┐ │
              │  │ Google API      │ │
              │  │ Docs + Drive    │ │
              │  └───────┬────────┘ │
              └──────────┼──────────┘
                         │
                         ▼
                 GOOGLE DOCUMENT
                         │
                         ▼
                  Link da WhatsApp
```

### 2.1 Stack tecnico

| Layer    | Tecnologia                                                                 |
| -------- | --------------------------------------------------------------------------- |
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6 (HashRouter), Zustand 4    |
| Backend  | Node.js 24, TypeScript, Express                                            |
| Storage  | SQLite (`node:sqlite`), file system persistente (`/data`)                  |
| Google   | Google Docs API + Google Drive API (OAuth 2.0), Fase 5                     |
| Hosting  | Home Assistant Addon (Docker), Ingress                                     |

```
addon/
├── backend/
│   ├── src/
│   │   ├── config.ts
│   │   ├── index.ts
│   │   ├── db/
│   │   ├── routes/
│   │   ├── services/
│   │   │   └── google/        # auth.ts, docs.ts, drive.ts (Fase 5)
│   │   └── types/
│   └── package.json
├── frontend/
│   ├── src/
│   └── package.json
├── config.yaml
├── build.yaml
└── Dockerfile
```

---

## 3. Perimetro Funzionale

> Legenda stato: `TODO` da fare · `WIP` in corso · `DONE` completato

### 3.1 Funzionalità Core (MVP)

| ID  | Funzionalità                | Descrizione                                                                                                    | Stato |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----- |
| F01 | **Anagrafica giocatori**    | CRUD giocatori: nome, ruolo, ruoli secondari, note. Statistiche (presenze, gol) di base.                          | WIP   |
| F02 | **Calendario eventi**       | CRUD eventi (allenamento/partita/torneo): data, ora, luogo, indirizzo, avversario, ritrovo, note, stato.          | WIP   |
| F03 | **Convocazioni**            | Per ogni evento, selezione dei giocatori convocati (checklist).                                                  | WIP   |
| F04 | **Presenze**                | Registrazione presenze effettive per allenamenti/partite (base per statistiche future).                          | TODO  |
| F05 | **Dashboard**                | Prossimi eventi, numero giocatori, riepilogo rapido.                                                              | WIP   |
| F06 | **App Home Assistant**      | Addon con Ingress, persistenza dati in `/data`, healthcheck.                                                     | WIP   |

> Nota: le funzionalità marcate `WIP` hanno lo **scheletro** (API + UI di base) già presente nel
> boilerplate ma vanno rifinite, validate e testate.

### 3.2 Funzionalità Post-MVP (da roadmap)

| ID  | Funzionalità                                                                                          | Stato |
| --- | -------------------------------------------------------------------------------------------------------- | ----- |
| F07 | **Generazione comunicazione Google Docs** — pulsante "Genera comunicazione", copia template, sostituzione placeholder tramite `batchUpdate`, salvataggio su Drive, link condivisibile. | TODO  |
| F08 | **OAuth 2.0 Google** — autenticazione con account Google personale (preferita a Service Account).       | TODO  |
| F09 | **Messaggio WhatsApp** — generazione testo precompilato + pulsante "Copia messaggio WhatsApp" (nessun invio automatico). | TODO  |
| F10 | **Storico comunicazioni** — elenco dei documenti generati con link.                                     | TODO  |
| F11 | **Statistiche avanzate** — formazioni, minutaggio, risultati partite, classifiche tornei.                | TODO  |
| F12 | **Archivio allenamenti** — temi, esercizi, durata per singola sessione.                                  | TODO  |

---

## 4. Modello dati (MVP)

```
players
--------
id
name
role
secondary_roles     -- JSON array
notes
created_at

events
------
id
type                -- training | match | tournament
date
start_time
end_time
location
address
opponent            -- solo per match
meeting_time
notes
status              -- scheduled | modified | cancelled
created_at

callups             -- convocazioni per evento
-------
id
event_id
player_id
called_up           -- boolean

attendance           -- presenze effettive (F04, post-MVP)
----------
id
event_id
player_id
status
```

### Modello dati futuro (Fase Google, F07-F10)

```
communications
--------------
id
event_ids            -- JSON array degli eventi inclusi
google_doc_id
google_doc_url
created_at

google_tokens         -- token OAuth persistiti
--------------
access_token
refresh_token
expiry
```

---

## 5. API (MVP)

```
GET    /api/health

GET    /api/players
POST   /api/players
GET    /api/players/:id
PUT    /api/players/:id
DELETE /api/players/:id

GET    /api/events
POST   /api/events
GET    /api/events/:id
PUT    /api/events/:id
DELETE /api/events/:id

GET    /api/events/:id/callups
PUT    /api/events/:id/callups     -- body: { playerIds: number[] }
```

Endpoint futuri (Fase Google — F07/F08, non ancora implementati):

```
GET    /api/google/oauth/url
GET    /api/google/oauth/callback
POST   /api/events/communication    -- genera il Google Doc per gli eventi selezionati
```

---

## 6. Autenticazione Google (Fase 5, non MVP)

Soluzione consigliata: **OAuth 2.0** con l'account Google personale (non Service Account), così i
documenti generati appartengono al proprio Google Drive. Il token viene salvato in `/data` dopo il
primo consenso e riutilizzato per le operazioni successive.

---

## 7. Roadmap di sviluppo

## Fase 1 — Boilerplate (corrente)

- struttura addon Home Assistant (Docker, Ingress, config.yaml)
- backend Express + SQLite, frontend React + Vite
- schema dati players/events/callups

## Fase 2 — Backend MVP

- CRUD giocatori
- CRUD eventi
- gestione convocazioni

## Fase 3 — Frontend MVP

- dashboard
- calendario
- pagina giocatori
- dettaglio evento + convocazioni

## Fase 4 — Rifinitura MVP

- presenze
- validazioni e stati evento (annullato/modificato)
- responsive/mobile

## Fase 5 — Google

- OAuth 2.0
- Google Drive API (template, copia, permessi)
- Google Docs API (`batchUpdate` sui placeholder)
- pulsante "Genera comunicazione" + storico

## Fase 6 — Estensioni future

- messaggio WhatsApp precompilato
- statistiche avanzate (formazioni, minutaggio, risultati)
- archivio allenamenti (temi, esercizi)
- gestione tornei e classifiche
