import type { CodeQualityReport } from "../models/codeQualityReport";

/* Baked reports for in-memory mode: three packages, one audited twice, newest first. */
export const MOCK_CODE_QUALITY_REPORTS: CodeQualityReport[] = [
  {
    date: "2026-11-09",
    time: "23_30",
    package: "backend",
    score: 64,
    previous: 58,
    markdown:
      "# backend · 64/100\n\n| Audit | Score |\n|---|---|\n| Complexity | 13/20 |\n| Pattern sprawl | 9/15 |\n| Consistency | 11/15 |\n| Divergence and duplication | 10/15 |\n| Code smells | 9/15 |\n| AI-friendliness | 12/20 |\n\n**Verdict:** Disciplined layering, undone by three ways of reading the environment and a scheduling service nobody should have to read twice.\n\n## Findings\n1. **Three env-read patterns** (Pattern sprawl): `requireEnv`, bare `process.env` and zod config objects. Pick one.\n2. **A 400-line scheduling service** (Complexity): `service/scheduling/schedulingService.ts`, nesting 6 deep.\n\n## Since last time\nUp 6: the duplicated DAO retry helper was merged into one.",
  },
  {
    date: "2026-11-05",
    time: "23_30",
    package: "web-app",
    score: 71,
    previous: null,
    markdown: "# web-app · 71/100\n\n**Verdict:** Components are small and consistent; data hooks are not.\n\n## Findings\n1. **Two fetching styles** (Pattern sprawl): TanStack hooks and a hand-rolled effect in the map.\n\n## Since last time\nFirst audit.",
  },
  {
    date: "2026-11-02",
    time: "23_30",
    package: "backend",
    score: 58,
    previous: null,
    markdown: "# backend · 58/100\n\n**Verdict:** First look: sound bones, too many copies.\n\n## Since last time\nFirst audit.",
  },
];
