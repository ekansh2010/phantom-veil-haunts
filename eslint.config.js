import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Backend + Vercel function. The frontend has its own config in frontend/eslint.config.js.
export default tseslint.config(
  { ignores: ["frontend/**", "node_modules/**", "**/dist/**", ".vercel/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["backend/**/*.ts", "api/**/*.ts"],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
