import {readFile} from 'node:fs/promises';
const migration=await readFile(new URL('../supabase/migrations/20261109010000_recovery.sql',import.meta.url),'utf8');
const marker='CREATE OR REPLACE FUNCTION public.handle_new_user()';
if(!migration.includes(marker))throw new Error('Recovery migration layout changed; review the compatibility phase');
const prefix=migration.slice(0,migration.indexOf(marker));
process.stdout.write('-- Compatibility phase before releasing the new web client. Backup first.\n'+prefix+`
ALTER TABLE public.dm_pairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dm_pairs FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION public.create_channel(text,text,text,boolean),public.join_channel(uuid),public.get_or_create_dm(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_channel(text,text,text,boolean),public.join_channel(uuid),public.get_or_create_dm(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
`);
