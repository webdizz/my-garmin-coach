import 'server-only';
import { createGarminClient, type GarminClient } from './client';

export type { GarminClient } from './client';
export { GarminApiError } from './client';
export type * from './types';

let client: GarminClient | undefined;

/** True when GARMIN_CONNECT_API_KEY is set. The value itself is never returned. */
export function hasGarminApiKey(): boolean {
  return Boolean(process.env.GARMIN_CONNECT_API_KEY);
}

/**
 * Process-wide Garmin client, built from GARMIN_CONNECT_API_KEY on first use.
 * Server-only. Only the variable name appears here; the value is never logged.
 */
export function getGarminClient(): GarminClient {
  if (!client) {
    const apiKey = process.env.GARMIN_CONNECT_API_KEY;
    if (!apiKey) throw new Error('GARMIN_CONNECT_API_KEY is not set');
    client = createGarminClient({ apiKey });
  }
  return client;
}
