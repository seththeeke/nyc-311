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

/* CLAUDE.md §5.3's customer boundary. A Lambda's code is named by a path
   string, not an import, so an import ban alone would never catch bureau
   infrastructure pointing at the customer's package or the reverse. This
   reports any string or template literal containing the banned word as a
   whole path segment (`customer/x`, `x/backend`, or the bare word, as
   passed to path.join) — never a longer word like `customer-api`. */
function hasPathSegment(text, segment) {
  return new RegExp(`(^|[\\\\/])${segment}([\\\\/]|$)`).test(text);
}

/** @type {import("eslint").Rule.RuleModule} */
const customerBoundaryRule = {
  meta: {
    type: "problem",
    docs: { description: "No path string may cross the bureau/customer boundary." },
    schema: [{ type: "object", properties: { bannedSegment: { type: "string" } }, required: ["bannedSegment"], additionalProperties: false }],
    messages: {
      crossing:
        "A `{{segment}}` path segment in a string crosses the bureau/customer boundary (CLAUDE.md §5.3). Only cdk/customer/customerBackendRoot.ts may name the customer's package.",
    },
  },
  create(context) {
    const segment = context.options[0].bannedSegment;
    const check = (node, text) => {
      if (typeof text === "string" && hasPathSegment(text, segment)) {
        context.report({ node, messageId: "crossing", data: { segment } });
      }
    };
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked);
      },
    };
  },
};

/* Bureau application infrastructure and its tests — everything but
   customer/ and pipeline/ (CI tooling, which must build every package). */
const BUREAU_CDK_FILES = [
  "bin/**/*.ts",
  "stack/**/*.ts",
  "lambda/**/*.ts",
  "data/**/*.ts",
  "api/**/*.ts",
  "web/**/*.ts",
  "warehouse/**/*.ts",
  "auth/**/*.ts",
  "step-function/**/*.ts",
  "tests/{stack,lambda,data,api,web,warehouse,auth,step-function}/**/*.ts",
];
const CUSTOMER_CDK_FILES = ["customer/**/*.ts", "tests/customer/**/*.ts"];
/* The one sanctioned file that names customer/backend, and its test. */
const CUSTOMER_BACKEND_ROOT_FILES = ["customer/customerBackendRoot.ts", "tests/customer/customerBackendRoot.test.ts"];
const NO_CUSTOMER_IMPORTS = {
  group: ["**/customer/**"],
  message: "Only cdk/pipeline/Nyc311CustomerStage.ts may import from cdk/customer/ (CLAUDE.md §5.3).",
};
const NO_BUREAU_IMPORTS = {
  group: [
    "**/stack/**",
    "**/lambda/**",
    "**/data/**",
    "**/api/**",
    "**/web/**",
    "**/warehouse/**",
    "**/auth/**",
    "**/step-function/**",
    "**/pipeline/**",
    "**/bin/**",
  ],
  message: "cdk/customer/ imports no bureau construct directory — copy the constant instead (CLAUDE.md §5.3).",
};

module.exports = tseslint.config(
  {
    ignores: ["node_modules", "coverage", "cdk.out", "eslint.config.js"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { local: { rules: { "comment-format": commentFormatRule, "customer-boundary": customerBoundaryRule } } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "local/comment-format": "error",
    },
  },
  {
    files: BUREAU_CDK_FILES,
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_CUSTOMER_IMPORTS] }],
      "local/customer-boundary": ["error", { bannedSegment: "customer" }],
    },
  },
  {
    /* The pipeline builds and tests every package, so it names them in
       commands — but it still may not import the customer's constructs. */
    files: ["pipeline/**/*.ts", "tests/pipeline/**/*.ts"],
    ignores: ["pipeline/Nyc311CustomerStage.ts", "tests/pipeline/Nyc311CustomerStage.test.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_CUSTOMER_IMPORTS] }],
    },
  },
  {
    files: CUSTOMER_CDK_FILES,
    ignores: CUSTOMER_BACKEND_ROOT_FILES,
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_BUREAU_IMPORTS] }],
      "local/customer-boundary": ["error", { bannedSegment: "backend" }],
    },
  },
  {
    /* The one sanctioned file naming customer/backend still imports nothing of the bureau's. */
    files: CUSTOMER_BACKEND_ROOT_FILES,
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_BUREAU_IMPORTS] }],
    },
  }
);
