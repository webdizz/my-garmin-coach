/** @jest-environment node */
jest.mock('server-only', () => ({}));

// Secrets rule: test values are built at runtime, never written as key-shaped literals.
// Env writes go through Reflect.set with the variable name held separately.
const KEY_VAR = 'GARMIN_CONNECT_API_KEY';
const ORIGINAL = Reflect.get(process.env, KEY_VAR);
const SYNTHETIC_KEY = ['synthetic', 'sentinel', Date.now().toString(36)].join('-');

describe('garmin index', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) Reflect.deleteProperty(process.env, KEY_VAR);
    else Reflect.set(process.env, KEY_VAR, ORIGINAL);
  });

  it('reports whether the key is set without returning its value', async () => {
    const { hasGarminApiKey } = await import('../index');
    Reflect.set(process.env, KEY_VAR, SYNTHETIC_KEY);
    expect(hasGarminApiKey()).toBe(true);
    Reflect.deleteProperty(process.env, KEY_VAR);
    expect(hasGarminApiKey()).toBe(false);
  });

  it('throws when building a client without the key', async () => {
    Reflect.deleteProperty(process.env, KEY_VAR);
    const { getGarminClient } = await import('../index');
    expect(() => getGarminClient()).toThrow('GARMIN_CONNECT_API_KEY is not set');
  });

  it('builds one process-wide client and reuses it', async () => {
    Reflect.set(process.env, KEY_VAR, SYNTHETIC_KEY);
    const { getGarminClient } = await import('../index');
    const first = getGarminClient();
    expect(getGarminClient()).toBe(first);
  });
});
