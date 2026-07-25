-- Migrazione idempotente:
-- 1. tutte le partite sono implicitamente registrate;
-- 2. rimuove il campo tecnico oea_voices.code, non usato dalle relazioni.

begin;

update public.oea_games
set on_record = true
where on_record = false;

alter table public.oea_games
alter column on_record set default true;

alter table public.oea_voices
add column if not exists voice_type text not null default 'PRIMARY';

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'oea_voices_voice_type_check'
			and conrelid = 'public.oea_voices'::regclass
	) then
		alter table public.oea_voices
		add constraint oea_voices_voice_type_check
		check (voice_type in ('PRIMARY', 'SECONDARY'));
	end if;
end $$;

alter table public.oea_voices
drop column if exists code;

commit;

select
	(select count(*) from public.oea_games where on_record = false) as games_not_on_record,
	exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'oea_voices'
			and column_name = 'code'
	) as voice_code_still_exists;
