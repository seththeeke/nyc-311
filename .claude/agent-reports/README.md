# Agent reports

Reports the scheduled agents write, one folder per run
(`docs/17-executive-team.md` §21.3):

```
.claude/agent-reports/<YYYY-MM-DD>/<HH_MM>/<agent>-<name>.md
```

- The date and time are the run's start in Central time; the scheduler picks
  the folder and passes it in the run's prompt.
- At most 500 words a report. A report is a snapshot; chat posts summarize it.
- Committed straight to `main` after the run by
  `scripts/agent-report-commit.sh`, for an agent whose schedule sets
  `REPORTS=1`. It accepts only new files in that run's folder named for that
  agent. Reports are never edited after they're committed.
- Penny (Chief of Staff) reads them for the morning brief. Sable's are also
  synced to S3 for the Code Quality page (§19.6).
