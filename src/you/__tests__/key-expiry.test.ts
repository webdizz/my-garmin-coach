import { KEY_EXPIRY_WARN_DAYS, keyExpiry } from '../key-expiry';
import { parseKeyExpiry } from '../key-expiry';
import { ProfileInputError } from '@/db/repos/you-profile';

// Synthetic dates only.
const TODAY = '2030-03-10';

describe('keyExpiry', () => {
  it('is unknown when no date has been entered', () => {
    expect(keyExpiry(null, TODAY)).toEqual({ state: 'unknown' });
    expect(keyExpiry(undefined, TODAY)).toEqual({ state: 'unknown' });
  });

  it('is ok with more than the warning window left', () => {
    expect(keyExpiry('2030-04-30', TODAY)).toEqual({
      state: 'ok',
      expiresOn: '2030-04-30',
      daysLeft: 51,
    });
  });

  it('warns at exactly the warning threshold', () => {
    const edge = new Date(Date.parse(`${TODAY}T00:00:00Z`) + KEY_EXPIRY_WARN_DAYS * 86_400_000);
    const expiresOn = edge.toISOString().slice(0, 10);
    expect(keyExpiry(expiresOn, TODAY).state).toBe('expiring');
    expect(keyExpiry(expiresOn, TODAY)).toMatchObject({ daysLeft: KEY_EXPIRY_WARN_DAYS });
  });

  it('is still valid on its expiry day, with zero days left', () => {
    expect(keyExpiry(TODAY, TODAY)).toMatchObject({ state: 'expiring', daysLeft: 0 });
  });

  it('is expired once the day is past', () => {
    expect(keyExpiry('2030-03-09', TODAY)).toMatchObject({ state: 'expired', daysLeft: -1 });
  });

  it('counts across a month boundary', () => {
    expect(keyExpiry('2030-04-02', '2030-03-31')).toMatchObject({ daysLeft: 2 });
  });
});

describe('parseKeyExpiry', () => {
  it('accepts a real YYYY-MM-DD date and null', () => {
    expect(parseKeyExpiry('2030-12-31')).toBe('2030-12-31');
    expect(parseKeyExpiry(null)).toBeNull();
  });

  it('rejects malformed input and impossible dates with ProfileInputError', () => {
    expect(() => parseKeyExpiry('31/12/2030')).toThrow(ProfileInputError);
    expect(() => parseKeyExpiry(20301231)).toThrow(ProfileInputError);
    expect(() => parseKeyExpiry('2030-02-30')).toThrow(ProfileInputError);
  });
});
