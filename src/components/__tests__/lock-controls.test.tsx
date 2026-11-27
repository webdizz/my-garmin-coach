/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LockControls } from '../lock-controls';

const replace = jest.fn();
const refresh = jest.fn();
const signOut = jest.fn(async () => ({}));
const getSession = jest.fn(async () => ({}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));
jest.mock('@/auth/client', () => ({
  authClient: {
    signOut: () => signOut(),
    getSession: () => getSession(),
  },
}));

describe('LockControls', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('signs out and returns to /login when Lock now is clicked', async () => {
    render(<LockControls />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lock now' }));
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
    expect(refresh).toHaveBeenCalled();
  });

  it('locks automatically after 5 minutes of inactivity', async () => {
    render(<LockControls />);
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('keeps the session alive on activity, pinging at most every 30 seconds', async () => {
    render(<LockControls />);
    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
      window.dispatchEvent(new Event('pointerdown'));
      window.dispatchEvent(new Event('keydown'));
    });
    expect(getSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(4 * 60 * 1000);
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('stops listening for activity after unmount', () => {
    const { unmount } = render(<LockControls />);
    unmount();
    window.dispatchEvent(new Event('scroll'));
    expect(getSession).not.toHaveBeenCalled();
  });
});
