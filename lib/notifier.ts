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

function buildHtml(jobs: ScrapedJob[], subject: string): string {
  const byCompany = new Map<string, ScrapedJob[]>();
  for (const job of jobs) {
    const company = job.company ?? 'Other';
    if (!byCompany.has(company)) byCompany.set(company, []);
    byCompany.get(company)!.push(job);
  }

  const companySections = [...byCompany.entries()]
    .map(([company, companyJobs]) => {
      const rows = companyJobs
        .map(
          (job) => `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #f0ede8;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;padding-right:16px;">
                    <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#18181b;line-height:1.35;">
                      ${job.title ?? 'Untitled Role'}
                    </p>
                    <p style="margin:0;font-size:13px;color:#78716c;">
                      United States
                    </p>
                  </td>
                  <td style="vertical-align:middle;white-space:nowrap;">
                    ${job.url
                      ? `<a href="${job.url}" style="display:inline-block;padding:8px 16px;background:#c95b26;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">View role</a>`
                      : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
        )
        .join('');

      return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td style="padding:0 0 12px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#c95b26;width:3px;border-radius:2px;">&nbsp;</td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:12px;font-weight:700;color:#c95b26;text-transform:uppercase;letter-spacing:0.07em;">${company}</span>
                    <span style="margin-left:8px;font-size:12px;color:#a8a29e;font-weight:600;">${companyJobs.length} role${companyJobs.length === 1 ? '' : 's'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${rows}
        </table>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f1ed;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f1ed;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:20px;" align="center">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#c95b26;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:16px;font-weight:900;line-height:36px;display:block;">&#x25C6;</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:800;color:#18181b;letter-spacing:-0.04em;">JobRadar</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:#c95b26;border-radius:20px 20px 0 0;padding:28px 32px 24px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.09em;">New roles detected</p>
              <h1 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.1;">
                ${jobs.length} new job${jobs.length === 1 ? '' : 's'} found
              </h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.55;">
                Across ${byCompany.size} ${byCompany.size === 1 ? 'company' : 'companies'} &mdash; check them before they&apos;re gone.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 20px 20px;padding:28px 32px;border:1px solid rgba(24,24,27,0.07);border-top:none;">
              ${companySections}

              <!-- Footer note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top:20px;border-top:1px solid #f0ede8;">
                    <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.7;">
                      You&apos;re receiving this because you subscribed to JobRadar alerts.<br/>
                      All roles are US-based positions sourced from Greenhouse and Ashby.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:28px;"></td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPlainText(jobs: ScrapedJob[]): string {
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
    sections.push(`── ${company} ──\n${lines.join('\n\n')}`);
  }

  return `${jobs.length} new job${jobs.length === 1 ? '' : 's'} found:\n\n${sections.join('\n\n')}\n\nCheck them before they're gone!`;
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
  const html = buildHtml(newJobs, subject);
  const text = buildPlainText(newJobs);
  const transport = createTransport();

  for (const to of subscribers) {
    try {
      await transport.sendMail({
        from: `JobRadar <${process.env.GMAIL_USER}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(`[notifier] email sent → ${to}`);
    } catch (err) {
      console.error(`[notifier] failed to send to ${to}:`, err);
    }
  }
}
