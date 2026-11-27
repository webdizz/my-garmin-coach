/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { FeelingPills } from '@/you/actions';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));

describe('FeelingPills', () => {
  it('marks the current feeling as pressed and the others as not', () => {
    render(<FeelingPills current="good" />);
    expect(screen.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tired' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders all five feelings with none pressed when nothing is set', () => {
    render(<FeelingPills current={null} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    for (const b of screen.getAllByRole('button')) {
      expect(b).toHaveAttribute('aria-pressed', 'false');
    }
  });
});
