import { requireSession } from '@/auth';
import { getDb } from '@/db';
import { settingsRepo } from '@/db/repos/settings';
import { youProfileRepo, ProfileInputError, parseFeeling } from '@/db/repos/you-profile';
import { parseKeyExpiry } from '@/you/key-expiry';
import { localDay } from '@/you/state';

/** True when Origin names another site, or is unparseable (e.g. `Origin: null`). Same rule as /api/sync. */
function isCrossSite(origin: string | null, host: string | null): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

const bad = (message: string) => Response.json({ error: message }, { status: 400 });

/**
 * User-driven edits on the You screen. One POST endpoint, dispatched on `action`.
 * Guarded like /api/sync: session first, then cross-site origin, then validation.
 * Request bodies hold health data: errors name the field only, bodies are never logged.
 */
export async function POST(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  if (isCrossSite(request.headers.get('origin'), request.headers.get('host'))) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (body === null || typeof body !== 'object') return bad('body must be a JSON object');
  const input = body as Record<string, unknown>;
  const repo = youProfileRepo(await getDb());
  const today = localDay(new Date());

  try {
    switch (input.action) {
      case 'feeling':
        await repo.setFeeling(today, parseFeeling(input.feeling));
        return Response.json({ ok: true });
      case 'addNiggle':
        await repo.addNiggle({
          label: input.label,
          bodyArea: input.bodyArea,
          severity: input.severity,
          note: input.note,
          startedOn: today,
        });
        return Response.json({ ok: true }, { status: 201 });
      case 'resolveNiggle': {
        if (typeof input.id !== 'string') return bad('id is required');
        const found = await repo.resolveNiggle(input.id, today);
        return found
          ? Response.json({ ok: true })
          : Response.json({ error: 'not found' }, { status: 404 });
      }
      case 'setGoal':
        await repo.setGoal({ event: input.event, date: input.date, target: input.target });
        return Response.json({ ok: true }, { status: 201 });
      case 'setKeyExpiry': {
        const expiresOn = parseKeyExpiry(input.expiresOn);
        const settings = settingsRepo(await getDb());
        if (expiresOn === null) await settings.delete('garmin.keyExpiresOn');
        else await settings.set('garmin.keyExpiresOn', expiresOn);
        return Response.json({ ok: true }, { status: 201 });
      }
      default:
        return bad('unknown action');
    }
  } catch (err) {
    if (err instanceof ProfileInputError) return bad(err.message);
    throw err;
  }
}
