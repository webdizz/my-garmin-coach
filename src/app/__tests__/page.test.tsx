/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import Home from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));
jest.mock('@/auth/client', () => ({
  authClient: { signOut: jest.fn(), getSession: jest.fn() },
}));

describe('Home page', () => {
  it('renders without crashing', () => {
    render(<Home />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('offers a Lock now action', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: 'Lock now' })).toBeInTheDocument();
  });
});
