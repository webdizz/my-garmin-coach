import { GarminApiError } from '../garmin/client';

export interface BackoffOptions {
  /** Retries after the first attempt. Default 3. */
  retries?: number;
  /** First delay; doubles each retry. Default 1000 ms. */
  baseMs?: number;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function isRateLimited(err: unknown): boolean {
  return err instanceof GarminApiError && err.status === 429;
}

/** Rate limits, server errors and request timeouts are worth another try. Other 4xx are not. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof GarminApiError) return err.status === 429 || err.status >= 500;
  return err instanceof Error && err.name === 'TimeoutError';
}

/** Run `fn`, retrying retryable failures with exponential backoff. Rethrows the last error. */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const { retries = 3, baseMs = 1000, maxMs = 30_000, sleep = wait } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      await sleep(Math.min(baseMs * 2 ** attempt, maxMs));
    }
  }
}
