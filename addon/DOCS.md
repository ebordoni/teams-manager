# Teams Manager - Documentazione

## Panoramica

**Teams Manager** è un addon per Home Assistant che permette di gestire il calendario, l'anagrafica
dei giocatori e le presenze della squadra, con generazione automatica di comunicazioni per i
genitori (Notion oppure Google Docs + WhatsApp). Interfaccia realizzata con Mantine UI.

## Funzionalità

### Squadra

Dalle **Impostazioni** puoi definire il nome della squadra. Viene usato nelle intestazioni delle comunicazioni e nella pagina del piano partita, senza modificare il nome generico dell'addon Teams Manager.

### Calendario

Allenamenti, partite, tornei e altri tipi di evento personalizzabili, con data, orario, luogo,
avversario e note. Ogni evento può essere programmato, modificato o annullato.

Per gli appuntamenti settimanali, ad esempio gli allenamenti, attiva **Ripeti ogni settimana**
durante la creazione e indica la data finale: vengono creati tutti gli eventi fino a tale data.
Le occorrenze sono indipendenti, quindi puoi modificare o annullare solo una data senza influire
sulle altre.

Nella scheda di un evento partita puoi indicare la **Squadra avversaria**, registrare il risultato
con pulsanti rapidi e attribuire i gol ai marcatori della tua rosa. La sezione presenze è chiusa
inizialmente e conserva comunque il riepilogo dei giocatori presenti.

Dalla scheda di ciascun giocatore, lo storico mostra anche i **gol totali** e le **partite a segno**
calcolati dai risultati registrati.

### Tipi di evento

Dalla pagina **Impostazioni** puoi creare, modificare ed eliminare i tipi di evento disponibili nel
calendario (es. Allenamento, Partita, Torneo, Amichevole…), indicando per ciascuno se prevede un
avversario (mostra il campo "Avversario").

### Giocatori

Anagrafica della squadra: nome, numero di maglia univoco (1–99), ruolo, ruoli secondari, piede preferito e valutazioni 0–100 di forma fisica, velocità, tecnica, tiro, difesa e attacco. L'elenco mostra un avatar con le iniziali e il numero di maglia; questi dati migliorano le proposte del piano partita AI.

### Rosa e presenze

Ogni evento include automaticamente tutta la rosa. Nella scheda evento tutti i giocatori sono
selezionati come presenti: deseleziona soltanto chi non ha partecipato.

### Piani partita

Apri la scheda della partita e seleziona **Piano partita**. Puoi creare tempi vuoti e compilare
le formazioni manualmente, oppure indicare numero e durata dei tempi, giocatori in campo e
rigidità dei ruoli per generare una proposta AI. Per il 7vs7, tocca direttamente una posizione
del campo per scegliere il giocatore; i tempi si navigano uno alla volta.

I nomi non vengono inviati al provider: l'AI riceve pseudonimi, ruoli, piede preferito e valori tecnici. Se il provider non è
configurato o non risponde, viene usato automaticamente il motore locale.

### Comunicazioni

#### Sito pubblico Cloudflare

In **Impostazioni → Integrazioni → Sito pubblico · Cloudflare** inserisci Account ID, nome Worker e token API con permesso Workers Scripts Edit sul tuo account. Per il prototipo già pubblicato usa `teams-manager`: l'app riconosce il relativo tag e aggiorna lo stesso sito. Worker esistenti non riconosciuti vengono rifiutati senza sovrascriverli. Non servono modifiche ai DNS o esposizione pubblica di Home Assistant.

1. Attiva **Usa il sito per gli appuntamenti** e salva. Il token resta nel backend, viene mantenuto se lasciato vuoto e non compare nelle risposte API o nell'export JSON. I backup completi dell'add-on contengono invece le credenziali: proteggili.
2. Usa **Verifica accesso**: controlla la destinazione senza pubblicare. **Anteprima home** mostra il contenuto salvato, in una cornice isolata e senza script, quindi i filtri non sono interattivi nell'anteprima.
3. Apri **Comunicazioni → Pubblica sito** e conferma che gli appuntamenti saranno pubblici. La prima pubblicazione sostituisce il prototipo con i dati della squadra. Se cambi destinazione o token viene richiesta una nuova pubblicazione esplicita.
4. Dopo il primo invio riuscito, **Aggiorna automaticamente** abilita pubblicazioni raggruppate dopo le modifiche agli eventi, controllo al riavvio e pulizia giornaliera alle 03:05 Europe/Rome. Se il contenuto non cambia non viene creato un nuovo deploy; **Aggiorna ora** forza il ripristino. Disabilita l'opzione per pubblicare soltanto manualmente.

Il sito include bacheca appuntamenti, Avvisi e Informazioni. I relativi testi pubblici si modificano nelle impostazioni; il nome della squadra viene dalle impostazioni generali. Sono rispettati i tipi evento inclusi nella pubblicazione e viene conservato un solo passato, in fondo, grigio e barrato. Nomi dei giocatori, presenze e formazioni non vengono pubblicati in questa prima integrazione. Le note degli eventi sono escluse: puoi abilitarle con l'opzione dedicata solo dopo averne controllato il contenuto. Avvisi e Informazioni accettano testo semplice, non HTML.

Una sola destinazione automatica è attiva: attivare il sito sospende gli aggiornamenti di Notion e del Google Doc senza eliminarli. Puoi tornare a Notion attivandolo nelle impostazioni; disattivare la destinazione attiva torna a Google Docs. Google Calendar e piani partita restano indipendenti.

Il sito contiene una copia pubblica dei dati: un link non costituisce un controllo degli accessi, e `noindex` non impedisce la lettura. Con Home Assistant spento resta consultabile l'ultima versione, ma non riceve nuove modifiche o pulizie finché l'add-on non torna online. Le pagine già aperte richiedono un ricaricamento per ricevere una nuova pubblicazione. Gli aggiornamenti sostituiscono tutte le pagine gestite dall'app, comprese eventuali modifiche manuali su Cloudflare. Per ritirare il sito e gestire vecchie versioni o rollback usa il pannello Cloudflare.

Client, renderer e asset sono condivisi fra prototipo e add-on. Questa prima integrazione non comprende ancora editor di pagine aggiuntive, logo e temi configurabili, area riservata, notifiche o recupero automatico di un rollback remoto: la [specifica di evoluzione](docs/PUBLIC_WEBSITE_SPEC.md) mantiene il piano completo.

#### Agenda Notion (alternativa al Google Doc)

Gli appuntamenti vengono pubblicati su una **pagina normale**, in un'agenda verticale a una sola colonna pensata per smartphone. Il prossimo evento non annullato è in evidenza in un riquadro; seguono gli altri appuntamenti in ordine cronologico. Date, tipo di evento, avversario, luogo, orari, note, formazione ed eventuali convocazioni sono leggibili direttamente, senza aprire schede o sezioni nascoste. In fondo rimane soltanto l'ultimo evento passato, in grigio e barrato. Non servono database, viste calendario o template esterni.

In **Impostazioni → Integrazioni → Notion** puoi collegare una pagina esistente:

1. Crea una connessione interna dal [portale Notion](https://www.notion.so/profile/integrations), con capacità di lettura e aggiornamento contenuti.
2. Crea una pagina normale dedicata agli appuntamenti (non un database) e aggiungi la connessione dal menu della pagina **••• → Connessioni**.
3. Nell'app inserisci il token e il link della pagina del workspace, attiva **Usa Notion per gli appuntamenti** e salva. Il token resta nel backend, non viene restituito al browser né incluso nell'export JSON.
4. Usa **Verifica accesso**, poi **Comunicazioni → Aggiorna ora**. L'aggiornamento sostituisce tutto il contenuto della pagina: eventuali note manuali devono restare fuori da questa pagina.
5. Per i genitori, pubblica la pagina da **Condividi → Pubblica** in Notion e salva il relativo link pubblico nell'app. La pubblicazione e le autorizzazioni dei lettori si gestiscono da Notion.

Dopo il primo aggiornamento riuscito, la pagina viene aggiornata dopo le modifiche agli eventi e ogni giorno alle 03:05 (Europe/Rome). Gli aggiornamenti automatici saltano le scritture se il contenuto non cambia; **Aggiorna ora** riscrive sempre la pagina e può ripristinarla dopo uno svuotamento manuale. Restano un evento passato in grigio e barrato e gli eventi da oggi in avanti, rispettando i flag dei tipi evento e delle convocazioni.

La pubblicazione verifica l'accesso alla pagina e ne sostituisce il contenuto con un'unica scrittura, anziché aggiornare separatamente tutti gli eventi. Le richieste di stato del browser controllano solo l'avanzamento del lavoro nel backend, senza chiamare Notion.

**Passaggio dal precedente database:** la relativa configurazione e sincronizzazione non sono più disponibili. Dopo l'aggiornamento dell'app, gli automatismi verso il vecchio database vengono sospesi; il database, le schede e i dati già presenti su Notion restano intatti. Collega una pagina normale (anche la precedente pagina elenco) nelle impostazioni: il token salvato viene mantenuto. Salva il nuovo link pubblico e pubblica con **Aggiorna ora** per riattivare gli aggiornamenti. La prima pubblicazione su questa pagina richiede un'azione manuale anche se il vecchio database era già sincronizzato.

Se la pagina non è accessibile, controlla link, token e connessione: l'app non crea automaticamente altre pagine, perché Notion non distingue sempre una pagina eliminata da una non autorizzata. Per sostituirla, crea una nuova pagina, collegala e pubblicala, quindi aggiorna i link nelle impostazioni.

Attivando Notion, il precedente Google Doc smette di aggiornarsi ma non viene eliminato. Google Calendar e l'esportazione dei piani partita continuano a funzionare. Disattivando Notion si torna al Google Doc precedente.

#### Google Docs

La pagina **Comunicazioni** crea un unico Google Document nella cartella Drive
"Teams Manager/Comunicazioni". Lo stesso link viene aggiornato dopo ogni modifica agli eventi e
ogni giorno alle 03:05; puoi anche forzare l'aggiornamento con il pulsante dedicato. Nel documento
restano gli appuntamenti da oggi in avanti e l'ultimo passato, attenuato in grigio e barrato.

I documenti creati in precedenza restano disponibili nell'archivio e possono essere aperti o
eliminati (l'eliminazione rimuove anche il file da Google Drive).

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
