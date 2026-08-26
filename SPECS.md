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

| Layer    | Tecnologia                                                               |
| -------- | ------------------------------------------------------------------------ |
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6 (HashRouter), Zustand 4 |
| Backend  | Node.js 24, TypeScript, Express                                          |
| Storage  | SQLite (`node:sqlite`), file system persistente (`/data`)                |
| Google   | Google Docs API + Google Drive API (OAuth 2.0), Fase 5                   |
| Hosting  | Home Assistant Addon (Docker), Ingress                                   |

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

| ID  | Funzionalità             | Descrizione                                                                                              | Stato |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------- | ----- |
| F01 | **Anagrafica giocatori** | CRUD giocatori: nome, ruolo, ruoli secondari, note. Statistiche (presenze, gol) di base.                 | WIP   |
| F02 | **Calendario eventi**    | CRUD eventi (allenamento/partita/torneo): data, ora, luogo, indirizzo, avversario, ritrovo, note, stato. | WIP   |
| F03 | **Convocazioni**         | Per ogni evento, selezione dei giocatori convocati (checklist).                                          | WIP   |
| F04 | **Presenze**             | Registrazione presenze effettive per allenamenti/partite (base per statistiche future).                  | DONE  |
| F05 | **Dashboard**            | Prossimi eventi, numero giocatori, riepilogo rapido.                                                     | WIP   |
| F06 | **App Home Assistant**   | Addon con Ingress, persistenza dati in `/data`, healthcheck.                                             | WIP   |
| F13 | **Validazione stato evento** — note obbligatorie quando un evento è modificato/annullato; badge di stato in calendario e dettaglio. | DONE  |
| F14 | **UI responsive**        | Nav a hamburger su mobile, form a colonna singola su schermi piccoli.                                     | DONE  |

> Nota: le funzionalità marcate `WIP` hanno lo **scheletro** (API + UI di base) già presente nel
> boilerplate ma vanno rifinite, validate e testate.

### 3.2 Funzionalità Post-MVP (da roadmap)

| ID  | Funzionalità                                                                                                                                                                           | Stato |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| F07 | **Generazione comunicazione Google Docs** — pulsante "Genera comunicazione", creazione documento via `documents.batchUpdate`, salvataggio su Drive, link condivisibile. | WIP (infra pronta, in attesa di credenziali Google) |
| F08 | **OAuth 2.0 Google** — autenticazione con account Google personale (preferita a Service Account).                                                                                      | WIP (infra pronta, in attesa di credenziali Google) |
| F09 | **Messaggio WhatsApp** — generazione testo precompilato + pulsante "Copia messaggio WhatsApp" (nessun invio automatico).                                                               | DONE  |
| F10 | **Storico comunicazioni** — elenco dei documenti generati con link.                                                                                                                    | WIP (endpoint pronto, manca UI storico) |
| F11 | **Statistiche avanzate** — formazioni, minutaggio, risultati partite, classifiche tornei.                                                                                              | TODO  |
| F12 | **Archivio allenamenti** — temi, esercizi, durata per singola sessione.                                                                                                                | TODO  |

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

attendance           -- presenze effettive (F04)
----------
id
event_id
player_id
status               -- present | absent | excused
```

### Modello dati — Fase Google (F07-F10, implementato)

```
communications
--------------
id
event_ids            -- JSON array degli eventi inclusi
title
google_doc_id
google_doc_url
created_at

google_tokens         -- token OAuth persistiti (riga singola, id = 1)
--------------
access_token
refresh_token
scope
token_type
expiry_date
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

GET    /api/events/:id/attendance
PUT    /api/events/:id/attendance  -- body: { records: { playerId, status }[] }
```

Endpoint Google e comunicazioni (Fase 5, implementati — richiedono client id/secret configurati):

```
GET    /api/google/status           -- { configured, connected }
GET    /api/google/oauth/url        -- URL di consenso Google
GET    /api/google/oauth/callback   -- callback OAuth (porta diretta, non Ingress)
POST   /api/google/disconnect

GET    /api/communications           -- storico comunicazioni generate
POST   /api/communications           -- body: { eventIds: number[] } — genera il Google Doc
```

---

## 6. Autenticazione Google (Fase 5)

Soluzione adottata: **OAuth 2.0** con l'account Google personale (non Service Account), così i
documenti generati appartengono al proprio Google Drive. Il token (incluso il `refresh_token`) è
persistito nella tabella `google_tokens` e riutilizzato/rinnovato automaticamente dalle chiamate
successive.

### Perché una porta diretta (non solo Ingress)

Il redirect URI di Google deve essere un URL raggiungibile direttamente dal browser dell'utente.
L'iframe Ingress di Home Assistant inietta un token di sessione nel path e non è adatto come
redirect OAuth statico. Per questo l'addon espone, oltre a Ingress, anche una **porta diretta**
(`8101`, vedi `config.yaml`) da usare solo per il redirect URI di Google.

### Setup richiesto su Google Cloud Console

1. Crea un progetto (o riusa uno esistente) su [Google Cloud Console](https://console.cloud.google.com/).
2. Abilita le API **Google Docs API** e **Google Drive API**.
3. Configura la **schermata di consenso OAuth** (tipo "Esterno" va bene per un uso personale; puoi
   aggiungere il tuo account come utente di test se l'app resta in modalità "Testing").
4. Crea una **credenziale OAuth 2.0 Client ID** di tipo "Applicazione web".
5. In **URI di reindirizzamento autorizzati** aggiungi:
   `http://<IP-O-HOST-HOME-ASSISTANT>:8101/api/google/oauth/callback`
6. Copia **Client ID** e **Client secret** e impostali nelle opzioni dell'addon
   (`google_client_id`, `google_client_secret`) oppure nel file `.env` in sviluppo
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`).
7. Dalla pagina **Impostazioni** dell'app, clicca **Collega Google** e completa il consenso.

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

## Fase 4 — Rifinitura MVP (completata)

- presenze (tabella `attendance`, endpoint `GET/PUT /api/events/:id/attendance`, UI in dettaglio evento)
- validazioni e stati evento: note obbligatorie su annullamento/modifica (backend + frontend)
- responsive/mobile: nav a hamburger, form a colonna singola su schermi piccoli

## Fase 5 — Google (infrastruttura pronta, in attesa di credenziali)

- ✅ OAuth 2.0 (`services/google/auth.ts`, token persistiti in `google_tokens`)
- ✅ Google Drive API (`services/google/drive.ts`: cartella "GIPS Calcio/Comunicazioni", condivisione)
- ✅ Google Docs API (`services/google/docs.ts`: creazione documento con contenuto formattato)
- ✅ pulsante "Genera comunicazione" (Calendario) + messaggio WhatsApp precompilato
- ✅ endpoint storico (`GET /api/communications`)
- ⏳ da fare non appena disponibili client id/secret: test end-to-end del flusso OAuth reale
- ⏳ TODO: pagina/UI dedicata allo storico comunicazioni (F10)

## Fase 6 — Estensioni future

- statistiche avanzate (formazioni, minutaggio, risultati)
- archivio allenamenti (temi, esercizi)
- gestione tornei e classifiche
