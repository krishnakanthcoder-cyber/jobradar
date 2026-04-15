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
];
