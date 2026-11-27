import { formatLocal, keyExpiryLabel, WEEKDAYS } from '../format';

describe('formatLocal', () => {
  it('returns "never" for a missing instant', () => {
    expect(formatLocal(null)).toBe('never');
  });

  it('formats an ISO instant as a non-empty local label', () => {
    expect(formatLocal('2030-03-10T09:31:00.000Z')).toMatch(/\d/);
  });

  it('maps weekday numbers 1-7 to Mon-Sun', () => {
    expect(WEEKDAYS.slice(1)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});

describe('keyExpiryLabel', () => {
  it('describes each state in plain words', () => {
    expect(keyExpiryLabel({ state: 'unknown' })).toBe('expiry date not set');
    expect(keyExpiryLabel({ state: 'ok', expiresOn: '2030-06-01', daysLeft: 83 })).toBe(
      'expires in 83 days (2030-06-01)'
    );
    expect(keyExpiryLabel({ state: 'expiring', expiresOn: '2030-03-11', daysLeft: 1 })).toBe(
      'expires in 1 day (2030-03-11)'
    );
    expect(keyExpiryLabel({ state: 'expiring', expiresOn: '2030-03-10', daysLeft: 0 })).toBe(
      'expires today (2030-03-10)'
    );
    expect(keyExpiryLabel({ state: 'expired', expiresOn: '2030-03-09', daysLeft: -1 })).toBe(
      'expired on 2030-03-09'
    );
  });
});
