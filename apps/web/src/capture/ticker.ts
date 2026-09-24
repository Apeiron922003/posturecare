type Fn = () => void;

let worker: Worker | null | undefined;
const fns = new Map<number, Fn>();
let nextId = 1;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./ticker.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<number>) => fns.get(e.data)?.();
  } catch {
    worker = null;
  }
  return worker;
}

/** setInterval driven from a Worker so it keeps firing while the tab is hidden. */
export function every(ms: number, fn: Fn): () => void {
  const w = getWorker();
  if (!w) {
    const id = window.setInterval(fn, ms);
    return () => clearInterval(id);
  }
  const id = nextId++;
  fns.set(id, fn);
  w.postMessage({ op: "start", id, ms });
  return () => {
    fns.delete(id);
    w.postMessage({ op: "stop", id });
  };
}
