\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.ok(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.denied(statement text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: %',label; RETURN; END;
  RAISE EXCEPTION 'FAIL: % was allowed',label;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data,is_anonymous) VALUES
('00000000-0000-4000-8000-000000000001','a@example.test','{"username":"alice"}',false),
('00000000-0000-4000-8000-000000000002','b@example.test','{"username":"bob"}',false),
('00000000-0000-4000-8000-000000000003','c@example.test','{"username":"outsider"}',false),
('00000000-0000-4000-8000-000000000004','m@example.test','{"username":"mfa_user"}',false),
('00000000-0000-4000-8000-000000000005',null,'{}',true);
SELECT pg_temp.ok((SELECT count(*)=5 FROM public.profiles),'signup creates profiles transactionally');
SELECT pg_temp.ok((SELECT username='alice' FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000001'),'signup preserves username');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","is_anonymous":false}',true);
SELECT id AS channel FROM public.create_channel('qa-private',null,'open',true) \gset
SELECT id AS broadcast FROM public.create_channel('qa-news',null,'owner_only',false) \gset
SELECT public.get_or_create_dm('00000000-0000-4000-8000-000000000002') AS conversation \gset
SELECT pg_temp.ok(public.get_or_create_dm('00000000-0000-4000-8000-000000000002')=:'conversation'::uuid,'DM creation is idempotent');
SELECT pg_temp.ok((SELECT count(*)=2 FROM public.conversation_members WHERE conversation_id=:'conversation'),'members can see both DM participants');
SELECT pg_temp.denied('INSERT INTO public.conversation_members VALUES('''||:'conversation'||''',''00000000-0000-4000-8000-000000000003'')','client cannot add arbitrary conversation members');
SELECT pg_temp.denied('INSERT INTO public.channels(name) VALUES(''forged'')','direct channel creation denied');
INSERT INTO public.messages(id,channel_id,sender_id,content) VALUES('10000000-0000-4000-8000-000000000001',:'channel','00000000-0000-4000-8000-000000000001','hello');
INSERT INTO public.direct_messages(id,conversation_id,sender_id,content) VALUES('20000000-0000-4000-8000-000000000001',:'conversation','00000000-0000-4000-8000-000000000001','private hello');
SELECT pg_temp.denied('INSERT INTO public.direct_messages(conversation_id,sender_id,content) VALUES('''||:'conversation'||''',''00000000-0000-4000-8000-000000000002'',''forged'')','sender spoofing denied');
SELECT pg_temp.denied('UPDATE public.direct_messages SET created_at=now() WHERE sender_id=auth.uid()','message timestamps cannot be rewritten');
SELECT pg_temp.denied('UPDATE public.profiles SET badges=ARRAY[''owner''] WHERE id=auth.uid()','badges are server managed');
SELECT pg_temp.denied('SELECT email FROM public.profiles','private email is not exposed');
UPDATE public.profiles SET bio='updated' WHERE id=auth.uid();
SELECT pg_temp.ok((SELECT bio='updated' FROM public.profiles WHERE id=auth.uid()),'own public profile is editable');
SELECT pg_temp.denied('UPDATE public.messages SET channel_id='''||:'broadcast'||''' WHERE id=''10000000-0000-4000-8000-000000000001''','message parent cannot change');
INSERT INTO public.pins(message_id,channel_id,pinned_by) VALUES('10000000-0000-4000-8000-000000000001',:'channel',auth.uid());
SELECT pg_temp.denied('INSERT INTO public.pins(message_id,channel_id,pinned_by) VALUES(''10000000-0000-4000-8000-000000000001'','''||:'broadcast'||''',auth.uid())','cross-channel pin denied');
INSERT INTO public.reactions(message_id,user_id,emoji) VALUES('20000000-0000-4000-8000-000000000001',auth.uid(),'ok');
SELECT pg_temp.denied('INSERT INTO public.reactions(message_id,user_id,emoji) VALUES(gen_random_uuid(),auth.uid(),''ok'')','reaction to missing message denied');
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('attachments',:'channel'||'/'||auth.uid()||'/file.txt',auth.uid()::text);
RESET ROLE;
INSERT INTO public.channel_members(channel_id,user_id) VALUES
(:'channel','00000000-0000-4000-8000-000000000002'),(:'broadcast','00000000-0000-4000-8000-000000000002'),(:'channel','00000000-0000-4000-8000-000000000004');
INSERT INTO storage.objects(bucket_id,name) VALUES('attachments',:'channel'||'/legacy-file.png');
INSERT INTO realtime.messages VALUES('test','presence','{}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT pg_temp.ok((SELECT count(*)=1 FROM public.direct_messages),'recipient can read own DM');
SELECT pg_temp.ok((SELECT count(*)=3 FROM public.channel_members WHERE channel_id=:'channel'),'channel members see their member list without recursion');
SELECT pg_temp.ok((SELECT count(*)=2 FROM storage.objects WHERE bucket_id='attachments'),'members can read new and legacy attachments');
SELECT pg_temp.denied('INSERT INTO storage.objects(bucket_id,name) VALUES(''attachments'','''||:'channel'||'/00000000-0000-4000-8000-000000000001/forged.txt'')','cannot upload into another user folder');
SELECT pg_temp.denied('INSERT INTO public.messages(channel_id,sender_id,content) VALUES('''||:'broadcast'||''',auth.uid(),''not owner'')','broadcast channel is owner-only');
UPDATE public.direct_messages SET content='hacked' WHERE id='20000000-0000-4000-8000-000000000001';
SELECT pg_temp.ok((SELECT content='private hello' FROM public.direct_messages WHERE id='20000000-0000-4000-8000-000000000001'),'recipient cannot edit another sender message');
SELECT set_config('realtime.topic','dm:'||:'conversation'||':typing',true);
SELECT pg_temp.ok((SELECT count(*)=1 FROM realtime.messages),'member can join private DM presence');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.direct_messages),'outsider cannot read DMs');
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.conversation_members),'outsider cannot read DM membership');
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.messages),'outsider cannot read channel messages');
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.pins),'outsider cannot read pins');
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.reactions),'outsider cannot read reactions');
SELECT pg_temp.ok((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='attachments'),'outsider cannot read attachment metadata');
SELECT pg_temp.ok((SELECT count(*)=0 FROM realtime.messages),'outsider cannot join private DM presence');
SELECT pg_temp.denied('SELECT public.join_channel('''||:'channel'||''')','cannot self-join a private channel');
SELECT public.join_channel(:'broadcast');
SELECT pg_temp.ok((SELECT count(*)=1 FROM public.channel_members WHERE channel_id=:'broadcast' AND user_id=auth.uid()),'public channel directory supports joining');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1","is_anonymous":true}',true);
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.profiles),'anonymous Auth is isolated from profiles');
SELECT pg_temp.denied('SELECT public.create_channel(''anonymous'')','anonymous Auth cannot create channels');
RESET ROLE;
INSERT INTO auth.mfa_factors VALUES('00000000-0000-4000-8000-000000000004','verified');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.messages),'MFA AAL1 cannot bypass verification');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
SELECT pg_temp.ok((SELECT count(*)=1 FROM public.messages),'verified MFA AAL2 can read own channel');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT pg_temp.denied('SELECT * FROM public.direct_messages','unauthenticated cannot read DM table');
SELECT pg_temp.denied('TRUNCATE public.direct_messages','client roles cannot truncate');
SELECT pg_temp.denied('SELECT public.get_or_create_dm(gen_random_uuid())','unauthenticated cannot execute DM RPC');
RESET ROLE;
SELECT pg_temp.ok((SELECT NOT public FROM storage.buckets WHERE id='attachments'),'attachments bucket is private');
SELECT pg_temp.ok((SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),'RLS is enabled on all application tables');
ROLLBACK;
