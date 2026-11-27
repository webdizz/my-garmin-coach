import { connection } from 'next/server';
import { KeyBanner } from '@/components/key-banner';
import { LockControls } from '@/components/lock-controls';
import { getDb } from '@/db';
import { settingsRepo } from '@/db/repos/settings';
import { keyExpiry } from '@/you/key-expiry';
import { localDay } from '@/you/state';

export default async function Home() {
  await connection();
  const expiresOn = await settingsRepo(await getDb()).get('garmin.keyExpiresOn');
  const expiry = keyExpiry(expiresOn, localDay(new Date()));
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-4 bg-[var(--color-bg)] p-7 text-[var(--color-text)]">
      <h1 className="text-[28px] font-semibold">Garmin Coach</h1>
      <KeyBanner expiry={expiry} />
      <p className="text-sm text-[var(--color-muted)]">Unlocked. Screens arrive with GC-33.</p>
      <div>
        <LockControls />
      </div>
    </main>
  );
}
