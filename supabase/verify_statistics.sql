-- Sola lettura: dataset e risultati SQL indipendenti per verificare il frontend.
with selected_users as (
  select id from public.oea_users where status = 'ACTIVE'
), compared_games as (
  select g.* from public.oea_games g
  where exists (select 1 from selected_users)
    and not exists (
      select 1 from selected_users u where not exists (
        select 1 from public.oea_game_players p where p.game_id = g.id and p.user_id = u.id
      )
    )
), totals as (
  select g.id as game_id, g.played_at, p.user_id,
    coalesce(sum(s.score) filter (where v.counts_in_total), 0) as total,
    count(s.score) filter (where v.counts_in_total) as filled_count,
    count(*) filter (where v.counts_in_total and s.score is null) as empty_count
  from compared_games g
  join public.oea_game_players p on p.game_id = g.id
  join selected_users u on u.id = p.user_id
  left join public.oea_scores s on s.game_id = g.id and s.user_id = p.user_id
  left join public.oea_voices v on v.id = s.voice_id
  group by g.id, g.played_at, p.user_id
)
select jsonb_build_object(
  'games', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'played_at',played_at)), '[]') from public.oea_games),
  'gamePlayers', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'game_id',game_id,'user_id',user_id)), '[]') from public.oea_game_players),
  'scores', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'game_id',game_id,'user_id',user_id,'voice_id',voice_id,'score',score)), '[]') from public.oea_scores),
  'voices', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'is_active',is_active,'counts_in_total',counts_in_total)), '[]') from public.oea_voices),
  'users', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status)), '[]') from public.oea_users),
  'expected', jsonb_build_object(
    'comparedGameIds', (select coalesce(jsonb_agg(id order by id), '[]') from compared_games),
    'totals', (select coalesce(jsonb_agg(to_jsonb(t) order by game_id, user_id), '[]') from totals t)
  )
) as snapshot;
