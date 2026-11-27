import 'server-only';
import { getDb } from '../db';
import { createAuth, type Auth } from './config';

const DEFAULT_ORIGIN = 'http://localhost:3344';

function readAuthEnv(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set to at least 32 random characters (e.g. `openssl rand -base64 32`)'
    );
  }
  return { secret, origin: env.APP_ORIGIN ?? DEFAULT_ORIGIN };
}

/** Instrumentation and route handlers are bundled separately, so share the instance through globalThis. */
const KEY = Symbol.for('garmin-coach.auth');
const shared = globalThis as Record<symbol, Promise<Auth> | undefined>;

export function getAuth(): Promise<Auth> {
  shared[KEY] ??= getDb()
    .then((db) => createAuth(db, readAuthEnv()))
    .catch((err: unknown) => {
      shared[KEY] = undefined;
      throw err;
    });
  return shared[KEY];
}

/** The current session for these request headers, or null. Re-verify in every route handler. */
export async function getSession(headers: Headers) {
  const auth = await getAuth();
  return auth.api.getSession({ headers });
}

/** Route-handler guard: a 401 response when there is no valid session, otherwise null. */
export async function requireSession(request: Request): Promise<Response | null> {
  const session = await getSession(request.headers);
  return session ? null : Response.json({ error: 'unauthorized' }, { status: 401 });
}
