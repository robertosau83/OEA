-- Svuota il campo notes di tutte le partite.
-- Eseguire nello SQL Editor di Supabase solo dopo backup/verifica.

begin;

update public.oea_games
set notes = null
where notes is not null;

select count(*) as games_with_notes_remaining
from public.oea_games
where notes is not null;

commit;
