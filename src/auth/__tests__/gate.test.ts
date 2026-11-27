import { decideAccess, isPublicPath } from '../gate';

describe('gate', () => {
  it.each(['/login', '/enroll', '/api/auth/sign-in/passkey', '/api/auth/get-session'])(
    '%s is public',
    (p) => {
      expect(isPublicPath(p)).toBe(true);
    }
  );

  it.each(['/', '/trends', '/api/sync', '/api/authx', '/login/extra', '/enroll/x'])(
    '%s is gated',
    (p) => {
      expect(isPublicPath(p)).toBe(false);
    }
  );

  it('redirects unauthenticated pages to login', () => {
    expect(decideAccess('/', false)).toBe('redirect-login');
    expect(decideAccess('/trends', false)).toBe('redirect-login');
  });

  it('returns 401 for unauthenticated API calls', () => {
    expect(decideAccess('/api/sync', false)).toBe('unauthorized');
  });

  it('allows a valid session and public paths', () => {
    expect(decideAccess('/', true)).toBe('allow');
    expect(decideAccess('/api/sync', true)).toBe('allow');
    expect(decideAccess('/login', false)).toBe('allow');
  });
});
