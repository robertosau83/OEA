-- Verifica read-only import OEA: data oea 2.xlsx
-- Eseguire nello SQL Editor di Supabase. Non modifica dati.

with imported_games as (
	select id, played_at, created_by, notes
	from public.oea_games
	where notes = 'Import Excel OEA: data oea 2.xlsx'
), imported_players as (
	select gp.*
	from public.oea_game_players gp
	join imported_games g on g.id = gp.game_id
), imported_scores as (
	select s.*
	from public.oea_scores s
	join imported_games g on g.id = s.game_id
)
select
	(select count(*) from imported_games) as games_found,
	(select count(*) from imported_players) as game_players_found,
	(select count(*) from imported_scores) as scores_found,
	(select count(distinct played_at) from imported_games) as distinct_dates,
	(select min(played_at) from imported_games) as min_played_at,
	(select max(played_at) from imported_games) as max_played_at,
	((select count(*) from imported_games) = 33) as games_ok,
	((select count(*) from imported_players) = 107) as game_players_ok,
	((select count(*) from imported_scores) = 1926) as scores_ok;

with imported_games as (
	select id, played_at
	from public.oea_games
	where notes = 'Import Excel OEA: data oea 2.xlsx'
)
select played_at, count(*) as games_same_date
from imported_games
group by played_at
having count(*) > 1
order by played_at;

with imported_games as (
	select id, played_at
	from public.oea_games
	where notes = 'Import Excel OEA: data oea 2.xlsx'
), per_game as (
	select
		g.id,
		g.played_at,
		count(distinct gp.user_id) as players_count,
		count(s.id) as scores_count,
		count(distinct s.voice_id) as voices_count,
		string_agg(u.name, ' > ' order by gp.player_order) as player_order
	from imported_games g
	left join public.oea_game_players gp on gp.game_id = g.id
	left join public.oea_users u on u.id = gp.user_id
	left join public.oea_scores s on s.game_id = gp.game_id and s.user_id = gp.user_id
	group by g.id, g.played_at
)
select
	played_at,
	players_count,
	scores_count,
	voices_count,
	player_order,
	(players_count * 18) as expected_scores,
	(scores_count = players_count * 18 and voices_count = 18) as game_ok
from per_game
where not (scores_count = players_count * 18 and voices_count = 18)
order by played_at;

with expected_voices(name) as (
	values
		('Uno'),
		('Due'),
		('Tre'),
		('Quattro'),
		('Cinque'),
		('Sei'),
		('Media'),
		('Tris'),
		('Poker'),
		('Full'),
		('Scala 4'),
		('Scala 5'),
		('Somma'),
		('Yatch'),
		('G.D.'),
		('Bevute'),
		('PNP'),
		('Bonus')
)
select
	ev.name as expected_voice_name,
	count(v.id) as matching_voices
from expected_voices ev
left join public.oea_voices v on lower(v.name) = lower(ev.name)
group by ev.name
having count(v.id) <> 1
order by ev.name;

with expected_users(name) as (
	values
		('Bobby'),
		('Bonde'),
		('Robby'),
		('Steppa')
)
select
	eu.name as expected_user_name,
	count(u.id) as matching_users
from expected_users eu
left join public.oea_users u on lower(u.name) = lower(eu.name)
group by eu.name
having count(u.id) <> 1
order by eu.name;

with imported_games as (
	select id, played_at
	from public.oea_games
	where notes = 'Import Excel OEA: data oea 2.xlsx'
), expected_voices(name) as (
	values
		('Uno'),
		('Due'),
		('Tre'),
		('Quattro'),
		('Cinque'),
		('Sei'),
		('Media'),
		('Tris'),
		('Poker'),
		('Full'),
		('Scala 4'),
		('Scala 5'),
		('Somma'),
		('Yatch'),
		('G.D.'),
		('Bevute'),
		('PNP'),
		('Bonus')
), player_voice_grid as (
	select
		g.id as game_id,
		g.played_at,
		gp.user_id,
		u.name as player_name,
		gp.player_order,
		v.id as voice_id,
		ev.name as voice_name
	from imported_games g
	join public.oea_game_players gp on gp.game_id = g.id
	join public.oea_users u on u.id = gp.user_id
	cross join expected_voices ev
	left join public.oea_voices v on lower(v.name) = lower(ev.name)
)
select
	grid.played_at,
	grid.player_order,
	grid.player_name,
	grid.voice_name,
	case
		when grid.voice_id is null then 'voice_missing'
		when s.id is null then 'score_missing'
		else 'ok'
	end as issue
from player_voice_grid grid
left join public.oea_scores s
	on s.game_id = grid.game_id
	and s.user_id = grid.user_id
	and s.voice_id = grid.voice_id
where grid.voice_id is null or s.id is null
order by grid.played_at, grid.player_order, grid.voice_name
limit 100;

select
	c.relname as table_name,
	c.relrowsecurity as rls_enabled,
	c.relforcerowsecurity as rls_forced,
	count(p.polname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
	and c.relname in ('oea_users', 'oea_games', 'oea_game_players', 'oea_voices', 'oea_scores')
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relname;
