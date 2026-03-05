type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

interface ViteWs {
  on: (event: string, cb: (data: unknown, client: unknown) => void) => void;
  send: (event: string, data: unknown) => void;
}

const pending = new Map<string, PendingRequest>();
let viteWs: ViteWs | null = null;
let idCounter = 0;

export function initBridge(ws: ViteWs): void {
  viteWs = ws;
  ws.on('canvas:response', (data: unknown) => {
    const { id, result, error } = data as { id: string; result?: unknown; error?: string };
    const req = pending.get(id);
    if (!req) return;
    pending.delete(id);
    clearTimeout(req.timer);
    if (error) req.reject(new Error(error));
    else req.resolve(result);
  });
}

export function callStore(action: string, args: unknown[] = []): Promise<unknown> {
  if (!viteWs) return Promise.reject(new Error('Bridge not initialized'));
  return new Promise((resolve, reject) => {
    const id = `req-${++idCounter}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Bridge timeout — is the browser tab open?'));
    }, 10_000);
    pending.set(id, { resolve, reject, timer });
    viteWs!.send('canvas:request', { id, action, args });
  });
}

export function resetBridge(): void {
  for (const req of pending.values()) {
    clearTimeout(req.timer);
  }
  pending.clear();
  viteWs = null;
  idCounter = 0;
}
