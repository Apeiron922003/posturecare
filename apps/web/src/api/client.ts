import type { GovernorSnapshot } from "../governor";
import type { Rules } from "../detectors";

const TOKEN = "posturecare.device_token";

export function deviceToken(): string {
  let t = localStorage.getItem(TOKEN);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(TOKEN, t);
  }
  return t;
}

export function tabId(): string {
  let t = sessionStorage.getItem("posturecare.tab_id");
  if (!t) {
    t = crypto.randomUUID();
    sessionStorage.setItem("posturecare.tab_id", t);
  }
  return t;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Device-Token", deviceToken());
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(typeof body === "object" && body && "detail" in body ? String((body as { detail: string }).detail) : res.statusText);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return body as T;
}

export type SessionView = {
  session_id: string;
  state: string;
  grace_sec: number;
  owner_live: boolean;
  lease_generation: number;
  exposure_sec: number;
  governor_state: GovernorSnapshot;
  you_are_leader?: boolean;
};

export const api = {
  start: (tid: string) => req<SessionView>("/api/sessions/start", { method: "POST", body: JSON.stringify({ tab_id: tid }) }),
  get: (id: string) => req<SessionView>(`/api/sessions/${id}`),
  takeover: (id: string, tid: string) =>
    req<SessionView>(`/api/sessions/${id}/takeover`, { method: "POST", body: JSON.stringify({ tab_id: tid }) }),
  heartbeat: (
    id: string,
    body: { tab_id: string; lease_generation: number; face_present: boolean; governor_state?: GovernorSnapshot },
  ) => req<SessionView>(`/api/sessions/${id}/heartbeat`, { method: "POST", body: JSON.stringify(body) }),
  stop: (id: string, tid: string) =>
    req<{ state: string }>(`/api/sessions/${id}/stop`, { method: "POST", body: JSON.stringify({ tab_id: tid }) }),
  readings: (id: string, readings: unknown[]) =>
    req<void>(`/api/sessions/${id}/readings`, { method: "POST", body: JSON.stringify({ readings }) }),
  action: (id: string, tid: string, lease: number, type: string) =>
    req<{ governor_state: GovernorSnapshot; state: string }>(`/api/sessions/${id}/actions`, {
      method: "POST",
      body: JSON.stringify({ tab_id: tid, lease_generation: lease, type }),
    }),
  rules: () => req<Rules>("/api/rules"),
  putRules: (rules: Partial<Rules>) => req<void>("/api/rules", { method: "PUT", body: JSON.stringify({ rules }) }),
  report: (id: string) => req<ReportPayload>(`/api/sessions/${id}/report`),
};

export type ReportPayload = {
  session_id: string;
  state: string;
  exposure_sec: number;
  flag_durations_sec: Record<string, number>;
  blink_count: number;
  timeline: { t: number; n: number; flags: number }[];
};
