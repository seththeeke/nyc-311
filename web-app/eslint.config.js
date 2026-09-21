// @ts-check
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

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

/* 12-UX-workspace-refactor.md §7.4: neutral colours must come from the theme
   tokens (bg-surface, text-fg, border-line, ...), never raw palette classes,
   so every component follows the active theme. Hue tints (bg-cyan-500/10,
   ...) stay allowed — they read on both themes. */
const RAW_NEUTRAL_CLASS =
  /(?:^|[\s"'`])(?:[\w[\]-]+:)*(?:bg|text|border|divide|ring|from|via|to|placeholder|fill|stroke|outline|decoration|caret|accent)-(?:slate|gray|zinc|neutral|stone|white|black)(?:-\d+)?(?:\/[\d.[\]]+)?(?![\w-])/;

/** @type {import("eslint").Rule.RuleModule} */
const noRawPaletteRule = {
  meta: {
    type: "problem",
    docs: { description: "Use semantic theme tokens instead of raw neutral palette classes." },
    schema: [],
    messages: {
      rawNeutral:
        "Raw neutral palette class in \"{{snippet}}\" — use a theme token (bg-surface, bg-panel, text-fg, text-fg-muted, border-line, ...) so the class follows the active theme.",
    },
  },
  create(context) {
    const check = (node, text) => {
      const match = RAW_NEUTRAL_CLASS.exec(text);
      if (match) {
        context.report({ node, messageId: "rawNeutral", data: { snippet: match[0].trim() } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ["node_modules", "coverage", "dist", "eslint.config.js"],
  },
  ...tseslint.configs.recommended,
  reactHooks.configs["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  {
    plugins: { local: { rules: { "comment-format": commentFormatRule, "no-raw-palette": noRawPaletteRule } } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "local/comment-format": "error",
    },
  },
  {
    files: ["src/components/**/*.tsx"],
    rules: {
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "local/no-raw-palette": "error" },
  }
);
