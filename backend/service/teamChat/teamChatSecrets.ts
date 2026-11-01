/*
 * Everything posted to Team Chat is public (docs/17-executive-team.md §10.5),
 * so text that looks like a credential is refused before it's stored.
 */
const SECRET_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: "AWS access key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { name: "Anthropic API key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "Slack token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
];

/** The kind of secret the text appears to contain, or null. */
export function findSecret(text: string): string | null {
  return SECRET_PATTERNS.find(({ pattern }) => pattern.test(text))?.name ?? null;
}
