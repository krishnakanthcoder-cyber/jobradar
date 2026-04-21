import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export interface Job {
  id: string;
  title: string | null;
  company: string | null;
  keyword: string | null;
  url: string | null;
  found_at: string;
  expired: number;
  notified: number;
}

async function ensureInit(): Promise<void> {
  // Supabase manages the connection — no pool init needed.
  // Table must exist in Supabase dashboard (run the SQL below once):
  //
  // CREATE TABLE IF NOT EXISTS jobs (
  //   id       TEXT PRIMARY KEY,
  //   title    TEXT,
  //   company  TEXT,
  //   keyword  TEXT,
  //   url      TEXT,
  //   found_at TEXT,
  //   expired  INTEGER NOT NULL DEFAULT 0,
  //   notified INTEGER NOT NULL DEFAULT 0
  // );
  // CREATE TABLE IF NOT EXISTS subscribers (
  //   email TEXT PRIMARY KEY
  // );
  await seedSubscribers();
}

let seeded = false;
async function seedSubscribers(): Promise<void> {
  if (seeded) return;
  seeded = true;

  const emails = [
    process.env.ALERT_EMAIL,
    process.env.FRIEND_EMAIL,
  ].filter(Boolean) as string[];

  for (const email of emails) {
    await supabase
      .from('subscribers')
      .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  }
}

// All active (non-expired) job IDs — used for diff comparison
export async function getKnownIds(): Promise<Set<string>> {
  await ensureInit();
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .eq('expired', 0);

  if (error) throw new Error(`getKnownIds: ${error.message}`);
  return new Set((data ?? []).map((r: { id: string }) => r.id));
}

// Insert only jobs that don't already exist
export async function insertNewJobs(
  jobs: Omit<Job, 'expired' | 'notified'>[]
): Promise<void> {
  await ensureInit();
  if (jobs.length === 0) return;

  const rows = jobs.map((j) => ({ ...j, expired: 0, notified: 0 }));
  const { error } = await supabase
    .from('jobs')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

  if (error) throw new Error(`insertNewJobs: ${error.message}`);
}

// Mark jobs that disappeared from portals as expired
export async function markExpired(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureInit();
  const { error } = await supabase
    .from('jobs')
    .update({ expired: 1 })
    .in('id', ids);

  if (error) throw new Error(`markExpired: ${error.message}`);
}

export async function markNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureInit();
  const { error } = await supabase
    .from('jobs')
    .update({ notified: 1 })
    .in('id', ids);

  if (error) throw new Error(`markNotified: ${error.message}`);
}

// Jobs found today (default view)
export async function getTodaysJobs(
  filters: { company?: string; keyword?: string } = {}
): Promise<Job[]> {
  await ensureInit();
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

  let query = supabase
    .from('jobs')
    .select('*')
    .eq('expired', 0)
    .gte('found_at', today)
    .order('found_at', { ascending: false });

  if (filters.company) query = query.eq('company', filters.company);
  if (filters.keyword) query = query.eq('keyword', filters.keyword);

  const { data, error } = await query;
  if (error) throw new Error(`getTodaysJobs: ${error.message}`);
  return (data ?? []) as Job[];
}

// All active jobs — used for ?all=true debug param
export async function getAllActiveJobs(
  filters: { company?: string; keyword?: string } = {}
): Promise<Job[]> {
  await ensureInit();

  let query = supabase
    .from('jobs')
    .select('*')
    .eq('expired', 0)
    .order('found_at', { ascending: false })
    .limit(200);

  if (filters.company) query = query.eq('company', filters.company);
  if (filters.keyword) query = query.eq('keyword', filters.keyword);

  const { data, error } = await query;
  if (error) throw new Error(`getAllActiveJobs: ${error.message}`);
  return (data ?? []) as Job[];
}

// Deletes jobs older than 7 days — run once per day
export async function cleanupOldJobs(): Promise<number> {
  await ensureInit();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase
    .from('jobs')
    .delete({ count: 'exact' })
    .lt('found_at', cutoff);

  if (error) throw new Error(`cleanupOldJobs: ${error.message}`);
  return count ?? 0;
}

export async function getSubscribers(): Promise<string[]> {
  await ensureInit();
  const { data, error } = await supabase.from('subscribers').select('email');
  if (error) throw new Error(`getSubscribers: ${error.message}`);
  return (data ?? []).map((r: { email: string }) => r.email);
}
