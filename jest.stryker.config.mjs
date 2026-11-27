// Jest config used only by Stryker (`npm run mutation`).
// Stryker's jest runner must instrument the test environment to collect per-test
// coverage. Its mixed-in environment wrappers are not reachable from the
// `@jest-environment` docblocks, so the Stryker run defaults every test to the
// node environment. The two DOM-dependent tests keep their jsdom behaviour via
// an explicit docblock. The app's real config stays in jest.config.js.
import baseConfig from './jest.config.js';

const config = await baseConfig();

const strykerJestConfig = {
  ...config,
  testEnvironment: 'jest-environment-node',
};

export default strykerJestConfig;
