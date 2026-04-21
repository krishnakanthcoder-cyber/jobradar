import nodemailer from 'nodemailer';
import { getSubscribers } from './db';
import type { ScrapedJob } from './scraper';

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });
}

function buildBody(jobs: ScrapedJob[]): string {
  const byCompany = new Map<string, ScrapedJob[]>();
  for (const job of jobs) {
    const company = job.company ?? 'Other';
    if (!byCompany.has(company)) byCompany.set(company, []);
    byCompany.get(company)!.push(job);
  }

  const sections: string[] = [];
  let counter = 1;
  for (const [company, companyJobs] of byCompany) {
    const lines = companyJobs.map(
      (job) => `${counter++}. ${job.title}\n   ${job.url}`
    );
    sections.push(`\u2500\u2500 ${company} \u2500\u2500\n${lines.join('\n\n')}`);
  }

  return `New jobs found:\n\n${sections.join('\n\n')}\n\nCheck them before they're gone!`;
}

export async function notifySubscribers(newJobs: ScrapedJob[]): Promise<void> {
  if (newJobs.length === 0) return;

  const subscribers = await getSubscribers();
  if (subscribers.length === 0) {
    console.log('[notifier] no subscribers configured — skipping email');
    return;
  }

  const companies = [...new Set(newJobs.map((j) => j.company ?? 'Other'))];
  const subject = `${newJobs.length} new job${newJobs.length === 1 ? '' : 's'} found across ${companies.length} ${companies.length === 1 ? 'company' : 'companies'}`;
  const text = buildBody(newJobs);
  const transport = createTransport();

  for (const to of subscribers) {
    try {
      await transport.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        text,
      });
      console.log(`[notifier] email sent → ${to}`);
    } catch (err) {
      console.error(`[notifier] failed to send to ${to}:`, err);
    }
  }
}
