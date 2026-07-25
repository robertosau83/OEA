-- Migrazione idempotente: distingue le voci di punteggio primarie e secondarie.
-- Le voci esistenti restano PRIMARY finche' un utente non le riclassifica dalla app.

begin;

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

commit;

select
	voice_type,
	count(*) as voices_count
from public.oea_voices
group by voice_type
order by voice_type;
