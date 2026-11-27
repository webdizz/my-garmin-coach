/**
 * Mint a one-time link that lets a device register a passkey.
 * Run on the host: `npm run auth:enroll`. The link expires in 15 minutes and works once.
 */
import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import {
  createEnrollmentToken,
  deleteExpiredEnrollmentTokens,
  ensureOwner,
  ENROLL_TTL_MS,
} from '../src/auth/enroll';

async function main() {
  const origin = process.env.APP_ORIGIN ?? 'http://localhost:3344';
  const db = await createDb(
    process.env.DATABASE_URL ?? 'file:./data/app.db',
    process.env.DATABASE_AUTH_TOKEN
  );
  await runMigrations(db);
  await ensureOwner(db);
  await deleteExpiredEnrollmentTokens(db);
  const { token } = await createEnrollmentToken(db);
  console.log(
    `Open on the device you want to add (valid ${ENROLL_TTL_MS / 60000} min, single use):\n`
  );
  console.log(`  ${origin}/enroll#${token}\n`);
}

main().catch((err) => {
  console.error('enroll failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
