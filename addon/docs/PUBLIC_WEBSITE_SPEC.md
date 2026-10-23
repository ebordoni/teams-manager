# Sito pubblico della squadra e integrazione con Teams Manager

Data: 23 ottobre 2026. Stato: prima integrazione disponibile, con evoluzioni ancora da realizzare. Base progettuale: Teams Manager 0.25.0.

Aggiornamento implementativo 1.0.0: disponibili configurazione Cloudflare nell'add-on, verifica, anteprima isolata, pubblicazione manuale confermata, aggiornamenti automatici con hash e testi semplici per Avvisi e Informazioni. La prova API con dati fittizi è stata eseguita sull'account dell'utente. Il piano seguente descrive anche evoluzioni non ancora implementate: editor completo delle pagine, campo note pubbliche separato, job persistenti con cronologia, rollback integrato, personalizzazioni del tema e aggiornamento delle schede browser già aperte. Nella prima integrazione le note gestionali sono escluse di default e pubblicabili solo con opt-in globale; nomi e formazioni restano esclusi. Per le istruzioni effettive di attivazione vedere [la documentazione dell'add-on](../DOCS.md).

## Obiettivo e soluzione proposta

Pubblicare un piccolo sito della squadra, leggibile soprattutto da smartphone, senza banner di registrazione imposti da un servizio documentale. Teams Manager rimane l'unico strumento con cui l'allenatore gestisce e pubblica i contenuti; i genitori aprono un link stabile, senza account.

La soluzione proposta è un sito statico multipagina generato dall'add-on e pubblicato via API su **Cloudflare Workers Static Assets, piano Free**. HTML, CSS e un piccolo JavaScript coprono bacheca, filtri e navigazione: non occorrono un CMS remoto, un database pubblico o un server applicativo online. Il sito contiene una copia selezionata dei dati, mai il database gestionale.

La personalizzazione riguarda tutto il codice del sito, non soltanto le opzioni di un template. Non significa però risorse gratuite illimitate: restano i limiti e le condizioni dell'hosting. L'implementazione iniziale propone un tema completo e poche impostazioni semplici; un editor visuale libero non fa parte della prima versione.

## Confronto dei provider

Condizioni verificate sulla documentazione ufficiale alla data sopra indicata. I piani possono cambiare: ricontrollarli prima dell'attivazione. Tutti i candidati consentono siti personalizzati e pubblicazione programmabile; non hanno il modello di pagina-documento con inviti alla registrazione di Notion. Il collaudo deve comunque verificare la visualizzazione pubblica anonima e le impostazioni del singolo progetto.

| Provider | Gratuità e vincoli rilevanti | Aggiornamento dall'add-on | Valutazione per questa app |
| --- | --- | --- | --- |
| Cloudflare Workers Static Assets | Richieste agli asset statici gratuite e illimitate; nessun costo aggiuntivo per lo storage degli asset. Free: 20.000 file per versione, massimo 25 MiB per file. L'esecuzione di codice Worker ha quote separate. | API per manifest, upload dei file mancanti e pubblicazione della versione; nessun repository Git necessario. | Prima scelta. Sito puramente statico e integrazione diretta. |
| Cloudflare Pages | Piano gratuito, 500 build al mese, 20.000 file e 25 MiB per file. Il limite di build non va interpretato automaticamente come quota dei Direct Upload. | Direct Upload con Wrangler; REST API per gestione dei deployment. | Alternativa valida, ma per un nuovo progetto Cloudflare raccomanda Workers. |
| Netlify Free | 300 crediti al mese; ogni deploy in produzione costa 15 crediti, oltre al consumo per traffico e richieste. All'esaurimento il progetto può essere sospeso fino al ciclo successivo. | REST API con ZIP completo oppure manifest dei file. | API molto comoda, piano gratuito poco adatto a pubblicazioni frequenti. |
| Vercel Hobby | Gratuito per uso personale non commerciale; quote di utilizzo e deploy. Non presumere che un sito associativo o con sponsor rientri automaticamente nell'uso ammesso. | REST API con token per file e deployment. | Tecnicamente valido, meno adatto come scelta generale per squadre diverse. |
| GitHub Pages | Con GitHub Free richiede un repository pubblico. Sito fino a 1 GB; banda con limite soft di 100 GB/mese. Vincoli sull'uso commerciale. | Aggiornamento del repository via API e workflow Pages, oppure artifact e API di deployment con i requisiti del workflow. Non è un semplice upload HTML a un endpoint generico. | Valido per contenuti interamente pubblici, meno semplice e meno adatto a dati che non devono restare nella cronologia Git. |

Fonti Cloudflare: [costi degli asset](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [limiti Workers](https://developers.cloudflare.com/workers/platform/limits/), [Direct Upload API](https://developers.cloudflare.com/workers/static-assets/direct-upload/), [scelta Workers per nuovi progetti](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#use-workers-static-assets-for-new-projects), [limiti Pages](https://developers.cloudflare.com/pages/platform/limits/), [Direct Upload Pages](https://developers.cloudflare.com/pages/get-started/direct-upload/).

Fonti Netlify: [piano gratuito](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [consumo dei crediti](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [sospensione al raggiungimento del limite](https://www.netlify.com/pricing/personal-vs-free/), [deploy via API](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/).

Fonti Vercel: [Hobby](https://vercel.com/docs/plans/hobby), [REST API](https://vercel.com/docs/rest-api). Fonti GitHub: [limiti Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [API Pages](https://docs.github.com/en/rest/pages/pages).

### Costi attesi e sostenibilità

Per Cloudflare, obiettivo operativo: **0 euro al mese e all'anno di hosting**, mantenendo un sito di soli asset nel piano Free. Si usa inizialmente il sottodominio del provider; un dominio proprio è facoltativo e il suo acquisto/rinnovo non è gratuito. L'eventuale dominio già posseduto può essere collegato senza acquistarne un altro, previa configurazione DNS compatibile.

Non attivare servizi a pagamento, database, storage aggiuntivo o upgrade automatici per questa estensione. Non promettere SLA o gratuità perpetua. Account, token e manutenzione rimangono necessari.

Esempio di carico, non una misura dell'utilizzo attuale: 100 pubblicazioni al mese renderebbero Netlify incompatibile con il budget Free già per i soli deploy. Anche un deploy giornaliero per 30 giorni richiederebbe 450 crediti, oltre ai 300 disponibili. La distribuzione statica Cloudflare evita questo specifico modello di costo, ma le API restano soggette ai propri limiti. Hash e raggruppamento degli aggiornamenti sono quindi necessari anche lì.

## Architettura

```text
Allenatore su Teams Manager
           |
           v
SQLite locale e contenuti del sito
           |
           v
Selezione esplicita dei dati pubblicabili
           |
           v
Generatore HTML CSS JS e manifest
           |
           v
Coda persistente di pubblicazione --HTTPS in uscita--> API Cloudflare
                                                           |
                                                           v
                                             Sito statico sulla CDN
                                                           |
                                                           v
                                             Genitori con browser mobile
```

Home Assistant non deve essere esposto pubblicamente. Il browser dei genitori non chiama le API dell'add-on e non riceve token di pubblicazione. Il sito resta disponibile con l'ultima versione pubblicata se l'add-on è spento o offline; non può ricevere nuove modifiche finché l'add-on non torna operativo.

Rigenerare tutto il sito a ogni pubblicazione è adeguato al volume previsto. L'upload può comunque trasferire solo i file cambiati. I provider restano sostituibili grazie a un archivio statico indipendente e a un adattatore di pubblicazione; nella prima versione si implementa soltanto Cloudflare, non cinque integrazioni.

## Esperienza del sito pubblico

### Pagine della prima versione

| Percorso | Contenuti e comportamento |
| --- | --- |
| `/` | Nome e logo opzionale, avviso importante se presente, prossimo evento non annullato in evidenza, agenda completa dei prossimi appuntamenti e ultimo evento passato in fondo. |
| `/avvisi/` | Bacheca con titolo, testo, data di pubblicazione ed eventuale scadenza. Gli avvisi non scaduti possono essere fissati in home. |
| `/informazioni/` | Testo di presentazione e indicazioni logistiche inseriti dall'allenatore. Nessun telefono, email o dato mancante inventato. |
| `/privacy/` | Informazioni sulla pubblicazione e contatto del responsabile solo se fornito; nessuna dichiarazione di conformità automatica. |

Il menu deve poter ospitare altre pagine in seguito. Nella prima versione, contenuti aggiuntivi in Markdown limitato e sicuro, non HTML o script arbitrari. Draft e pubblicato sono distinti per avvisi e pagine. Foto, gallerie e allegati sono fuori dal primo rilascio, salvo il logo controllato.

### Bacheca eventi

- Agenda verticale con date estese in italiano, raggruppamento per giorno, ordine data e ora, dettaglio disponibile senza aprire schede. Il prossimo evento è mostrato una sola volta, non duplicato nell'elenco.
- Tipo con icona e testo; partite con indicazione casa/trasferta/campo neutro e nomi delle squadre nell'ordine casa contro trasferta.
- Luogo, indirizzo quando presente, ritrovo, inizio e fine; note pubbliche sempre leggibili. Link a una mappa esterna, senza embed tracciante iniziale.
- Stato modificato o annullato ben visibile anche senza distinguere i colori. Un evento annullato non viene promosso come prossimo appuntamento.
- Da oggi in avanti, più soltanto l'ultimo evento passato incluso, in fondo, attenuato e barrato ma ancora leggibile. Date e cambio giorno secondo Europe/Rome, non il fuso del dispositivo.
- Filtri leggeri per tipo e periodo; funzionamento base senza JavaScript. Nessuna griglia mensile obbligatoria su mobile.
- Data e ora dell'ultima pubblicazione, pulsante Condividi e collegamenti stabili agli eventi, ad esempio `/#evento-42`, finché l'evento è incluso.

Il criterio iniziale di passato resta quello attuale, basato sul giorno. Passare alla fine effettiva dell'evento richiederebbe una modifica esplicita della regola condivisa con gli altri publisher.

### Requisiti mobile e accessibilità

Nessuno scorrimento orizzontale a 320 px; controlli touch di almeno 44 px; contrasto verificato, focus visibile e navigazione da tastiera. Il contenuto importante viene prima di menu e decorazioni. Font locali o di sistema, immagini ottimizzate, nessun video automatico. Test su Safari iOS e Chrome Android, oltre al desktop.

Obiettivo tecnico iniziale: HTML, CSS e JavaScript compressi sotto 200 KB per la home, logo escluso, nessuna dipendenza da CDN di terzi. Un piccolo JS aggiunge filtri e condivisione; non si distribuisce il gestionale Mantine completo né una copia delle sue API.

## Pubblicazione dei dati e privacy

Il sito è pubblico: conoscere un URL non equivale a essere autorizzati. Un link difficile da indovinare, `robots.txt` e `noindex` non impediscono accesso, inoltro o copia. Autenticazione dei lettori ed eventuale area riservata sono un'estensione separata, da progettare prima di pubblicare dati riservati.

Per la prima attivazione, il contenuto viene mostrato in anteprima e pubblicato soltanto dopo conferma dell'allenatore. Impostazioni iniziali prudenti:

| Dato | Regola proposta |
| --- | --- |
| Eventi | Solo tipi inclusi nella pubblicazione; nessun export automatico dell'intera tabella. |
| Note | Nuovo campo `publicNotes`; le note gestionali esistenti non diventano pubbliche automaticamente. |
| Convocazioni e formazioni con nomi | Non pubblicate per impostazione predefinita sul sito. L'abilitazione esplicita resta subordinata al flag globale delle convocazioni e alla valutazione della destinazione pubblica. |
| Anagrafica, compleanni, foto giocatori, presenze, valutazioni tecniche | Mai presenti nell'output della prima versione, nemmeno in JSON nascosti o sorgenti JS. |
| Contenuti manuali | Pubblicati solo se approvati e non in bozza; verifica dell'autore per informazioni personali inserite nel testo libero. |

Il modello pubblico deve essere un DTO a lista consentita, non una serializzazione di `Event` o del database. Le eventuali convocazioni vanno nominate correttamente: oggi il compositore usa tutti i nomi della rosa, non una selezione individuale per partita. Non introdurre nel sito una falsa selezione dei convocati.

Nessun analytics, font remoto, form, pixel o cookie applicativo nella prima versione. Questo riduce la raccolta di dati, ma non elimina i log tecnici dell'hosting e non sostituisce una valutazione degli obblighi del titolare. I dati già visitati o copiati non sono recuperabili con una semplice rimozione dal sito.

Prevedere una pubblicazione di emergenza di una pagina neutra per ritirare i contenuti. Le precedenti versioni e gli URL di anteprima possono trattenere dati: verificare accessibilità e politica di rimozione dei deployment del provider prima di abilitare contenuti personali. Il rollback di una versione con dati rimossi deve richiedere un avviso esplicito.

## Integrazione nel gestionale

### Impostazioni e flusso per l'allenatore

In Impostazioni → Integrazioni aggiungere Sito pubblico con provider Cloudflare, Account ID, nome del progetto Worker dedicato, token protetto e URL pubblico. Una guida accompagna la creazione iniziale del progetto e del sottodominio nel proprio account. Vietato puntare automaticamente a un Worker esistente con altre funzioni e sovrascriverlo senza verifica di proprietà e destinazione.

L'area Aspetto e contenuti gestisce nome pubblico, logo, colori con contrasto controllato, presentazione, avvisi e pagine. Nessun codice HTML/CSS arbitrario inseribile dall'allenatore nel primo rilascio. La personalizzazione avanzata resta possibile modificando il tema nel codice.

In Comunicazioni mostrare Anteprima locale, Verifica collegamento, Pubblica ora, Apri sito e stato della pubblicazione. La verifica è in sola lettura; il primo deploy è esplicito. L'anteprima passa dalle autorizzazioni correnti dell'add-on e non genera un sito di preview pubblico contenente dati reali.

Il sito diventa una terza destinazione (`website`) accanto a `google` e `notion`. Una sola destinazione automatica attiva inizialmente, per evitare doppie pubblicazioni e rendere comprensibile quale link condividere. Non eliminare Notion o Google Docs durante la migrazione; Calendar e piani partita restano indipendenti.

### Punti di modifica del codice

- `communication.service.ts`: introdurre una selezione esplicita a tre provider. L'attuale distinzione Notion/altrimenti Google non basta: `website` non deve ricadere nel ramo Google.
- `communication-content.ts`: estrarre regole comuni di inclusione, ordinamento e ultimo passato. Generare un modello pubblico strutturato separato dai paragrafi Docs/Notion, preservando i test di regressione.
- `live-communication-scheduler.service.ts`: riusare i trigger ma introdurre debounce, recupero al riavvio e pianificazione corretta in Europe/Rome anche nei cambi dell'ora legale.
- Nuovi moduli `public-site-content`, `public-site-renderer`, `site-publishing` e adattatore `publishers/cloudflare-assets`; tema e asset statici versionati insieme all'app.
- Nuove route `/api/public-site` per impostazioni, verifica e anteprima; i job riusano o estendono il meccanismo di pubblicazione in background esistente.
- Frontend: scheda integrazione, editor semplice di avvisi/pagine e stato del sito in Comunicazioni. Nessun accesso diretto del browser alle API di deploy Cloudflare.

Il nome legacy `includeInGoogleDoc` continua a valere per tutte le destinazioni. È opportuno introdurre un nome neutro nell'interfaccia e nella DTO, mantenendo compatibilità dei dati e degli export; non perdere le selezioni esistenti con una rinomina distruttiva.

### Persistenza proposta

SQLite continua a essere l'unica fonte primaria. Nuove migrazioni non distruttive:

- `events.public_notes`, inizialmente vuoto, senza copia indiscriminata delle note attuali.
- `site_pages`: slug univoco, titolo, corpo, ordine menu, bozza/pubblicato, data di modifica.
- `site_notices`: titolo, corpo, priorità, pubblicazione, scadenza e stato bozza/pubblicato.
- `site_publish_jobs`: identificativo, revisione contenuti, configurazione destinazione, hash, stato, tentativi, deployment remoto, tempi ed errore sanitizzato.
- Impostazioni sito: tema, destinazione, URL confermato, consenso alla prima pubblicazione, ultima revisione pubblicata. Token separato dai valori esportabili e mai restituito dalle API.

## Processo di aggiornamento

1. Il salvataggio di eventi, tipi, impostazioni visibili, avvisi o pagine marca il sito come da aggiornare. Raggruppare le modifiche vicine per circa 15 secondi, con attesa massima di 60 secondi; il pulsante manuale forza l'elaborazione.
2. Acquisire una fotografia coerente dei contenuti pubblicabili e della configurazione. Validare e generare tutte le pagine, compresi header di sicurezza e 404. La generazione non modifica il provider.
3. Calcolare un hash del contenuto significativo, tema e schema inclusi. Timestamp di tentativo e metadati variabili non devono causare deploy senza modifiche. Le scritture automatiche a hash invariato sono saltate; il refresh forzato può riparare il sito.
4. Registrare il job in SQLite, caricare l'artefatto con l'adattatore e attivare la nuova versione solo dopo il completamento degli upload.
5. Verificare il manifest pubblico della revisione prima di segnare il job come riuscito. Solo allora aggiornare hash, orario di successo e URL. Un fallimento non deve dichiarare aggiornato un sito vecchio.
6. Se arrivano modifiche durante il deploy, segnare una revisione successiva da pubblicare. Le richieste ripetute si accodano o si aggregano, senza avviare deploy concorrenti sulla stessa destinazione.

La manutenzione giornaliera alle 03:05 Europe/Rome rimuove gli eventi oltre l'ultimo passato e gli avvisi scaduti; pianificare anche le scadenze puntuali degli avvisi. Al riavvio riconciliare job interrotti e contenuti scaduti. Il sito aperto può aggiornare i dati tramite un piccolo manifest pubblico alla riapertura della scheda e, mentre visibile, ogni cinque minuti; non è un sistema realtime e non garantisce notifiche push.

Per evitare contenuti incoerenti, il manifest punta a un JSON pubblico versionato con hash; conservare per una breve finestra gli asset necessari alle schede già aperte. HTML e manifest devono essere rivalidati, mentre CSS/JS con hash possono avere cache lunga. Nessun service worker nella prima versione: evitare che una cache offline mostri cancellazioni non aggiornate senza avviso.

Con add-on offline il giorno può cambiare senza un deploy: il JS filtra per data gli eventi già presenti nello snapshot e segnala l'ultima pubblicazione, ma non inventa nuove modifiche né garantisce la pulizia dei file sul provider. Un eventuale fallback HTML senza JS può restare datato: l'orario di aggiornamento deve essere sempre visibile.

### Adattatore Cloudflare

Implementare il protocollo ufficiale Direct Upload: registrazione del manifest dei file, upload in gruppi dei soli asset richiesti e creazione/attivazione della versione con il token di completamento. Non equivale a una singola chiamata: il vantaggio è operare su file e versioni, non su ogni evento. Seguire hash, MIME e metadati previsti dall'API; usare il relativo SDK fissato a versione, oppure un client REST piccolo con test di contratto. [Protocollo ufficiale](https://developers.cloudflare.com/workers/static-assets/direct-upload/).

Servire asset statici senza `run_worker_first`; non aggiungere backend pubblico per semplici filtri. Se il percorso API scelto richiede un modulo minimo, mantenere il routing degli asset prioritario. Confermare nel prototipo la pubblicazione di soli asset o del modulo minimo, l'attivazione sul sottodominio e il rollback prima di finalizzare l'adattatore. Non richiedere Wrangler installato sul dispositivo dell'allenatore, né eseguire `npx` con download di dipendenze a ogni deploy.

Per timeout dopo l'attivazione, confrontare revisione pubblica e deployment prima di ripetere la pubblicazione. Retry limitati con backoff e `Retry-After` per errori transitori; niente retry infinito per credenziali revocate, quote esaurite o configurazioni errate. Conservare localmente almeno l'ultimo artefatto riuscito e quello precedente, con limiti di spazio e rollback esplicito.

### Stato e sicurezza

Le API amministrative restituiscono rapidamente un job ID; il browser legge lo stato locale con intervalli progressivi, non interroga Cloudflare ogni secondo. Stati: in attesa, generazione, upload, attivazione, verifica, riuscito, fallito. La pubblicazione fallita lascia l'ultima versione valida e offre un nuovo tentativo con messaggio comprensibile.

Token con permessi minimi disponibili sul solo account necessario, preferibilmente dedicato; non presumere che il provider supporti restrizioni per singolo Worker. Non usare la Global API Key. Credenziali in backend, escluse da export JSON, log, HTML, screenshot diagnostici e bundle frontend; proteggere anche i backup completi dell'add-on.

Rendering con escaping contestuale, URL HTTPS validati, Markdown sanitizzato e nessuno script utente. Logo con limiti di tipo e dimensione, senza SVG arbitrario non sanitizzato. Vietare path traversal negli slug. Impostare CSP, protezione MIME e referrer policy; testare i relativi header sul sito realmente distribuito. L'anteprima deve avere isolamento coerente, non eseguire codice editoriale nell'origine del gestionale.

## Piano di implementazione e collaudo

### Fase uno convalida del provider

Su un progetto dedicato di prova e con dati fittizi: pubblicare tre pagine via API, aggiornarle senza cambio URL, simulare upload interrotto, verificare quota, lettura anonima, header/cache e comportamento dei vecchi deployment. Confermare che non servano piano a pagamento, repository pubblico o esposizione di Home Assistant. Questa prova è il primo punto di decisione, prima del refactoring del gestionale.

### Fase due generatore e dati pubblici

Realizzare DTO, migrazioni, tema mobile, anteprima e archivio statico esportabile. Testare esclusione dei dati privati in tutti i file, escaping, stati, date italiane, ordinamento, flag, una sola occorrenza per evento e nessuna pubblicazione accidentale delle note precedenti.

### Fase tre integrazione di pubblicazione

Implementare adattatore Cloudflare, job persistenti, debounce, scheduling, hash, verifica e retry. Testare perdita della risposta finale, riavvio, revoca token, quote esaurite, cambio configurazione durante upload e due richieste simultanee. Le regressioni Google Docs e Notion devono restare coperte.

### Fase quattro contenuti e passaggio operativo

Aggiungere avvisi/pagine, impostazioni del tema e procedura guidata. Pubblicare una copia di prova con dati approvati, validarla su telefoni reali, poi scegliere Sito pubblico come destinazione attiva e condividere il nuovo link. La precedente pagina Notion rimane consultabile ma non aggiornata: indicare chiaramente la nuova destinazione, senza cancellarla automaticamente.

### Criteri di accettazione

- Genitore senza account e fuori dalla LAN apre il link HTTPS, legge tutti gli appuntamenti senza banner di iscrizione e naviga le altre pagine.
- Su telefoni da 320, 375 e 430 px non c'è overflow; filtri e condivisione funzionano con touch; senza JS restano leggibili eventi e contenuti essenziali.
- Modifica/annullamento/cancellazione/inclusione di un evento si riflettono sul sito dopo una pubblicazione riuscita. Gli errori non creano duplicati e non cambiano l'URL.
- Un batch di eventi ravvicinati produce un solo job aggregato; a dati invariati il controllo automatico non crea un deployment.
- Mai più di un passato nel contenuto generato; test di mezzanotte e ora legale Europe/Rome, compreso recupero dopo spegnimento prolungato.
- Nessun token, presenza, dato tecnico o nome non autorizzato nei file, JSON, log e vecchi artefatti conservati dall'app oltre la retention.
- Per il caso di prova concordato, Lighthouse mobile almeno 90 su prestazioni e accessibilità; verifica manuale di Safari iOS e Chrome Android, tastiera, contrasto e stato annullato.
- Home Assistant spento: il sito resta leggibile; l'ultima pubblicazione è identificabile. Riconnesso: eventuali aggiornamenti pendenti vengono recuperati.
- Primo sito di prova pubblicato e aggiornato mantenendo il piano gratuito; verifica documentata dei consumi e della procedura di ritiro dei contenuti.

## Decisioni iniziali e sviluppi successivi

Le impostazioni proposte sono Cloudflare Free, sottodominio gratuito, tema mobile a una colonna, nessun accesso richiesto ai lettori, dati personali esclusi, un solo publisher attivo e nessuna cancellazione delle integrazioni precedenti. Il codice deve consentire successivamente un dominio proprio e altri adattatori senza cambiare il modello dei contenuti.

Fuori perimetro iniziale: app nativa, area riservata, conferma presenze dei genitori, notifiche push, upload documenti, gallerie dei giocatori, CMS remoto, multi-squadra e creazione automatica di account cloud. Sono evoluzioni possibili, non benefici già inclusi nell'hosting statico.

Il passo successivo consigliato è la fase uno su Cloudflare con dati fittizi. Solo dopo questa prova conviene implementare sito e publisher: prima si valida il canale di pubblicazione gratuito, poi si investe nel layout definitivo.
