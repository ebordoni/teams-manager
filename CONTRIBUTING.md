# Contribuire

Il progetto usa Node.js 24 o superiore. Le dipendenze degli applicativi sono
bloccate nei rispettivi lockfile.

## Controlli locali

```bash
npm ci --prefix addon/backend
npm ci --prefix addon/frontend
npm run check
```

`npm run check` verifica l'allineamento delle versioni e compila backend e
frontend. La CI esegue gli stessi controlli e costruisce l'immagine Docker
dell'add-on.

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
