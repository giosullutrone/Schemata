import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/canvas/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns search results for q=User*', async () => {
    const mockResults = [
      { id: 'n1', type: 'classNode', label: 'UserService' },
      { id: 'n2', type: 'classNode', label: 'UserRepository' },
    ];
    mockCallStore.mockResolvedValueOnce(mockResults);

    const res = await app.request('/api/canvas/search?q=User*');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data).toEqual(mockResults);
    expect(mockCallStore).toHaveBeenCalledWith('search', ['User*', undefined]);
  });

  it('passes type filter to callStore', async () => {
    mockCallStore.mockResolvedValueOnce([]);

    const res = await app.request('/api/canvas/search?q=User*&type=classNode');
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('search', ['User*', 'classNode']);
  });

  it('returns 400 when q is missing', async () => {
    const res = await app.request('/api/canvas/search');
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error).toBe('Missing query parameter q');
    expect(mockCallStore).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid type filter', async () => {
    const res = await app.request('/api/canvas/search?q=User*&type=invalidType');
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error).toContain('type must be one of');
    expect(mockCallStore).not.toHaveBeenCalled();
  });
});
