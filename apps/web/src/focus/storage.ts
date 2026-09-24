export type AmbientId = "none" | "rain" | "ocean" | "breeze" | "white";
export type FocusTheme = "slate" | "midnight" | "forest" | "sunset" | "ocean";

export type FocusSettings = {
  focusMinutes: number;
  breakMinutes: number;
  ambientSound: AmbientId;
  ambientVolume: number;
  alarmVolume: number;
  voiceEnabled: boolean;
  youtubeUrl: string;
  youtubeVolume: number;
  theme: FocusTheme;
};

export type Task = { id: string; text: string; done: boolean; pomodoros: number };

const SETTINGS_KEY = "pc_settings";
const TASKS_KEY = "pc_tasks";
const ACTIVE_TASK_KEY = "pc_active_task_id";

export function defaultSettings(): FocusSettings {
  return {
    focusMinutes: 25,
    breakMinutes: 5,
    ambientSound: "none",
    ambientVolume: 0.5,
    alarmVolume: 0.6,
    voiceEnabled: false,
    youtubeUrl: "",
    youtubeVolume: 0.5,
    theme: "slate",
  };
}

export function hasSavedSettings(): boolean {
  return localStorage.getItem(SETTINGS_KEY) != null;
}

export function loadSettings(): FocusSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings();
  try {
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<FocusSettings>) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: FocusSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage blocked (e.g. private mode) — settings just won't persist, Q-F05 */
  }
}

export function loadTasks(): Task[] {
  const raw = localStorage.getItem(TASKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    /* ignore, see saveSettings */
  }
}

export function loadActiveTaskId(): string | null {
  return localStorage.getItem(ACTIVE_TASK_KEY);
}

export function saveActiveTaskId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_TASK_KEY, id);
  else localStorage.removeItem(ACTIVE_TASK_KEY);
}
