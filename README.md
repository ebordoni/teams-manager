<div align="center">

# ⚽ GIPS Calcio

**Home Assistant Addon** per gestire il calendario, l'anagrafica giocatori e le convocazioni della squadra, con generazione automatica di comunicazioni per i genitori (Google Docs + WhatsApp).

[![Version](https://img.shields.io/badge/version-0.2.2-blue)](addon/CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Home%20Assistant-41BDF5)](https://www.home-assistant.io/)
[![Architecture](https://img.shields.io/badge/arch-amd64%20%7C%20aarch64-lightgrey)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)

</div>

---

> ⚠️ **Stato: boilerplate iniziale.** L'infrastruttura dell'addon (backend, frontend, packaging Home Assistant) è impostata e funzionante come scheletro. Le funzionalità applicative verranno sviluppate progressivamente seguendo i requisiti descritti in [`SPECS.md`](SPECS.md).

## 🎯 Obiettivo

GIPS Calcio è il gestionale della squadra pensato per essere installato come addon nella propria istanza Home Assistant:

- **Calendario** — allenamenti, partite, tornei, eventi speciali.
- **Anagrafica giocatori** — ruoli, presenze, gol, note.
- **Convocazioni** — selezione rapida dei convocati per ogni evento.
- **Comunicazioni** — generazione automatica di un Google Document da condividere via WhatsApp con i genitori (Fase successiva, vedi [`SPECS.md`](SPECS.md)).

Il database (SQLite) resta locale all'addon; Google Docs è solo il formato di pubblicazione della comunicazione.

---

## 🚀 Installazione (Home Assistant)

### Prerequisiti

- Home Assistant con **Supervisor** (Home Assistant OS o Supervised)

### Aggiungere il repository

1. Vai su **Impostazioni → Add-on Store**
2. Menu (⋮) in alto a destra → **Repository**
3. Aggiungi l'URL del repository:
   ```
   https://github.com/ebordoni/gips-calcio
   ```
4. Cerca **GIPS Calcio** e clicca **Installa**

Avvia l'addon e aprilo dalla barra laterale di Home Assistant (Ingress).

---

## 🛠️ Sviluppo locale

### Requisiti

- Node.js 20+ (il container di produzione usa Node 24)

### Avvio

```bash
# Terminale 1 — Backend (porta 3002)
cd addon/backend
npm install
npm run dev

# Terminale 2 — Frontend (porta 5175)
cd addon/frontend
npm install
npm run dev
```

Oppure con Docker Compose (dal root del repo):

```bash
docker compose up --build
```

Il frontend in sviluppo proxya le richieste `/api` verso il backend (vedi `addon/frontend/vite.config.ts`).

---

## 📁 Struttura del progetto

```
TEAMS_MANAGER/
├── addon/
│   ├── config.yaml       # manifest Home Assistant
│   ├── build.yaml
│   ├── Dockerfile        # build produzione (frontend + backend)
│   ├── CHANGELOG.md
│   ├── translations/
│   ├── backend/          # Node.js + TypeScript + Express + SQLite
│   └── frontend/         # React + TypeScript + Vite + Mantine UI
├── docker-compose.yml    # ambiente di sviluppo
├── repository.json       # descrittore per l'Add-on Store di HA
└── SPECS.md              # specifiche funzionali (documento vivo)
```

## 📄 Licenza

MIT
