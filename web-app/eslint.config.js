// @ts-check
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  {
    ignores: ["node_modules", "coverage", "dist", "eslint.config.js"],
  },
  ...tseslint.configs.recommended,
  reactHooks.configs["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/components/**/*.tsx"],
    rules: {
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
    },
  }
);
