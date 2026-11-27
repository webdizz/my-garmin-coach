/** @jest-environment node */
import { createAuth, IDLE_LOCK_SECONDS } from '../config';
import {
  consumeEnrollmentToken,
  createEnrollmentToken,
  deleteExpiredEnrollmentTokens,
  ENROLL_TTL_MS,
  enrollIdentifier,
  ensureOwner,
} from '../enroll';
import { getLoginStatus } from '../status';
import { createTestDb } from '../../db/testing';
import { syncRunRepo } from '../../db/repos/sync-run';
import { verification } from '../../db/schema';

const ORIGIN = 'http://localhost:3344';
const SECRET = 'test-secret-test-secret-test-secret-0123';

async function setup() {
  const db = await createTestDb();
  const auth = createAuth(db, { secret: SECRET, origin: ORIGIN });
  const headers = new Headers({ origin: ORIGIN, host: 'localhost:3344' });
  return { db, auth, headers };
}

describe('enrollment tokens', () => {
  it('stores only a hash, with a 15 minute expiry', async () => {
    const { db } = await setup();
    const now = new Date('2030-01-01T00:00:00Z');
    const { token, expiresAt } = await createEnrollmentToken(db, now);
    const rows = await db.select().from(verification);
    expect(rows).toHaveLength(1);
    expect(rows[0].identifier).toBe(enrollIdentifier(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(expiresAt.getTime() - now.getTime()).toBe(ENROLL_TTL_MS);
  });

  it('ensureOwner is idempotent', async () => {
    const { db } = await setup();
    const a = await ensureOwner(db);
    const b = await ensureOwner(db);
    expect(b.id).toBe(a.id);
  });
});

describe('auth config', () => {
  it('has no session without a cookie', async () => {
    const { auth, headers } = await setup();
    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it('exposes no sign-up or password sign-in', async () => {
    const { auth, headers } = await setup();
    for (const path of ['/sign-up/email', '/sign-in/email']) {
      const res = await auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method: 'POST',
          headers: { ...Object.fromEntries(headers), 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'a@b.c', password: 'password1234', name: 'x' }),
        })
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('locks sessions after 5 idle minutes', () => {
    expect(IDLE_LOCK_SECONDS).toBe(300);
  });

  it('refuses passkey registration without an enrollment link or session', async () => {
    const db = await createTestDb();
    const auth = createAuth(db, { secret: SECRET, origin: ORIGIN });
    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth/passkey/generate-register-options`, {
        headers: new Headers({ origin: ORIGIN, host: 'localhost:3344' }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('refuses a bad enrollment token', async () => {
    const { db, auth, headers } = await setup();
    await ensureOwner(db);
    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth/passkey/generate-register-options?context=nope`, { headers })
    );
    expect(res.status).toBe(401);
  });

  it('refuses an expired enrollment token', async () => {
    const { db, auth, headers } = await setup();
    await ensureOwner(db);
    const { token } = await createEnrollmentToken(db, new Date(Date.now() - 2 * ENROLL_TTL_MS));
    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth/passkey/generate-register-options?context=${token}`, {
        headers,
      })
    );
    expect(res.status).toBe(401);
  });

  it('issues registration options for a valid token, bound to the localhost RP ID', async () => {
    const { db, auth, headers } = await setup();
    await ensureOwner(db);
    const { token } = await createEnrollmentToken(db);
    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth/passkey/generate-register-options?context=${token}`, {
        headers,
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rp: { id: string };
      authenticatorSelection: { residentKey: string; userVerification: string };
    };
    expect(body.rp.id).toBe('localhost');
    expect(body.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
    });
  });
});

describe('login status', () => {
  it('reports key presence only, never the key', async () => {
    const db = await createTestDb();
    const status = await getLoginStatus(db, { GARMIN_CONNECT_API_KEY: 'super-secret' });
    expect(status).toEqual({ garminKey: 'configured', lastSyncAt: null });
    expect(JSON.stringify(status)).not.toContain('super-secret');
    expect((await getLoginStatus(db, {})).garminKey).toBe('missing');
  });

  it('returns the last successful sync time', async () => {
    const db = await createTestDb();
    const runs = syncRunRepo(db);
    const run = await runs.start('manual');
    await runs.finish(run.id);
    expect((await getLoginStatus(db, {})).lastSyncAt).toBeInstanceOf(Date);
  });
});

describe('enrollment token consumption', () => {
  it('accepts a live token once, then refuses it (single use)', async () => {
    const db = await createTestDb();
    const { token } = await createEnrollmentToken(db);
    expect(await consumeEnrollmentToken(db, token)).toBe(true);
    expect(await consumeEnrollmentToken(db, token)).toBe(false);
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it('refuses an expired token and leaves no row behind', async () => {
    const db = await createTestDb();
    const { token } = await createEnrollmentToken(db, new Date(Date.now() - 2 * ENROLL_TTL_MS));
    expect(await consumeEnrollmentToken(db, token)).toBe(false);
  });

  it('refuses an unknown token', async () => {
    const db = await createTestDb();
    expect(await consumeEnrollmentToken(db, 'not-issued')).toBe(false);
  });

  it('deletes only expired enrollment tokens', async () => {
    const db = await createTestDb();
    const now = new Date();
    const expired = await createEnrollmentToken(db, new Date(now.getTime() - 2 * ENROLL_TTL_MS));
    const live = await createEnrollmentToken(db, now);
    await deleteExpiredEnrollmentTokens(db, now);
    const rows = await db.select().from(verification);
    expect(rows.map((r) => r.identifier)).toEqual([enrollIdentifier(live.token)]);
    expect(rows.map((r) => r.identifier)).not.toContain(enrollIdentifier(expired.token));
  });
});
