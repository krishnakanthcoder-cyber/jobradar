import { Pool } from 'pg';

const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRailway ? { rejectUnauthorized: false } : false,
});

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

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id       TEXT PRIMARY KEY,
      title    TEXT,
      company  TEXT,
      keyword  TEXT,
      url      TEXT,
      found_at TEXT,
      expired  INTEGER NOT NULL DEFAULT 0,
      notified INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY
    );
  `);
  // Migrate: add expired column if it doesn't exist yet
  await pool.query(`
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expired INTEGER NOT NULL DEFAULT 0;
  `);

  await seedSubscribers();
  initialized = true;
}

async function seedSubscribers(): Promise<void> {
  const emails = [
    process.env.ALERT_EMAIL,
    process.env.FRIEND_EMAIL,
  ].filter(Boolean) as string[];

  for (const email of emails) {
    await pool.query(
      'INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT DO NOTHING',
      [email]
    );
  }
}

// All active (non-expired) job IDs — used for diff comparison
export async function getKnownIds(): Promise<Set<string>> {
  await ensureInit();
  const result = await pool.query('SELECT id FROM jobs WHERE expired = 0');
  return new Set(result.rows.map((r: { id: string }) => r.id));
}

// Insert only jobs that don't already exist
export async function insertNewJobs(
  jobs: Omit<Job, 'expired' | 'notified'>[]
): Promise<void> {
  await ensureInit();
  for (const job of jobs) {
    await pool.query(
      `INSERT INTO jobs (id, title, company, keyword, url, found_at, expired, notified)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 0)
       ON CONFLICT (id) DO NOTHING`,
      [job.id, job.title, job.company, job.keyword, job.url, job.found_at]
    );
  }
}

// Mark jobs that disappeared from portals as expired
export async function markExpired(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureInit();
  await pool.query('UPDATE jobs SET expired = 1 WHERE id = ANY($1)', [ids]);
}

export async function markNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureInit();
  await pool.query('UPDATE jobs SET notified = 1 WHERE id = ANY($1)', [ids]);
}

// Jobs found today (default view)
export async function getTodaysJobs(
  filters: { company?: string; keyword?: string } = {}
): Promise<Job[]> {
  await ensureInit();
  const conditions = [
    'expired = 0',
    "found_at::timestamptz >= CURRENT_DATE::timestamptz",
  ];
  const params: unknown[] = [];
  let i = 1;

  if (filters.company) {
    conditions.push(`company = $${i++}`);
    params.push(filters.company);
  }
  if (filters.keyword) {
    conditions.push(`keyword = $${i++}`);
    params.push(filters.keyword);
  }

  const result = await pool.query(
    `SELECT * FROM jobs WHERE ${conditions.join(' AND ')} ORDER BY found_at DESC`,
    params
  );
  return result.rows as Job[];
}

// All active jobs — used for ?all=true debug param
export async function getAllActiveJobs(
  filters: { company?: string; keyword?: string } = {}
): Promise<Job[]> {
  await ensureInit();
  const conditions = ['expired = 0'];
  const params: unknown[] = [];
  let i = 1;

  if (filters.company) {
    conditions.push(`company = $${i++}`);
    params.push(filters.company);
  }
  if (filters.keyword) {
    conditions.push(`keyword = $${i++}`);
    params.push(filters.keyword);
  }

  params.push(200);
  const result = await pool.query(
    `SELECT * FROM jobs WHERE ${conditions.join(' AND ')} ORDER BY found_at DESC LIMIT $${i}`,
    params
  );
  return result.rows as Job[];
}

// Deletes jobs older than 7 days — run once per day
export async function cleanupOldJobs(): Promise<number> {
  await ensureInit();
  const result = await pool.query(
    "DELETE FROM jobs WHERE found_at::timestamptz < NOW() - INTERVAL '7 days'"
  );
  return result.rowCount ?? 0;
}

export async function getSubscribers(): Promise<string[]> {
  await ensureInit();
  const result = await pool.query('SELECT email FROM subscribers');
  return result.rows.map((r: { email: string }) => r.email);
}
