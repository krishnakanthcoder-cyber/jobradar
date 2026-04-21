export const KEYWORDS = [
  "Software Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Full Stack Engineer",
  "AI Engineer",
  "ML Engineer",
];

export const PORTALS = [
  {
    name: "Microsoft",
    buildUrl: (keyword: string) =>
      `https://apply.careers.microsoft.com/careers?query=${encodeURIComponent(keyword)}&location=United+States&sort_by=timestamp&filter_include_remote=1&filter_career_discipline=Software+Engineering&filter_seniority=Mid-Level%2CEntry`,
  },
  {
    name: "Google",
    buildUrl: (keyword: string) =>
      `https://www.google.com/about/careers/applications/jobs/results?q=${encodeURIComponent(keyword)}&location=United%20States&sort_by=date`,
  },
  {
    name: "Amazon",
    buildUrl: (keyword: string) =>
      `https://www.amazon.jobs/en/search?base_query=${encodeURIComponent(keyword)}&loc_query=United+States&sort=recent`,
  },
  {
    name: "Apple",
    buildUrl: (keyword: string) =>
      `https://jobs.apple.com/en-us/search?search=${encodeURIComponent(keyword)}&sort=newest`,
  },
  {
    name: "Meta",
    buildUrl: (keyword: string) =>
      `https://www.metacareers.com/jobs?q=${encodeURIComponent(keyword)}&divisions%5B0%5D=Engineering&sort_by_new=true`,
  },
  {
    name: "Nvidia",
    buildUrl: (keyword: string) =>
      `https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite?q=${encodeURIComponent(keyword)}`,
  },
  {
    name: "Salesforce",
    buildUrl: (keyword: string) =>
      `https://careers.salesforce.com/en/jobs/?search=${encodeURIComponent(keyword)}&team=Software+Engineering`,
  },
  {
    name: "Netflix",
    buildUrl: (keyword: string) =>
      `https://jobs.netflix.com/search?q=${encodeURIComponent(keyword)}`,
  },
  {
    name: "Stripe",
    buildUrl: (keyword: string) =>
      `https://stripe.com/jobs/search?query=${encodeURIComponent(keyword)}`,
  },
  {
    name: "OpenAI",
    buildUrl: (keyword: string) =>
      `https://openai.com/careers/search?q=${encodeURIComponent(keyword)}`,
  },
  {
    name: "Anthropic",
    buildUrl: (keyword: string) =>
      `https://www.anthropic.com/careers#open-roles`,
  },
  {
    name: "Figma",
    buildUrl: (keyword: string) =>
      `https://www.figma.com/careers/#job-openings`,
  },
  {
    name: "Notion",
    buildUrl: (keyword: string) =>
      `https://www.notion.so/careers`,
  },
  {
    name: "Airbnb",
    buildUrl: (keyword: string) =>
      `https://careers.airbnb.com/positions/?gh_src=&search=${encodeURIComponent(keyword)}`,
  },
];
