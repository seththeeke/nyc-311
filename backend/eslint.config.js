// @ts-check
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["node_modules", "coverage", "eslint.config.js"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // CLAUDE.md §5.2: controllers must always go through a service to
    // reach a DAO, never import/construct/call one directly. Scoped to
    // controller/ source files only — tests/controller/** legitimately
    // mock DAOs and are unaffected.
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
