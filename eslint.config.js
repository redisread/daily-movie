import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".wrangler/**",
      "worker-configuration.d.ts",
      "artifacts/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
