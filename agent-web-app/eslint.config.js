// @ts-check
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));

/* CLAUDE.md §6.1's comment-format rule: comments must use block-comment
   syntax, never line-comment syntax, except recognized tooling directives
   (eslint-disable, ts-check, prettier-ignore, ...). A block comment's
   free-text prose is capped at 500 characters; JSDoc tag lines are exempt. */
const DIRECTIVE_PATTERN = /^\s*(eslint-disable|eslint-enable|eslint-env|eslint\b|@ts-check|@ts-nocheck|@ts-ignore|@ts-expect-error|prettier-ignore|istanbul|c8|v8)/;
const MAX_PROSE_LENGTH = 500;

function isOwnLine(sourceCode, comment) {
  const lineText = sourceCode.lines[comment.loc.start.line - 1] ?? "";
  return lineText.slice(0, comment.loc.start.column).trim() === "";
}

function indentOf(sourceCode, comment) {
  const lineText = sourceCode.lines[comment.loc.start.line - 1] ?? "";
  return lineText.slice(0, comment.loc.start.column);
}

/* Groups every non-directive `//` comment into a run: adjacent, own-line
   comments (each starting exactly where the previous one's line ended,
   same indentation) merge into one run so a multi-line // paragraph
   reports/fixes as a single block comment; an inline trailing comment (code
   before it on its own line) always stays its own singleton run — it never
   merges with a neighboring line's comment either direction. */
function groupLineCommentRuns(sourceCode, comments) {
  const runs = [];
  let current = [];
  for (const comment of comments) {
    if (comment.type !== "Line" || DIRECTIVE_PATTERN.test(comment.value)) {
      if (current.length > 0) runs.push(current);
      current = [];
      continue;
    }
    const ownLine = isOwnLine(sourceCode, comment);
    const previous = current[current.length - 1];
    const continuesRun =
      ownLine &&
      previous &&
      isOwnLine(sourceCode, previous) &&
      comment.loc.start.line === previous.loc.end.line + 1 &&
      comment.loc.start.column === current[0].loc.start.column;
    if (continuesRun) {
      current.push(comment);
    } else {
      if (current.length > 0) runs.push(current);
      current = [comment];
    }
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

function mergedBlockText(indent, comments) {
  const texts = comments.map((c) => c.value.trim());
  if (texts.length === 1) return `/* ${texts[0]} */`;
  return `/*\n${texts.map((t) => `${indent} * ${t}`).join("\n")}\n${indent} */`;
}

/** @type {import("eslint").Rule.RuleModule} */
const commentFormatRule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: { description: "Comments must be block-style with prose capped at 500 characters." },
    schema: [],
    messages: {
      lineComment:
        "Single-line `//` comments aren't allowed except tooling directives (eslint-disable, @ts-*, ...). Use a block comment instead.",
      tooLong: "Comment prose is {{length}} characters, over the 500-character cap (JSDoc @tag lines are exempt).",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program() {
        const allComments = sourceCode.getAllComments();
        for (const comment of allComments) {
          if (comment.type === "Line" && DIRECTIVE_PATTERN.test(comment.value)) continue;
          if (comment.type !== "Block") continue;
          const descriptionLines = [];
          for (const line of comment.value.split("\n")) {
            const trimmed = line.replace(/^\s*\*\s?/, "").trim();
            if (/^@\w+/.test(trimmed)) break;
            descriptionLines.push(trimmed);
          }
          const prose = descriptionLines.join(" ").trim();
          if (prose.length > MAX_PROSE_LENGTH) {
            context.report({ node: comment, messageId: "tooLong", data: { length: String(prose.length) } });
          }
        }

        for (const run of groupLineCommentRuns(sourceCode, allComments)) {
          const indent = indentOf(sourceCode, run[0]);
          context.report({
            node: run[0],
            messageId: "lineComment",
            fix(fixer) {
              return fixer.replaceTextRange(
                [run[0].range[0], run[run.length - 1].range[1]],
                mergedBlockText(indent, run)
              );
            },
          });
        }
      },
    };
  },
};

/* CLAUDE.md §5.5: agent-web-app is self-contained. A relative import that
   resolves outside this package (into backend/, web-app/, cdk/, customer/,
   docs/, scripts/, ...) is an error; copy the helper instead. */
/** @type {import("eslint").Rule.RuleModule} */
const stayInPackageRule = {
  meta: {
    type: "problem",
    docs: { description: "Imports must not leave agent-web-app/." },
    schema: [],
    messages: { outside: "\"{{source}}\" resolves outside agent-web-app/ (CLAUDE.md §5.5): copy what you need instead." },
  },
  create(context) {
    const check = (node) => {
      const source = node.source && node.source.value;
      if (typeof source !== "string" || !source.startsWith(".")) return;
      const resolved = path.resolve(path.dirname(context.filename), source);
      const relative = path.relative(PACKAGE_ROOT, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        context.report({ node, messageId: "outside", data: { source } });
      }
    };
    return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check, ImportExpression: check };
  },
};

export default tseslint.config(
  {
    ignores: ["node_modules", "coverage", "dist", "eslint.config.js"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { local: { rules: { "comment-format": commentFormatRule, "stay-in-package": stayInPackageRule } } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "local/comment-format": "error",
      "local/stay-in-package": "error",
    },
  },
  {
    files: ["web/**/*.{ts,tsx}", "tests/web/**/*.{ts,tsx}"],
    ...reactHooks.configs["recommended-latest"],
  },
  {
    files: ["web/**/*.{ts,tsx}", "tests/web/**/*.{ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ["web/components/**/*.tsx"],
    rules: { "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ["web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["**/server/**"], message: "The UI talks to the server over /api only; share types via shared/models." }] }],
    },
  },
  {
    files: ["server/**/*.ts", "shared/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["**/web/**"], message: "Server and shared code never import the UI." }] }],
    },
  },
  {
    /*
     * Controllers reach data only through a service (backend §5.2's rule,
     * source/ standing in for dao/). Flat config replaces a rule's options
     * per block, so this block repeats the server/** pattern and must come
     * after it.
     */
    files: ["server/controller/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["**/source/**"], message: "Controllers call services, never source/ (CLAUDE.md §5.5)." },
        { group: ["**/web/**"], message: "Server and shared code never import the UI." },
      ] }],
    },
  }
);
