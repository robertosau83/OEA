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

## auto cancellazione utenza da parte di admin. 

Per fare in modo che admin possa cancellare la sua utenza quindi:

la company
tutti i dipendenti
l’admin stesso
tutti gli utenti Auth relativi

bisogna inserire una funzione rpc così:

````md
```sql

create or replace function admin_delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_uid uuid := auth.uid();
  v_company_id uuid;
  user_ids uuid[];
begin
  -- 1) Verifica che l'utente sia realmente un admin
  select company_id into v_company_id
  from onshift_users
  where id = admin_uid
    and role = 'ADMIN';

  if v_company_id is null then
    raise exception 'Unauthorized: only admins can delete their account and company.';
  end if;

  -- 2) Recupera TUTTI gli utenti della company (admin + employees)
  select array_agg(id) into user_ids
  from onshift_users
  where onshift_users.company_id = v_company_id;

  if user_ids is null then
    raise exception 'Unexpected error: no users found for this company.';
  end if;

  -- 3) Cancella gli utenti dalla tabella applicativa
  delete from onshift_users
  where onshift_users.id = any(user_ids);

  -- 4) Cancella la company
  delete from onshift_companies
  where onshift_companies.id = v_company_id;

  -- 5) Cancella gli utenti dal sistema Auth
  delete from auth.users
  where auth.users.id = any(user_ids);

end;
$$;

```

il codice la richiamerà quando vorremo cancellare l'utenza di un ADMIN e lasciare tutto pulito.
i relativi employee non saranno più in grado di fare nulla, e verranno loggati fuori dopo tot ore o al successivo refresh.


## auto cancellazione utenza da parte di employee. 

Per fare in modo che employee possa cancellare la sua utenza quindi:

se stesso
la sua utenza Auth

bisogna inserire una funzione rpc così:

````md
```sql

create or replace function employee_delete_self()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  emp_uid uuid := auth.uid();
  emp_role text;
begin
  -- 1) Recupera ruolo dell'utente
  select role into emp_role
  from onshift_users
  where id = emp_uid;

  if emp_role is null then
    raise exception 'User not found.';
  end if;

  -- 2) Blocca la cancellazione per un ADMIN
  if emp_role = 'ADMIN' then
    raise exception 'Admins cannot delete themselves. Use admin_delete_account instead.';
  end if;

  -- 3) Cancella dalla tabella applicativa
  delete from onshift_users
  where id = emp_uid;

  -- 4) Cancella dal sistema Auth
  delete from auth.users
  where id = emp_uid;

end;
$$;


```

il codice la richiamerà quando vorremo cancellare l'utenza di un EMPLOYEE e lasciare tutto pulito.


## cancellazione singola utenza EMPLOYEE da parte di ADMIN

Per fare in modo che un Admin possa cancellare una singola utenza (tasto "cancella" nella tabella dei suoi dipendenti):
-viene cancellata l'istanza del dipendente da onshift_users
-viene cancellata l'istanza del dipendente da auth

bisogna inserire una funzione rpc così:

````md
```sql

create or replace function admin_delete_employee(emp_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_uid uuid := auth.uid();
  admin_company uuid;
  emp_company uuid;
  emp_role text;
begin
  -- Recupera company dell'admin chiamante
  select company_id into admin_company
  from onshift_users
  where id = admin_uid and role = 'ADMIN';

  if admin_company is null then
    raise exception 'Unauthorized: only admins can delete employees.';
  end if;

  -- Recupera la company del dipendente da eliminare
  select company_id, role into emp_company, emp_role
  from onshift_users
  where id = emp_id;

  if emp_company is null then
    raise exception 'Employee not found.';
  end if;

  -- L'admin NON può eliminare altri admin
  if emp_role = 'ADMIN' then
    raise exception 'Admins cannot delete other admin accounts.';
  end if;

  -- Devono appartenere alla stessa company
  if emp_company != admin_company then
    raise exception 'Cannot delete employees from another company.';
  end if;

  -- Elimina dalla tabella applicativa
  delete from onshift_users where id = emp_id;

  -- Elimina dal sistema Auth
  delete from auth.users where id = emp_id;

end;
$$;



```

il codice la richiamerà quando vorremo cancellare l'utenza di un EMPLOYEE e lasciare tutto pulito.