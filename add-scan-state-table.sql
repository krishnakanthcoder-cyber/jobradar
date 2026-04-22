CREATE TABLE IF NOT EXISTS public.scan_state (
  source TEXT,
  company TEXT,
  last_successful_scan_started_at TEXT,
  last_successful_scan_job_ids_json TEXT
);

ALTER TABLE public.scan_state
ADD COLUMN IF NOT EXISTS company TEXT;

ALTER TABLE public.scan_state
ADD COLUMN IF NOT EXISTS last_successful_scan_job_ids_json TEXT;

UPDATE public.scan_state
SET company = 'Anthropic'
WHERE company IS NULL;

UPDATE public.scan_state
SET last_successful_scan_job_ids_json = '[]'
WHERE last_successful_scan_job_ids_json IS NULL;

ALTER TABLE public.scan_state
ALTER COLUMN source SET NOT NULL;

ALTER TABLE public.scan_state
ALTER COLUMN company SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scan_state_pkey'
      AND conrelid = 'public.scan_state'::regclass
  ) THEN
    ALTER TABLE public.scan_state DROP CONSTRAINT scan_state_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scan_state_pkey'
      AND conrelid = 'public.scan_state'::regclass
  ) THEN
    ALTER TABLE public.scan_state
    ADD CONSTRAINT scan_state_pkey PRIMARY KEY (source, company);
  END IF;
END $$;

ALTER TABLE public.scan_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan_state_select_public" ON public.scan_state;
CREATE POLICY "scan_state_select_public"
ON public.scan_state
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "scan_state_insert_public" ON public.scan_state;
CREATE POLICY "scan_state_insert_public"
ON public.scan_state
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "scan_state_update_public" ON public.scan_state;
CREATE POLICY "scan_state_update_public"
ON public.scan_state
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
