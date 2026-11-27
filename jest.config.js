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
