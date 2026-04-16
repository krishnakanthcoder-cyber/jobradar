'use client';

import { useEffect, useState, useCallback } from 'react';

interface Job {
  id: string;
  title: string | null;
  url: string | null;
  found_at: string;
  company: string | null;
  keyword: string | null;
}

const POLL_INTERVAL = 30_000;
const BRAND_NEW_WINDOW = 20 * 60 * 1000; // 20 minutes

const COMPANIES = [
  'Microsoft', 'Google', 'Amazon', 'Apple', 'Meta',
  'Nvidia', 'Salesforce', 'Netflix', 'Stripe', 'OpenAI',
  'Anthropic', 'Figma', 'Notion', 'Airbnb',
];

const KEYWORDS = [
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'AI Engineer',
  'ML Engineer',
];

function getDotColor(foundAt: string): { color: string; label: string } {
  const diff = Date.now() - new Date(foundAt).getTime();
  if (diff < BRAND_NEW_WINDOW) return { color: '#22c55e', label: 'Found in last 20 min' };
  return { color: '#eab308', label: 'Found earlier today' };
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `found ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `found ${hours}h ago`;
  return `found at ${new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(company, keyword);
    const id = setInterval(() => fetchJobs(company, keyword), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [company, keyword, fetchJobs]);

  const lastCheckedStr = lastChecked
    ? lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '32px 16px', fontFamily: 'monospace' }}>

      {/* Header */}
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>JobRadar</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
        Freshly posted jobs — updated every 20 min
      </p>

      {/* Company filter */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>Company:</span>
        <span style={chip(company === null)} onClick={() => setCompany(null)}>All</span>
        {COMPANIES.map((c) => (
          <span key={c} style={chip(company === c)} onClick={() => setCompany(company === c ? null : c)}>
            {c}
          </span>
        ))}
      </div>

      {/* Keyword filter */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>Keyword:</span>
        <span style={chip(keyword === null)} onClick={() => setKeyword(null)}>All</span>
        {KEYWORDS.map((k) => (
          <span key={k} style={chip(keyword === k)} onClick={() => setKeyword(keyword === k ? null : k)}>
            {k}
          </span>
        ))}
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, fontSize: 12, color: '#888' }}>
        {lastCheckedStr && <span>Last checked: {lastCheckedStr}</span>}
        <span
          style={{ cursor: 'pointer', color: '#0070f3', textDecoration: 'underline' }}
          onClick={() => { setLoading(true); fetchJobs(company, keyword); }}
        >
          Refresh now
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          last 20 min
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', display: 'inline-block', marginLeft: 8 }} />
          earlier today
        </span>
      </div>

      {/* Error */}
      {error && <p style={{ color: '#c00', marginBottom: 16 }}>{error}</p>}

      {/* Empty state */}
      {!loading && !error && jobs.length === 0 && (
        <p style={{ color: '#888', padding: '32px 0' }}>
          No new jobs posted yet today.{lastCheckedStr ? ` Last checked: ${lastCheckedStr}` : ''}
        </p>
      )}

      {/* Job list */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {jobs.map((job) => {
          const dot = getDotColor(job.found_at);
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
              {/* Status dot */}
              <span
                title={dot.label}
                style={{
                  marginTop: 5,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: dot.color,
                }}
              />

              <div>
                {/* Title */}
                {job.url ? (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {job.title ?? 'Untitled'}
                  </a>
                ) : (
                  <span style={{ fontWeight: 500 }}>{job.title ?? 'Untitled'}</span>
                )}

                {/* Meta row */}
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    {formatRelativeTime(job.found_at)}
                  </span>

                  {job.company && (
                    <span style={{
                      fontSize: 11, padding: '1px 7px', borderRadius: 3,
                      background: '#f0f4ff', color: '#3b5bdb', border: '1px solid #c5d0f5',
                    }}>
                      {job.company}
                    </span>
                  )}

                  {job.keyword && (
                    <span style={{
                      fontSize: 11, padding: '1px 7px', borderRadius: 3,
                      background: '#f3faf3', color: '#2f7a2f', border: '1px solid #b5ddb5',
                    }}>
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
