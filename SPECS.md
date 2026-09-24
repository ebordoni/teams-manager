# Teams Manager — Specifiche Applicative

> Documento vivo — da aggiornare progressivamente man mano che raccogliamo i requisiti.
> Stato attuale: **MVP operativo (v0.19.3)** — include piani partita AI multi-provider con rotazioni validate, fallback locale ed export in Google Docs.
> Fonte: documento di progettazione iniziale (2026-08-26).

---

## 1. Obiettivo

Realizzare un **Home Assistant Addon** che permetta di gestire gli appuntamenti della squadra di
calcio (allenamenti, partite, tornei), l'anagrafica dei giocatori e le presenze, e che generi su
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
              │ App "Teams Manager" │
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

| Layer    | Tecnologia                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| Frontend | React 19, Vite 5, Mantine UI 9 (`@mantine/core`, `dates`, `notifications`, `form`), React Router 6 (HashRouter) |
| Backend  | Node.js 24, TypeScript, Express                                                                                 |
| Storage  | SQLite (`node:sqlite`), file system persistente (`/data`)                                                       |
| Google   | Google Docs API + Google Drive API (OAuth 2.0)                                                                  |
| Hosting  | Home Assistant Addon (Docker), Ingress + porta diretta (redirect OAuth)                                         |

```
addon/
├── backend/
│   ├── src/
│   │   ├── config.ts
│   │   ├── index.ts
│   │   ├── db/
│   │   ├── routes/            # players, events, attendance,
│   │   │                      # event-types, settings, google, communications
│   │   ├── services/
│   │   │   ├── communication.service.ts
│   │   │   ├── settings.service.ts
│   │   │   └── google/        # auth.ts, docs.ts, drive.ts
│   │   └── types/
│   └── package.json
├── frontend/
│   ├── src/
│   │   └── pages/              # Dashboard, Calendar, Players, EventDetail,
│   │                            # Communications, Settings
│   └── package.json
├── config.yaml
├── build.yaml
└── Dockerfile
```

---

## 3. Perimetro Funzionale

> Legenda stato: `TODO` da fare · `WIP` in corso · `DONE` completato

### 3.1 Funzionalità Core (MVP)

| ID  | Funzionalità                                                                                                                                                        | Descrizione                                                                                              | Stato |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----- |
| F01 | **Anagrafica giocatori**                                                                                                                                            | CRUD giocatori: nome, ruoli, piede preferito, profilo tecnico 0–100 e note.                              | DONE  |
| F02 | **Calendario eventi**                                                                                                                                               | CRUD eventi (allenamento/partita/torneo): data, ora, luogo, indirizzo, avversario, ritrovo, note, stato. | WIP   |
| F03 | **Rosa automatica**                                                                                                                                                 | Ogni evento include l'intera rosa; non è prevista una selezione manuale dei convocati.                   | DONE  |
| F04 | **Presenze**                                                                                                                                                        | Registrazione presenze effettive per allenamenti/partite (base per statistiche future).                  | DONE  |
| F05 | **Dashboard**                                                                                                                                                       | Prossimi eventi, numero giocatori, riepilogo rapido.                                                     | DONE  |
| F06 | **App Home Assistant**                                                                                                                                              | Addon con Ingress, persistenza dati in `/data`, healthcheck.                                             | DONE  |
| F13 | **Validazione stato evento** — note obbligatorie quando un evento è modificato/annullato; badge di stato in calendario e dettaglio.                                 | DONE                                                                                                     |
| F14 | **UI responsive (Mantine)**                                                                                                                                         | Interfaccia basata su Mantine UI 9 (AppShell, form, tabelle), nav a hamburger su mobile.                 | DONE  |
| F15 | **Tipi di evento configurabili** — gestione (crea/modifica/elimina) dei tipi evento (Allenamento, Partita, Torneo, …) dalle Impostazioni, con flag "ha avversario". | DONE                                                                                                     |

> Nota: le funzionalità marcate `WIP` hanno lo **scheletro** (API + UI di base) già presente nel
> boilerplate ma vanno rifinite, validate e testate.

### 3.2 Funzionalità Post-MVP (da roadmap)

| ID  | Funzionalità                                                                                                                                                                                                                                                | Stato |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| F07 | **Generazione comunicazione Google Docs** — pulsante "Genera comunicazione", creazione documento (da zero o da template con placeholder), salvataggio su Drive, link condivisibile.                                                                         | DONE  |
| F08 | **OAuth 2.0 Google** — autenticazione con account Google personale (preferita a Service Account).                                                                                                                                                           | DONE  |
| F09 | **Messaggio WhatsApp** — generazione testo precompilato + pulsante "Copia messaggio WhatsApp" (nessun invio automatico).                                                                                                                                    | DONE  |
| F10 | **Storico comunicazioni** — pagina "Comunicazioni": elenco dei documenti generati, apertura e **eliminazione** (rimuove anche il file da Drive).                                                                                                            | DONE  |
| F16 | **Template Google Doc** — documento personalizzato con placeholder `{{TITOLO}}`, `{{SETTIMANA}}`, `{{PARTITE}}`, `{{ALLENAMENTI}}`, `{{FORMAZIONI}}`, `{{PRESENZE}}`, configurabile dalle Impostazioni. Se non impostato, si usa la generazione automatica. | DONE  |
| F11 | **Statistiche avanzate** — formazioni, minutaggio, risultati partite, classifiche tornei.                                                                                                                                                                   | TODO  |
| F12 | **Archivio allenamenti** — temi, esercizi, durata per singola sessione.                                                                                                                                                                                     | TODO  |
| F17 | **Piani partita AI** — formazione per ciascun tempo, minimizzazione della differenza di minutaggio, rispetto dei ruoli, modifica manuale e conferma.                                                                                                        | DONE  |

---

## 4. Modello dati (MVP)

```
players
--------
id
name
role
secondary_roles     -- JSON array
preferred_foot      -- right | left | both
fitness              -- 0..100
speed                -- 0..100
technique            -- 0..100
shooting             -- 0..100
defending            -- 0..100
attacking            -- 0..100
notes
created_at

events
------
id
type                -- chiave (key) di un event_types, non più enum fisso
date
start_time
end_time
location
address
opponent            -- solo se il tipo ha "has_opponent"
meeting_time
notes
status              -- scheduled | modified | cancelled
created_at

event_types          -- tipi di evento configurabili (F15)
-----------
id
key                  -- es. "training", "match", "friendly"...
label                -- es. "Allenamento"
icon                 -- emoji
has_opponent         -- boolean: mostra avversario
sort_order

attendance           -- presenze effettive (F04)
----------
id
event_id
player_id
status               -- present | absent | excused
```

### Modello dati — Fase Google (F07-F10, F16, implementato)

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

app_settings          -- coppie chiave/valore (es. google_template_doc_id)
------------
key
value

match_plans           -- configurazione e stato del piano partita AI
-----------
id, event_id, name, period_count, minutes_per_period, players_on_field
system, role_policy, source, provider, model, status, warnings

match_periods         -- formazione e panchina per ciascun tempo
-------------
id, match_plan_id, period_number, assignments, bench_player_ids
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

GET    /api/events/:id/attendance
PUT    /api/events/:id/attendance  -- body: { records: { playerId, status }[] }

GET    /api/ai/config
PUT    /api/ai/config
POST   /api/ai/test

GET    /api/events/:id/match-plans
POST   /api/events/:id/match-plans/generate
GET    /api/events/:id/match-plans/:planId
PUT    /api/events/:id/match-plans/:planId
POST   /api/events/:id/match-plans/:planId/confirm
DELETE /api/events/:id/match-plans/:planId

GET    /api/event-types
POST   /api/event-types             -- body: { key, label, icon, hasOpponent, sortOrder }
PUT    /api/event-types/:id
DELETE /api/event-types/:id         -- rifiutata (409) se il tipo è ancora usato da eventi
```

Endpoint Google e comunicazioni (implementati):

```
GET    /api/google/status           -- { configured, connected }
GET    /api/google/oauth/url        -- URL di consenso Google
GET    /api/google/oauth/callback   -- callback OAuth (porta diretta, non Ingress)
POST   /api/google/disconnect

GET    /api/communications           -- storico comunicazioni generate
POST   /api/communications           -- body: { eventIds: number[] } — genera il Google Doc
DELETE /api/communications/:id       -- elimina il file da Drive e dallo storico

GET    /api/settings                 -- { googleTemplateDocId }
PUT    /api/settings                 -- body: { googleTemplateDocId } (accetta anche URL completo)
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
(`8102`, vedi `config.yaml`) da usare solo per il redirect URI di Google.

### Setup richiesto su Google Cloud Console

1. Crea un progetto (o riusa uno esistente) su [Google Cloud Console](https://console.cloud.google.com/).
2. Abilita le API **Google Docs API** e **Google Drive API**.
3. Configura la **schermata di consenso OAuth** (tipo "Esterno" va bene per un uso personale; puoi
   aggiungere il tuo account come utente di test se l'app resta in modalità "Testing").
4. Crea una **credenziale OAuth 2.0 Client ID** di tipo "Applicazione web".
5. In **URI di reindirizzamento autorizzati** aggiungi:
   `http://<IP-O-HOST-HOME-ASSISTANT>:8102/api/google/oauth/callback`
6. Copia **Client ID** e **Client secret** e impostali nelle opzioni dell'addon
   (`google_client_id`, `google_client_secret`) oppure nel file `.env` in sviluppo
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`).
7. Dalla pagina **Impostazioni** dell'app, clicca **Collega Google** e completa il consenso.

---

## 7. Roadmap di sviluppo

## Fase 1 — Boilerplate (completata)

- struttura addon Home Assistant (Docker, Ingress, config.yaml)
- backend Express + SQLite, frontend React + Vite
- schema dati players/events/attendance

## Fase 2 — Backend MVP

- CRUD giocatori
- CRUD eventi
- presenze con rosa inclusa automaticamente

## Fase 3 — Frontend MVP

- dashboard
- calendario
- pagina giocatori
- dettaglio evento + presenze

## Fase 4 — Rifinitura MVP (completata)

- presenze (tabella `attendance`, endpoint `GET/PUT /api/events/:id/attendance`, UI in dettaglio evento)
- validazioni e stati evento: note obbligatorie su annullamento/modifica (backend + frontend)
- responsive/mobile: nav a hamburger, form a colonna singola su schermi piccoli

## Fase 5 — Google (completata, verificata end-to-end dall'utente)

- ✅ OAuth 2.0 (`services/google/auth.ts`, token persistiti in `google_tokens`)
- ✅ Google Drive API (`services/google/drive.ts`: cartella "Teams Manager/Comunicazioni", condivisione, copia/eliminazione file)
- ✅ Google Docs API (`services/google/docs.ts`: creazione documento con contenuto formattato o da template + `batchUpdate` sui placeholder)
- ✅ pulsante "Genera comunicazione" (Calendario) + messaggio WhatsApp precompilato
- ✅ pagina "Comunicazioni": storico, apertura documento, eliminazione (F10)
- ✅ collegamento OAuth testato con successo sull'istanza reale dell'utente

## Fase 6 — UI Mantine e configurabilità (completata)

- ✅ Migrazione UI a Mantine 9 (React 19): AppShell, form, tabelle, notifiche
- ✅ Tipi di evento configurabili dalle Impostazioni (F15), con flag "ha avversario"
- ✅ Generazione documento basata su template Google Doc opzionale (F16), con fallback automatico

## Fase 7 — Estensioni future

- statistiche avanzate (formazioni, minutaggio, risultati)
- archivio allenamenti (temi, esercizi)
- gestione tornei e classifiche
- ulteriori test di integrazione per i flussi Google (richiedono credenziali esterne)

### Bacheca — hardening dati

- import JSON validato, con anteprima e conferma esplicita prima della scrittura
- politica di conservazione e gestione dei backup locali
- controlli di coerenza estesi e prova di upgrade su una copia reale dell'istanza Home Assistant
