import { DEFAULT_DAYS, describeError, getSyncService, getSyncStatus, MAX_DAYS } from '@/sync';
import { requireSession } from '@/auth';
import { getDb } from '@/db';
import { settingsRepo } from '@/db/repos/settings';
import { keyExpiry } from '@/you/key-expiry';
import { localDay } from '@/you/state';

async function status() {
  const [db, service] = await Promise.all([getDb(), getSyncService()]);
  return getSyncStatus(db, { running: service.isRunning() });
}

/** Sync state for the SYNCED banner: last pull, next pull, running/error. */
export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  return Response.json(await status());
}

/** True when Origin names another site, or is unparseable (e.g. `Origin: null`). */
function isCrossSite(origin: string | null, host: string | null): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** Manual refresh. Returns 202 at once; poll GET for progress. 409 when a pull is already running. */
export async function POST(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  // Route sits behind proxy.ts and requireSession. This also refuses cross-site form posts.
  if (isCrossSite(request.headers.get('origin'), request.headers.get('host'))) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => null);
  const days =
    (body !== null && typeof body === 'object' ? (body as { days?: unknown }).days : undefined) ??
    DEFAULT_DAYS;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return Response.json(
      { error: `days must be an integer from 1 to ${MAX_DAYS}` },
      { status: 400 }
    );
  }
  // An expired key cannot pull. Refuse before starting a run that would only fail.
  const db = await getDb();
  if (
    keyExpiry(await settingsRepo(db).get('garmin.keyExpiresOn'), localDay(new Date())).state ===
    'expired'
  ) {
    return Response.json({ error: 'keyExpired' }, { status: 409 });
  }
  const service = await getSyncService();
  if (service.isRunning()) return Response.json(await status(), { status: 409 });
  void service.run('manual', { days }).catch((err: unknown) => {
    console.error('[sync] manual pull failed:', describeError(err));
  });
  return Response.json(await status(), { status: 202 });
}
