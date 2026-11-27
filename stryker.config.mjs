// Mutation testing, on demand only (`npm run mutation`). Not part of `verify`.
// Targets the places where a silent wrong value would hurt: parsers and unit
// conversions (grams/kg, seconds/ms, Portuguese-locale values) plus retry/slot math.
// Add parser and conversion modules to `mutate` as they land in src/.
const config = {
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.js',
    enableFindRelatedTests: true,
  },
  coverageAnalysis: 'all',
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
  thresholds: { high: 80, low: 60, break: null },
  concurrency: 4,
  incremental: false,
  incrementalFile: '.stryker-cache/incremental.json',
  tempDirName: '.stryker-tmp',
  ignoreStatic: false,
};

export default config;
