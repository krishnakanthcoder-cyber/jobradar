import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'jobradar.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id       TEXT PRIMARY KEY,
      title    TEXT NOT NULL,
      url      TEXT NOT NULL,
      found_at TEXT NOT NULL,
      notified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY
    );
  `);

  // Migrate: add company and keyword columns if they don't exist yet
  const cols = (db.prepare("PRAGMA table_info(jobs)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('company')) db.exec('ALTER TABLE jobs ADD COLUMN company TEXT');
  if (!cols.includes('keyword')) db.exec('ALTER TABLE jobs ADD COLUMN keyword TEXT');

  seedSubscribers(db);
}

function seedSubscribers(db: Database.Database): void {
  const emails = [
    process.env.ALERT_EMAIL,
    process.env.FRIEND_EMAIL,
  ].filter(Boolean) as string[];

  const insert = db.prepare(
    'INSERT OR IGNORE INTO subscribers (email) VALUES (?)'
  );
  for (const email of emails) {
    insert.run(email);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  url: string;
  found_at: string;
  notified: number;
  company: string | null;
  keyword: string | null;
}

export function getKnownIds(): Set<string> {
  const db = getDb();
  const rows = db.prepare('SELECT id FROM jobs').all() as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

export function insertJobs(jobs: Omit<Job, 'notified'>[]): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO jobs (id, title, url, found_at, notified, company, keyword)
    VALUES (@id, @title, @url, @found_at, 0, @company, @keyword)
  `);
  const insertMany = db.transaction((items: Omit<Job, 'notified'>[]) => {
    for (const job of items) insert.run(job);
  });
  insertMany(jobs);
}

export function markNotified(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getDb();
  const update = db.prepare('UPDATE jobs SET notified = 1 WHERE id = ?');
  const updateMany = db.transaction((list: string[]) => {
    for (const id of list) update.run(id);
  });
  updateMany(ids);
}

export function getRecentJobs(
  limit = 50,
  filters: { company?: string; keyword?: string } = {}
): Job[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.company) {
    conditions.push('company = ?');
    params.push(filters.company);
  }
  if (filters.keyword) {
    conditions.push('keyword = ?');
    params.push(filters.keyword);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  return db
    .prepare(`SELECT * FROM jobs ${where} ORDER BY found_at DESC LIMIT ?`)
    .all(...params) as Job[];
}

export function getSubscribers(): string[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT email FROM subscribers')
    .all() as { email: string }[];
  return rows.map((r) => r.email);
}
