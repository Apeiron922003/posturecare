// Installability only. No fetch handler and no cache on purpose: the model/WASM and
// app bundle must always come from the network so a deploy never serves a stale mix.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
