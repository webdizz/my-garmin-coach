'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Screens that exist. Others are shown disabled until their ticket lands. */
const TABS = [
  { label: 'Today', href: '/', enabled: true, icon: <TodayIcon /> },
  { label: 'Plan', href: '/plan', enabled: false, icon: <PlanIcon /> },
  { label: 'Trends', href: '/trends', enabled: false, icon: <TrendsIcon /> },
  { label: 'Coach', href: '/coach', enabled: false, icon: <CoachIcon /> },
  { label: 'You', href: '/you', enabled: true, icon: <YouIcon /> },
] as const;

/** Icon paths match docs/mockup/index.html. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[22px] w-[22px] fill-none stroke-current"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function TodayIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </Icon>
  );
}
function PlanIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  );
}
function TrendsIcon() {
  return (
    <Icon>
      <path d="M3 17l5-6 4 3 8-9" />
      <path d="M15 5h5v5" />
    </Icon>
  );
}
function CoachIcon() {
  return (
    <Icon>
      <path d="M4 5h16v11H9l-5 4z" />
    </Icon>
  );
}
function YouIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </Icon>
  );
}

/** Paths without a session: no tab bar on the unlock or enrollment screens. */
const HIDDEN_ON = new Set(['/login', '/enroll']);

export function TabNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.has(pathname)) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] justify-around border-t border-[var(--color-line)] bg-[var(--color-nav-bg)] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[10px] font-semibold tracking-wide"
    >
      {TABS.map((tab) =>
        tab.enabled ? (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={pathname === tab.href ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-[3px] py-1.5 ${
              pathname === tab.href ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        ) : (
          <span
            key={tab.href}
            aria-disabled="true"
            className="flex flex-1 flex-col items-center gap-[3px] py-1.5 text-[var(--color-dimmed)]"
          >
            {tab.icon}
            {tab.label}
          </span>
        )
      )}
    </nav>
  );
}
