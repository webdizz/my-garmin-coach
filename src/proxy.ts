import { NextResponse, type NextRequest } from 'next/server';
import { getAuth } from '@/auth';
import { decideAccess, isPublicPath } from '@/auth/gate';

/**
 * Gate in front of every route. Validates the session against the database (Node runtime)
 * and forwards the refreshed cookie so activity slides the 5 minute idle lock forward.
 * Route handlers re-check the session themselves; this is not the only line of defence.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  let refreshed: Headers | undefined;
  let hasSession = false;
  try {
    const auth = await getAuth();
    const result = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
    hasSession = result.response !== null;
    refreshed = result.headers;
  } catch (err) {
    console.error('[auth] session check failed:', err instanceof Error ? err.message : 'unknown');
  }

  const decision = decideAccess(pathname, hasSession);
  if (decision === 'unauthorized') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (decision === 'redirect-login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const response = NextResponse.next();
  for (const cookie of refreshed?.getSetCookie() ?? [])
    response.headers.append('set-cookie', cookie);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
