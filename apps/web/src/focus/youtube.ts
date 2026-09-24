// Minimal YouTube IFrame API wrapper. The player is a small, visible dock with
// YouTube's own controls — YouTube's API policies do not allow a hidden player used
// as an audio-only source (plan B8). NFR-F003: the pasted link never reaches the
// backend — this module talks to youtube.com directly from the browser.

type YTPlayer = {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  stopVideo: () => void;
  setVolume: (v: number) => void;
};

declare global {
  interface Window {
    YT?: { Player: new (el: string, opts: Record<string, unknown>) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const DOCK_ID = "focus-yt-dock";
const CONTAINER_ID = "focus-yt-player";
let player: YTPlayer | null = null;
let apiPromise: Promise<void> | null = null;

export function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function loadApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

// Lives on <body>, not inside Focus Hub, so music keeps playing when the user
// switches to the Monitor tab.
function ensureDock(): HTMLElement {
  let dock = document.getElementById(DOCK_ID);
  if (dock) return dock;
  dock = document.createElement("div");
  dock.id = DOCK_ID;
  dock.className = "yt-dock";
  const inner = document.createElement("div");
  inner.id = CONTAINER_ID;
  dock.appendChild(inner);
  document.body.appendChild(dock);
  return dock;
}

function showDock(visible: boolean): void {
  const dock = document.getElementById(DOCK_ID);
  if (dock) dock.hidden = !visible;
}

export async function playYoutube(videoId: string, volume: number, onError: () => void): Promise<void> {
  await loadApi();
  ensureDock();
  showDock(true);
  if (player) {
    player.loadVideoById(videoId);
    player.setVolume(Math.round(volume * 100));
    return;
  }
  player = new window.YT!.Player(CONTAINER_ID, {
    videoId,
    width: "100%",
    height: "100%",
    playerVars: { autoplay: 1, controls: 1, playsinline: 1 },
    events: {
      onReady: (e: { target: YTPlayer }) => {
        e.target.setVolume(Math.round(volume * 100));
        e.target.playVideo();
      },
      onError: () => onError(),
    },
  });
}

export function stopYoutubePlayer(): void {
  player?.stopVideo();
  showDock(false);
}

export function setYoutubeVolume(volume: number): void {
  player?.setVolume(Math.round(volume * 100));
}
