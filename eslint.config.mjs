import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';
import security from 'eslint-plugin-security';

// Modules that must never reach the browser bundle. `@/auth/client` is the
// browser auth client and is the single allowed module under src/auth.
// esquery regex literals end at the first unescaped "/", so slashes are escaped.
const SERVER_ONLY_SOURCE =
  '^(?!.*\\/auth\\/client$)(?:@\\/|(?:\\.\\.?\\/)+)?(?:.*\\/)?(?:garmin|db|auth)(?:\\/.*)?$';

const USE_CLIENT = "Program:has(> ExpressionStatement[directive='use client'])";

const CLIENT_IMPORT_RULES = [
  {
    selector: `${USE_CLIENT} ImportDeclaration[source.value=/${SERVER_ONLY_SOURCE}/]`,
    message:
      'Client components must not import src/garmin, src/db or src/auth (except @/auth/client). Move data access to a server component, route handler or server action.',
  },
  {
    selector: `${USE_CLIENT} ImportExpression[source.value=/${SERVER_ONLY_SOURCE}/]`,
    message: 'Client components must not dynamically import src/garmin, src/db or src/auth.',
  },
];

const GARMIN_ENV_RULES = [
  {
    selector:
      "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^GARMIN_/]",
    message:
      'Read GARMIN_* env vars only in src/garmin/index.ts. Use getGarminClient() or hasGarminApiKey().',
  },
  {
    selector:
      "MemberExpression[object.object.name='process'][object.property.name='env'][computed=true][property.value=/^GARMIN_/]",
    message:
      'Read GARMIN_* env vars only in src/garmin/index.ts. Use getGarminClient() or hasGarminApiKey().',
  },
];

const SECRET_LOG_RULES = [
  {
    selector:
      "CallExpression[callee.object.name='console'] Identifier[name=/(token|payload|secret|api_?key|password|cookie|authorization)/i]",
    message: 'Do not log tokens, payloads or secrets. Log ids, counts and status instead.',
  },
  {
    selector:
      "CallExpression[callee.object.name='console'] Literal[value=/(token|payload|secret|api_?key|password|cookie|authorization)/i]",
    message: 'Do not log tokens, payloads or secrets. Log ids, counts and status instead.',
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Type-aware rules: floating/misused promises and dead conditions are the async bugs to catch.
  {
    files: ['**/*.{ts,tsx,mts}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Numbers in log and error messages (counts, day ranges, limits) are safe.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Security rules: the app holds a personal Garmin API key.
  security.configs.recommended,

  // Project rules for application source.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/__tests__/**', 'src/**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...CLIENT_IMPORT_RULES,
        ...GARMIN_ENV_RULES,
        ...SECRET_LOG_RULES,
      ],
      complexity: ['warn', 10],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 4],
    },
  },

  // src/garmin/index.ts is the one place allowed to read GARMIN_* env vars.
  {
    files: ['src/garmin/index.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...CLIENT_IMPORT_RULES, ...SECRET_LOG_RULES],
    },
  },

  // Jest hygiene: no focused, disabled or assertion-free tests.
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    plugins: { jest },
    languageOptions: { globals: jest.environments.globals.globals },
    rules: {
      'jest/no-focused-tests': 'error',
      'jest/no-disabled-tests': 'error',
      'jest/expect-expect': 'error',
      // Test doubles often implement async interfaces without awaiting.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Generated output:
    'coverage/**',
    'graphify-out/**',
    'drizzle/**',
  ]),
]);

export default eslintConfig;
