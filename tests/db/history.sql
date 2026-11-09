\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('90000000-0000-4000-8000-000000000001','history-a@example.test','{}'),
('90000000-0000-4000-8000-000000000002','history-b@example.test','{}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT public.get_or_create_dm('90000000-0000-4000-8000-000000000002') AS conversation \gset
RESET ROLE;
INSERT INTO public.direct_messages(id,conversation_id,sender_id,content,created_at)
SELECT ('91000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,:'conversation','90000000-0000-4000-8000-000000000001','history '||n,
  '2026-11-09 10:00:00+00'::timestamptz + (n/5)*interval '1 second'
FROM generate_series(1,250) n;
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE pages(id uuid PRIMARY KEY,created_at timestamptz);
INSERT INTO pages SELECT id,created_at FROM public.direct_messages WHERE conversation_id=:'conversation' ORDER BY created_at DESC,id DESC LIMIT 100;
DO $$ BEGIN
  IF (SELECT count(*) FROM pages)<>100 OR (SELECT min(id::text) FROM pages)<>'91000000-0000-4000-8000-000000000151' THEN RAISE EXCEPTION 'Initial page did not select latest 100'; END IF;
END $$;
SELECT id AS cursor_id,created_at AS cursor_date FROM pages ORDER BY created_at,id LIMIT 1 \gset
INSERT INTO pages SELECT id,created_at FROM public.direct_messages WHERE conversation_id=:'conversation'
  AND (created_at<:'cursor_date' OR (created_at=:'cursor_date' AND id<:'cursor_id')) ORDER BY created_at DESC,id DESC LIMIT 100;
SELECT id AS cursor_id,created_at AS cursor_date FROM pages ORDER BY created_at,id LIMIT 1 \gset
INSERT INTO pages SELECT id,created_at FROM public.direct_messages WHERE conversation_id=:'conversation'
  AND (created_at<:'cursor_date' OR (created_at=:'cursor_date' AND id<:'cursor_id')) ORDER BY created_at DESC,id DESC LIMIT 100;
DO $$ BEGIN
  IF (SELECT count(*) FROM pages)<>250 THEN RAISE EXCEPTION 'Cursor pagination lost or duplicated messages'; END IF;
  RAISE NOTICE 'PASS: latest screen and cursor pagination cover 250 messages, including tied timestamps';
END $$;
ROLLBACK;
