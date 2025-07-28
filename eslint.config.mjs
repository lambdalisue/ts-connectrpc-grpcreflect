import { defineConfig, globalIgnores } from "eslint/config";
import pluginImport from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Specify files and directories to ignore
  globalIgnores(["**/node_modules/**", "**/dist/**", "**/_gen/**", "repos/**"]),

  // Basic configuration
  tseslint.configs.recommended, // TypeScript recommended
  pluginImport.flatConfigs.recommended,

  // Target files and common environment settings
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true, // Include type definition files in resolution
          extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".mts"],
        },
      },
    },
    rules: {
      // Warn about unused variables, but exclude those starting with _
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Separate type imports
      // https://typescript-eslint.io/rules/consistent-type-imports/
      "@typescript-eslint/consistent-type-imports": "error",
      // Prohibit import { type ... } format that could have side effects
      // https://typescript-eslint.io/rules/no-import-type-side-effects/
      "@typescript-eslint/no-import-type-side-effects": "error",
      // Organize import order
      "import/order": [
        "error",
        {
          // Group type imports first
          groups: [
            "type",
            "builtin",
            "external",
            "parent",
            "sibling",
            "index",
            "object",
          ],
          // Treat pathGroup items as subgroups
          distinctGroup: true,
          // Include type imports in sorting
          sortTypesGroup: true,
          // Separate each group with empty lines
          "newlines-between": "always",
          // Don't use empty line separators for type imports as they are few
          "newlines-between-types": "ignore",
        },
      ],
    },
  },
]);
