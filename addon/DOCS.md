# Teams Manager - Documentazione

## Panoramica

**Teams Manager** è un addon per Home Assistant che permette di gestire il calendario, l'anagrafica
dei giocatori e le presenze della squadra, con generazione automatica di comunicazioni per i
genitori (Google Docs + WhatsApp). Interfaccia realizzata con Mantine UI.

## Funzionalità

### Squadra

Dalle **Impostazioni** puoi definire il nome della squadra. Viene usato nelle intestazioni delle comunicazioni e nella pagina del piano partita, senza modificare il nome generico dell'addon Teams Manager.

### Calendario

Allenamenti, partite, tornei e altri tipi di evento personalizzabili, con data, orario, luogo,
avversario e note. Ogni evento può essere programmato, modificato o annullato.

### Tipi di evento

Dalla pagina **Impostazioni** puoi creare, modificare ed eliminare i tipi di evento disponibili nel
calendario (es. Allenamento, Partita, Torneo, Amichevole…), indicando per ciascuno se prevede un
avversario (mostra il campo "Avversario").

### Giocatori

Anagrafica della squadra: nome, ruolo, ruoli secondari, piede preferito e valutazioni 0–100 di forma fisica, velocità, tecnica, tiro, difesa e attacco. Questi dati migliorano le proposte del piano partita AI.

### Rosa e presenze

Ogni evento include automaticamente tutta la rosa. Nella scheda evento tutti i giocatori sono
selezionati come presenti: deseleziona soltanto chi non ha partecipato.

### Piani partita AI

Apri la scheda della partita e seleziona **Piano partita AI**.
Indica numero e durata dei tempi, giocatori in campo e rigidità dei ruoli. L'app prepara una
formazione per ciascun tempo cercando la distribuzione di minuti più uniforme possibile senza
cambi durante il tempo. La proposta può essere modificata, confermata o eliminata.

I nomi non vengono inviati al provider: l'AI riceve pseudonimi, ruoli, piede preferito e valori tecnici. Se il provider non è
configurato o non risponde, viene usato automaticamente il motore locale.

### Comunicazioni

Dalla pagina Calendario, seleziona uno o più eventi e premi "Genera comunicazione": l'app crea un
Google Document con gli appuntamenti (nella cartella Drive "Teams Manager/Comunicazioni"), fornisce
il link al documento e un messaggio WhatsApp pronto da incollare nel gruppo genitori. Se hai
configurato un **template** (vedi sotto), il documento viene generato a partire da quello.

La pagina **Comunicazioni** mostra lo storico dei documenti generati: da lì puoi aprirli o
eliminarli (l'eliminazione rimuove anche il file da Google Drive).

### Template Google Doc (opzionale)

Nelle Impostazioni puoi collegare un Google Doc personale da usare come template: crealo su Google
Docs con i placeholder `{{TITOLO}}`, `{{SETTIMANA}}`, `{{PARTITE}}`, `{{ALLENAMENTI}}`,
`{{FORMAZIONI}}` e `{{PRESENZE}}` dove
vuoi che compaiano i rispettivi contenuti, poi incolla il link del documento nel campo dedicato.
Se il campo è vuoto, il documento viene generato automaticamente senza template.

## Configurazione

| Opzione                 | Descrizione                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `google_client_id`      | Client ID OAuth 2.0 Google (necessario per le Comunicazioni)        |
| `google_client_secret`  | Client Secret OAuth 2.0 Google (necessario per le Comunicazioni)    |
| `google_redirect_uri`   | Redirect URI OAuth (default: porta diretta `8102` dell'addon)       |
| `ai_provider`           | Provider principale: `openai`, `google`, `anthropic`, `groq`, `xai` |
| `ai_model`              | Modello opzionale; vuoto usa il predefinito del provider            |
| `ai_api_key`            | Chiave del provider principale (campo protetto)                     |
| `ai_fallback_providers` | Provider di riserva separati da virgola                             |

Per usare provider diversi come fallback configura anche le rispettive opzioni protette:
`openai_api_key`, `google_ai_api_key`, `anthropic_api_key`, `groq_api_key`, `xai_api_key`.
La pagina **Intelligenza artificiale** permette di selezionare provider e modello, impostare i
valori predefiniti e verificare la connessione.

### Collegare Google

1. Su [Google Cloud Console](https://console.cloud.google.com/) crea un progetto, abilita **Google
   Docs API**, **Google Drive API** e **Google Calendar API**, configura la schermata di consenso OAuth e crea una
   credenziale **OAuth 2.0 Client ID** di tipo "Applicazione web".
2. Aggiungi come **URI di reindirizzamento autorizzato**:
   `http://<IP-HOME-ASSISTANT>:8102/api/google/oauth/callback`
3. Inserisci Client ID e Client Secret nelle opzioni dell'addon.
4. Apri la pagina **Impostazioni** dell'app e clicca **Collega Google**.

### Google Calendar

L'integrazione Calendar è un export **manuale e unidirezionale**: dalla pagina Calendario si
selezionano gli eventi e si usa “Esporta in Google Calendar”. Una nuova esportazione degli stessi
eventi li aggiorna senza duplicarli; non vengono importati o rimossi eventi di Google.

In **Impostazioni → Google Calendar** puoi usare `primary` oppure l'ID di un calendario condiviso,
poi scegliere “Verifica accesso”. Se la verifica fallisce, l'ID è errato oppure il calendario non è
condiviso con l'account autorizzato. Se è stato aggiunto Calendar dopo il primo collegamento, usa
“Disconnetti” e poi “Collega Google” per rilasciare nuovamente gli scope necessari.

> Il redirect deve passare dalla porta diretta `8102` (non dall'iframe Ingress), per questo
> l'addon espone anche quella porta oltre all'integrazione in sidebar.

### "Il collegamento Google non è più valido" (errore `invalid_grant`)

Google invalida il consenso salvato — e l'app chiede di ricollegare l'account — nei casi seguenti:

- l'app OAuth è rimasta in stato **Testing** sulla schermata di consenso: in questa modalità i
  refresh token **scadono dopo 7 giorni**. Pubblica l'app ("In produzione") per un uso continuativo;
- il Client ID/Secret nelle opzioni dell'addon è stato cambiato dopo il collegamento;
- l'accesso è stato revocato dal tuo account Google (myaccount.google.com → Sicurezza → App con
  accesso al tuo account);
- l'orologio del sistema Home Assistant è molto sfasato.

In tutti questi casi basta aprire **Impostazioni → Collega Google** e completare di nuovo il
consenso: il vecchio token viene rimosso automaticamente.

I dati (SQLite) sono salvati in `/data` e inclusi nei backup di Home Assistant.

## Integrità, migrazioni e backup dati

All'avvio l'add-on verifica e applica le migrazioni SQLite necessarie. Prima di
una migrazione su un database già esistente crea una copia con nome
`teams-manager.db.backup-<timestamp>` nella stessa cartella `/data`; conserva
questo file finché non hai verificato il corretto aggiornamento.

La pagina **Impostazioni → Backup dati** permette inoltre di scaricare un JSON
con rosa, eventi, presenze, risultati, formazioni e piani partita. L'export non
contiene token Google, chiavi AI o stato OAuth.

Quando un giocatore ha presenze confermate, l'eliminazione dalla rosa lo
archivia invece di rimuoverlo fisicamente: lo storico rimane integro, mentre il
giocatore non appare più nelle schermate della rosa attiva.
