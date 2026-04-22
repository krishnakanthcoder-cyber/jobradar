import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

const recipients = [
  process.env.ALERT_EMAIL,
  process.env.FRIEND_EMAIL,
].filter(Boolean) as string[];

const subject = 'JobRadar is live — you\'ll get alerts when new jobs are posted';

const text = `Hi,

Your JobRadar job alert scheduler is now active and running.

Here's what it's watching:

  Companies:  Anthropic · Figma · Stripe · Airbnb · Datadog
              Instacart · Discord · Coinbase · Roblox · Dropbox
  Roles:      Software Engineer, Backend Engineer, Frontend Engineer,
              Full Stack Engineer, AI Engineer, ML Engineer
  Source:     Greenhouse boards API per company tenant
  Frequency:  Every 20 minutes

Whenever new jobs matching these criteria are posted, you'll get an email at this address with the titles and direct apply links — grouped by company.

You can also view the live feed anytime at:
  http://localhost:3000

Stay sharp,
JobRadar`;

async function main() {
  for (const to of recipients) {
    await transport.sendMail({
      from: `JobRadar <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`✓ Sent to ${to}`);
  }
}

main().catch((err) => {
  console.error('Failed to send:', err.message);
  process.exit(1);
});
