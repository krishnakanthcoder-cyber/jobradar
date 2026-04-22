'use client';

import { PORTALS } from '@/lib/portals';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Job {
  id: string;
  title: string | null;
  url: string | null;
  found_at: string;
  first_published: string | null;
  company: string | null;
  keyword: string | null;
  location: string | null;
}

interface JobsResponse {
  todayJobs: Job[];
  newJobs: Job[];
  lastScanAt: string | null;
}

interface ScanProgress {
  running: boolean;
  stage: 'idle' | 'starting' | 'scanning' | 'finishing' | 'completed' | 'error';
  message: string;
  totalPortals: number;
  completedPortals: number;
  currentPortal: string | null;
  recentJobs: number;
  expiredJobs: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

const POLL_INTERVAL = 30_000;
const NEW_SINCE_SCAN_WINDOW = 20 * 60 * 1000;

const COMPANIES = PORTALS.map((portal) => portal.name);

const KEYWORDS = [
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'AI Engineer',
  'ML Engineer',
];

const TIME_FILTERS = [
  { id: 'any', label: 'Any publish time' },
  { id: '24h', label: 'Published in 24h' },
  { id: '72h', label: 'Published in 3 days' },
  { id: '7d', label: 'Published in 7 days' },
] as const;

const SORT_OPTIONS = [
  { id: 'published-desc', label: 'Newest publish time' },
  { id: 'published-asc', label: 'Oldest publish time' },
  { id: 'seen-desc', label: 'Recently discovered' },
] as const;

type TimeFilter = (typeof TIME_FILTERS)[number]['id'];
type SortOption = (typeof SORT_OPTIONS)[number]['id'];
type DropdownKey = 'company' | 'keyword' | 'time' | 'sort';
type JobsTab = 'new' | 'today';

const COMPANY_ACCENT: Record<string, string> = {
  Anthropic: '#d26d3d',
  Figma: '#f24e1e',
  Stripe: '#635bff',
  Airbnb: '#ff385c',
  Airtable: '#18bfff',
  Attentive: '#5b44ff',
  Betterment: '#1f8f66',
  Checkr: '#16a34a',
  ClickHouse: '#ffcc01',
  'Cockroach Labs': '#6933ff',
  Contentful: '#2478cc',
  Datadog: '#632ca6',
  'dbt Labs': '#ff694b',
  Instacart: '#43b02a',
  Discord: '#5865f2',
  Coinbase: '#0052ff',
  Cohere: '#ff6b35',
  Coder: '#2563eb',
  Gusto: '#f45d48',
  'Help Scout': '#1292ee',
  LaunchDarkly: '#4050ff',
  Linear: '#111827',
  Lob: '#0ea5e9',
  Notable: '#7c3aed',
  Notion: '#111111',
  PagerDuty: '#06ac38',
  PitchBook: '#0f766e',
  Pylon: '#14b8a6',
  Ramp: '#f97316',
  Replit: '#f26207',
  Roblox: '#111111',
  Sardine: '#0f766e',
  Valon: '#1d4ed8',
  Vanta: '#111827',
  Dropbox: '#0061ff',
  Webflow: '#4353ff',
  Yext: '#0f172a',
};

function isNewSincePreviousScan(foundAt: string) {
  return Date.now() - new Date(foundAt).getTime() < NEW_SINCE_SCAN_WINDOW;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function toggleSelection(values: string[], entry: string) {
  return values.includes(entry)
    ? values.filter((value) => value !== entry)
    : [...values, entry];
}

function getDropdownLabel(
  selected: string[],
  emptyLabel: string,
  singularLabel: string,
  pluralLabel: string
) {
  if (selected.length === 0) return emptyLabel;
  if (selected.length === 1) return selected[0];
  return `${selected.length} ${selected.length === 1 ? singularLabel : pluralLabel} selected`;
}

function getTimeFilterLabel(value: TimeFilter) {
  return TIME_FILTERS.find((option) => option.id === value)?.label ?? 'Any publish time';
}

function getSortLabel(value: SortOption) {
  return SORT_OPTIONS.find((option) => option.id === value)?.label ?? 'Newest publish time';
}

function getPublishedTimestamp(job: Job) {
  return job.first_published ?? job.found_at;
}

function matchesTimeFilter(job: Job, timeFilter: TimeFilter) {
  if (timeFilter === 'any') return true;

  const publishedAt = Date.parse(getPublishedTimestamp(job));
  if (Number.isNaN(publishedAt)) return false;

  const ageMs = Date.now() - publishedAt;
  const limitMs =
    timeFilter === '24h'
      ? 24 * 60 * 60 * 1000
      : timeFilter === '72h'
        ? 3 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;

  return ageMs <= limitMs;
}

export default function Home() {
  const [jobSets, setJobSets] = useState<JobsResponse>({
    todayJobs: [],
    newJobs: [],
    lastScanAt: null,
  });
  const [activeTab, setActiveTab] = useState<JobsTab>('new');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [sortOption, setSortOption] = useState<SortOption>('published-desc');
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ msg: string; ok: boolean } | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const companyDropdownRef = useRef<HTMLDivElement | null>(null);
  const keywordDropdownRef = useRef<HTMLDivElement | null>(null);
  const timeDropdownRef = useRef<HTMLDivElement | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: JobsResponse = await res.json();
      setJobSets(data);
      setLastChecked(new Date());
      setError(null);
    } catch {
      setError('Could not load jobs. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const id = setInterval(() => fetchJobs(), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchJobs]);

  const triggerScrape = async () => {
    setScraping(true);
    setScrapeResult(null);
    setScanProgress(null);

    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const line = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === 'progress') {
            setScanProgress({
              running: true,
              stage: event.stage as ScanProgress['stage'],
              message: event.message as string,
              totalPortals: event.totalPortals as number,
              completedPortals: event.completedPortals as number,
              currentPortal: event.currentPortal as string | null,
              recentJobs: event.recentJobs as number,
              expiredJobs: event.expiredJobs as number,
              startedAt: null,
              finishedAt: null,
              error: null,
            });
          } else if (event.type === 'complete') {
            const { newJobs, scraped } = event as { newJobs: number; scraped: number };
            setScrapeResult({
              msg:
                newJobs > 0
                  ? `${newJobs} new listing${newJobs === 1 ? '' : 's'} found across ${scraped} job${scraped === 1 ? '' : 's'} posted today`
                  : `All clear — no new listings found (${scraped} jobs posted today)`,
              ok: true,
            });
            fetchJobs();
          } else if (event.type === 'error') {
            throw new Error(event.error as string);
          }
        }
      }
    } catch (e) {
      setScrapeResult({ msg: (e as Error).message, ok: false });
    } finally {
      setScraping(false);
    }
  };

  const activeJobs = activeTab === 'new' ? jobSets.newJobs : jobSets.todayJobs;

  const filteredJobs = useMemo(() => {
    const results = activeJobs.filter((job) => {
      const companyMatch =
        selectedCompanies.length === 0 ||
        (job.company !== null && selectedCompanies.includes(job.company));
      const keywordMatch =
        selectedKeywords.length === 0 ||
        (job.keyword !== null && selectedKeywords.includes(job.keyword));
      const timeMatch = matchesTimeFilter(job, timeFilter);

      return companyMatch && keywordMatch && timeMatch;
    });

    results.sort((left, right) => {
      if (sortOption === 'seen-desc') {
        return Date.parse(right.found_at) - Date.parse(left.found_at);
      }

      const leftPublished = Date.parse(getPublishedTimestamp(left));
      const rightPublished = Date.parse(getPublishedTimestamp(right));

      if (sortOption === 'published-asc') {
        return leftPublished - rightPublished;
      }

      return rightPublished - leftPublished;
    });

    return results;
  }, [activeJobs, selectedCompanies, selectedKeywords, timeFilter, sortOption]);

  const latestScanCount = jobSets.newJobs.length;
  const todayJobsCount = jobSets.todayJobs.length;
  const lastCheckedStr = lastChecked?.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const lastScanStr = jobSets.lastScanAt
    ? new Date(jobSets.lastScanAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const hasActiveFilters =
    selectedCompanies.length > 0 ||
    selectedKeywords.length > 0 ||
    timeFilter !== 'any' ||
    sortOption !== 'published-desc';
  const accent = COMPANY_ACCENT[selectedCompanies[0] ?? COMPANIES[0]] ?? '#d26d3d';
  const companyLabel = getDropdownLabel(
    selectedCompanies,
    'All companies',
    'company',
    'companies'
  );
  const keywordLabel = getDropdownLabel(
    selectedKeywords,
    'All roles',
    'role',
    'roles'
  );
  const timeFilterLabel = getTimeFilterLabel(timeFilter);
  const sortLabel = getSortLabel(sortOption);
  const activeTabLabel = activeTab === 'new' ? 'New Jobs' : 'Today Jobs';
  const progressPercent = scanProgress?.totalPortals
    ? Math.round((scanProgress.completedPortals / scanProgress.totalPortals) * 100)
    : 0;

  useEffect(() => {
    if (!openDropdown) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const refs = [
        companyDropdownRef.current,
        keywordDropdownRef.current,
        timeDropdownRef.current,
        sortDropdownRef.current,
      ];

      if (refs.some((ref) => ref?.contains(target))) return;
      setOpenDropdown(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openDropdown]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }
        html { font-size: 16px; }
        body {
          margin: 0;
          background:
            radial-gradient(circle at top left, rgba(210, 109, 61, 0.12), transparent 28%),
            linear-gradient(180deg, #fffdf9 0%, #f7f5f1 40%, #f3f1ed 100%);
          color: #18181b;
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        button, a { font: inherit; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes shimmer {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes popoverIn {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .page-shell {
          min-height: 100vh;
          padding: 32px 20px 72px;
        }

        .page-inner {
          max-width: 1120px;
          margin: 0 auto;
        }

        .hero {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(24, 24, 27, 0.08);
          border-radius: 28px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,248,243,0.92)),
            linear-gradient(135deg, rgba(210, 109, 61, 0.08), rgba(125, 87, 63, 0.02));
          box-shadow: 0 18px 50px rgba(24, 24, 27, 0.08);
          padding: 28px;
          margin-bottom: 22px;
        }

        .hero::after {
          content: '';
          position: absolute;
          inset: auto -80px -100px auto;
          width: 240px;
          height: 240px;
          background: radial-gradient(circle, rgba(210, 109, 61, 0.18), transparent 70%);
          pointer-events: none;
        }

        .hero-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.9fr);
          gap: 18px;
        }

        .hero-panel,
        .stat-card,
        .filters-card,
        .status-card,
        .job-card,
        .empty-card,
        .error-card,
        .loading-card {
          border: 1px solid rgba(24, 24, 27, 0.08);
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(8px);
          box-shadow: 0 10px 30px rgba(24, 24, 27, 0.05);
        }

        .hero-panel {
          border-radius: 22px;
          padding: 24px;
        }

        .hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(210, 109, 61, 0.18);
          background: rgba(210, 109, 61, 0.08);
          color: #8f4521;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .hero-title {
          margin: 16px 0 10px;
          font-size: clamp(2rem, 4vw, 3.4rem);
          line-height: 0.96;
          letter-spacing: -0.05em;
          font-weight: 800;
          max-width: 12ch;
        }

        .hero-copy {
          max-width: 58ch;
          color: #57534e;
          font-size: 15px;
          line-height: 1.65;
          margin: 0;
        }

        .hero-meta {
          margin-top: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .tab-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 0 0 18px;
        }

        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 11px 14px;
          border-radius: 999px;
          border: 1px solid rgba(24, 24, 27, 0.08);
          background: rgba(255, 255, 255, 0.88);
          color: #44403c;
          cursor: pointer;
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .tab-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(210, 109, 61, 0.22);
          box-shadow: 0 8px 24px rgba(24, 24, 27, 0.05);
        }

        .tab-btn.active {
          border-color: rgba(210, 109, 61, 0.22);
          background: rgba(210, 109, 61, 0.08);
          color: #8f4521;
        }

        .tab-count {
          min-width: 24px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(24, 24, 27, 0.06);
          color: inherit;
          font-size: 12px;
          font-weight: 700;
          text-align: center;
        }

        .hero-chip,
        .meta-chip,
        .status-pill,
        .tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .hero-chip {
          padding: 10px 14px;
          background: rgba(24, 24, 27, 0.04);
          border: 1px solid rgba(24, 24, 27, 0.08);
          color: #3f3f46;
          font-size: 12px;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr 1fr;
        }

        .stat-card {
          border-radius: 18px;
          padding: 18px;
          min-height: 126px;
        }

        .stat-label {
          color: #78716c;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .stat-value {
          margin-top: 14px;
          font-size: 2rem;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .stat-foot {
          margin-top: 10px;
          font-size: 13px;
          color: #57534e;
        }

        .filters-card {
          position: relative;
          z-index: 40;
          overflow: visible;
          border-radius: 24px;
          padding: 22px;
          margin-bottom: 16px;
        }

        .filters-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .section-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .section-copy {
          margin: 6px 0 0;
          color: #6b625a;
          font-size: 14px;
          line-height: 1.5;
        }

        .reset-btn,
        .secondary-btn,
        .primary-btn,
        .ghost-btn {
          border: none;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
        }

        .reset-btn {
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(24, 24, 27, 0.04);
          color: #44403c;
          border: 1px solid rgba(24, 24, 27, 0.08);
          font-size: 13px;
          font-weight: 600;
        }

        .reset-btn:hover:not(:disabled),
        .secondary-btn:hover:not(:disabled),
        .ghost-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          background: rgba(24, 24, 27, 0.06);
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        .filter-group {
          display: grid;
          gap: 10px;
          position: relative;
        }

        .filter-group.open {
          z-index: 60;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #78716c;
        }

        .dropdown-shell {
          position: relative;
          z-index: 1;
        }

        .dropdown-trigger {
          width: 100%;
          min-height: 54px;
          border-radius: 16px;
          border: 1px solid rgba(24, 24, 27, 0.1);
          background: #fff;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #292524;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease, background 0.16s ease;
        }

        .dropdown-trigger:hover {
          transform: translateY(-1px);
          border-color: rgba(210, 109, 61, 0.3);
          background: #fffaf7;
        }

        .dropdown-trigger.open {
          border-color: rgba(210, 109, 61, 0.34);
          box-shadow: 0 0 0 4px rgba(210, 109, 61, 0.08);
          background: #fffaf7;
        }

        .dropdown-trigger-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: left;
        }

        .dropdown-trigger-meta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .dropdown-count {
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(210, 109, 61, 0.1);
          color: #8f4521;
          font-size: 11px;
          font-weight: 700;
        }

        .dropdown-caret {
          color: #78716c;
          font-size: 12px;
          transition: transform 0.16s ease, color 0.16s ease;
        }

        .dropdown-trigger.open .dropdown-caret {
          transform: rotate(180deg);
          color: #8f4521;
        }

        .dropdown-panel {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          z-index: 80;
          border-radius: 18px;
          border: 1px solid rgba(24, 24, 27, 0.1);
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 18px 36px rgba(24, 24, 27, 0.12);
          padding: 12px;
          animation: popoverIn 0.16s ease;
        }

        .dropdown-options {
          display: grid;
          gap: 6px;
          max-height: 260px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .dropdown-option {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 46px;
          border-radius: 12px;
          padding: 0 12px;
          cursor: pointer;
          color: #44403c;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.16s ease, color 0.16s ease;
        }

        .dropdown-option:hover {
          background: rgba(24, 24, 27, 0.04);
        }

        .dropdown-option.selected {
          background: rgba(210, 109, 61, 0.08);
          color: #8f4521;
        }

        .dropdown-option.selected:hover {
          background: rgba(210, 109, 61, 0.12);
        }

        .dropdown-option input {
          margin: 0;
          accent-color: #c95b26;
          transform: scale(1.08);
        }

        .dropdown-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(24, 24, 27, 0.08);
        }

        .dropdown-footer-copy {
          color: #78716c;
          font-size: 12px;
          line-height: 1.5;
        }

        .dropdown-footer-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .filter-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(24, 24, 27, 0.07);
        }

        .filter-summary-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(24, 24, 27, 0.04);
          border: 1px solid rgba(24, 24, 27, 0.08);
          color: #57534e;
          font-size: 12px;
          font-weight: 600;
        }

        .filter-summary-chip strong {
          color: #18181b;
        }

        .actions-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid rgba(24, 24, 27, 0.07);
        }

        .primary-btn,
        .secondary-btn,
        .ghost-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          border-radius: 14px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 700;
        }

        .primary-btn {
          background: linear-gradient(135deg, #c95b26, #d97c4d);
          color: #fff;
          box-shadow: 0 12px 24px rgba(201, 91, 38, 0.24);
        }

        .primary-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 16px 28px rgba(201, 91, 38, 0.26);
        }

        .secondary-btn,
        .ghost-btn {
          background: #fff;
          color: #44403c;
          border: 1px solid rgba(24, 24, 27, 0.1);
        }

        .primary-btn:disabled,
        .secondary-btn:disabled,
        .ghost-btn:disabled,
        .reset-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .inline-spinner {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.5);
          border-top-color: #fff;
          animation: spin 0.75s linear infinite;
        }

        .secondary-spinner {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          border: 2px solid rgba(68, 64, 60, 0.18);
          border-top-color: #44403c;
          animation: spin 0.75s linear infinite;
        }

        .actions-meta {
          margin-left: auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .status-pill {
          padding: 9px 12px;
          background: rgba(24, 24, 27, 0.04);
          border: 1px solid rgba(24, 24, 27, 0.08);
          color: #57534e;
          font-size: 12px;
          font-weight: 600;
        }

        .status-card,
        .error-card,
        .empty-card,
        .loading-card {
          border-radius: 20px;
          padding: 18px 20px;
          margin-bottom: 16px;
        }

        .status-card.success {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.18);
          color: #166534;
        }

        .status-card.progress {
          background: rgba(210, 109, 61, 0.08);
          border-color: rgba(210, 109, 61, 0.18);
          color: #8f4521;
        }

        .status-card.error {
          background: rgba(244, 63, 94, 0.08);
          border-color: rgba(244, 63, 94, 0.18);
          color: #9f1239;
        }

        .progress-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .progress-title {
          font-size: 14px;
          font-weight: 700;
        }

        .progress-meta {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.8;
          white-space: nowrap;
        }

        .progress-copy {
          font-size: 13px;
          line-height: 1.5;
        }

        .progress-track {
          margin-top: 12px;
          width: 100%;
          height: 8px;
          border-radius: 999px;
          background: rgba(24, 24, 27, 0.08);
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #c95b26, #d97c4d);
          transition: width 0.25s ease;
        }

        .progress-footer {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          font-size: 12px;
          color: inherit;
          opacity: 0.88;
        }

        .results-toolbar {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin: 18px 0 14px;
        }

        .results-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .results-copy {
          margin: 4px 0 0;
          color: #6b625a;
          font-size: 14px;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #6b625a;
          font-size: 12px;
          font-weight: 600;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
        }

        .list-grid {
          display: grid;
          gap: 14px;
        }

        .job-card {
          border-radius: 22px;
          padding: 20px;
          animation: fadeUp 0.24s ease both;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .job-card:hover {
          transform: translateY(-2px);
          border-color: rgba(210, 109, 61, 0.18);
          box-shadow: 0 18px 36px rgba(24, 24, 27, 0.08);
        }

        .job-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
        }

        .job-top {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .job-accent {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          margin-top: 8px;
          flex-shrink: 0;
          box-shadow: 0 0 0 6px rgba(210, 109, 61, 0.08);
        }

        .job-title {
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.35;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .job-title a {
          color: #18181b;
          text-decoration: none;
        }

        .job-title a:hover {
          color: #8f4521;
        }

        .job-subtitle {
          margin: 8px 0 0;
          color: #6b625a;
          font-size: 14px;
          line-height: 1.5;
        }

        .job-meta {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(24, 24, 27, 0.08);
          color: #44403c;
          background: #fff;
        }

        .tag.company {
          color: #8f4521;
          background: rgba(210, 109, 61, 0.08);
          border-color: rgba(210, 109, 61, 0.2);
        }

        .tag.role {
          background: #f7f4ef;
          color: #57534e;
        }

        .tag.location {
          background: #fafaf9;
          color: #57534e;
        }

        .tag.time {
          background: transparent;
          color: #78716c;
        }

        .job-side {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          min-width: 130px;
        }

        .fresh-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .fresh-badge.new {
          background: rgba(16, 185, 129, 0.08);
          color: #166534;
          border: 1px solid rgba(16, 185, 129, 0.18);
        }

        .fresh-badge.old {
          background: rgba(245, 158, 11, 0.08);
          color: #92400e;
          border: 1px solid rgba(245, 158, 11, 0.18);
        }

        .fresh-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .apply-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 14px;
          background: #18181b;
          color: #fff;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 12px 24px rgba(24, 24, 27, 0.14);
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .apply-link:hover {
          transform: translateY(-1px);
          background: #2f2f35;
          box-shadow: 0 16px 28px rgba(24, 24, 27, 0.16);
        }

        .loading-stack {
          display: grid;
          gap: 12px;
        }

        .skeleton {
          height: 112px;
          border-radius: 20px;
          background: linear-gradient(90deg, rgba(231, 229, 228, 0.9) 25%, rgba(245, 245, 244, 0.95) 50%, rgba(231, 229, 228, 0.9) 75%);
          background-size: 600px 100%;
          animation: shimmer 1.3s infinite linear;
        }

        .empty-card,
        .error-card {
          text-align: center;
          padding: 54px 24px;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 18px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(210, 109, 61, 0.12), rgba(210, 109, 61, 0.04));
          border: 1px solid rgba(210, 109, 61, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8f4521;
          font-size: 24px;
          font-weight: 800;
        }

        .empty-title,
        .error-title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .empty-copy,
        .error-copy {
          max-width: 56ch;
          margin: 10px auto 0;
          color: #6b625a;
          font-size: 14px;
          line-height: 1.65;
        }

        .footer-note {
          margin-top: 18px;
          text-align: center;
          color: #8b8680;
          font-size: 12px;
          font-weight: 600;
        }

        @media (max-width: 900px) {
          .hero-grid,
          .job-shell {
            grid-template-columns: 1fr;
          }

          .filter-grid {
            grid-template-columns: 1fr 1fr;
          }

          .job-side {
            align-items: flex-start;
            min-width: 0;
          }

          .actions-meta {
            margin-left: 0;
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .page-shell {
            padding: 18px 14px 48px;
          }

          .hero,
          .filters-card,
          .job-card,
          .status-card,
          .empty-card,
          .error-card {
            border-radius: 18px;
          }

          .hero,
          .filters-card,
          .job-card {
            padding: 18px;
          }

          .filters-top,
          .results-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }

          .hero-title {
            max-width: none;
          }

          .primary-btn,
          .secondary-btn,
          .ghost-btn,
          .reset-btn {
            width: 100%;
          }

          .actions-row {
            align-items: stretch;
          }
        }
      `}</style>

      <div className="page-shell">
        <div className="page-inner">
          <section className="hero">
            <div className="hero-grid">
              <div className="hero-panel">
                <span className="hero-kicker">Engineering jobs monitor</span>
                <h1 className="hero-title">Track new US roles without the clutter.</h1>
                <p className="hero-copy">
                  A focused hiring feed for engineering roles across Greenhouse and Ashby-backed
                  companies in the United States. Filter by company and role family, refresh
                  instantly, and scan new openings without digging through every board manually.
                </p>

                <div className="hero-meta">
                  <span className="hero-chip">United States only</span>
                  <span className="hero-chip">Greenhouse + Ashby</span>
                  <span className="hero-chip">Refreshes every 30s</span>
                  <span className="hero-chip">Auto-scan every 20m</span>
                  <span className="hero-chip">Central time today feed</span>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Visible roles</div>
                  <div className="stat-value">{filteredJobs.length}</div>
                  <div className="stat-foot">{activeTabLabel} matching the current filter state</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Latest scan</div>
                  <div className="stat-value" style={{ color: '#15803d' }}>{latestScanCount}</div>
                  <div className="stat-foot">Rows currently stored in `new_jobs`</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Posted today</div>
                  <div className="stat-value" style={{ fontSize: '1.55rem' }}>{todayJobsCount}</div>
                  <div className="stat-foot">Rows currently stored in `today_jobs`</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Last scan</div>
                  <div className="stat-value" style={{ fontSize: '1.55rem', color: accent }}>
                    {lastScanStr ?? '--:--'}
                  </div>
                  <div className="stat-foot">Time the last scan completed</div>
                </div>
              </div>
            </div>
          </section>

          <div className="tab-strip">
            <button
              type="button"
              className={`tab-btn${activeTab === 'new' ? ' active' : ''}`}
              onClick={() => setActiveTab('new')}
            >
              <span>New Jobs</span>
              <span className="tab-count">{latestScanCount}</span>
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === 'today' ? ' active' : ''}`}
              onClick={() => setActiveTab('today')}
            >
              <span>Today Jobs</span>
              <span className="tab-count">{todayJobsCount}</span>
            </button>
          </div>

          <section className="filters-card">
            <div className="filters-top">
              <div>
                <h2 className="section-title">Filters</h2>
                <p className="section-copy">
                  Pick companies, roles, publish windows, and sort order. Changes update the
                  selected feed immediately.
                </p>
              </div>
            </div>

            <div className="filter-grid">
              <div className={`filter-group${openDropdown === 'company' ? ' open' : ''}`}>
                <div className="filter-label">Company</div>
                <div className="dropdown-shell" ref={companyDropdownRef}>
                  <button
                    className={`dropdown-trigger${openDropdown === 'company' ? ' open' : ''}`}
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === 'company' ? null : 'company')
                    }
                  >
                    <span className="dropdown-trigger-text">{companyLabel}</span>
                    <span className="dropdown-trigger-meta">
                      {selectedCompanies.length > 0 && (
                        <span className="dropdown-count">{selectedCompanies.length}</span>
                      )}
                      <span className="dropdown-caret">
                        {openDropdown === 'company' ? '▲' : '▼'}
                      </span>
                    </span>
                  </button>

                  {openDropdown === 'company' && (
                    <div className="dropdown-panel">
                      <div className="dropdown-options">
                        {COMPANIES.map((entry) => (
                          <label
                            key={entry}
                            className={`dropdown-option${selectedCompanies.includes(entry) ? ' selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCompanies.includes(entry)}
                              onChange={() =>
                                setSelectedCompanies((current) => toggleSelection(current, entry))
                              }
                            />
                            <span>{entry}</span>
                          </label>
                        ))}
                      </div>

                      <div className="dropdown-footer">
                        <span className="dropdown-footer-copy">
                          Leave empty to include every company.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`filter-group${openDropdown === 'keyword' ? ' open' : ''}`}>
                <div className="filter-label">Role focus</div>
                <div className="dropdown-shell" ref={keywordDropdownRef}>
                  <button
                    className={`dropdown-trigger${openDropdown === 'keyword' ? ' open' : ''}`}
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === 'keyword' ? null : 'keyword')
                    }
                  >
                    <span className="dropdown-trigger-text">{keywordLabel}</span>
                    <span className="dropdown-trigger-meta">
                      {selectedKeywords.length > 0 && (
                        <span className="dropdown-count">{selectedKeywords.length}</span>
                      )}
                      <span className="dropdown-caret">
                        {openDropdown === 'keyword' ? '▲' : '▼'}
                      </span>
                    </span>
                  </button>

                  {openDropdown === 'keyword' && (
                    <div className="dropdown-panel">
                      <div className="dropdown-options">
                        {KEYWORDS.map((entry) => (
                          <label
                            key={entry}
                            className={`dropdown-option${selectedKeywords.includes(entry) ? ' selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedKeywords.includes(entry)}
                              onChange={() =>
                                setSelectedKeywords((current) => toggleSelection(current, entry))
                              }
                            />
                            <span>{entry}</span>
                          </label>
                        ))}
                      </div>

                      <div className="dropdown-footer">
                        <span className="dropdown-footer-copy">
                          Select one or more engineering tracks.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`filter-group${openDropdown === 'time' ? ' open' : ''}`}>
                <div className="filter-label">Published window</div>
                <div className="dropdown-shell" ref={timeDropdownRef}>
                  <button
                    className={`dropdown-trigger${openDropdown === 'time' ? ' open' : ''}`}
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'time' ? null : 'time')}
                  >
                    <span className="dropdown-trigger-text">{timeFilterLabel}</span>
                    <span className="dropdown-trigger-meta">
                      <span className="dropdown-caret">
                        {openDropdown === 'time' ? '▲' : '▼'}
                      </span>
                    </span>
                  </button>

                  {openDropdown === 'time' && (
                    <div className="dropdown-panel">
                      <div className="dropdown-options">
                        {TIME_FILTERS.map((option) => (
                          <label
                            key={option.id}
                            className={`dropdown-option${timeFilter === option.id ? ' selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="time-filter"
                              checked={timeFilter === option.id}
                              onChange={() => {
                                setTimeFilter(option.id);
                                setOpenDropdown(null);
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="dropdown-footer">
                        <span className="dropdown-footer-copy">
                          Filter by the job&apos;s first published timestamp.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`filter-group${openDropdown === 'sort' ? ' open' : ''}`}>
                <div className="filter-label">Sort order</div>
                <div className="dropdown-shell" ref={sortDropdownRef}>
                  <button
                    className={`dropdown-trigger${openDropdown === 'sort' ? ' open' : ''}`}
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
                  >
                    <span className="dropdown-trigger-text">{sortLabel}</span>
                    <span className="dropdown-trigger-meta">
                      <span className="dropdown-caret">
                        {openDropdown === 'sort' ? '▲' : '▼'}
                      </span>
                    </span>
                  </button>

                  {openDropdown === 'sort' && (
                    <div className="dropdown-panel">
                      <div className="dropdown-options">
                        {SORT_OPTIONS.map((option) => (
                          <label
                            key={option.id}
                            className={`dropdown-option${sortOption === option.id ? ' selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="sort-filter"
                              checked={sortOption === option.id}
                              onChange={() => {
                                setSortOption(option.id);
                                setOpenDropdown(null);
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="dropdown-footer">
                        <span className="dropdown-footer-copy">
                          Choose how the visible jobs should be ordered.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="filter-summary">
              <span className="filter-summary-chip">
                <strong>Companies:</strong> {selectedCompanies.length > 0 ? selectedCompanies.join(', ') : 'All'}
              </span>
              <span className="filter-summary-chip">
                <strong>Roles:</strong> {selectedKeywords.length > 0 ? selectedKeywords.join(', ') : 'All'}
              </span>
              <span className="filter-summary-chip">
                <strong>Published:</strong> {getTimeFilterLabel(timeFilter)}
              </span>
              <span className="filter-summary-chip">
                <strong>Sort:</strong> {getSortLabel(sortOption)}
              </span>
            </div>

            <div className="actions-row">
              <button className="primary-btn" onClick={triggerScrape} disabled={scraping}>
                {scraping ? (
                  <>
                    <span className="inline-spinner" />
                    {scanProgress?.currentPortal
                      ? `Scanning ${scanProgress.currentPortal}...`
                      : 'Scanning board...'}
                  </>
                ) : (
                  'Run scan now'
                )}
              </button>

              <button
                className="secondary-btn"
                onClick={() => {
                  setLoading(true);
                  fetchJobs();
                }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="secondary-spinner" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh results'
                )}
              </button>

              <div className="actions-meta">
                <span className="status-pill">US only</span>
                <span className="status-pill">{activeTab === 'new' ? 'New jobs tab' : 'Today jobs tab'}</span>
                <span className="status-pill">{hasActiveFilters ? 'Filtered view' : 'All tracked roles'}</span>
                {lastCheckedStr && <span className="status-pill">Updated {lastCheckedStr}</span>}
              </div>
            </div>
          </section>

          {scraping && scanProgress && (
            <div className="status-card progress">
              <div className="progress-head">
                <span className="progress-title">
                  {scanProgress.stage === 'finishing' ? 'Finalizing scan' : 'Scan in progress'}
                </span>
                <span className="progress-meta">
                  {scanProgress.completedPortals}/{scanProgress.totalPortals} companies
                </span>
              </div>
              <div className="progress-copy">
                {scanProgress.message}
                {scanProgress.currentPortal ? ` Current company: ${scanProgress.currentPortal}.` : ''}
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="progress-footer">
                <span>{progressPercent}% complete</span>
                <span>{scanProgress.recentJobs} new jobs found</span>
                <span>{scanProgress.expiredJobs} expired jobs</span>
              </div>
            </div>
          )}

          {scrapeResult && (
            <div className={`status-card ${scrapeResult.ok ? 'success' : 'error'}`}>
              {scrapeResult.msg}
            </div>
          )}

          {error && (
            <section className="error-card">
              <h3 className="error-title">Unable to load the jobs feed</h3>
              <p className="error-copy">
                {error} Try refreshing the feed or running a fresh scan against the source board.
              </p>
            </section>
          )}

          {!error && !loading && activeJobs.length > 0 && (
            <div className="results-toolbar">
              <div>
                <h2 className="results-title">
                  {activeTab === 'new'
                    ? `${filteredJobs.length} new role${filteredJobs.length === 1 ? '' : 's'} from the latest scan`
                    : `${filteredJobs.length} role${filteredJobs.length === 1 ? '' : 's'} posted today`}
                </h2>
                <p className="results-copy">
                  {hasActiveFilters
                    ? 'Showing only roles that match the selected filters and publish-time settings.'
                    : activeTab === 'new'
                      ? 'Showing only the jobs that were newly detected in the latest successful scan.'
                      : 'Showing all tracked engineering roles posted today in the United States across the monitored companies.'}
                </p>
              </div>

              <div className="legend">
                {activeTab === 'new' ? (
                  <span className="legend-item">
                    <span className="legend-dot" style={{ background: '#16a34a' }} />
                    Latest scan only
                  </span>
                ) : (
                  <>
                    <span className="legend-item">
                      <span className="legend-dot" style={{ background: '#16a34a' }} />
                      New since previous scan
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot" style={{ background: '#d97706' }} />
                      Already tracked today
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {loading && (
            <section className="loading-card">
              <div className="loading-stack">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="skeleton" style={{ opacity: 1 - (item - 1) * 0.08 }} />
                ))}
              </div>
            </section>
          )}

          {!loading && !error && filteredJobs.length === 0 && (
            <section className="empty-card">
              <div className="empty-icon">JR</div>
              <h3 className="empty-title">
                {activeTab === 'new' ? 'No new roles match the current view' : 'No today roles match the current view'}
              </h3>
              <p className="empty-copy">
                {hasActiveFilters
                  ? 'Try clearing the active filters to widen the board, or run a fresh scan to pick up any new postings.'
                  : activeTab === 'new'
                    ? 'No newly detected roles are available from the latest scan. Run another scan to refresh the new_jobs table.'
                    : 'No tracked roles were found in the current US-only feed for jobs posted today. The scanner will keep checking automatically every 20 minutes.'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
                <button className="primary-btn" onClick={triggerScrape} disabled={scraping}>
                  {scraping ? (
                    <>
                      <span className="inline-spinner" />
                      {scanProgress?.currentPortal
                        ? `Scanning ${scanProgress.currentPortal}...`
                        : 'Scanning board...'}
                    </>
                  ) : (
                    'Run scan now'
                  )}
                </button>
              </div>
            </section>
          )}

          {!loading && !error && filteredJobs.length > 0 && (
            <div className="list-grid">
              {filteredJobs.map((job, index) => {
                const publishedAt = getPublishedTimestamp(job);
                const fresh = activeTab === 'new' || isNewSincePreviousScan(job.found_at);
                const cardAccent = COMPANY_ACCENT[job.company ?? ''] ?? '#d26d3d';

                return (
                  <article
                    key={job.id}
                    className="job-card"
                    style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                  >
                    <div className="job-shell">
                      <div>
                        <div className="job-top">
                          <span className="job-accent" style={{ background: cardAccent }} />

                          <div style={{ minWidth: 0 }}>
                            <h3 className="job-title">
                              {job.url ? (
                                <a href={job.url} target="_blank" rel="noopener noreferrer">
                                  {job.title ?? 'Untitled'}
                                </a>
                              ) : (
                                <span>{job.title ?? 'Untitled'}</span>
                              )}
                            </h3>

                            <p className="job-subtitle">
                              {job.location ?? 'United States'}
                              {' · '}
                              Published {formatRelativeTime(publishedAt)}
                              {' · '}
                              Seen {formatRelativeTime(job.found_at)}
                            </p>
                          </div>
                        </div>

                        <div className="job-meta">
                          {job.company && <span className="tag company">{job.company}</span>}
                          {job.keyword && <span className="tag role">{job.keyword}</span>}
                          {job.location && <span className="tag location">{job.location}</span>}
                          <span className="tag time">Published {formatAbsoluteTime(publishedAt)}</span>
                          <span className="tag time">Seen {formatAbsoluteTime(job.found_at)}</span>
                        </div>
                      </div>

                      <div className="job-side">
                        <span className={`fresh-badge ${fresh ? 'new' : 'old'}`}>
                          <span
                            className="fresh-dot"
                            style={{ background: fresh ? '#16a34a' : '#d97706' }}
                          />
                          {activeTab === 'new'
                            ? 'Latest scan'
                            : fresh
                              ? 'New since previous scan'
                              : 'Already tracked today'}
                        </span>

                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="apply-link"
                          >
                            View role
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && !error && filteredJobs.length > 0 && (
            <p className="footer-note">
              {filteredJobs.length} visible role{filteredJobs.length === 1 ? '' : 's'} in {activeTabLabel.toLowerCase()} · auto-refresh every 30 seconds
            </p>
          )}
        </div>
      </div>
    </>
  );
}
