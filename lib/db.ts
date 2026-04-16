import { Pool } from 'pg';

const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRailway ? { rejectUnauthorized: false } : false,
});

export interface Job {
  id: string;
  title: string;
  url: string;
  found_at: string;
  notified: number;
  company: string | null;
  keyword: string | null;
}

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id       TEXT PRIMARY KEY,
      title    TEXT NOT NULL,
      url      TEXT NOT NULL,
      found_at TEXT NOT NULL,
      notified INTEGER NOT NULL DEFAULT 0,
      company  TEXT,
      keyword  TEXT
    );
    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY
    );
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

export async function getJobIdsBySource(company: string, keyword: string): Promise<Set<string>> {
  await ensureInit();
  const result = await pool.query(
    'SELECT id FROM jobs WHERE company = $1 AND keyword = $2',
    [company, keyword]
  );
  return new Set(result.rows.map((r: { id: string }) => r.id));
}

export async function removeJobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureInit();
  await pool.query('DELETE FROM jobs WHERE id = ANY($1)', [ids]);
}

export async function insertJobs(jobs: Omit<Job, 'notified'>[]): Promise<void> {
  await ensureInit();
  for (const job of jobs) {
    await pool.query(
      `INSERT INTO jobs (id, title, url, found_at, notified, company, keyword)
       VALUES ($1, $2, $3, $4, 0, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [job.id, job.title, job.url, job.found_at, job.company, job.keyword]
    );
  }
}

export async function markNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureInit();
  await pool.query('UPDATE jobs SET notified = 1 WHERE id = ANY($1)', [ids]);
}

export async function getRecentJobs(
  limit = 50,
  filters: { company?: string; keyword?: string } = {}
): Promise<Job[]> {
  await ensureInit();
  const conditions: string[] = [];
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

  params.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT * FROM jobs ${where} ORDER BY found_at DESC LIMIT $${i}`,
    params
  );
  return result.rows as Job[];
}

export async function getSubscribers(): Promise<string[]> {
  await ensureInit();
  const result = await pool.query('SELECT email FROM subscribers');
  return result.rows.map((r: { email: string }) => r.email);
}
