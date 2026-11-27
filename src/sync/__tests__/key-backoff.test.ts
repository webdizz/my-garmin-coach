/** @jest-environment node */
import { keyBackoffActive, keyBackoffMs } from '../key-backoff';

const HOUR = 3_600_000;

describe('keyBackoffMs', () => {
  it('is 0 without a streak', () => {
    expect(keyBackoffMs(0)).toBe(0);
  });

  it('doubles from 6 h and caps at 24 h', () => {
    expect([1, 2, 3, 4, 5].map((n) => keyBackoffMs(n) / HOUR)).toEqual([6, 12, 24, 24, 24]);
  });
});

describe('keyBackoffActive', () => {
  const lastAt = new Date(Date.UTC(2030, 0, 10, 12, 0));

  it('is inactive without a streak', () => {
    expect(keyBackoffActive({ count: 0 }, lastAt)).toBe(false);
  });

  it('is inactive when there is no timestamp', () => {
    expect(keyBackoffActive({ count: 2 }, lastAt)).toBe(false);
  });

  it('waits the backoff after the last rejection, then lets pulls through again', () => {
    const streak = { count: 1, lastAt }; // 6 h
    expect(keyBackoffActive(streak, new Date(lastAt.getTime() + 6 * HOUR - 1))).toBe(true);
    expect(keyBackoffActive(streak, new Date(lastAt.getTime() + 6 * HOUR))).toBe(false);
  });
});
