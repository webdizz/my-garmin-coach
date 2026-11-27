import type { Db } from '../db/client';
import { syncRunRepo } from '../db/repos/sync-run';

export interface LoginStatus {
  /** Whether the Garmin key is configured. The key itself never leaves the server. */
  garminKey: 'configured' | 'missing';
  lastSyncAt: Date | null;
}

/** Non-sensitive facts shown on the login screen before the user is authenticated. */
export async function getLoginStatus(
  db: Db,
  env: Record<string, string | undefined> = process.env
): Promise<LoginStatus> {
  const last = await syncRunRepo(db).lastSuccess();
  return {
    garminKey: env.GARMIN_CONNECT_API_KEY ? 'configured' : 'missing',
    lastSyncAt: last?.finishedAt ?? null,
  };
}
