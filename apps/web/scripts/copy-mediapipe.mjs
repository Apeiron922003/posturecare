import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDest = join(root, "public/mediapipe/wasm");
mkdirSync(wasmDest, { recursive: true });
if (existsSync(wasmSrc)) {
  for (const name of readdirSync(wasmSrc)) {
    copyFileSync(join(wasmSrc, name), join(wasmDest, name));
  }
}

const modelDir = join(root, "public/models");
mkdirSync(modelDir, { recursive: true });
const modelPath = join(modelDir, "face_landmarker.task");
if (!existsSync(modelPath)) {
  const url =
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    await import("node:fs/promises").then((fs) => fs.writeFile(modelPath, buf));
    console.log("downloaded face_landmarker.task");
  } catch (err) {
    console.warn("could not download FaceLandmarker model:", err);
  }
}
