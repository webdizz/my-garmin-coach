import { connection } from 'next/server';
import { KeyBanner } from '@/components/key-banner';
import { getDb } from '@/db';
import { settingsRepo } from '@/db/repos/settings';
import { syncRunRepo } from '@/db/repos/sync-run';
import { keyExpiry } from '@/you/key-expiry';
import { localDay } from '@/you/state';

/** Server component: reads the typed key date and the key-rejection streak for the Today screen. */
export default async function HomeKeyStatus() {
  await connection();
  const db = await getDb();
  const [expiresOn, streak] = await Promise.all([
    settingsRepo(db).get('garmin.keyExpiresOn'),
    syncRunRepo(db).keyInvalidStreak(),
  ]);
  const expiry = keyExpiry(expiresOn, localDay(new Date()));
  return <KeyBanner expiry={expiry} invalid={streak.count > 0} />;
}
