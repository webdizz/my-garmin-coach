// Mutation testing. Part of `npm run verify` (break threshold below fails the run). Slow, by design:
// it is the test-quality gate, not just a coverage number.
// Targets the places where a silent wrong value would hurt: parsers and unit
// conversions (grams/kg, seconds/ms, Portuguese-locale values) plus retry/slot math.
// Add parser and conversion modules to `mutate` as they land in src/.
const config = {
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'jest.stryker.config.mjs',
    enableFindRelatedTests: true,
  },
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/garmin/client.ts',
    'src/sync/backoff.ts',
    'src/sync/slots.ts',
    '!src/**/__tests__/**',
  ],
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 80, low: 60, break: 74 },
  concurrency: 4,
  incremental: false,
  incrementalFile: '.stryker-cache/incremental.json',
  tempDirName: '.stryker-tmp',
  ignoreStatic: false,
};

export default config;
