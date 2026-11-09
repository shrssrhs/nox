-- Additive recovery. No message, user, channel or storage object is deleted.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.session_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND NOT coalesce(u.is_anonymous,false))
    AND (auth.jwt()->>'aal' = 'aal2' OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=auth.uid() AND f.status::text='verified'))
$$;
CREATE OR REPLACE FUNCTION private.channel_member(channel uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.session_allowed() AND EXISTS (
    SELECT 1 FROM public.channel_members m WHERE m.channel_id=channel AND m.user_id=auth.uid())
$$;
CREATE OR REPLACE FUNCTION private.channel_owner(channel uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.session_allowed() AND EXISTS (
    SELECT 1 FROM public.channels c WHERE c.id=channel AND c.created_by=auth.uid())
$$;
CREATE OR REPLACE FUNCTION private.channel_writable(channel uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.channel_member(channel) AND EXISTS (
    SELECT 1 FROM public.channels c WHERE c.id=channel AND (c.mode='open' OR c.created_by=auth.uid()))
$$;
CREATE OR REPLACE FUNCTION private.dm_member(conversation uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.session_allowed() AND EXISTS (
    SELECT 1 FROM public.conversation_members m WHERE m.conversation_id=conversation AND m.user_id=auth.uid())
$$;
CREATE OR REPLACE FUNCTION private.message_readable(message uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.session_allowed() AND (
    EXISTS (SELECT 1 FROM public.messages m WHERE m.id=message AND private.channel_member(m.channel_id)) OR
    EXISTS (SELECT 1 FROM public.direct_messages m WHERE m.id=message AND private.dm_member(m.conversation_id)))
$$;
CREATE OR REPLACE FUNCTION private.safe_uuid(value text) RETURNS uuid
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN value::uuid END
$$;

ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
UPDATE public.channels SET is_private=true WHERE is_demo;
CREATE TABLE IF NOT EXISTS public.dm_pairs (
  conversation_id uuid PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_low uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE(user_low,user_high), CHECK(user_low<user_high)
);
-- Keep all historical conversations, including any duplicates. Future creation
-- uses one canonical pair. Do not merge or discard history during recovery.
INSERT INTO public.dm_pairs(conversation_id,user_low,user_high)
SELECT DISTINCT ON (members[1],members[2]) id,members[1],members[2]
FROM (SELECT c.id,c.created_at,array_agg(m.user_id ORDER BY m.user_id) members
      FROM public.conversations c JOIN public.conversation_members m ON m.conversation_id=c.id
      GROUP BY c.id,c.created_at HAVING count(*)=2) pairs
WHERE members[1]<>members[2]
ORDER BY members[1],members[2],created_at NULLS LAST,id
ON CONFLICT DO NOTHING;

-- Preflight checked existing history. A null parent/date must abort, never erase data.
ALTER TABLE public.messages ALTER COLUMN channel_id SET NOT NULL, ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.direct_messages ALTER COLUMN conversation_id SET NOT NULL, ALTER COLUMN created_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS messages_history_idx ON public.messages(channel_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS direct_messages_history_idx ON public.direct_messages(conversation_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS channel_members_user_idx ON public.channel_members(user_id,channel_id);
CREATE INDEX IF NOT EXISTS conversation_members_user_idx ON public.conversation_members(user_id,conversation_id);

CREATE OR REPLACE FUNCTION public.create_channel(p_name text,p_description text DEFAULT NULL,p_mode text DEFAULT 'open',p_private boolean DEFAULT false)
RETURNS public.channels LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.channels;
BEGIN
  IF NOT private.session_allowed() THEN RAISE EXCEPTION 'Sign in and complete verification' USING ERRCODE='42501'; END IF;
  IF length(btrim(p_name)) NOT BETWEEN 1 AND 64 OR p_mode NOT IN ('open','owner_only') OR length(coalesce(p_description,''))>1000
  THEN RAISE EXCEPTION 'Invalid channel details' USING ERRCODE='22023'; END IF;
  INSERT INTO public.channels(name,description,mode,created_by,is_private)
  VALUES(lower(regexp_replace(btrim(p_name),'\s+','-','g')),nullif(btrim(p_description),''),p_mode,auth.uid(),coalesce(p_private,false)) RETURNING * INTO result;
  INSERT INTO public.channel_members(channel_id,user_id,role) VALUES(result.id,auth.uid(),'owner');
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.join_channel(p_channel uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.session_allowed() OR NOT EXISTS (SELECT 1 FROM public.channels c WHERE c.id=p_channel AND (NOT c.is_private OR c.created_by=auth.uid()))
  THEN RAISE EXCEPTION 'Channel is not available' USING ERRCODE='42501'; END IF;
  INSERT INTO public.channel_members(channel_id,user_id) VALUES(p_channel,auth.uid()) ON CONFLICT DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION public.get_or_create_dm(p_other uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := auth.uid(); lo uuid; hi uuid; conversation uuid;
BEGIN
  IF NOT private.session_allowed() OR p_other IS NULL OR p_other=me
    OR NOT EXISTS (SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id WHERE u.id=p_other AND NOT coalesce(u.is_anonymous,false))
  THEN RAISE EXCEPTION 'Conversation is not available' USING ERRCODE='42501'; END IF;
  lo:=least(me,p_other); hi:=greatest(me,p_other);
  PERFORM pg_advisory_xact_lock(hashtextextended(lo::text||':'||hi::text,0));
  SELECT d.conversation_id INTO conversation FROM public.dm_pairs d WHERE d.user_low=lo AND d.user_high=hi;
  IF conversation IS NOT NULL THEN RETURN conversation; END IF;
  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO conversation;
  INSERT INTO public.conversation_members(conversation_id,user_id) VALUES(conversation,me),(conversation,p_other);
  INSERT INTO public.dm_pairs VALUES(conversation,lo,hi);
  RETURN conversation;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE handle text := lower(new.raw_user_meta_data->>'username');
BEGIN
  IF handle IS NOT NULL AND handle !~ '^[a-z0-9_]{3,20}$' THEN handle:=NULL; END IF;
  INSERT INTO public.profiles(id,display_name,avatar_url,email,username)
  VALUES(new.id,nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','')),''),
    coalesce(new.raw_user_meta_data->>'avatar_url',new.raw_user_meta_data->>'picture'),new.email,handle)
  ON CONFLICT(id) DO NOTHING;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created_demo ON auth.users;
REVOKE ALL ON FUNCTION public.add_user_to_demo() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_my_channel_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.channel_id FROM public.channel_members m WHERE m.user_id=auth.uid() AND private.session_allowed()
$$;
REVOKE ALL ON FUNCTION public.get_my_channel_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_channel_ids() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_profile_login() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid()=old.id AND new.username IS DISTINCT FROM old.username
    AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=old.id AND u.email LIKE '%@users.onirnox.lol')
  THEN RAISE EXCEPTION 'Login username cannot be changed here' USING ERRCODE='42501'; END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS nox_profile_login_guard ON public.profiles;
CREATE TRIGGER nox_profile_login_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.guard_profile_login();

-- Replace only this application's policies. PostgreSQL policy names do not
-- confer a role: the old policies named "service role" granted PUBLIC inserts.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN
    ('profiles','channels','channel_members','conversations','conversation_members','direct_messages','messages','pins','reactions','rooms','dm_pairs')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
END $$;
REVOKE ALL ON public.profiles,public.channels,public.channel_members,public.conversations,public.conversation_members,
  public.direct_messages,public.messages,public.pins,public.reactions,public.rooms,public.dm_pairs FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,display_name,avatar_url,created_at,status,bio,banner_url,username,badges) ON public.profiles TO authenticated;
GRANT UPDATE(display_name,avatar_url,status,bio,banner_url,username) ON public.profiles TO authenticated;
GRANT SELECT ON public.channels,public.channel_members,public.conversations,public.conversation_members,public.dm_pairs,public.rooms TO authenticated;
GRANT UPDATE(name,description,mode,is_private) ON public.channels TO authenticated;
GRANT DELETE ON public.channels,public.channel_members TO authenticated;
GRANT SELECT,DELETE ON public.messages,public.direct_messages TO authenticated;
GRANT INSERT(id,channel_id,sender_id,content) ON public.messages TO authenticated;
GRANT INSERT(id,conversation_id,sender_id,content) ON public.direct_messages TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.pins,public.reactions TO authenticated;
GRANT UPDATE(content) ON public.messages,public.direct_messages TO authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','channels','channel_members','conversations','conversation_members','direct_messages','messages','pins','reactions','rooms','dm_pairs']
  LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END LOOP;
END $$;
CREATE POLICY nox_profiles_read ON public.profiles FOR SELECT TO authenticated USING(private.session_allowed());
CREATE POLICY nox_profiles_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid() AND private.session_allowed()) WITH CHECK(id=auth.uid() AND private.session_allowed());
CREATE POLICY nox_channels_read ON public.channels FOR SELECT TO authenticated USING(private.session_allowed() AND (NOT is_private OR private.channel_member(id)));
CREATE POLICY nox_channels_update ON public.channels FOR UPDATE TO authenticated USING(private.channel_owner(id)) WITH CHECK(private.channel_owner(id));
CREATE POLICY nox_channels_delete ON public.channels FOR DELETE TO authenticated USING(private.channel_owner(id));
CREATE POLICY nox_channel_members_read ON public.channel_members FOR SELECT TO authenticated USING(private.channel_member(channel_id));
CREATE POLICY nox_channel_members_leave ON public.channel_members FOR DELETE TO authenticated USING(user_id=auth.uid() AND private.channel_member(channel_id) AND NOT private.channel_owner(channel_id));
CREATE POLICY nox_conversations_read ON public.conversations FOR SELECT TO authenticated USING(private.dm_member(id));
CREATE POLICY nox_conversation_members_read ON public.conversation_members FOR SELECT TO authenticated USING(private.dm_member(conversation_id));
CREATE POLICY nox_pairs_read ON public.dm_pairs FOR SELECT TO authenticated USING(private.dm_member(conversation_id));
CREATE POLICY nox_messages_read ON public.messages FOR SELECT TO authenticated USING(private.channel_member(channel_id));
CREATE POLICY nox_messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK(sender_id=auth.uid() AND private.channel_writable(channel_id) AND length(btrim(content)) BETWEEN 1 AND 16000);
CREATE POLICY nox_messages_update ON public.messages FOR UPDATE TO authenticated USING(sender_id=auth.uid() AND private.channel_writable(channel_id)) WITH CHECK(sender_id=auth.uid() AND private.channel_writable(channel_id) AND length(btrim(content)) BETWEEN 1 AND 16000);
CREATE POLICY nox_messages_delete ON public.messages FOR DELETE TO authenticated USING(private.channel_member(channel_id) AND (sender_id=auth.uid() OR private.channel_owner(channel_id)));
CREATE POLICY nox_dm_read ON public.direct_messages FOR SELECT TO authenticated USING(private.dm_member(conversation_id));
CREATE POLICY nox_dm_insert ON public.direct_messages FOR INSERT TO authenticated WITH CHECK(sender_id=auth.uid() AND private.dm_member(conversation_id) AND length(btrim(content)) BETWEEN 1 AND 16000);
CREATE POLICY nox_dm_update ON public.direct_messages FOR UPDATE TO authenticated USING(sender_id=auth.uid() AND private.dm_member(conversation_id)) WITH CHECK(sender_id=auth.uid() AND private.dm_member(conversation_id) AND length(btrim(content)) BETWEEN 1 AND 16000);
CREATE POLICY nox_dm_delete ON public.direct_messages FOR DELETE TO authenticated USING(sender_id=auth.uid() AND private.dm_member(conversation_id));
CREATE POLICY nox_pins_read ON public.pins FOR SELECT TO authenticated USING(private.channel_member(channel_id));
CREATE POLICY nox_pins_insert ON public.pins FOR INSERT TO authenticated WITH CHECK(pinned_by=auth.uid() AND private.channel_member(channel_id) AND EXISTS(SELECT 1 FROM public.messages m WHERE m.id=message_id AND m.channel_id=pins.channel_id));
CREATE POLICY nox_pins_delete ON public.pins FOR DELETE TO authenticated USING(private.channel_member(channel_id) AND (pinned_by=auth.uid() OR private.channel_owner(channel_id)));
CREATE POLICY nox_reactions_read ON public.reactions FOR SELECT TO authenticated USING(private.message_readable(message_id));
CREATE POLICY nox_reactions_insert ON public.reactions FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND private.message_readable(message_id) AND length(emoji) BETWEEN 1 AND 32);
CREATE POLICY nox_reactions_delete ON public.reactions FOR DELETE TO authenticated USING(user_id=auth.uid() AND private.message_readable(message_id));
CREATE POLICY nox_rooms_read ON public.rooms FOR SELECT TO authenticated USING(private.channel_member(channel_id));

-- Storage access is derived from the parent conversation, not from possession
-- of a permanent public URL. Legacy paths remain readable by their members.
CREATE OR REPLACE FUNCTION private.file_readable(path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN split_part(path,'/',1) LIKE 'dm-%'
    THEN private.dm_member(private.safe_uuid(substr(split_part(path,'/',1),4)))
    ELSE private.channel_member(private.safe_uuid(split_part(path,'/',1))) END
$$;
CREATE OR REPLACE FUNCTION private.avatar_owned(path text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT private.session_allowed() AND (
    split_part(path,'/',1)=auth.uid()::text OR
    (split_part(path,'/',1) IN ('avatars','banners') AND split_part(split_part(path,'/',2),'.',1)=auth.uid()::text))
$$;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT * FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND
    (policyname LIKE 'nox_%' OR policyname IN ('Allow upload and read for authed 1mt4rzk_0','Allow upload and read for authed 1mt4rzk_1','Allow upload and read for authed 1mt4rzk_2','avatars public read','avatars update own','avatars upload own','avatars: public read','avatars: users can update own','avatars: users can upload own'))
  LOOP EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname); END LOOP;
END $$;
CREATE POLICY nox_attachment_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='attachments' AND private.file_readable(name));
CREATE POLICY nox_attachment_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='attachments' AND private.file_readable(name) AND split_part(name,'/',2)=auth.uid()::text);
CREATE POLICY nox_attachment_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='attachments' AND private.file_readable(name) AND split_part(name,'/',2)=auth.uid()::text) WITH CHECK(bucket_id='attachments' AND private.file_readable(name) AND split_part(name,'/',2)=auth.uid()::text);
CREATE POLICY nox_attachment_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='attachments' AND private.file_readable(name) AND split_part(name,'/',2)=auth.uid()::text);
CREATE POLICY nox_avatar_read ON storage.objects FOR SELECT TO public USING(bucket_id='avatars');
CREATE POLICY nox_avatar_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='avatars' AND private.avatar_owned(name));
CREATE POLICY nox_avatar_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='avatars' AND private.avatar_owned(name)) WITH CHECK(bucket_id='avatars' AND private.avatar_owned(name));
UPDATE storage.buckets SET public=false,file_size_limit=26214400 WHERE id='attachments';
UPDATE storage.buckets SET file_size_limit=5242880,allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp','image/gif'] WHERE id='avatars';

CREATE OR REPLACE FUNCTION private.topic_allowed(topic text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE split_part(topic,':',1)
    WHEN 'channel' THEN private.channel_member(private.safe_uuid(split_part(topic,':',2)))
    WHEN 'dm' THEN private.dm_member(private.safe_uuid(split_part(topic,':',2)))
    WHEN 'user' THEN private.session_allowed() AND private.safe_uuid(split_part(topic,':',2))=auth.uid() ELSE false END
$$;
DROP POLICY IF EXISTS nox_presence_read ON realtime.messages;
DROP POLICY IF EXISTS nox_presence_write ON realtime.messages;
CREATE POLICY nox_presence_read ON realtime.messages FOR SELECT TO authenticated USING(private.topic_allowed(realtime.topic()));
CREATE POLICY nox_presence_write ON realtime.messages FOR INSERT TO authenticated WITH CHECK(private.topic_allowed(realtime.topic()));

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION public.create_channel(text,text,text,boolean),public.join_channel(uuid),public.get_or_create_dm(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_channel(text,text,text,boolean),public.join_channel(uuid),public.get_or_create_dm(uuid) TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pins')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.pins; END IF;
END $$;
ALTER TABLE public.pins REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversation_members')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
