-- Compatibility phase before releasing the new web client. Backup first.
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


ALTER TABLE public.dm_pairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dm_pairs FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION public.create_channel(text,text,text,boolean),public.join_channel(uuid),public.get_or_create_dm(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_channel(text,text,text,boolean),public.join_channel(uuid),public.get_or_create_dm(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
