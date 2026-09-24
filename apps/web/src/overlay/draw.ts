import type { Landmark } from "../signals/pose";

export function drawOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: Landmark[] | undefined,
  pose: { pitch: number; yaw: number; roll: number } | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = video.videoWidth || canvas.clientWidth;
  canvas.height = video.videoHeight || canvas.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (!landmarks?.length) return;
  ctx.fillStyle = "#5eead4";
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * canvas.width, p.y * canvas.height, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pose) {
    const nose = landmarks[1];
    if (nose) {
      const x = nose.x * canvas.width;
      const y = nose.y * canvas.height;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + pose.yaw * 3, y - pose.pitch * 3);
      ctx.stroke();
    }
  }
}
