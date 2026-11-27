/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { KeyBanner } from '../key-banner';

// Synthetic dates only.
describe('KeyBanner', () => {
  it('shows nothing while the key is fine or the date is unknown', () => {
    const { container, rerender } = render(
      <KeyBanner expiry={{ state: 'ok', expiresOn: '2030-06-01', daysLeft: 83 }} />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<KeyBanner expiry={{ state: 'unknown' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns with the days left when expiring', () => {
    render(<KeyBanner expiry={{ state: 'expiring', expiresOn: '2030-03-20', daysLeft: 10 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Garmin key expires in 10 days');
  });

  it('uses the singular for one day', () => {
    render(<KeyBanner expiry={{ state: 'expiring', expiresOn: '2030-03-11', daysLeft: 1 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('expires in 1 day');
  });

  it('shows the expired state with recovery steps as an alert', () => {
    render(<KeyBanner expiry={{ state: 'expired', expiresOn: '2030-03-09', daysLeft: -1 }} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Garmin key expired on 2030-03-09');
    expect(alert).toHaveTextContent('Data refresh is paused');
  });
});
