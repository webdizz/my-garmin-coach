import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
  ],
  // Floors start at the measured baseline (rounded down) and ratchet up as tests land.
  // Directory keys aggregate all files under the path; glob keys would apply per file.
  coverageThreshold: {
    // Measures files outside the three path keys below (UI, app routes, proxy, etc.).
    global: { statements: 67, branches: 63, functions: 72, lines: 68 },
    './src/garmin/': { statements: 87, branches: 81, functions: 82, lines: 88 },
    './src/db/': { statements: 92, branches: 94, functions: 80, lines: 93 },
    './src/sync/': { statements: 82, branches: 67, functions: 78, lines: 87 },
  },
  modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp/'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
const ESM_PACKAGES = [
  'better-auth',
  '@better-auth',
  'better-call',
  '@better-fetch',
  'nanostores',
  '@simplewebauthn',
  '@noble',
  '@peculiar',
  'jose',
  'rou3',
  'kysely',
];

// next/jest ignores all of node_modules; let the ESM-only auth packages through the SWC transform.
const buildConfig = async () => {
  const config = await createJestConfig(customJestConfig)();
  config.transformIgnorePatterns = [
    `/node_modules/(?!(${ESM_PACKAGES.join('|')})/)`,
    '^.+\\.module\\.(css|sass|scss)$',
  ];
  return config;
};

export default buildConfig;
