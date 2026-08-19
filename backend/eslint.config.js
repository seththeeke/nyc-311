// @ts-check
const tseslint = require("typescript-eslint");

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

module.exports = tseslint.config(
  {
    ignores: ["node_modules", "coverage", "eslint.config.js"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { local: { rules: { "comment-format": commentFormatRule } } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "local/comment-format": "error",
    },
  },
  {
    /* CLAUDE.md §5.2: controllers go through a service to reach a DAO,
       never import/construct/call one directly. tests/controller/** may
       still mock DAOs. */
    files: ["controller/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/dao/**"],
              message:
                "Controllers must not import a DAO directly — go through a service layer instead (CLAUDE.md §5.2).",
            },
          ],
        },
      ],
    },
  }
);
