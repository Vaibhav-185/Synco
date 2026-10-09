import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider } from '../context/AuthContext';
import Dashboard from './Dashboard';

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } }
}));

const SLOT = { _id: 's1', day: 'Monday', startTime: '09:00', endTime: '10:00', subject: 'DC', type: 'class' };

function seedSession() {
  localStorage.setItem('synco_token', 't');
  localStorage.setItem('synco_user', JSON.stringify({ id: 'u1', displayName: 'T', username: 't', email: 't@x.com' }));
}

function mockBaseline() {
  axios.get.mockImplementation((url) => {
    if (url.endsWith('/timetable/my')) return Promise.resolve({ data: [SLOT] });
    if (url.endsWith('/timetable/status')) {
      return Promise.resolve({ data: { day: 'Monday', currentTime: '08:00', inClass: false, nextClass: null } });
    }
    return Promise.resolve({ data: {} });
  });
}

function pickFile(name = 'tt.jpg', type = 'image/jpeg', size = 75 * 1024) {
  const input = document.querySelector('#tt-upload');
  const file = new File([new ArrayBuffer(size)], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  seedSession();
  mockBaseline();
});

describe('Dashboard timetable upload', () => {
  it('successful upload shows the review step and re-enables input', async () => {
    axios.post.mockResolvedValue({ data: { preview: true, slots: [SLOT], notes: [], uncertainEntries: [] } });
    render(<AuthProvider><Dashboard /></AuthProvider>);
    await waitFor(() => expect(document.querySelector('label[for="tt-upload"]')).toBeTruthy());
    pickFile();
    await screen.findByText('Review Extracted Timetable');
    expect(document.querySelector('#tt-upload').disabled).toBe(false);
  });

  it('network failure shows an error and resets loading state', async () => {
    axios.post.mockRejectedValue(new Error('Network Error'));
    render(<AuthProvider><Dashboard /></AuthProvider>);
    await waitFor(() => expect(document.querySelector('label[for="tt-upload"]')).toBeTruthy());
    pickFile();
    await screen.findByText('Upload failed: Network Error');
    // input usable again for a retry
    expect(document.querySelector('#tt-upload').disabled).toBe(false);
    expect(document.querySelector('label[for="tt-upload"]')).toBeTruthy();
  });

  it('oversize and non-image files are rejected before any request', async () => {
    render(<AuthProvider><Dashboard /></AuthProvider>);
    await waitFor(() => expect(document.querySelector('label[for="tt-upload"]')).toBeTruthy());
    pickFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024);
    await screen.findByText(/larger than 10 MB/);
    expect(axios.post).not.toHaveBeenCalled();
    pickFile('doc.pdf', 'application/pdf', 1024);
    await screen.findByText(/not an image/);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('a stalled upload can be cancelled and retried', async () => {
    // Mirror real axios: aborting the signal rejects with a cancel error.
    axios.post.mockImplementation((url, data, config) => new Promise((_, reject) => {
      config?.signal?.addEventListener('abort', () => {
        const e = new Error('canceled');
        e.code = 'ERR_CANCELED';
        e.name = 'CanceledError';
        reject(e);
      });
    }));
    render(<AuthProvider><Dashboard /></AuthProvider>);
    await waitFor(() => expect(document.querySelector('label[for="tt-upload"]')).toBeTruthy());
    pickFile();
    const cancel = await screen.findByText('Cancel');
    expect(document.querySelector('#tt-upload').disabled).toBe(true);
    fireEvent.click(cancel);
    await screen.findByText('Upload cancelled. Your current timetable is unchanged.');
    expect(document.querySelector('#tt-upload').disabled).toBe(false);
  });

  it('loading flag always resets (finally) even on unexpected throws', async () => {
    axios.post.mockRejectedValue({ response: { data: {} } }); // no message anywhere
    render(<AuthProvider><Dashboard /></AuthProvider>);
    await waitFor(() => expect(document.querySelector('label[for="tt-upload"]')).toBeTruthy());
    pickFile();
    await waitFor(() => expect(document.querySelector('#tt-upload').disabled).toBe(false));
  });
});
