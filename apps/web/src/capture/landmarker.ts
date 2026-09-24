import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";

export async function createLandmarker(): Promise<FaceLandmarker> {
  const files = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const opts = {
    baseOptions: { modelAssetPath: "/models/face_landmarker.task" },
    runningMode: "VIDEO" as const,
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
    outputFaceBlendshapes: false,
  };
  try {
    return await FaceLandmarker.createFromOptions(files, {
      ...opts,
      baseOptions: { ...opts.baseOptions, delegate: "GPU" },
    });
  } catch {
    return FaceLandmarker.createFromOptions(files, {
      ...opts,
      baseOptions: { ...opts.baseOptions, delegate: "CPU" },
    });
  }
}

export function detect(landmarker: FaceLandmarker, video: HTMLVideoElement, ts: number): FaceLandmarkerResult {
  return landmarker.detectForVideo(video, ts);
}
