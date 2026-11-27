import { LockControls } from '@/components/lock-controls';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-4 bg-[var(--color-bg)] p-7 text-[var(--color-text)]">
      <h1 className="text-[28px] font-semibold">Garmin Coach</h1>
      <p className="text-sm text-[var(--color-muted)]">Unlocked. Screens arrive with GC-33.</p>
      <div>
        <LockControls />
      </div>
    </main>
  );
}
