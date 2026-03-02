import { describe, it, expect, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  it('should delay execution', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 150));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should only call once for rapid invocations', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    await new Promise((r) => setTimeout(r, 150));
    expect(fn).toHaveBeenCalledOnce();
  });
});
