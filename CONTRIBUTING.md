# Contribuire

Il progetto usa Node.js 24 o superiore. Le dipendenze degli applicativi sono
bloccate nei rispettivi lockfile.

## Controlli locali

```bash
npm ci --prefix addon/backend
npm ci --prefix addon/frontend
npm run check
```

`npm run check` verifica l'allineamento delle versioni, esegue gli smoke test
API e compila backend e frontend. La CI esegue gli stessi controlli e costruisce l'immagine Docker
dell'add-on.

### Verifiche UI

Per i test nel browser, dopo aver installato le dipendenze locali:

```bash
npm exec --prefix addon/frontend -- playwright install --with-deps chromium
npm run test:ui
```

La suite avvia backend e frontend compilati su una porta temporanea e un database di prova, senza leggere o modificare `data/` né contattare le integrazioni esterne. Verifica tutte le schermate a 320, 375, 768 e 1440 px, temi chiaro/scuro, flussi operativi e percorsi Ingress. Gli screenshot sono salvati nella cartella temporanea indicata nell'output; `UI_SCREENSHOT_DIR` permette di scegliere una cartella esistente. Queste verifiche richiedono Chromium e le sue librerie di sistema e sono separate da `npm run check`.

## Versioni, changelog e commit

- Usa Conventional Commits in inglese: `feat:`, `fix:`, `docs:`, `refactor:`.
- Il versioning segue SemVer: patch per correzioni, minor per funzionalità,
  major per modifiche incompatibili.
- Ogni modifica funzionale richiede una nuova versione e una voce sia in
  `CHANGELOG.md` sia in `addon/CHANGELOG.md`.
- Prima del commit di release aggiorna `package.json`, manifest HA, package e
  lockfile backend/frontend, label Docker e badge README, quindi esegui
  `npm run check`.
- Le sole modifiche di documentazione non richiedono una nuova versione.
