import {
  PORTALS,
  KEYWORDS,
  getAshbyApiUrl,
  getGreenhouseApiUrl,
  type Portal,
} from './portals';
import crypto from 'crypto';

export interface ScrapedJob {
  id: string;
  title: string;
  url: string;
  found_at: string;
  first_published: string | null;
  company: string;
  keyword: string;
}

interface LiveJobDetails {
  title: string;
  url: string;
  keyword: string;
  location: string;
  firstPublished: string | null;
}

function makeId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  first_published?: string;
  company_name?: string;
  location?: {
    name?: string;
  };
}

interface AshbyLocationRef {
  name?: string;
  location?: string;
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  publishedAt?: string;
  location?: string;
  secondaryLocations?: Array<string | AshbyLocationRef>;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  address?: {
    postalAddress?: {
      addressCountry?: string;
      addressRegion?: string;
      addressLocality?: string;
    };
  };
}

const US_LOCATION_REGEX =
  /\bUnited States\b|,\s*(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/;

function isUnitedStatesLocation(location: string | undefined): boolean {
  if (!location) return false;
  return US_LOCATION_REGEX.test(location);
}

function normalizeUnitedStatesLocation(location: string | undefined): string | null {
  if (!location) return null;

  const usParts = location
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && isUnitedStatesLocation(part));

  if (usParts.length === 0) return null;

  return [...new Set(usParts)].join(' | ');
}

function normalizeTimestamp(timestamp: string | undefined): string | null {
  if (!timestamp) return null;

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

const GREENHOUSE_CACHE_TTL_MS = 5 * 60 * 1000;
const jobsCache = new Map<string, { expiresAt: number; jobs: LiveJobDetails[] }>();

function classifyKeyword(title: string): string | null {
  const normalized = title.toLowerCase();

  if (normalized.includes('frontend')) return 'Frontend Engineer';
  if (normalized.includes('full stack') || normalized.includes('full-stack')) return 'Full Stack Engineer';
  if (normalized.includes('backend')) return 'Backend Engineer';
  if (
    normalized.includes('machine learning') ||
    /\bml\b/.test(normalized) ||
    normalized.includes('model behavior') ||
    normalized.includes('training')
  ) {
    return 'ML Engineer';
  }
  if (
    normalized.includes('ai ') ||
    normalized.startsWith('ai') ||
    normalized.includes('artificial intelligence') ||
    normalized.includes('applied ai') ||
    normalized.includes('research engineer')
  ) {
    return 'AI Engineer';
  }
  if (normalized.includes('engineer')) return 'Software Engineer';

  return null;
}

function buildUsAddressLabel(
  locality: string | undefined,
  region: string | undefined
): string | null {
  const parts = [locality, region].filter(Boolean);
  if (parts.length === 0) return 'United States';
  return `${parts.join(', ')}, United States`;
}

function getAshbyLocationCandidates(job: AshbyJob): string[] {
  const candidates: string[] = [];

  if (job.location) candidates.push(job.location);

  for (const location of job.secondaryLocations ?? []) {
    if (typeof location === 'string') {
      candidates.push(location);
      continue;
    }

    if (location.location) candidates.push(location.location);
    if (location.name) candidates.push(location.name);
  }

  const postalAddress = job.address?.postalAddress;
  const addressCountry = postalAddress?.addressCountry?.trim();
  if (
    addressCountry &&
    /^(United States|USA|US)$/i.test(addressCountry)
  ) {
    candidates.push(
      buildUsAddressLabel(
        postalAddress?.addressLocality?.trim(),
        postalAddress?.addressRegion?.trim()
      ) ?? 'United States'
    );
  }

  if (job.isRemote && candidates.length === 0) {
    candidates.push('United States');
  }

  return candidates;
}

async function fetchLiveGreenhouseJobs(portal: Portal): Promise<LiveJobDetails[]> {
  const apiUrl = getGreenhouseApiUrl(portal.boardToken);
  const cached = jobsCache.get(apiUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.jobs;
  }

  const res = await fetch(apiUrl, {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Greenhouse API`);
  }

  const payload = await res.json() as { jobs?: GreenhouseJob[] };
  const jobs = (payload.jobs ?? [])
    .map((job) => {
      const title = job.title.trim().replace(/\s+/g, ' ');
      const keyword = classifyKeyword(title);
      const location = normalizeUnitedStatesLocation(job.location?.name?.trim());
      if (!keyword || !job.absolute_url || !location) return null;

      return {
        title,
        keyword,
        location,
        firstPublished: normalizeTimestamp(job.first_published),
        url: job.absolute_url,
      } satisfies LiveJobDetails;
    })
    .filter((job): job is LiveJobDetails => job !== null);

  jobsCache.set(apiUrl, {
    expiresAt: Date.now() + GREENHOUSE_CACHE_TTL_MS,
    jobs,
  });

  return jobs;
}

async function fetchLiveAshbyJobs(portal: Portal): Promise<LiveJobDetails[]> {
  const apiUrl = getAshbyApiUrl(portal.boardToken);
  const cached = jobsCache.get(apiUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.jobs;
  }

  const res = await fetch(apiUrl, {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Ashby API`);
  }

  const payload = await res.json() as { jobs?: AshbyJob[] };
  const jobs = (payload.jobs ?? [])
    .map((job) => {
      if (!job.isListed || !job.jobUrl) return null;

      const title = job.title.trim().replace(/\s+/g, ' ');
      const keyword = classifyKeyword(title);
      const location = normalizeUnitedStatesLocation(
        getAshbyLocationCandidates(job).join(' | ')
      );

      if (!keyword || !location) return null;

      return {
        title,
        keyword,
        location,
        firstPublished: normalizeTimestamp(job.publishedAt),
        url: job.jobUrl,
      } satisfies LiveJobDetails;
    })
    .filter((job): job is LiveJobDetails => job !== null);

  jobsCache.set(apiUrl, {
    expiresAt: Date.now() + GREENHOUSE_CACHE_TTL_MS,
    jobs,
  });

  return jobs;
}

async function fetchLiveJobs(portal: Portal): Promise<LiveJobDetails[]> {
  if (portal.provider === 'ashby') {
    return fetchLiveAshbyJobs(portal);
  }

  return fetchLiveGreenhouseJobs(portal);
}

async function scrapeGreenhousePortal(portal: Portal): Promise<ScrapedJob[]> {
  try {
    const foundAt = new Date().toISOString();
    const liveJobs = await fetchLiveGreenhouseJobs(portal);
    const jobs = liveJobs.map((job) => ({
      id: makeId(job.url),
      title: job.title,
      company: portal.name,
      keyword: job.keyword,
      url: job.url,
      found_at: foundAt,
      first_published: job.firstPublished,
    }));

    const byKeyword = KEYWORDS.map((keyword) => {
      const count = jobs.filter((job) => job.keyword === keyword).length;
      return count > 0 ? `${keyword}: ${count}` : null;
    }).filter(Boolean);

    console.log(`[${portal.name}] Greenhouse → ${jobs.length} jobs found${byKeyword.length ? ` (${byKeyword.join(', ')})` : ''}`);
    return jobs;
  } catch (err) {
    console.log(`[${portal.name}] Greenhouse fetch failed: ${(err as Error).message}`);
    return [];
  }
}

async function scrapeAshbyPortal(portal: Portal): Promise<ScrapedJob[]> {
  try {
    const foundAt = new Date().toISOString();
    const liveJobs = await fetchLiveAshbyJobs(portal);
    const jobs = liveJobs.map((job) => ({
      id: makeId(job.url),
      title: job.title,
      company: portal.name,
      keyword: job.keyword,
      url: job.url,
      found_at: foundAt,
      first_published: job.firstPublished,
    }));

    const byKeyword = KEYWORDS.map((keyword) => {
      const count = jobs.filter((job) => job.keyword === keyword).length;
      return count > 0 ? `${keyword}: ${count}` : null;
    }).filter(Boolean);

    console.log(
      `[${portal.name}] Ashby → ${jobs.length} jobs found${byKeyword.length ? ` (${byKeyword.join(', ')})` : ''}`
    );
    return jobs;
  } catch (err) {
    console.log(`[${portal.name}] Ashby fetch failed: ${(err as Error).message}`);
    return [];
  }
}

export async function getLiveLocationsByUrl(company?: string): Promise<Map<string, string>> {
  const portals = company
    ? PORTALS.filter((entry) => entry.name === company)
    : PORTALS;

  const jobsByPortal = await Promise.allSettled(
    portals.map((portal) => fetchLiveJobs(portal))
  );

  const locations = new Map<string, string>();
  for (const result of jobsByPortal) {
    if (result.status !== 'fulfilled') continue;

    const jobs = result.value;
    for (const job of jobs) {
      locations.set(job.url, job.location);
    }
  }

  return locations;
}

export async function scrapePortal(portal: Portal): Promise<ScrapedJob[]> {
  if (portal.provider === 'ashby') {
    return scrapeAshbyPortal(portal);
  }

  return scrapeGreenhousePortal(portal);
}

export async function scrapeAll(): Promise<ScrapedJob[]> {
  const allJobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  for (const portal of PORTALS) {
    const jobs = await scrapePortal(portal);
    for (const job of jobs) {
      if (!seen.has(job.id)) {
        seen.add(job.id);
        allJobs.push(job);
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return allJobs;
}
