'use client';

import { useEffect, useState, useCallback } from 'react';

interface Job {
  id: string;
  title: string;
  url: string;
  found_at: string;
  notified: number;
  company: string | null;
  keyword: string | null;
}

const POLL_INTERVAL = 30_000;
const NEW_JOB_WINDOW = 20 * 60 * 1000;

const COMPANIES = ['Microsoft', 'Google', 'Amazon', 'Apple', 'Meta'];
const KEYWORDS = [
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'AI Engineer',
  'ML Engineer',
];

function isRecent(foundAt: string): boolean {
  return Date.now() - new Date(foundAt).getTime() < NEW_JOB_WINDOW;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const chip = (active: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '3px 10px',
  marginRight: 6,
  marginBottom: 6,
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
  border: active ? '1.5px solid #0070f3' : '1.5px solid #ddd',
  background: active ? '#e8f0fe' : '#fafafa',
  color: active ? '#0070f3' : '#444',
  fontFamily: 'monospace',
});

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [keyword, setKeyword] = useState<string | null>(null);

  const fetchJobs = useCallback(async (c: string | null, k: string | null) => {
    try {
      const params = new URLSearchParams();
      if (c) params.set('company', c);
      if (k) params.set('keyword', k);
      const qs = params.toString();
      const res = await fetch(`/api/jobs${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Job[] = await res.json();
      setJobs(data);
      setLastChecked(new Date());
      setError(null);
    } catch {
      setError('Could not load jobs');
    }
  }, []);

  useEffect(() => {
    fetchJobs(company, keyword);
    const id = setInterval(() => fetchJobs(company, keyword), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [company, keyword, fetchJobs]);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>JobRadar</h1>

      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Loading\u2026'}
      </p>

      {/* Company filter row */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>Company:</span>
        <span style={chip(company === null)} onClick={() => setCompany(null)}>All</span>
        {COMPANIES.map((c) => (
          <span key={c} style={chip(company === c)} onClick={() => setCompany(company === c ? null : c)}>
            {c}
          </span>
        ))}
      </div>

      {/* Keyword filter row */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>Keyword:</span>
        <span style={chip(keyword === null)} onClick={() => setKeyword(null)}>All</span>
        {KEYWORDS.map((k) => (
          <span key={k} style={chip(keyword === k)} onClick={() => setKeyword(keyword === k ? null : k)}>
            {k}
          </span>
        ))}
      </div>

      {error && <p style={{ color: '#c00', marginBottom: 16 }}>{error}</p>}
      {jobs.length === 0 && !error && <p style={{ color: '#888' }}>No jobs found yet.</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {jobs.map((job) => {
          const recent = isRecent(job.found_at);
          return (
            <li
              key={job.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 0',
                borderBottom: '1px solid #eee',
              }}
            >
              {/* Green dot indicator */}
              <span
                title={recent ? 'Found in the last 20 min' : ''}
                style={{
                  marginTop: 5,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: recent ? '#22c55e' : 'transparent',
                  border: recent ? 'none' : '1px solid #ccc',
                }}
              />

              <div>
                {/* Title link */}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 500 }}
                >
                  {job.title}
                </a>

                {/* Meta row: time + company tag + keyword tag */}
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#999' }}>{formatTime(job.found_at)}</span>

                  {job.company && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 7px',
                        borderRadius: 3,
                        background: '#f0f4ff',
                        color: '#3b5bdb',
                        border: '1px solid #c5d0f5',
                      }}
                    >
                      {job.company}
                    </span>
                  )}

                  {job.keyword && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 7px',
                        borderRadius: 3,
                        background: '#f3faf3',
                        color: '#2f7a2f',
                        border: '1px solid #b5ddb5',
                      }}
                    >
                      {job.keyword}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
