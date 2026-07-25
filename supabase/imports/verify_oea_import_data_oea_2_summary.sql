-- Verifica read-only import OEA: data oea 2.xlsx
-- Versione a singolo result set per SQL Editor Supabase.
-- Non modifica dati.

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
), bad_games as (
	select *
	from per_game
	where not (scores_count = players_count * 18 and voices_count = 18)
), duplicate_dates as (
	select played_at, count(*) as games_same_date
	from imported_games
	group by played_at
	having count(*) > 1
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
), voice_matches as (
	select
		ev.name,
		count(v.id) as matching_voices
	from expected_voices ev
	left join public.oea_voices v on lower(v.name) = lower(ev.name)
	group by ev.name
), bad_voices as (
	select *
	from voice_matches
	where matching_voices <> 1
), expected_users(name) as (
	values
		('Bobby'),
		('Bonde'),
		('Robby'),
		('Steppa')
), user_matches as (
	select
		eu.name,
		count(u.id) as matching_users
	from expected_users eu
	left join public.oea_users u on lower(u.name) = lower(eu.name)
	group by eu.name
), bad_users as (
	select *
	from user_matches
	where matching_users <> 1
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
), missing_scores as (
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
), rls_status as (
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
), bad_rls as (
	select *
	from rls_status
	where rls_enabled is not true or policy_count = 0
)
select
	'games_found' as check_name,
	case when count(*) = 33 then 'OK' else 'KO' end as status,
	count(*)::text as actual,
	'33' as expected,
	jsonb_build_object(
		'min_played_at', min(played_at),
		'max_played_at', max(played_at),
		'distinct_dates', count(distinct played_at)
	) as details
from imported_games

union all

select
	'game_players_found',
	case when count(*) = 107 then 'OK' else 'KO' end,
	count(*)::text,
	'107',
	'{}'::jsonb
from imported_players

union all

select
	'scores_found',
	case when count(*) = 1926 then 'OK' else 'KO' end,
	count(*)::text,
	'1926',
	'{}'::jsonb
from imported_scores

union all

select
	'duplicate_dates',
	case when count(*) = 0 then 'OK' else 'KO' end,
	count(*)::text,
	'0',
	coalesce(jsonb_agg(jsonb_build_object('played_at', played_at, 'games_same_date', games_same_date)), '[]'::jsonb)
from duplicate_dates

union all

select
	'bad_per_game_counts',
	case when count(*) = 0 then 'OK' else 'KO' end,
	count(*)::text,
	'0',
	coalesce(jsonb_agg(jsonb_build_object(
		'played_at', played_at,
		'players_count', players_count,
		'scores_count', scores_count,
		'voices_count', voices_count,
		'player_order', player_order
	)), '[]'::jsonb)
from bad_games

union all

select
	'voice_name_matches',
	case when count(*) = 0 then 'OK' else 'KO' end,
	count(*)::text,
	'0',
	coalesce(jsonb_agg(jsonb_build_object('name', name, 'matching_voices', matching_voices)), '[]'::jsonb)
from bad_voices

union all

select
	'user_name_matches',
	case when count(*) = 0 then 'OK' else 'KO' end,
	count(*)::text,
	'0',
	coalesce(jsonb_agg(jsonb_build_object('name', name, 'matching_users', matching_users)), '[]'::jsonb)
from bad_users

union all

select
	'missing_scores',
	case when count(*) = 0 then 'OK' else 'KO' end,
	count(*)::text,
	'0',
	coalesce(jsonb_agg(jsonb_build_object(
		'played_at', played_at,
		'player_order', player_order,
		'player_name', player_name,
		'voice_name', voice_name,
		'issue', issue
	)), '[]'::jsonb)
from missing_scores

union all

select
	'rls_and_policies',
	case when count(*) = 0 then 'OK' else 'KO' end,
	count(*)::text,
	'0',
	coalesce(jsonb_agg(jsonb_build_object(
		'table_name', table_name,
		'rls_enabled', rls_enabled,
		'policy_count', policy_count
	)), '[]'::jsonb)
from bad_rls;
