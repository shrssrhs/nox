-- Baseline captured from production 2026-11-09. Apply only to a fresh Supabase database.
-- Existing production already has this schema: record baseline; do not replay it there.


CREATE TABLE public."channel_members" (
  "channel_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text DEFAULT 'member'::text NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."channels" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "mode" text DEFAULT 'open'::text NOT NULL,
  "is_demo" boolean DEFAULT false NOT NULL
);

CREATE TABLE public."conversation_members" (
  "conversation_id" uuid NOT NULL,
  "user_id" uuid NOT NULL
);

CREATE TABLE public."conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."direct_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid,
  "sender_id" uuid,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid,
  "sender_id" uuid,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."pins" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid,
  "channel_id" uuid,
  "pinned_by" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "display_name" text,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "email" text,
  "status" text DEFAULT '🟢 Online'::text,
  "bio" text,
  "banner_url" text,
  "username" text,
  "badges" text[] DEFAULT '{}'::text[]
);

CREATE TABLE public."reactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."rooms" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid,
  "livekit_room_name" text NOT NULL,
  "active" boolean DEFAULT true,
  "started_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."channel_members" ADD CONSTRAINT "channel_members_pkey" PRIMARY KEY (channel_id, user_id);

ALTER TABLE public."channel_members" ADD CONSTRAINT "channel_members_user_channel_key" UNIQUE (channel_id, user_id);

ALTER TABLE public."channels" ADD CONSTRAINT "channels_mode_check" CHECK ((mode = ANY (ARRAY['open'::text, 'owner_only'::text])));

ALTER TABLE public."channels" ADD CONSTRAINT "channels_pkey" PRIMARY KEY (id);

ALTER TABLE public."conversation_members" ADD CONSTRAINT "conversation_members_pkey" PRIMARY KEY (conversation_id, user_id);

ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY (id);

ALTER TABLE public."direct_messages" ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."pins" ADD CONSTRAINT "pins_message_id_channel_id_key" UNIQUE (message_id, channel_id);

ALTER TABLE public."pins" ADD CONSTRAINT "pins_pkey" PRIMARY KEY (id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE (username);

ALTER TABLE public."reactions" ADD CONSTRAINT "reactions_message_id_user_id_emoji_key" UNIQUE (message_id, user_id, emoji);

ALTER TABLE public."reactions" ADD CONSTRAINT "reactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."rooms" ADD CONSTRAINT "rooms_livekit_room_name_key" UNIQUE (livekit_room_name);

ALTER TABLE public."rooms" ADD CONSTRAINT "rooms_pkey" PRIMARY KEY (id);

ALTER TABLE public."channel_members" ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

ALTER TABLE public."channel_members" ADD CONSTRAINT "channel_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."channels" ADD CONSTRAINT "channels_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public."conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE public."conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE public."direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public."messages" ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

ALTER TABLE public."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public."pins" ADD CONSTRAINT "pins_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

ALTER TABLE public."pins" ADD CONSTRAINT "pins_message_id_fkey" FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

ALTER TABLE public."pins" ADD CONSTRAINT "pins_pinned_by_fkey" FOREIGN KEY (pinned_by) REFERENCES profiles(id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public."rooms" ADD CONSTRAINT "rooms_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

ALTER TABLE public."direct_messages" REPLICA IDENTITY FULL;

ALTER TABLE public."messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."messages" REPLICA IDENTITY FULL;

ALTER TABLE public."pins" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."reactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."reactions" REPLICA IDENTITY FULL;

ALTER TABLE public."rooms" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_members: members can view" ON "public"."channel_members" AS PERMISSIVE FOR SELECT TO "public" USING ((channel_id IN ( SELECT channel_members_1.channel_id
   FROM channel_members channel_members_1
  WHERE (channel_members_1.user_id = auth.uid()))));

CREATE POLICY "channel_members: service role can insert" ON "public"."channel_members" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (true);

CREATE POLICY "channels: authenticated can create" ON "public"."channels" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE POLICY "channels: members can view" ON "public"."channels" AS PERMISSIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM channel_members
  WHERE ((channel_members.channel_id = channels.id) AND (channel_members.user_id = auth.uid())))));

CREATE POLICY "conversation_members: insert" ON "public"."conversation_members" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (true);

CREATE POLICY "conversation_members: view own" ON "public"."conversation_members" AS PERMISSIVE FOR SELECT TO "public" USING ((user_id = auth.uid()));

CREATE POLICY "conversations: insert" ON "public"."conversations" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (true);

CREATE POLICY "conversations: members can view" ON "public"."conversations" AS PERMISSIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM conversation_members
  WHERE ((conversation_members.conversation_id = conversations.id) AND (conversation_members.user_id = auth.uid())))));

CREATE POLICY "delete own dms" ON "public"."direct_messages" AS PERMISSIVE FOR DELETE TO "public" USING ((auth.uid() = sender_id));

CREATE POLICY "direct_messages: members can read" ON "public"."direct_messages" AS PERMISSIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM conversation_members
  WHERE ((conversation_members.conversation_id = direct_messages.conversation_id) AND (conversation_members.user_id = auth.uid())))));

CREATE POLICY "direct_messages: members can send" ON "public"."direct_messages" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM conversation_members
  WHERE ((conversation_members.conversation_id = direct_messages.conversation_id) AND (conversation_members.user_id = auth.uid()))))));

CREATE POLICY "update own dms" ON "public"."direct_messages" AS PERMISSIVE FOR UPDATE TO "public" USING ((auth.uid() = sender_id));

CREATE POLICY "delete own messages" ON "public"."messages" AS PERMISSIVE FOR DELETE TO "public" USING ((auth.uid() = sender_id));

CREATE POLICY "messages: members can insert" ON "public"."messages" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM channel_members
  WHERE ((channel_members.channel_id = messages.channel_id) AND (channel_members.user_id = auth.uid()))))));

CREATE POLICY "messages: members can select" ON "public"."messages" AS PERMISSIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM channel_members
  WHERE ((channel_members.channel_id = messages.channel_id) AND (channel_members.user_id = auth.uid())))));

CREATE POLICY "owner_only_channels_block_nonowners" ON "public"."messages" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK (((COALESCE(( SELECT c.mode
   FROM channels c
  WHERE (c.id = messages.channel_id)), 'open'::text) <> 'owner_only'::text) OR (( SELECT c.created_by
   FROM channels c
  WHERE (c.id = messages.channel_id)) = auth.uid())));

CREATE POLICY "update own messages" ON "public"."messages" AS PERMISSIVE FOR UPDATE TO "public" USING ((auth.uid() = sender_id));

CREATE POLICY "delete pins" ON "public"."pins" AS PERMISSIVE FOR DELETE TO "public" USING ((auth.uid() = pinned_by));

CREATE POLICY "insert pins" ON "public"."pins" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((auth.uid() = pinned_by));

CREATE POLICY "read pins" ON "public"."pins" AS PERMISSIVE FOR SELECT TO "public" USING (true);

CREATE POLICY "Profiles are viewable by authenticated users" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "profiles: anyone authenticated can view" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "public" USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "profiles: service role can insert" ON "public"."profiles" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (true);

CREATE POLICY "profiles: users update own" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "public" USING ((auth.uid() = id));

CREATE POLICY "add own reaction" ON "public"."reactions" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "read reactions" ON "public"."reactions" AS PERMISSIVE FOR SELECT TO "public" USING (true);

CREATE POLICY "remove own reaction" ON "public"."reactions" AS PERMISSIVE FOR DELETE TO "public" USING ((auth.uid() = user_id));

CREATE POLICY "rooms: members can insert" ON "public"."rooms" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((EXISTS ( SELECT 1
   FROM channel_members
  WHERE ((channel_members.channel_id = rooms.channel_id) AND (channel_members.user_id = auth.uid())))));

CREATE POLICY "rooms: members can view" ON "public"."rooms" AS PERMISSIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM channel_members
  WHERE ((channel_members.channel_id = rooms.channel_id) AND (channel_members.user_id = auth.uid())))));

CREATE POLICY "Allow upload and read for authed 1mt4rzk_0" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((bucket_id = 'attachments'::text));

CREATE POLICY "Allow upload and read for authed 1mt4rzk_1" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((bucket_id = 'attachments'::text));

CREATE POLICY "Allow upload and read for authed 1mt4rzk_2" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((bucket_id = 'attachments'::text));

CREATE POLICY "avatars public read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "public" USING ((bucket_id = 'avatars'::text));

CREATE POLICY "avatars update own" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "public" USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)));

CREATE POLICY "avatars upload own" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)));

CREATE POLICY "avatars: public read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "public" USING ((bucket_id = 'avatars'::text));

CREATE POLICY "avatars: users can update own" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "public" USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "avatars: users can upload own" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE OR REPLACE FUNCTION public.add_user_to_demo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.channel_members (channel_id, user_id)
  select c.id, new.id from public.channels c
  where c.is_demo
    and not exists (select 1 from public.channel_members m
                    where m.channel_id = c.id and m.user_id = new.id);
  return new;
end $function$;


CREATE OR REPLACE FUNCTION public.get_my_channel_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select channel_id from channel_members where user_id = auth.uid();
 $function$;


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'user_name',
      new.email,
      'Anonymous'
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    new.email
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url   = excluded.avatar_url,
    email        = excluded.email;

  -- НЕ добавляем автоматически в каналы
  -- Юзер сам вступает через Join кнопку

  return new;
exception when others then
  raise log 'handle_new_user error: %', sqlerrm;
  return new;
end;
 $function$;


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_auth_user_created_demo AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION add_user_to_demo();

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."channel_members" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."channel_members" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."channels" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."channels" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."conversation_members" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."conversation_members" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."conversations" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."conversations" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."direct_messages" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."direct_messages" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."messages" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."messages" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."pins" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."pins" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."profiles" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."profiles" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."reactions" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."reactions" TO "authenticated";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."rooms" TO "anon";

GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."rooms" TO "authenticated";

INSERT INTO storage.buckets(id,name,public) VALUES ('attachments','attachments',true) ON CONFLICT(id) DO NOTHING;

INSERT INTO storage.buckets(id,name,public) VALUES ('avatars','avatars',true) ON CONFLICT(id) DO NOTHING;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF; END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public."direct_messages";

ALTER PUBLICATION supabase_realtime ADD TABLE public."messages";

ALTER PUBLICATION supabase_realtime ADD TABLE public."reactions";

ALTER PUBLICATION supabase_realtime ADD TABLE public."rooms";
