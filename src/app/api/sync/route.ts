import { DEFAULT_DAYS, getSyncService, getSyncStatus, MAX_DAYS } from '@/sync';
import { getDb } from '@/db';

export const dynamic = 'force-dynamic';

async function status() {
  const [db, service] = await Promise.all([getDb(), getSyncService()]);
  return getSyncStatus(db, { running: service.isRunning() });
}

/** Sync state for the SYNCED banner: last pull, next pull, running/error. */
export async function GET() {
  return Response.json(await status());
}

/** Manual refresh. Returns 202 at once; poll GET for progress. 409 when a pull is already running. */
export async function POST(request: Request) {
  // Single-user app with no login gate yet: refuse cross-site form posts.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { days?: unknown };
  const days = body.days ?? DEFAULT_DAYS;
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
    .catch((err) => console.error('[sync] manual pull failed:', err));
  return Response.json(await status(), { status: 202 });
}
