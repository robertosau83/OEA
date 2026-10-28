# OEA Yazzi

Applicazione Solid/Vite per memorizzare e consultare partite di Yazzi tra utenti autorizzati.

## Script disponibili

```bash
npm run dev
npm run build
npm run typecheck
npm run test:statistics
```

## Modello dati

Lo schema applicativo e' in `supabase/oea_users.sql`.

Tabelle principali:

- `oea_users`: utenti censiti, con `status` `PENDING`, `ACTIVE` o `DISABLED`.
- `oea_games`: una riga per ogni partita, con data, note e flag `on_record`.
- `oea_game_players`: partecipanti di ogni partita.
- `oea_voices`: voci di punteggio modificabili, ad esempio coppia, tris, poker, Yazzi, con flag `is_active` e `counts_in_total`.
- `oea_scores`: punteggio di un giocatore per una voce in una partita.

Vincoli importanti:

- solo utenti `ACTIVE` possono usare l'app;
- una partita puo' includere solo utenti esistenti;
- un giocatore puo' avere un solo punteggio per ogni voce dentro la stessa partita;
- le voci non vanno cancellate se sono gia' usate nello storico: conviene impostare `is_active = false`.
- solo le voci con `counts_in_total = true` entrano nella sommatoria finale del punteggio.
- eliminando una partita vengono eliminati automaticamente partecipanti e punteggi collegati.

## Setup Supabase

Esegui `supabase/oea_users.sql` nello SQL Editor di Supabase.

Lo script crea tabelle, RLS, policy, trigger per `updated_at`, trigger di creazione profilo dopo signup e voci Yazzi iniziali.

Dopo `auth.signUp`, il frontend non inserisce direttamente in `oea_users`: la riga viene creata dal trigger `create_oea_user_after_signup` con stato `PENDING`.

Dopo la registrazione, un utente viene creato come `PENDING`. Per autorizzarlo:

```sql
update public.oea_users
set status = 'ACTIVE'
where email = 'utente@example.com';
```

Per abilitare la gestione utenti dalla app, imposta almeno un primo admin:

```sql
update public.oea_users
set status = 'ACTIVE',
    is_admin = true
where email = 'admin@example.com';
```

Gli admin possono cambiare stato agli utenti e, in fase di pulizia iniziale, cancellare utenti di test anche da Supabase Auth. La cancellazione fisica puo' fallire se l'utente ha partite collegate: in quel caso usa `DISABLED`.

## Rotte frontend

- `/` login
- `/register` registrazione
- `/app` gestione partite

## Statistiche e record partita

Le statistiche caricano l'intero storico con pagine ordinate per ID univoco e un
cursore, proseguendo fino alla pagina vuota anche se il limite del server e'
inferiore alla dimensione richiesta. Errori e timeout impediscono di mostrare un
caricamento parziale come completo. Il pulsante **Aggiorna** rilegge lo storico;
uscire dalla sezione annulla il caricamento.

Il filtro include le partite a cui partecipano **tutti i giocatori selezionati**.
I punti vittoria sono confrontati tra questi giocatori: un primo posto condiviso
vale un punto per ciascun vincitore se batte almeno un altro selezionato; un
pareggio tra tutti non assegna punti. Con un solo giocatore restano disponibili
totali e record, senza assegnare vittorie.

Totali, classifiche e record usano lo stesso campione. Entrano nel totale solo le
voci con `counts_in_total = true`, comprese quelle disattivate ma presenti nello
storico, mantenendo anche zero e penalita'. Il grafico dei punti totali usa barre
per poter rappresentare anche valori negativi.

Sono escluse dal campione le partite con punteggi da completare per i selezionati:
le voci richieste sono quelle conteggiate e registrate nella singola partita,
cosi' una nuova voce non invalida automaticamente lo storico. Questa e' una
verifica della compilazione dei dati, non un flag esplicito di fine partita.

La card **Record partita** mostra il totale individuale piu' alto e piu' basso,
con giocatore, data e collegamento al dettaglio. Mostra tutti i record a pari
merito e segue il filtro selezionato.

### Verifica del 28 ottobre 2026

Controllate con query di sola lettura **103 partite, 381 partecipazioni e 7.120
punteggi**. Con i quattro giocatori attivi selezionati il campione e' di **72
partite**: massimo **305, Bonde, 01/10/2025**; minimo **85, Bonde, 25/09/2023**.
I totali del frontend coincidono con una query SQL indipendente.

`supabase/verify_statistics.sql` estrae il dataset e i totali SQL per ripetere la
verifica senza scrivere sul database. Il risultato locale, contenente lo storico,
e' escluso da Git in `.codex/statistics-verification.json`. Se presente viene
confrontato dalla suite; se assente quel test viene saltato. Gli altri test
verificano paginazione con limite ridotto del server, errori, annullamento,
timeout, filtri, parita', voci storiche, punteggi incompleti, zero e negativi.

Verificati anche nel browser autenticato: lettura reale dello storico, filtri,
record, grafici, ricaricamento con **Aggiorna** e apertura del dettaglio del record.
