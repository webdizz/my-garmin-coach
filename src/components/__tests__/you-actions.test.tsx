/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AddNiggle, KeyExpiryForm, RefreshNow, ResolveNiggle } from '@/you/actions';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), refresh }),
}));

const fetchMock = jest.fn();

/** Reads the JSON body of the nth fetch call. */
const bodyOf = (call: number): unknown => JSON.parse(String(fetchMock.mock.calls[call][1].body));

/** jsdom has no Response global; the actions only read `ok` and `status`. */
const res = (status: number) => ({ ok: status >= 200 && status < 300, status });

describe('you actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as typeof fetch;
  });

  it('AddNiggle posts the label and refreshes the screen', async () => {
    fetchMock.mockResolvedValue(res(201));
    render(<AddNiggle />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Left calf' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/you', expect.objectContaining({ method: 'POST' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('AddNiggle shows an error when the server refuses', async () => {
    fetchMock.mockResolvedValue(res(400));
    render(<AddNiggle />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Calf' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ResolveNiggle posts the niggle id', async () => {
    fetchMock.mockResolvedValue(res(200));
    render(<ResolveNiggle id="01ABC" label="Calf" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark Calf resolved' }));
    });
    expect(fetchMock.mock.calls[0][1].body).toContain('01ABC');
  });

  it('RefreshNow treats a 409 (already running) as not an error', async () => {
    fetchMock.mockResolvedValue(res(409));
    render(<RefreshNow />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it('RefreshNow reports a real failure', async () => {
    fetchMock.mockResolvedValue(res(500));
    render(<RefreshNow />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not start a refresh');
  });

  it('KeyExpiryForm saves the date, and sends null when cleared', async () => {
    fetchMock.mockResolvedValue(res(201));
    render(<KeyExpiryForm current="2030-06-01" />);
    const input = screen.getByLabelText(/Key expires on/);
    expect(input).toHaveValue('2030-06-01');
    fireEvent.change(input, { target: { value: '2030-07-01' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save expiry' }));
    });
    expect(bodyOf(0)).toEqual({
      action: 'setKeyExpiry',
      expiresOn: '2030-07-01',
    });
    fireEvent.change(input, { target: { value: '' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save expiry' }));
    });
    expect(bodyOf(1)).toEqual({
      action: 'setKeyExpiry',
      expiresOn: null,
    });
  });

  it('KeyExpiryForm shows an error when the server refuses', async () => {
    fetchMock.mockResolvedValue(res(400));
    render(<KeyExpiryForm current={null} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save expiry' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  });
});
