import { DEFAULT_DAYS, describeError, getSyncService, getSyncStatus, MAX_DAYS } from '@/sync';
import { requireSession } from '@/auth';
import { getDb } from '@/db';

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
  const service = await getSyncService();
  if (service.isRunning()) return Response.json(await status(), { status: 409 });
  void service
    .run('manual', { days })
    .catch((err) => console.error('[sync] manual pull failed:', describeError(err)));
  return Response.json(await status(), { status: 202 });
}
