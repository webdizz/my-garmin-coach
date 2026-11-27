/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { TabNav } from '../tab-nav';

let pathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

describe('TabNav', () => {
  it('shows the enabled tabs as links and the rest as disabled', () => {
    pathname = '/';
    render(<TabNav />);
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'You' })).toHaveAttribute('href', '/you');
    expect(screen.getByText('Plan')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: 'Plan' })).toBeNull();
  });

  it('marks the current tab with aria-current', () => {
    pathname = '/you';
    render(<TabNav />);
    expect(screen.getByRole('link', { name: 'You' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('renders nothing on the login and enroll screens', () => {
    for (const p of ['/login', '/enroll']) {
      pathname = p;
      const { container, unmount } = render(<TabNav />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
