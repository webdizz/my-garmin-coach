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
    global: { statements: 51, branches: 37, functions: 53, lines: 53 },
    './src/garmin/': { statements: 78, branches: 72, functions: 75, lines: 79 },
    './src/db/': { statements: 85, branches: 82, functions: 75, lines: 84 },
    './src/sync/': { statements: 74, branches: 62, functions: 70, lines: 78 },
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
