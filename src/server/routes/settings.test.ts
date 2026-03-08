import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns settings', async () => {
    mockCallStore.mockResolvedValueOnce({
      theme: 'dark',
      autoSave: true,
    });

    const res = await app.request('/api/settings');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.theme).toBe('dark');
    expect(json.data.autoSave).toBe(true);
    expect(mockCallStore).toHaveBeenCalledWith('getSettings', []);
  });
});

describe('PATCH /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates valid settings', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });

    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorMode: 'dark', sidebarOpen: true }),
    });

    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateSettings', [
      { colorMode: 'dark', sidebarOpen: true },
    ]);
  });

  it('filters out unknown settings keys', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });

    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorMode: 'light', unknownKey: 'bad' }),
    });

    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateSettings', [{ colorMode: 'light' }]);
  });

  it('rejects when no valid settings provided', async () => {
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknownKey: 'bad' }),
    });

    expect(res.status).toBe(400);
  });
});
