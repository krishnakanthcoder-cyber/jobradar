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
const BRAND_NEW_WINDOW = 20 * 60 * 1000;

const COMPANIES = [
  'Microsoft', 'Google', 'Amazon', 'Apple', 'Meta',
  'Nvidia', 'Salesforce', 'Netflix', 'Stripe', 'OpenAI',
  'Anthropic', 'Figma', 'Notion', 'Airbnb',
];

const KEYWORDS = [
  'Software Engineer', 'Backend Engineer', 'Frontend Engineer',
  'Full Stack Engineer', 'AI Engineer', 'ML Engineer',
];

const COMPANY_ACCENT: Record<string, string> = {
  Microsoft: '#0078d4', Google: '#ea4335', Amazon: '#ff9900',
  Apple: '#555555', Meta: '#0866ff', Nvidia: '#76b900',
  Salesforce: '#00a1e0', Netflix: '#e50914', Stripe: '#635bff',
  OpenAI: '#10a37f', Anthropic: '#c96442', Figma: '#f24e1e',
  Notion: '#37352f', Airbnb: '#ff385c',
};

function isNew(foundAt: string) {
  return Date.now() - new Date(foundAt).getTime() < BRAND_NEW_WINDOW;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [keyword, setKeyword] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ msg: string; ok: boolean } | null>(null);

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
      setError('Could not load jobs. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(company, keyword);
    const id = setInterval(() => fetchJobs(company, keyword), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [company, keyword, fetchJobs]);

  const triggerScrape = async () => {
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setScrapeResult({
        msg: data.newJobs > 0
          ? `${data.newJobs} new listing${data.newJobs === 1 ? '' : 's'} found across ${data.scraped} scanned`
          : `All clear — no new listings found (${data.scraped} scanned)`,
        ok: true,
      });
      fetchJobs(company, keyword);
    } catch (e) {
      setScrapeResult({ msg: (e as Error).message, ok: false });
    } finally {
      setScraping(false);
    }
  };

  const freshCount = jobs.filter((j) => isNew(j.found_at)).length;
  const lastCheckedStr = lastChecked?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
        body { background: #f4f6fb; font-family: 'Inter', system-ui, sans-serif; color: #111827; -webkit-font-smoothing: antialiased; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.4); }
          50% { box-shadow: 0 0 0 5px rgba(5, 150, 105, 0); }
        }

        .job-card {
          transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
          animation: fade-up 0.25s ease both;
        }
        .job-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important;
          border-color: #c7d2fe !important;
        }
        .job-card:hover .apply-link { opacity: 1 !important; }

        .pill-btn {
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          cursor: pointer; border: none; outline: none;
        }
        .pill-btn:hover:not(.active) {
          background: #eef2ff !important;
          color: #4f46e5 !important;
          border-color: #c7d2fe !important;
        }

        .icon-btn {
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
        }
        .icon-btn:hover { background: #f3f4f6 !important; color: #111827 !important; }

        .scan-btn {
          transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
          cursor: pointer; border: none; outline: none;
        }
        .scan-btn:hover:not(:disabled) {
          background: #4338ca !important;
          box-shadow: 0 4px 14px rgba(79,70,229,0.35);
          transform: translateY(-1px);
        }
        .scan-btn:disabled { cursor: not-allowed; }

        .skeleton {
          background: linear-gradient(90deg, #ececec 25%, #f5f5f5 50%, #ececec 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: 12px;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f4f6fb' }}>

        {/* ── TOP ACCENT BAR ── */}
        <div style={{
          height: 4,
          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 35%, #06b6d4 70%, #10b981 100%)',
        }} />

        {/* ── HEADER ── */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>

            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.6px', color: '#111827' }}>Job</span>
                <span style={{
                  fontSize: 26, fontWeight: 800, letterSpacing: '-0.6px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Radar</span>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                Tech job listings — scanned every 20 minutes
              </p>
            </div>

            {/* Stat chips */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                padding: '8px 20px', borderRadius: 10,
                background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                border: '1px solid #a7f3d0',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#059669', lineHeight: 1 }}>{freshCount}</div>
                <div style={{ fontSize: 11, color: '#065f46', marginTop: 3, fontWeight: 500 }}>Fresh (20 min)</div>
              </div>
              <div style={{
                padding: '8px 20px', borderRadius: 10,
                background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                border: '1px solid #c7d2fe',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#4f46e5', lineHeight: 1 }}>{jobs.length}</div>
                <div style={{ fontSize: 11, color: '#3730a3', marginTop: 3, fontWeight: 500 }}>Today</div>
              </div>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px 80px' }}>

          {/* ── FILTER + ACTION PANEL ── */}
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)', marginBottom: 24, overflow: 'hidden',
          }}>
            {/* Company */}
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 10 }}>
                Company
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['All', ...COMPANIES].map((c) => {
                  const active = c === 'All' ? company === null : company === c;
                  return (
                    <button
                      key={c}
                      className={`pill-btn${active ? ' active' : ''}`}
                      onClick={() => setCompany(c === 'All' ? null : (company === c ? null : c))}
                      style={{
                        padding: '5px 13px', fontSize: 12, fontWeight: 500,
                        borderRadius: 20, fontFamily: 'inherit',
                        border: `1.5px solid ${active ? '#6366f1' : '#e5e7eb'}`,
                        background: active ? '#eef2ff' : '#fff',
                        color: active ? '#4f46e5' : '#6b7280',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Role */}
            <div style={{ padding: '14px 22px 14px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 10 }}>
                Role
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['All', ...KEYWORDS].map((k) => {
                  const active = k === 'All' ? keyword === null : keyword === k;
                  return (
                    <button
                      key={k}
                      className={`pill-btn${active ? ' active' : ''}`}
                      onClick={() => setKeyword(k === 'All' ? null : (keyword === k ? null : k))}
                      style={{
                        padding: '5px 13px', fontSize: 12, fontWeight: 500,
                        borderRadius: 20, fontFamily: 'inherit',
                        border: `1.5px solid ${active ? '#6366f1' : '#e5e7eb'}`,
                        background: active ? '#eef2ff' : '#fff',
                        color: active ? '#4f46e5' : '#6b7280',
                      }}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action bar */}
            <div style={{
              padding: '14px 22px', display: 'flex', alignItems: 'center',
              gap: 10, flexWrap: 'wrap', background: '#fafafa',
            }}>
              <button
                className="scan-btn"
                onClick={triggerScrape}
                disabled={scraping}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 20px', fontSize: 13, fontWeight: 600,
                  borderRadius: 8, fontFamily: 'inherit',
                  background: scraping ? '#e5e7eb' : '#4f46e5',
                  color: scraping ? '#9ca3af' : '#fff',
                }}
              >
                {scraping ? (
                  <>
                    <span style={{
                      width: 13, height: 13,
                      border: '2px solid #d1d5db', borderTopColor: '#6b7280',
                      borderRadius: '50%', display: 'inline-block',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Scanning portals...
                  </>
                ) : 'Scan now'}
              </button>

              <button
                className="icon-btn"
                onClick={() => { setLoading(true); fetchJobs(company, keyword); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', fontSize: 13, fontWeight: 500,
                  borderRadius: 8, fontFamily: 'inherit',
                  background: 'transparent', color: '#6b7280',
                  border: '1.5px solid #e5e7eb',
                }}
              >
                Refresh
              </button>

              {lastCheckedStr && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
                  Updated {lastCheckedStr}
                </span>
              )}
            </div>

            {/* Scrape result */}
            {scrapeResult && (
              <div style={{
                margin: '0 22px 16px', padding: '11px 16px', borderRadius: 8, fontSize: 13,
                background: scrapeResult.ok ? '#f0fdf4' : '#fff1f2',
                border: `1px solid ${scrapeResult.ok ? '#bbf7d0' : '#fecdd3'}`,
                color: scrapeResult.ok ? '#166534' : '#9f1239',
              }}>
                {scrapeResult.msg}
              </div>
            )}
          </div>

          {/* ── RESULTS HEADER ── */}
          {!loading && !error && jobs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                {jobs.length} listing{jobs.length === 1 ? '' : 's'} today
                {freshCount > 0 && (
                  <span style={{ marginLeft: 8, fontWeight: 400, color: '#059669' }}>
                    · {freshCount} new in last 20 min
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#9ca3af' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
                  Last 20 min
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
                  Earlier today
                </span>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {error && (
            <div style={{
              padding: '14px 18px', borderRadius: 10, marginBottom: 20,
              background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* ── LOADING SKELETONS ── */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton" style={{ height: 84, opacity: 1 - (i - 1) * 0.12 }} />
              ))}
            </div>
          )}

          {/* ── EMPTY STATE ── */}
          {!loading && !error && jobs.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '72px 24px',
              background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
              boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', margin: '0 auto 20px',
                background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                border: '2px solid #c7d2fe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 1.2s linear infinite' }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                No listings posted yet today
              </div>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 28, lineHeight: 1.6 }}>
                {lastCheckedStr ? `Last checked at ${lastCheckedStr}.` : ''} The scanner runs automatically every 20 minutes.
              </div>
              <button
                onClick={triggerScrape}
                disabled={scraping}
                className="scan-btn"
                style={{
                  padding: '10px 28px', fontSize: 14, fontWeight: 600,
                  borderRadius: 8, fontFamily: 'inherit',
                  background: '#4f46e5', color: '#fff', border: 'none',
                }}
              >
                {scraping ? 'Scanning...' : 'Run scan now'}
              </button>
            </div>
          )}

          {/* ── JOB LIST ── */}
          {!loading && jobs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map((job, idx) => {
                const fresh = isNew(job.found_at);
                const accent = COMPANY_ACCENT[job.company ?? ''] ?? '#6366f1';

                return (
                  <div
                    key={job.id}
                    className="job-card"
                    style={{
                      background: '#fff', borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                      display: 'flex', overflow: 'hidden',
                      animationDelay: `${Math.min(idx, 8) * 40}ms`,
                    }}
                  >
                    {/* Left color bar */}
                    <div style={{ width: 4, flexShrink: 0, background: accent }} />

                    {/* Content */}
                    <div style={{ flex: 1, padding: '14px 18px 14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>

                        {/* Title + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {job.url ? (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 15, fontWeight: 600, color: '#111827',
                                textDecoration: 'none', lineHeight: 1.4,
                                display: 'block',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#4f46e5')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#111827')}
                            >
                              {job.title ?? 'Untitled'}
                            </a>
                          ) : (
                            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827', lineHeight: 1.4, display: 'block' }}>
                              {job.title ?? 'Untitled'}
                            </span>
                          )}

                          <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                            {/* Company badge */}
                            {job.company && (
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                                background: `${accent}14`, color: accent,
                                border: `1px solid ${accent}30`,
                              }}>
                                {job.company}
                              </span>
                            )}

                            {/* Keyword badge */}
                            {job.keyword && (
                              <span style={{
                                fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 20,
                                background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb',
                              }}>
                                {job.keyword}
                              </span>
                            )}

                            {/* Separator */}
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />

                            {/* Time */}
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>
                              {formatRelativeTime(job.found_at)}
                            </span>
                          </div>
                        </div>

                        {/* Right side */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                          {/* Recency badge */}
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: fresh ? '#f0fdf4' : '#fffbeb',
                            color: fresh ? '#059669' : '#d97706',
                            border: `1px solid ${fresh ? '#bbf7d0' : '#fde68a'}`,
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: fresh ? '#059669' : '#d97706',
                              display: 'inline-block',
                              animation: fresh ? 'pulse-dot 2s infinite' : 'none',
                            }} />
                            {fresh ? 'Just in' : 'Earlier'}
                          </span>

                          {/* Apply link */}
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="apply-link"
                              style={{
                                fontSize: 12, fontWeight: 600, color: '#4f46e5',
                                textDecoration: 'none', opacity: 0,
                                transition: 'opacity 0.15s',
                              }}
                            >
                              Apply
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer count */}
          {!loading && jobs.length > 0 && (
            <p style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: '#d1d5db' }}>
              {jobs.length} listing{jobs.length === 1 ? '' : 's'} · refreshes every 30s
            </p>
          )}

        </div>
      </div>
    </>
  );
}
