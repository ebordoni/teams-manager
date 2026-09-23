<div align="center">

# ⚽ Teams Manager

**Home Assistant Addon** per gestire il calendario, l'anagrafica giocatori e le presenze della squadra, con generazione automatica di comunicazioni per i genitori (Google Docs + WhatsApp).

[![Version](https://img.shields.io/badge/version-0.18.2-blue)](CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Home%20Assistant-41BDF5)](https://www.home-assistant.io/)
[![Architecture](https://img.shields.io/badge/arch-amd64%20%7C%20aarch64-lightgrey)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)

</div>

---

> ✅ **Stato: MVP operativo (v0.18.2).** Calendario, giocatori, presenze, formazioni, piani partita AI ed esportazioni Google sono disponibili.

## 🎯 Obiettivo

Teams Manager è il gestionale della squadra pensato per essere installato come addon nella propria istanza Home Assistant:

- **Calendario** — allenamenti, partite, tornei, eventi speciali.
- **Anagrafica giocatori** — ruoli, piede preferito, profilo tecnico 0–100 e note.
- **Rosa automatica** — tutti i giocatori sono inclusi in ogni evento; le presenze partono da “presente”.
- **Comunicazioni** — generazione di un Google Document condivisibile via WhatsApp con i genitori.
- **Piani partita AI** — rotazioni per ciascun tempo con minutaggio bilanciato, ruoli e fallback locale.

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
   https://github.com/ebordoni/teams-manager
   ```
4. Cerca **Teams Manager** e clicca **Installa**

Avvia l'addon e aprilo dalla barra laterale di Home Assistant (Ingress).

---

## 🛠️ Sviluppo locale

### Requisiti

- Node.js 24+ (come il container di produzione e la CI)

### Avvio

```bash
# Installa le dipendenze riproducibilmente
npm ci --prefix addon/backend
npm ci --prefix addon/frontend

# Terminale 1 — Backend (porta 3002)
npm run dev --prefix addon/backend

# Terminale 2 — Frontend (porta 5175)
npm run dev --prefix addon/frontend
```

Oppure con Docker Compose (dal root del repo):

```bash
docker compose up --build
```

Il frontend in sviluppo proxya le richieste `/api` verso il backend (vedi `addon/frontend/vite.config.ts`).

### Verifiche e rilascio

```bash
npm run check

# Aggiorna tutte le versioni e inserisce i placeholder nel changelog
npm run version:bump -- patch
```

Il bump accetta `patch`, `minor`, `major` oppure una versione esplicita (ad esempio `1.0.0`),
esegue il controllo di coerenza e lascia le nuove voci changelog da completare prima del commit.

Il comando controlla che le versioni siano coerenti e compila backend e frontend.
La CI esegue lo stesso controllo e costruisce l'immagine Docker dell'add-on. Per
le regole di versionamento, changelog e commit vedi [`CONTRIBUTING.md`](CONTRIBUTING.md).

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
├── repository.yaml       # descrittore per l'Add-on Store di HA
└── SPECS.md              # specifiche funzionali (documento vivo)
```

## 📄 Licenza

MIT
