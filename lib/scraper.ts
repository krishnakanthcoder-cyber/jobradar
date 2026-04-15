import { chromium } from 'playwright';
import md5 from 'md5';
import { PORTALS, KEYWORDS } from './portals';

export interface ScrapedJob {
  id: string;
  title: string;
  url: string;
  found_at: string;
  company: string;
  keyword: string;
}

/**
 * Generic DOM extractor: returns every anchor that looks like a job link.
 * Each portal page is different, so we cast a wide net and let callers filter.
 */
async function extractJobLinks(
  page: import('playwright').Page
): Promise<Array<{ title: string; url: string }>> {
  return page.evaluate(() => {
    const seen = new Set<string>();
    const results: Array<{ title: string; url: string }> = [];

    // Grab all anchors with non-trivial text that link somewhere
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    for (const a of anchors) {
      const href = a.href;
      const title = a.textContent?.trim() ?? '';
      if (!href || !title || title.length < 5) continue;
      // Skip nav / logo / footer links (very short or obviously generic)
      if (['home', 'jobs', 'search', 'careers', 'back'].includes(title.toLowerCase())) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      results.push({ title, url: href });
    }
    return results;
  });
}

async function scrapePortalKeyword(
  portalName: string,
  url: string,
  keyword: string
): Promise<ScrapedJob[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Wait for any list-like structure to appear
    await page
      .waitForSelector('ul, ol, [role="list"], [class*="job"], [class*="result"]', {
        timeout: 15_000,
      })
      .catch(() => {/* continue even if no match */});

    // Extra buffer for JS rendering
    await page.waitForTimeout(3_000);

    const links = await extractJobLinks(page);
    const found_at = new Date().toISOString();

    return links.map((link) => ({
      id: md5(link.url),
      title: link.title,
      url: link.url,
      found_at,
      company: portalName,
      keyword,
    }));
  } finally {
    await browser.close();
  }
}

export async function scrapeAll(): Promise<ScrapedJob[]> {
  const seen = new Set<string>();
  const all: ScrapedJob[] = [];

  for (const portal of PORTALS) {
    for (const keyword of KEYWORDS) {
      const url = portal.buildUrl(keyword);
      try {
        console.log(`[scraper] ${portal.name} / "${keyword}"`);
        const jobs = await scrapePortalKeyword(portal.name, url, keyword);
        let added = 0;
        for (const job of jobs) {
          if (!seen.has(job.id)) {
            seen.add(job.id);
            all.push(job);
            added++;
          }
        }
        console.log(`[scraper]   → ${added} unique jobs`);
      } catch (err) {
        console.error(`[scraper] error on ${portal.name}/"${keyword}":`, err);
        // continue with next combo
      }
    }
  }

  return all;
}
