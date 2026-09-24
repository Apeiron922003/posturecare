// Cloudflare Pages Function: proxies /api/* to the Fly.io API so the browser
// only ever talks to this Pages origin (same-origin, no CORS, X-Device-Token
// passes through untouched). `_redirects` can't do this — 200 rewrites there
// only cover internal assets, not an external origin.
const API_ORIGIN = "https://posturecare-api.fly.dev";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = new URL(url.pathname + url.search, API_ORIGIN);

  const upstream = new Request(target, context.request);
  // Behind this proxy Fly only sees Cloudflare's egress IP; pass the visitor IP for
  // the API's per-client rate limit (ratelimit.py). Overwrite, never trust a client value.
  upstream.headers.set("X-PostureCare-Client-IP", context.request.headers.get("CF-Connecting-IP") ?? "");
  return fetch(upstream);
};
