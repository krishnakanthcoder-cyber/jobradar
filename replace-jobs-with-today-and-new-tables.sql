CREATE TABLE IF NOT EXISTS public.today_jobs (
  id TEXT PRIMARY KEY,
  title TEXT,
  company TEXT,
  keyword TEXT,
  url TEXT,
  found_at TEXT,
  first_published TEXT,
  expired INTEGER NOT NULL DEFAULT 0,
  notified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.new_jobs (
  id TEXT PRIMARY KEY,
  title TEXT,
  company TEXT,
  keyword TEXT,
  url TEXT,
  found_at TEXT,
  first_published TEXT,
  expired INTEGER NOT NULL DEFAULT 0,
  notified INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.today_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.new_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "today_jobs_select_public" ON public.today_jobs;
CREATE POLICY "today_jobs_select_public"
ON public.today_jobs
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "today_jobs_insert_public" ON public.today_jobs;
CREATE POLICY "today_jobs_insert_public"
ON public.today_jobs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "today_jobs_update_public" ON public.today_jobs;
CREATE POLICY "today_jobs_update_public"
ON public.today_jobs
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "today_jobs_delete_public" ON public.today_jobs;
CREATE POLICY "today_jobs_delete_public"
ON public.today_jobs
FOR DELETE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "new_jobs_select_public" ON public.new_jobs;
CREATE POLICY "new_jobs_select_public"
ON public.new_jobs
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "new_jobs_insert_public" ON public.new_jobs;
CREATE POLICY "new_jobs_insert_public"
ON public.new_jobs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "new_jobs_update_public" ON public.new_jobs;
CREATE POLICY "new_jobs_update_public"
ON public.new_jobs
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "new_jobs_delete_public" ON public.new_jobs;
CREATE POLICY "new_jobs_delete_public"
ON public.new_jobs
FOR DELETE
TO anon, authenticated
USING (true);

DROP TABLE IF EXISTS public.jobs;
