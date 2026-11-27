import { formatLocal, WEEKDAYS } from '../format';

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
