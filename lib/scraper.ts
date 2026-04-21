import * as cheerio from 'cheerio';
import { PORTALS, KEYWORDS } from './portals';
import crypto from 'crypto';

export interface ScrapedJob {
  id: string;
  title: string;
  url: string;
  found_at: string;
  company: string;
  keyword: string;
}

function makeId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

export async function scrapePortal(
  name: string,
  url: string,
  keyword: string,
  selector?: string
): Promise<ScrapedJob[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.log(`[${name}] HTTP ${res.status} for keyword "${keyword}"`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const jobs: ScrapedJob[] = [];

    if (selector) {
      // Use the portal-specific CSS selector to find job title elements
      $(selector).each((_, el) => {
        const title = $(el).text().trim();
        if (!title) return;

        // Find the href: the element itself, a child <a>, or the closest ancestor <a>
        let href =
          $(el).attr('href') ||
          $(el).find('a[href]').first().attr('href') ||
          $(el).closest('a[href]').attr('href') ||
          '';

        if (!href) return;

        const fullUrl = href.startsWith('http') ? href : new URL(href, url).toString();
        jobs.push({
          id: makeId(fullUrl),
          title: title.replace(/\s+/g, ' '),
          company: name,
          keyword,
          url: fullUrl,
          found_at: new Date().toISOString(),
        });
      });
    } else {
      // Generic fallback: scan all <a href> links that look like job links
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim();

        if (
          title.length > 10 &&
          title.length < 150 &&
          (
            href.includes('/job') ||
            href.includes('/career') ||
            href.includes('/position') ||
            href.includes('/opening') ||
            href.includes('/role') ||
            href.includes('/apply')
          )
        ) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, url).toString();
          jobs.push({
            id: makeId(fullUrl),
            title: title.replace(/\s+/g, ' '),
            company: name,
            keyword,
            url: fullUrl,
            found_at: new Date().toISOString(),
          });
        }
      });
    }

    console.log(`[${name}] "${keyword}" → ${jobs.length} jobs found`);
    return jobs;

  } catch (err) {
    console.log(`[${name}] Failed for "${keyword}": ${(err as Error).message}`);
    return [];
  }
}

export async function scrapeAll(): Promise<ScrapedJob[]> {
  const allJobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  for (const portal of PORTALS) {
    for (const keyword of KEYWORDS) {
      const url = portal.buildUrl(keyword);
      const jobs = await scrapePortal(portal.name, url, keyword, portal.selector);
      for (const job of jobs) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          allJobs.push(job);
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allJobs;
}
