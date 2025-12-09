## Available Scripts

In the project directory, you can run:

### `npm run dev` or `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

## funzionamento base

Questo template utilizza Row Level Security (RLS) di Supabase per gestire un sistema multi-company, con due ruoli:
-ADMIN
-EMPLOYEE

Ogni utente appartiene a una company attraverso il campo company_id, memorizzato nel JWT.

Gli ADMIN possono:
-leggere tutti gli utenti della loro azienda
-aggiornare lo stato dei loro dipendenti (es. da PENDING → CONFIRMED)
-aggiornare la propria azienda

I dipendenti possono:
-leggere solo i membri della propria azienda
-aggiornare solo la propria riga


````md
## 🔧 Funzioni JWT (da copiare in Supabase)

```sql
create or replace function app_auth.company_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.company_id', true), ''),
    null
  );
$$;

create or replace function app_auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    null
  );
$$;
```
Queste funzioni permettono di scrivere policy leggibili come:

app_auth.role() = 'ADMIN'
app_auth.company_id() = company_id

## Tabella: onshift_companies

Questa tabella rappresenta le aziende registrate sulla piattaforma.

🔒 Policy attive
insert_company	INSERT	Consente la creazione di una company da parte di un utente autenticato
select_companies	SELECT	Permette di leggere l’azienda a cui si appartiene
update_company	UPDATE	Solo l’admin dell’azienda può modificarla

````md
# Query SQL per ricreare le policy di onshift_companies

```sql
-- INSERT
create policy "insert_company"
on public.onshift_companies
for insert
to public
with check (auth.uid() IS NOT NULL);

-- SELECT
create policy "select_companies"
on public.onshift_companies
for select
to public
using (auth.uid() IS NOT NULL);

-- UPDATE (solo l'admin della company)
create policy "update_company"
on public.onshift_companies
for update
to public
using (admin_id = auth.uid())
with check (admin_id = auth.uid());
```

## Tabella: onshift_users

Questa tabella contiene tutti gli utenti (admin + dipendenti).

Ogni utente ha nel JWT:
- company_id
- role (ADMIN / EMPLOYEE)

🔒 Policy attive
insert_user	INSERT	L’utente può inserire solo la propria riga (durante la registrazione)
Users see only company members	SELECT	Utenti e admin vedono solo gli utenti con la loro stessa company
Admins can update employees of their company	UPDATE	L’ADMIN può aggiornare dipendenti della propria azienda; ogni utente può aggiornare solo se stesso

````md
# Query SQL per ricreare le policy di onshift_users

```sql
-- INSERT: utente può inserire solo se stesso
create policy "insert_user"
on public.onshift_users
for insert
to public
with check (id = auth.uid());

-- SELECT: utenti vedono solo membri della stessa company
create policy "Users see only company members"
on public.onshift_users
for select
to public
using (app_auth.company_id() = company_id);

-- UPDATE: admin può aggiornare dipendenti della propria azienda
-- ogni utente può aggiornare solo se stesso
create policy "Admins can update employees of their company"
on public.onshift_users
for update
to public
using (
  (app_auth.role() = 'ADMIN' AND app_auth.company_id() = company_id)
  OR (id = auth.uid())
);
```

🚀 Riepilogo

Per utilizzare questo template devi:

1️⃣ Aggiungere nel JWT dell’utente:
- company_id
- role
(lo fa già il codice quando crea l'utenza)

2️⃣ Creare le funzioni:
- app_auth.company_id()
- app_auth.role()

3️⃣ Abilitare RLS, realtime e applicare le policy su:
- onshift_users
- onshift_companies

4️⃣ Ora l’ADMIN può:
- vedere tutti i dipendenti della sua azienda
- confermarli cambiando status = 'CONFIRMED'