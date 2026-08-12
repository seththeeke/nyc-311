// @ts-check
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["node_modules", "coverage", "cdk.out", "eslint.config.js"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  }
);
