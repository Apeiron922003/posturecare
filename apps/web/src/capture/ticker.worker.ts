// Dedicated-worker interval source. Browsers throttle main-thread timers (and stop
// requestAnimationFrame) in hidden tabs; worker timers are not throttled the same
// way, and their messages still wake the page. Measured, not assumed — see bgStats.
type Msg = { op: "start"; id: number; ms: number } | { op: "stop"; id: number };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Msg>) => void) | null;
  postMessage(message: unknown): void;
};
const timers = new Map<number, ReturnType<typeof setInterval>>();

ctx.onmessage = (e) => {
  const msg = e.data;
  clearInterval(timers.get(msg.id));
  timers.delete(msg.id);
  if (msg.op === "start") timers.set(msg.id, setInterval(() => ctx.postMessage(msg.id), msg.ms));
};
