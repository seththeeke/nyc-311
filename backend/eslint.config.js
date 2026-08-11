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
  }
);
