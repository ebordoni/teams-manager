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

### Comunicazioni (in arrivo)

Generazione automatica di un Google Document con gli appuntamenti della settimana, da condividere
con i genitori tramite WhatsApp. Vedi [`SPECS.md`](../SPECS.md) per i dettagli della roadmap.

## Configurazione

| Opzione                | Descrizione                                        |
| ---------------------- | -------------------------------------------------- |
| `google_client_id`     | Client ID OAuth 2.0 Google (Fase 5, opzionale)     |
| `google_client_secret` | Client Secret OAuth 2.0 Google (Fase 5, opzionale) |

I dati (SQLite) sono salvati in `/data` e inclusi nei backup di Home Assistant.
