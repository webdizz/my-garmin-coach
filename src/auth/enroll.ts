import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { Db } from '../db/client';
import { newId } from '../db/id';
import { user, verification } from '../db/schema';

/** How long a CLI-minted enrollment link stays valid. */
export const ENROLL_TTL_MS = 15 * 60 * 1000;

const OWNER_EMAIL = 'owner@garmin-coach.local';

/** Only the hash is stored, so a copy of the database cannot be used to enroll a device. */
export function enrollIdentifier(token: string): string {
  return `enroll:${createHash('sha256').update(token).digest('hex')}`;
}

/** The single owner row. Created on first enrollment; the app never creates users any other way. */
export async function ensureOwner(db: Db) {
  const [existing] = await db.select().from(user).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(user)
    .values({ id: newId(), name: 'Owner', email: OWNER_EMAIL, emailVerified: true })
    .returning();
  return created;
}

export async function findOwner(db: Db) {
  const [owner] = await db.select().from(user).limit(1);
  return owner;
}

/** Mint a one-time enrollment token. The plain token is returned once and never stored. */
export async function createEnrollmentToken(
  db: Db,
  now: Date = new Date()
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + ENROLL_TTL_MS);
  await db.insert(verification).values({
    id: newId(),
    identifier: enrollIdentifier(token),
    value: 'enroll',
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Atomically consume a live enrollment token. Returns true only for the first caller;
 * a second use, an expired token or an unknown token returns false.
 */
export async function consumeEnrollmentToken(
  db: Db,
  token: string,
  now: Date = new Date()
): Promise<boolean> {
  const rows = await db
    .delete(verification)
    .where(
      and(
        eq(verification.identifier, enrollIdentifier(token)),
        eq(verification.value, 'enroll'),
        gt(verification.expiresAt, now)
      )
    )
    .returning({ id: verification.id });
  return rows.length === 1;
}

/** Remove enrollment tokens whose expiry has passed. Unexpired tokens are left alone. */
export async function deleteExpiredEnrollmentTokens(db: Db, now: Date = new Date()): Promise<void> {
  await db
    .delete(verification)
    .where(and(eq(verification.value, 'enroll'), lte(verification.expiresAt, now)));
}
