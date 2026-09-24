import { CAPTURE_RESOLUTION } from "../signals/constants";

export type CameraErrorKind = "denied" | "missing" | "busy" | "insecure" | "other";

export function cameraErrorMessage(err: unknown): CameraErrorKind {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  // Another app (Zoom, Meet, OBS…) or another browser holds the device.
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  // getUserMedia is undefined outside HTTPS/localhost (WEB-001).
  if (name === "TypeError" && typeof navigator !== "undefined" && !navigator.mediaDevices) return "insecure";
  return "other";
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "videoinput");
}

export async function openCamera(deviceId?: string): Promise<MediaStream> {
  const video: MediaTrackConstraints = {
    width: { ideal: CAPTURE_RESOLUTION.width },
    height: { ideal: CAPTURE_RESOLUTION.height },
    facingMode: deviceId ? undefined : "user",
    deviceId: deviceId ? { exact: deviceId } : undefined,
  };
  return navigator.mediaDevices.getUserMedia({ video, audio: false });
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}
