import { createClient } from '@supabase/supabase-js';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required.');
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.');

  supabase = createClient(url, key);
  return supabase;
}

export interface Job {
  id: string;
  title: string | null;
  company: string | null;
  keyword: string | null;
  url: string | null;
  found_at: string;
  first_published: string | null;
  expired: number;
  notified: number;
}

type JobInput = Omit<Job, 'expired' | 'notified'>;
type JobFilters = { company?: string; keyword?: string };
type JobsTableName = 'today_jobs' | 'new_jobs';

const TODAY_JOBS_TABLE: JobsTableName = 'today_jobs';
const NEW_JOBS_TABLE: JobsTableName = 'new_jobs';
const JOB_TABLE_SETUP_HINT =
  'Run replace-jobs-with-today-and-new-tables.sql to create today_jobs/new_jobs and retire jobs.';

export const DEFAULT_SCAN_SOURCE = 'greenhouse-us-feed';
export const DEFAULT_SCAN_COMPANY = 'all';

let seeded = false;
let hasTodayJobsTable: boolean | null = null;
let hasNewJobsTable: boolean | null = null;
let hasScanStateTable: boolean | null = null;
let hasScanStateSnapshotColumn: boolean | null = null;
let warnedScanStateSnapshotFallback = false;

async function ensureInit(): Promise<void> {
  // Supabase manages the connection — no pool init needed.
  // Required tables:
  //
  // CREATE TABLE IF NOT EXISTS today_jobs (...job schema...);
  // CREATE TABLE IF NOT EXISTS new_jobs   (...job schema...);
  // CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY);
  // CREATE TABLE IF NOT EXISTS scan_state (
  //   source TEXT,
  //   company TEXT,
  //   last_successful_scan_started_at TEXT,
  //   last_successful_scan_job_ids_json TEXT,
  //   PRIMARY KEY (source, company)
  // );
  await seedSubscribers();
}

function normalizeJobRow(job: JobInput) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    keyword: job.keyword,
    url: job.url,
    found_at: job.found_at,
    first_published: job.first_published,
    expired: 0,
    notified: 0,
  };
}

async function supportsJobsTable(table: JobsTableName): Promise<boolean> {
  const current = table === TODAY_JOBS_TABLE ? hasTodayJobsTable : hasNewJobsTable;
  if (current !== null) return current;

  const { error } = await getSupabase().from(table).select('id').limit(1);
  const supported = !error;

  if (table === TODAY_JOBS_TABLE) {
    hasTodayJobsTable = supported;
  } else {
    hasNewJobsTable = supported;
  }

  if (!supported && error?.message.includes(table)) {
    console.warn(`[db] ${table} table missing; ${JOB_TABLE_SETUP_HINT}`);
    return false;
  }

  if (!supported && error) {
    throw new Error(`supportsJobsTable(${table}): ${error.message}`);
  }

  return true;
}

async function assertJobsTable(table: JobsTableName): Promise<void> {
  if (!(await supportsJobsTable(table))) {
    throw new Error(`[db] ${table} table is required. ${JOB_TABLE_SETUP_HINT}`);
  }
}

async function supportsScanStateTable(): Promise<boolean> {
  if (hasScanStateTable !== null) return hasScanStateTable;

  const { error } = await getSupabase()
    .from('scan_state')
    .select('source, company')
    .limit(1);

  if (!error) {
    hasScanStateTable = true;
    return true;
  }

  if (error.message.includes('scan_state')) {
    hasScanStateTable = false;
    console.warn('[db] scan_state table missing; run add-scan-state-table.sql to enable previous-scan snapshots');
    return false;
  }

  throw new Error(`supportsScanStateTable: ${error.message}`);
}

async function supportsScanStateSnapshotColumn(): Promise<boolean> {
  if (hasScanStateSnapshotColumn !== null) return hasScanStateSnapshotColumn;
  if (!(await supportsScanStateTable())) return false;

  const { error } = await getSupabase()
    .from('scan_state')
    .select('last_successful_scan_job_ids_json')
    .limit(1);

  if (!error) {
    hasScanStateSnapshotColumn = true;
    return true;
  }

  if (error.message.includes('last_successful_scan_job_ids_json')) {
    hasScanStateSnapshotColumn = false;
    console.warn('[db] scan_state snapshot column missing; rerun add-scan-state-table.sql to enable previous-scan diffing');
    return false;
  }

  throw new Error(`supportsScanStateSnapshotColumn: ${error.message}`);
}

async function getScanSnapshotColumnName(): Promise<
  'last_successful_scan_job_ids_json' | 'last_successful_scan_started_at' | null
> {
  if (!(await supportsScanStateTable())) return null;
  if (await supportsScanStateSnapshotColumn()) return 'last_successful_scan_job_ids_json';

  if (!warnedScanStateSnapshotFallback) {
    console.warn(
      '[db] scan_state snapshot column missing; temporarily using last_successful_scan_started_at to persist previous-scan snapshots'
    );
    warnedScanStateSnapshotFallback = true;
  }

  return 'last_successful_scan_started_at';
}

async function seedSubscribers(): Promise<void> {
  if (seeded) return;
  seeded = true;

  const emails = [process.env.ALERT_EMAIL, process.env.FRIEND_EMAIL].filter(
    Boolean
  ) as string[];

  for (const email of emails) {
    await getSupabase()
      .from('subscribers')
      .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  }
}

async function getTableIds(table: JobsTableName): Promise<Set<string>> {
  await ensureInit();
  await assertJobsTable(table);

  const { data, error } = await getSupabase().from(table).select('id');
  if (error) throw new Error(`getTableIds(${table}): ${error.message}`);
  return new Set((data ?? []).map((row: { id: string }) => row.id));
}

async function deleteRowsByIds(table: JobsTableName, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getSupabase().from(table).delete().in('id', ids);
  if (error) throw new Error(`deleteRowsByIds(${table}): ${error.message}`);
}

async function deleteAllRows(table: JobsTableName): Promise<void> {
  await ensureInit();
  await assertJobsTable(table);

  const { error } = await getSupabase().from(table).delete().not('id', 'is', null);
  if (error) throw new Error(`deleteAllRows(${table}): ${error.message}`);
}

async function replaceJobsInTable(
  table: JobsTableName,
  jobs: JobInput[]
): Promise<void> {
  await ensureInit();
  await assertJobsTable(table);

  if (jobs.length === 0) {
    await deleteAllRows(table);
    return;
  }

  const uniqueJobs = [...new Map(jobs.map((job) => [job.id, job])).values()];
  const rows = uniqueJobs.map(normalizeJobRow);

  const { error } = await getSupabase()
    .from(table)
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

  if (error) throw new Error(`replaceJobsInTable(${table}): ${error.message}`);

  const incomingIds = new Set(uniqueJobs.map((job) => job.id));
  const existingIds = await getTableIds(table);
  const staleIds = [...existingIds].filter((id) => !incomingIds.has(id));
  await deleteRowsByIds(table, staleIds);
}

async function appendJobsToTable(
  table: JobsTableName,
  jobs: JobInput[]
): Promise<void> {
  await ensureInit();
  await assertJobsTable(table);

  if (jobs.length === 0) return;

  const uniqueJobs = [...new Map(jobs.map((job) => [job.id, job])).values()];
  const rows = uniqueJobs.map(normalizeJobRow);

  const { error } = await getSupabase()
    .from(table)
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

  if (error) throw new Error(`appendJobsToTable(${table}): ${error.message}`);
}

async function getJobsFromTable(
  table: JobsTableName,
  filters: JobFilters = {}
): Promise<Job[]> {
  await ensureInit();
  await assertJobsTable(table);

  let query = getSupabase()
    .from(table)
    .select('*')
    .order('first_published', { ascending: false })
    .order('found_at', { ascending: false });

  if (filters.company) query = query.eq('company', filters.company);
  if (filters.keyword) query = query.eq('keyword', filters.keyword);

  const { data, error } = await query;
  if (error) throw new Error(`getJobsFromTable(${table}): ${error.message}`);
  return (data ?? []) as Job[];
}

async function cleanupTable(table: JobsTableName, cutoff: string): Promise<number> {
  await ensureInit();
  await assertJobsTable(table);

  const { error, count } = await getSupabase()
    .from(table)
    .delete({ count: 'exact' })
    .lt('found_at', cutoff);

  if (error) throw new Error(`cleanupTable(${table}): ${error.message}`);
  return count ?? 0;
}

export async function getCurrentTodayJobIds(): Promise<Set<string>> {
  return getTableIds(TODAY_JOBS_TABLE);
}

export async function replaceTodayJobs(jobs: JobInput[]): Promise<void> {
  await appendJobsToTable(TODAY_JOBS_TABLE, jobs);
}

export async function replaceLatestNewJobs(jobs: JobInput[]): Promise<void> {
  await replaceJobsInTable(NEW_JOBS_TABLE, jobs);
}

export async function getTodaysJobs(filters: JobFilters = {}): Promise<Job[]> {
  return getJobsFromTable(TODAY_JOBS_TABLE, filters);
}

export async function getNewJobs(filters: JobFilters = {}): Promise<Job[]> {
  return getJobsFromTable(NEW_JOBS_TABLE, filters);
}

export async function getPreviousSuccessfulScanIds(
  source: string = DEFAULT_SCAN_SOURCE,
  company: string = DEFAULT_SCAN_COMPANY
): Promise<Set<string>> {
  await ensureInit();
  const snapshotColumn = await getScanSnapshotColumnName();
  if (!snapshotColumn) return new Set<string>();

  const { data, error } = await getSupabase()
    .from('scan_state')
    .select(snapshotColumn)
    .eq('source', source)
    .eq('company', company)
    .maybeSingle();

  if (error) {
    if (error.message.includes('row-level security')) {
      console.warn('[db] scan_state read blocked by RLS; rerun add-scan-state-table.sql to add select/insert/update policies');
      return new Set<string>();
    }

    throw new Error(`getPreviousSuccessfulScanIds: ${error.message}`);
  }

  const rawSnapshot = (
    data as
      | {
          last_successful_scan_job_ids_json?: string | null;
          last_successful_scan_started_at?: string | null;
        }
      | null
  )?.[snapshotColumn];

  if (!rawSnapshot) return new Set<string>();

  try {
    const parsed = JSON.parse(rawSnapshot);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    console.warn('[db] scan_state snapshot payload was invalid JSON; ignoring previous-scan baseline');
    return new Set<string>();
  }
}

export async function setPreviousSuccessfulScanIds(
  ids: Iterable<string>,
  source: string = DEFAULT_SCAN_SOURCE,
  company: string = DEFAULT_SCAN_COMPANY
): Promise<void> {
  await ensureInit();
  const snapshotColumn = await getScanSnapshotColumnName();
  if (!snapshotColumn) return;

  const snapshot = JSON.stringify([...new Set(ids)].sort());

  const { error } = await getSupabase()
    .from('scan_state')
    .upsert(
      {
        source,
        company,
        last_successful_scan_started_at: new Date().toISOString(),
        [snapshotColumn]: snapshot,
      },
      { onConflict: 'source,company', ignoreDuplicates: false }
    );

  if (error) {
    if (error.message.includes('row-level security')) {
      console.warn('[db] scan_state write blocked by RLS; rerun add-scan-state-table.sql to add select/insert/update policies');
      return;
    }

    throw new Error(`setPreviousSuccessfulScanIds: ${error.message}`);
  }
}

// Deletes rows older than 1 day from both today_jobs and new_jobs.
export async function cleanupOldJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [todayRemoved, newRemoved] = await Promise.all([
    cleanupTable(TODAY_JOBS_TABLE, cutoff),
    cleanupTable(NEW_JOBS_TABLE, cutoff),
  ]);

  return todayRemoved + newRemoved;
}

export async function getSubscribers(): Promise<string[]> {
  await ensureInit();
  const { data, error } = await getSupabase().from('subscribers').select('email');
  if (error) throw new Error(`getSubscribers: ${error.message}`);
  return (data ?? []).map((row: { email: string }) => row.email);
}
