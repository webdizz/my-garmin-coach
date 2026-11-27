import { EnrollForm } from './enroll-form';

export const metadata = { title: 'Add this device · Garmin Coach' };

export default function EnrollPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center bg-[var(--color-bg)] px-7 text-[var(--color-text)]">
      <h1 className="text-[28px] font-semibold">Add this device</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Creates a passkey on this device so Face ID can unlock the app.
      </p>
      <EnrollForm />
    </main>
  );
}
