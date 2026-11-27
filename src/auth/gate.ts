/** Paths reachable without a session. Everything else is gated by `proxy.ts`. */
const PUBLIC_EXACT = new Set(['/login', '/enroll']);
const PUBLIC_PREFIXES = ['/api/auth/'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export type GateDecision = 'allow' | 'redirect-login' | 'unauthorized';

/** API callers get a 401; page requests are sent to the login screen. */
export function decideAccess(pathname: string, hasSession: boolean): GateDecision {
  if (isPublicPath(pathname) || hasSession) return 'allow';
  return pathname.startsWith('/api/') ? 'unauthorized' : 'redirect-login';
}
