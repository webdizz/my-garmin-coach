import type { KeyExpiry } from '@/you/key-expiry';

/**
 * Garmin key warning for the Today screen. Renders nothing while the key is fine or its
 * date is unknown. `invalid`: Garmin rejected the key (401), rose, whatever the typed date says.
 * Expiring: amber, with days left. Expired: rose, with renewal steps.
 */
export function KeyBanner({ expiry, invalid = false }: { expiry: KeyExpiry; invalid?: boolean }) {
  if (invalid) {
    return (
      <div role="alert" className="rounded-xl border border-[var(--color-bad)] p-3 text-[14px]">
        <p className="font-medium text-[var(--color-bad)]">Garmin rejected the key</p>
        <p className="text-[13px] text-[var(--color-muted)]">
          Data refresh is paused and retried less often. Create a new key in Garmin Connect, set
          GARMIN_CONNECT_API_KEY on the server, restart it, set the new expiry date on the You
          screen, then tap Sync. Scheduled pulls resume only after a pull succeeds.
        </p>
      </div>
    );
  }
  if (expiry.state === 'expiring') {
    const days = expiry.daysLeft === 1 ? '1 day' : `${expiry.daysLeft} days`;
    return (
      <div role="status" className="rounded-xl border border-[var(--border-warn)] p-3 text-[14px]">
        <p className="font-medium text-[var(--color-warn)]">Garmin key expires in {days}</p>
        <p className="text-[13px] text-[var(--color-muted)]">
          Create a new key in Garmin Connect, then update the server and the expiry date on the You
          screen.
        </p>
      </div>
    );
  }
  if (expiry.state === 'expired') {
    return (
      <div role="alert" className="rounded-xl border border-[var(--color-bad)] p-3 text-[14px]">
        <p className="font-medium text-[var(--color-bad)]">
          Garmin key expired on {expiry.expiresOn}
        </p>
        <p className="text-[13px] text-[var(--color-muted)]">
          Data refresh is paused. Create a new key in Garmin Connect, set GARMIN_CONNECT_API_KEY on
          the server, restart it, then set the new expiry date on the You screen.
        </p>
      </div>
    );
  }
  return null;
}
