import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import type { Db } from '../db/client';
import { newId } from '../db/id';
import * as schema from '../db/schema';
import { consumeEnrollmentToken, enrollIdentifier, findOwner } from './enroll';

/** Idle time after which a session is locked. Activity slides the expiry forward. */
export const IDLE_LOCK_SECONDS = 5 * 60;
/** How often an active session is written back to the database (seconds). */
const SESSION_REFRESH_SECONDS = 30;
/**
 * Passkey endpoints are public (no session yet). Cap them per client so a token cannot be
 * brute-forced and sign-in cannot be hammered. Single-user app, so the limit is generous.
 */
const PASSKEY_RATE_LIMIT = { window: 60, max: 20 } as const;

export interface AuthOptions {
  /** At least 32 random characters. */
  secret: string;
  /** Origin the app is served from, e.g. `http://localhost:3344`. Fixes the passkey RP ID. */
  origin: string;
}

const unauthorized = (message: string) => new APIError('UNAUTHORIZED', { message });

/**
 * Single-user, passkey-only auth. No sign-up, no password, no social login:
 * the only way to add a credential is an enrollment token minted from the host
 * (`npm run auth:enroll`) or an existing session.
 */
export function createAuth(db: Db, { secret, origin }: AuthOptions) {
  const rpID = new URL(origin).hostname;

  return betterAuth({
    appName: 'Garmin Coach',
    secret,
    baseURL: origin,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    advanced: { database: { generateId: () => newId() } },
    // Explicit: Better Auth enables its limiter only in production by default.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: { '/passkey/*': PASSKEY_RATE_LIMIT },
    },
    session: {
      expiresIn: IDLE_LOCK_SECONDS,
      updateAge: SESSION_REFRESH_SECONDS,
      // Revocation (Lock now) must take effect on the next request.
      cookieCache: { enabled: false },
    },
    plugins: [
      passkey({
        rpID,
        rpName: 'Garmin Coach',
        origin,
        // Discoverable credentials so sign-in needs no username; Face ID / PIN is mandatory.
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        registration: {
          requireSession: false,
          async resolveUser({ ctx, context }) {
            if (!context) throw unauthorized('Enrollment link required');
            const row = await ctx.context.internalAdapter.findVerificationValue(
              enrollIdentifier(context)
            );
            if (!row || row.expiresAt.getTime() <= Date.now()) {
              throw unauthorized('Enrollment link expired or already used');
            }
            const owner = await findOwner(db);
            if (!owner) throw unauthorized('Enrollment link expired or already used');
            return { id: owner.id, name: owner.email, displayName: owner.name };
          },
          async afterVerification({ context }) {
            // Context is only present on the enrollment-link path; a signed-in owner adding a device has none.
            if (!context) return;
            const used = await consumeEnrollmentToken(db, context);
            if (!used) throw unauthorized('Enrollment link expired or already used');
          },
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
