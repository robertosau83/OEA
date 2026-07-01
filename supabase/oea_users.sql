create table if not exists public.oea_users (
	id uuid primary key references auth.users(id) on delete cascade,
	name text not null,
	email text not null unique,
	status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'DISABLED')),
	is_admin boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.oea_users add column if not exists status text not null default 'PENDING';
alter table public.oea_users add column if not exists is_admin boolean not null default false;
alter table public.oea_users add column if not exists updated_at timestamptz not null default now();

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'oea_users_status_check'
	) then
		alter table public.oea_users
		add constraint oea_users_status_check
		check (status in ('PENDING', 'ACTIVE', 'DISABLED'));
	end if;
end $$;

create table if not exists public.oea_games (
	id uuid primary key default gen_random_uuid(),
	played_at date not null default current_date,
	on_record boolean not null default false,
	created_by uuid not null references public.oea_users(id) on delete restrict,
	notes text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.oea_games add column if not exists on_record boolean not null default false;

create table if not exists public.oea_game_players (
	id uuid primary key default gen_random_uuid(),
	game_id uuid not null references public.oea_games(id) on delete cascade,
	user_id uuid not null references public.oea_users(id) on delete restrict,
	player_order integer not null default 0,
	created_at timestamptz not null default now(),
	unique (game_id, user_id)
);

create table if not exists public.oea_voices (
	id uuid primary key default gen_random_uuid(),
	code text not null unique,
	name text not null,
	sort_order integer not null default 0,
	is_active boolean not null default true,
	counts_in_total boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.oea_voices add column if not exists counts_in_total boolean not null default true;

create table if not exists public.oea_scores (
	id uuid primary key default gen_random_uuid(),
	game_id uuid not null references public.oea_games(id) on delete cascade,
	user_id uuid not null references public.oea_users(id) on delete restrict,
	voice_id uuid not null references public.oea_voices(id) on delete restrict,
	score integer,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (game_id, user_id, voice_id),
	foreign key (game_id, user_id) references public.oea_game_players(game_id, user_id) on delete cascade
);

alter table public.oea_users enable row level security;
alter table public.oea_games enable row level security;
alter table public.oea_game_players enable row level security;
alter table public.oea_voices enable row level security;
alter table public.oea_scores enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists set_oea_users_updated_at on public.oea_users;
create trigger set_oea_users_updated_at
before update on public.oea_users
for each row
execute function public.set_updated_at();

drop trigger if exists set_oea_games_updated_at on public.oea_games;
create trigger set_oea_games_updated_at
before update on public.oea_games
for each row
execute function public.set_updated_at();

drop trigger if exists set_oea_voices_updated_at on public.oea_voices;
create trigger set_oea_voices_updated_at
before update on public.oea_voices
for each row
execute function public.set_updated_at();

drop trigger if exists set_oea_scores_updated_at on public.oea_scores;
create trigger set_oea_scores_updated_at
before update on public.oea_scores
for each row
execute function public.set_updated_at();

create or replace function public.oea_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.oea_users
		where id = auth.uid()
			and status = 'ACTIVE'
	);
$$;

create or replace function public.oea_is_active_user(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.oea_users
		where id = user_id
			and status = 'ACTIVE'
	);
$$;

create or replace function public.oea_is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.oea_users
		where id = auth.uid()
			and status = 'ACTIVE'
			and is_admin = true
	);
$$;

create or replace function public.create_oea_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.oea_users (id, name, email, status, is_admin)
	values (
		new.id,
		coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
		lower(new.email),
		'PENDING',
		false
	)
	on conflict (id) do nothing;

	return new;
end;
$$;

drop trigger if exists create_oea_user_after_signup on auth.users;
create trigger create_oea_user_after_signup
after insert on auth.users
for each row
execute function public.create_oea_user_from_auth();

insert into public.oea_voices (code, name, sort_order, counts_in_total)
values
	('ones', 'Uno', 10, true),
	('twos', 'Due', 20, true),
	('threes', 'Tre', 30, true),
	('fours', 'Quattro', 40, true),
	('fives', 'Cinque', 50, true),
	('sixes', 'Sei', 60, true),
	('pair', 'Coppia', 70, true),
	('two_pairs', 'Doppia coppia', 80, true),
	('three_kind', 'Tris', 90, true),
	('four_kind', 'Poker', 100, true),
	('small_straight', 'Scala piccola', 110, true),
	('large_straight', 'Scala grande', 120, true),
	('full_house', 'Full', 130, true),
	('chance', 'Chance', 140, true),
	('yazzi', 'Yazzi', 150, true)
on conflict (code) do update
set name = excluded.name,
	sort_order = excluded.sort_order,
	counts_in_total = excluded.counts_in_total;

drop policy if exists "oea_users_select_own" on public.oea_users;
drop policy if exists "oea_users_select" on public.oea_users;
create policy "oea_users_select"
on public.oea_users
for select
to authenticated
using (
	id = auth.uid()
	or public.oea_is_admin_user()
	or (public.oea_is_active_user() and status = 'ACTIVE')
);

drop policy if exists "oea_users_insert_own" on public.oea_users;
create policy "oea_users_insert_own"
on public.oea_users
for insert
to authenticated
with check (
	id = auth.uid()
	and lower(email) = lower(coalesce(auth.jwt()->>'email', email))
	and status = 'PENDING'
	and is_admin = false
);

drop policy if exists "oea_users_update_own" on public.oea_users;
drop policy if exists "oea_users_update_admin" on public.oea_users;
create policy "oea_users_update_admin"
on public.oea_users
for update
to authenticated
using (public.oea_is_admin_user())
with check (public.oea_is_admin_user());

create or replace function public.admin_delete_oea_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
	if not public.oea_is_admin_user() then
		raise exception 'Unauthorized: only admins can delete users.';
	end if;

	if target_user_id = auth.uid() then
		raise exception 'Cannot delete the current user.';
	end if;

	delete from auth.users
	where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_oea_user(uuid) from public;
grant execute on function public.admin_delete_oea_user(uuid) to authenticated;

drop policy if exists "oea_games_select_active" on public.oea_games;
create policy "oea_games_select_active"
on public.oea_games
for select
to authenticated
using (public.oea_is_active_user());

drop policy if exists "oea_games_insert_active" on public.oea_games;
create policy "oea_games_insert_active"
on public.oea_games
for insert
to authenticated
with check (
	public.oea_is_active_user()
	and created_by = auth.uid()
	and public.oea_is_active_user(created_by)
);

drop policy if exists "oea_games_update_active" on public.oea_games;
create policy "oea_games_update_active"
on public.oea_games
for update
to authenticated
using (public.oea_is_active_user())
with check (public.oea_is_active_user());

drop policy if exists "oea_games_delete_active" on public.oea_games;
create policy "oea_games_delete_active"
on public.oea_games
for delete
to authenticated
using (public.oea_is_active_user());

drop policy if exists "oea_game_players_all_active" on public.oea_game_players;
create policy "oea_game_players_all_active"
on public.oea_game_players
for all
to authenticated
using (public.oea_is_active_user())
with check (
	public.oea_is_active_user()
	and public.oea_is_active_user(user_id)
);

drop policy if exists "oea_voices_select_active" on public.oea_voices;
create policy "oea_voices_select_active"
on public.oea_voices
for select
to authenticated
using (public.oea_is_active_user());

drop policy if exists "oea_voices_write_active" on public.oea_voices;
create policy "oea_voices_write_active"
on public.oea_voices
for all
to authenticated
using (public.oea_is_active_user())
with check (public.oea_is_active_user());

drop policy if exists "oea_scores_all_active" on public.oea_scores;
create policy "oea_scores_all_active"
on public.oea_scores
for all
to authenticated
using (public.oea_is_active_user())
with check (
	public.oea_is_active_user()
	and public.oea_is_active_user(user_id)
);
