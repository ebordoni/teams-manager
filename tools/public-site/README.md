# Prototipo del sito pubblico su Cloudflare

Prova tecnica separata dal gestionale: genera una bacheca responsive e due pagine con soli dati fittizi. Non legge SQLite e non modifica l'integrazione Notion. Richiede Node.js 24 o superiore, senza nuove dipendenze.

## Anteprima locale

Dalla radice del repository:

```bash
npm run site:test
npm run site:preview
```

Aprire `http://127.0.0.1:4174`. L'anteprima è accessibile solo dal computer locale; in WSL usare l'inoltro localhost. Per generare soltanto i file: `npm run site:build`. L'output è in `dist/public-site-prototype`, escluso da Git. Le date dimostrative sono relative al giorno corrente in Europe/Rome.

## Configurazione temporanea delle credenziali

In un terminale Bash locale, senza condividere i valori in chat:

```bash
read -r -p "Cloudflare Account ID: " CLOUDFLARE_ACCOUNT_ID
read -r -s -p "Cloudflare API token: " CLOUDFLARE_API_TOKEN
printf '\n'
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN
export CLOUDFLARE_WORKER_NAME=teams-manager
npm run site:verify
```

Il token non viene digitato nella cronologia dei comandi, stampato o salvato dal prototipo. Rimane nell'ambiente dei processi avviati da questa shell: non usare terminali condivisi o strumenti che esportano l'ambiente. Terminata la prova, eseguire `unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_WORKER_NAME` o chiudere il terminale. Non caricare token nel frontend o nelle impostazioni Notion.

La verifica effettua solo letture e mostra l'URL previsto. Non certifica i permessi di scrittura: questi sono verificabili con il deploy di prova. Occorrono un sottodominio workers.dev configurato nell'account e i permessi Workers Scripts Edit sul relativo account. Non servono permessi DNS.

## Pubblicazione esplicita

```bash
npm run site:deploy -- --confirm-publish
```

Il comando crea il Worker `teams-manager`, se libero, pubblica dati fittizi e abilita il suo URL workers.dev; le preview vengono disabilitate. Se il Worker esiste senza il tag di proprietà del prototipo, il comando si ferma senza sovrascriverlo. Non aggirare il controllo per sostituire un Worker usato da altri servizi: scegliere invece un nome libero, ad esempio `teams-manager-test`.

Gli aggiornamenti successivi sostituiscono tutto il sito dimostrativo mantenendo l'URL. Non lanciare deploy simultanei da più terminali. Non sono previsti deploy automatici, retry di scritture o rollback automatici in questa prova. Se la risposta finale si perde, controllare prima nel pannello Cloudflare e all'URL pubblico; un errore di verifica della revisione non significa necessariamente che il deploy non sia avvenuto.

Prima di confermare il passaggio all'integrazione completa, eseguire due pubblicazioni, controllare link stabili, pagine e header, e provare il rollback di una versione dal pannello Cloudflare. Nessun contenuto reale deve essere usato per queste verifiche. Per ritirare il prototipo, disabilitare il suo indirizzo workers.dev dal pannello; questo non rimuove automaticamente le vecchie versioni archiviate dal provider.

## Verifiche e limiti

I test locali simulano le API: coprono manifest/hash, upload base64, credenziali negli errori, destinazioni estranee e mancata attivazione dopo un upload fallito. Non sostituiscono una prova sul proprio account Cloudflare. Anche layout mobile e contrasto richiedono collaudo nel browser e su telefoni reali.

Il client usa il protocollo [Direct Upload](https://developers.cloudflare.com/workers/static-assets/direct-upload/), la pubblicazione [Worker Module](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/) con soli asset e l'API [Worker Script Subdomain](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/methods/create/). Se una chiamata viene rifiutata, interrompere la prova e riportare soltanto il messaggio sanitizzato del comando, mai il token.
