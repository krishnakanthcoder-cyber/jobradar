export const KEYWORDS = [
  "Software Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Full Stack Engineer",
  "AI Engineer",
  "ML Engineer",
];

export interface Portal {
  name: string;
  buildUrl: (keyword: string) => string;
  selector?: string;
}

export const PORTALS: Portal[] = [
  {
    name: "Microsoft",
    buildUrl: (keyword: string) =>
      `https://apply.careers.microsoft.com/careers?query=${encodeURIComponent(keyword)}&start=0&location=United+States&pid=1970393556649786&sort_by=timestamp&filter_include_remote=1&filter_career_discipline=Software+Engineering&filter_seniority=Mid-Level%2CEntry`,
    selector: ".title-1aNJK",
  },

  // Paused — enable when Microsoft is confirmed working
  // { name: "Google",     buildUrl: (k) => `https://www.google.com/about/careers/applications/jobs/results?q=${encodeURIComponent(k)}&location=United%20States&sort_by=date` },
  // { name: "Amazon",     buildUrl: (k) => `https://www.amazon.jobs/en/search?base_query=${encodeURIComponent(k)}&loc_query=United+States&sort=recent` },
  // { name: "Apple",      buildUrl: (k) => `https://jobs.apple.com/en-us/search?search=${encodeURIComponent(k)}&sort=newest` },
  // { name: "Meta",       buildUrl: (k) => `https://www.metacareers.com/jobs?q=${encodeURIComponent(k)}&divisions%5B0%5D=Engineering&sort_by_new=true` },
  // { name: "Nvidia",     buildUrl: (k) => `https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite?q=${encodeURIComponent(k)}` },
  // { name: "Salesforce", buildUrl: (k) => `https://careers.salesforce.com/en/jobs/?search=${encodeURIComponent(k)}&team=Software+Engineering` },
  // { name: "Netflix",    buildUrl: (k) => `https://jobs.netflix.com/search?q=${encodeURIComponent(k)}` },
  // { name: "Stripe",     buildUrl: (k) => `https://stripe.com/jobs/search?query=${encodeURIComponent(k)}` },
  // { name: "OpenAI",     buildUrl: (k) => `https://openai.com/careers/search?q=${encodeURIComponent(k)}` },
  // { name: "Anthropic",  buildUrl: (_k) => `https://www.anthropic.com/careers#open-roles` },
  // { name: "Figma",      buildUrl: (_k) => `https://www.figma.com/careers/#job-openings` },
  // { name: "Notion",     buildUrl: (_k) => `https://www.notion.so/careers` },
  // { name: "Airbnb",     buildUrl: (k) => `https://careers.airbnb.com/positions/?gh_src=&search=${encodeURIComponent(k)}` },
];
