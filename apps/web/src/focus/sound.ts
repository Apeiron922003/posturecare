import type { AmbientId } from "./storage";

// No bundled audio files are shipped (avoids adding binary assets of unknown
// license to the repo) — every ambient id is synthesized with Web Audio noise +
// a filter, matching the fallback path the spec already requires for
// rain/ocean/breeze/white (doc §UC-F06 step 2).
type NoiseColor = "white" | "pink" | "brown";
const PRESETS: Record<Exclude<AmbientId, "none">, { color: NoiseColor; filter?: { type: BiquadFilterType; freq: number } }> = {
  white: { color: "white" },
  rain: { color: "white", filter: { type: "highpass", freq: 800 } },
  ocean: { color: "brown", filter: { type: "lowpass", freq: 400 } },
  breeze: { color: "pink", filter: { type: "bandpass", freq: 1200 } },
};

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let current: AmbientId = "none";
let baseVolume = 0.5;
let ducked = false;

function ensureCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

function makeNoiseBuffer(audioCtx: AudioContext, color: NoiseColor): AudioBuffer {
  const size = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1;
    if (color === "white") {
      data[i] = white;
    } else if (color === "pink") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else {
      b0 = (b0 + 0.02 * white) / 1.02;
      data[i] = b0 * 3.5;
    }
  }
  return buffer;
}

export function stopAmbient(): void {
  try {
    source?.stop();
  } catch {
    /* already stopped */
  }
  source?.disconnect();
  gain?.disconnect();
  source = null;
  gain = null;
  current = "none";
}

export function playAmbient(id: AmbientId, volume: number): void {
  stopAmbient();
  if (id === "none") return;
  baseVolume = volume;
  const audioCtx = ensureCtx();
  const preset = PRESETS[id];
  const src = audioCtx.createBufferSource();
  src.buffer = makeNoiseBuffer(audioCtx, preset.color);
  src.loop = true;
  let node: AudioNode = src;
  if (preset.filter) {
    const f = audioCtx.createBiquadFilter();
    f.type = preset.filter.type;
    f.frequency.value = preset.filter.freq;
    node.connect(f);
    node = f;
  }
  const g = audioCtx.createGain();
  g.gain.value = ducked ? baseVolume * 0.2 : baseVolume;
  node.connect(g);
  g.connect(audioCtx.destination);
  src.start();
  source = src;
  gain = g;
  current = id;
}

export function currentAmbient(): AmbientId {
  return current;
}

export function setAmbientVolume(volume: number): void {
  baseVolume = volume;
  if (gain && !ducked) gain.gain.value = volume;
}

/** UX addendum: dip ambient/YouTube volume during a TTS alert or the Pomodoro
 * alarm instead of letting audio sources overlap and startle the user. */
export function duckAmbient(): void {
  ducked = true;
  if (gain) gain.gain.value = baseVolume * 0.2;
}

export function unduckAmbient(): void {
  ducked = false;
  if (gain) gain.gain.value = baseVolume;
}

export function playAlarm(beeps: number, volume: number): void {
  const audioCtx = ensureCtx();
  duckAmbient();
  let t = audioCtx.currentTime;
  for (let i = 0; i < beeps; i++) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = 880;
    g.gain.value = volume;
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
    t += 0.35;
  }
  window.setTimeout(unduckAmbient, beeps * 350 + 200);
}
