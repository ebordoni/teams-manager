# GIPS Calcio - Documentazione

## Panoramica

**GIPS Calcio** è un addon per Home Assistant che permette di gestire il calendario, l'anagrafica
dei giocatori e le convocazioni della squadra, con generazione automatica di comunicazioni per i
genitori (Google Docs + WhatsApp, roadmap Fase 5).

## Funzionalità

### Calendario

Allenamenti, partite e tornei con data, orario, luogo, avversario e note. Ogni evento può essere
programmato, modificato o annullato.

### Giocatori

Anagrafica della squadra: nome, ruolo, ruoli secondari e note.

### Convocazioni

Per ogni evento, selezione rapida dei giocatori convocati.

### Comunicazioni

Dalla pagina Calendario, seleziona uno o più eventi e premi "Genera comunicazione": l'app crea un
Google Document con gli appuntamenti (nella cartella Drive "GIPS Calcio/Comunicazioni"), fornisce
il link al documento e un messaggio WhatsApp pronto da incollare nel gruppo genitori.

## Configurazione

| Opzione                | Descrizione                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `google_client_id`     | Client ID OAuth 2.0 Google (necessario per le Comunicazioni)         |
| `google_client_secret` | Client Secret OAuth 2.0 Google (necessario per le Comunicazioni)     |
| `google_redirect_uri`  | Redirect URI OAuth (default: porta diretta `8101` dell'addon)        |

### Collegare Google

1. Su [Google Cloud Console](https://console.cloud.google.com/) crea un progetto, abilita **Google
   Docs API** e **Google Drive API**, configura la schermata di consenso OAuth e crea una
   credenziale **OAuth 2.0 Client ID** di tipo "Applicazione web".
2. Aggiungi come **URI di reindirizzamento autorizzato**:
   `http://<IP-HOME-ASSISTANT>:8101/api/google/oauth/callback`
3. Inserisci Client ID e Client Secret nelle opzioni dell'addon.
4. Apri la pagina **Impostazioni** dell'app e clicca **Collega Google**.

> Il redirect deve passare dalla porta diretta `8101` (non dall'iframe Ingress), per questo
> l'addon espone anche quella porta oltre all'integrazione in sidebar.

I dati (SQLite) sono salvati in `/data` e inclusi nei backup di Home Assistant.
