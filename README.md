# OEA Yazzi

Applicazione Solid/Vite per memorizzare e consultare partite di Yazzi tra utenti autorizzati.

## Script disponibili

```bash
npm run dev
npm run build
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
