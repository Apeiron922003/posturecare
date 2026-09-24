import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { t, type Lang } from "../i18n";
import type { Signals } from "../signals";
import {
  duckAmbient,
  playAlarm,
  playAmbient,
  setAmbientVolume,
  stopAmbient,
  unduckAmbient,
} from "./sound";
import {
  loadActiveTaskId,
  loadSettings,
  loadTasks,
  saveActiveTaskId,
  saveSettings,
  saveTasks,
  type AmbientId,
  type FocusSettings,
  type FocusTheme,
  type Task,
} from "./storage";
import {
  applyPreset,
  formatTime,
  initialTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startBreakFromGovernor,
  startTimer,
  tick,
  type PendingKind,
  type TimerState,
} from "./timer";
import { extractVideoId, playYoutube, setYoutubeVolume, stopYoutubePlayer } from "./youtube";
import { speak, unlockTts } from "../session/tts";

export type FocusHubHandle = {
  isIdle: () => boolean;
  startBreakFromToast: () => void;
};

type Props = {
  lang: Lang;
  signals: Signals;
  onCalibratePose: () => void;
  onBreakStart: () => void;
  onBreakEnd: () => void;
};

const PRESETS: { kind: PendingKind; minutes: number; key: string }[] = [
  { kind: "focus", minutes: 25, key: "25m Focus" },
  { kind: "focus", minutes: 50, key: "50m Deep Work" },
  { kind: "break", minutes: 5, key: "5m Break" },
  { kind: "break", minutes: 15, key: "15m Rest" },
];

type TKey = Parameters<typeof t>[1];

const AMBIENTS: { id: AmbientId; key: TKey }[] = [
  { id: "none", key: "soundNone" },
  { id: "rain", key: "soundRain" },
  { id: "ocean", key: "soundOcean" },
  { id: "breeze", key: "soundBreeze" },
  { id: "white", key: "soundWhite" },
];

const THEMES: { id: FocusTheme; color: string }[] = [
  { id: "slate", color: "#14b8a6" },
  { id: "midnight", color: "#6366f1" },
  { id: "forest", color: "#22c55e" },
  { id: "sunset", color: "#f97316" },
  { id: "ocean", color: "#0ea5e9" },
];

function fmt(n: number | null): string {
  return n == null ? "—" : n.toFixed(1);
}

export const FocusHub = forwardRef<FocusHubHandle, Props>(function FocusHub(props, ref) {
  const { lang, signals, onCalibratePose, onBreakStart, onBreakEnd } = props;
  const [settings, setSettings] = useState<FocusSettings>(loadSettings);
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(loadActiveTaskId);
  const [timer, setTimer] = useState<TimerState>(() => initialTimer(settings.focusMinutes, settings.breakMinutes));
  const [newTaskText, setNewTaskText] = useState("");
  const [youtubeInput, setYoutubeInput] = useState(settings.youtubeUrl);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubePlaying, setYoutubePlaying] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const activeTaskIdRef = useRef(activeTaskId);
  activeTaskIdRef.current = activeTaskId;

  useImperativeHandle(
    ref,
    () => ({
      isIdle: () => timer.mode === "idle",
      startBreakFromToast: () => setTimer((s) => startBreakFromGovernor(s)),
    }),
    [timer],
  );

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveActiveTaskId(activeTaskId), [activeTaskId]);

  // 1s tick, always mounted (Focus Hub stays alive when the Monitor tab is shown).
  useEffect(() => {
    const id = window.setInterval(() => {
      setTimer((prev) => {
        const { state, events } = tick(prev, 1);
        for (const ev of events) {
          if (ev === "focus_complete") {
            playAlarm(2, settingsRef.current.alarmVolume);
            notify(lang === "en" ? "Time for a break." : "Đến giờ nghỉ.");
            const activeId = activeTaskIdRef.current;
            if (activeId) {
              setTasks((ts) => ts.map((task) => (task.id === activeId ? { ...task, pomodoros: task.pomodoros + 1 } : task)));
            }
            onBreakStart();
          } else if (ev === "break_complete") {
            playAlarm(1, settingsRef.current.alarmVolume);
            notify(lang === "en" ? "Ready for another focus session?" : "Sẵn sàng cho phiên tiếp theo?");
            onBreakEnd();
          }
        }
        return state;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notify(text: string): void {
    try {
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "granted") new Notification(text);
    } catch {
      /* unsupported/blocked — FR-F015 exception, don't block the timer */
    }
  }

  function handleStart(): void {
    unlockTts();
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    } catch {
      /* ignore */
    }
    setTimer((s) => {
      const next = startTimer(s);
      if (next.mode === "break") onBreakStart();
      return next;
    });
    if (settings.ambientSound !== "none" && !youtubePlaying) {
      playAmbient(settings.ambientSound, settings.ambientVolume);
    }
  }

  function handlePauseResume(): void {
    setTimer((s) => (s.running ? pauseTimer(s) : resumeTimer(s)));
  }

  function handleReset(): void {
    setTimer((s) => {
      const { state, wasBreak } = resetTimer(s);
      if (wasBreak) onBreakEnd();
      return state;
    });
  }

  function handlePreset(kind: PendingKind, minutes: number): void {
    setTimer((s) => applyPreset(s, kind, minutes));
    setSettings((s) => (kind === "focus" ? { ...s, focusMinutes: minutes } : { ...s, breakMinutes: minutes }));
  }

  function handleAddTask(e: React.FormEvent): void {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text) return;
    const task: Task = { id: crypto.randomUUID(), text, done: false, pomodoros: 0 };
    setTasks((ts) => [...ts, task]);
    if (!activeTaskId) setActiveTaskId(task.id);
    setNewTaskText("");
  }

  function toggleDone(id: string): void {
    setTasks((ts) => ts.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  }

  function removeTask(id: string): void {
    setTasks((ts) => ts.filter((task) => task.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  }

  function chooseAmbient(id: AmbientId): void {
    setSettings((s) => ({ ...s, ambientSound: id }));
    if (id === "none") {
      stopAmbient();
      return;
    }
    stopYoutubePlayer();
    setYoutubePlaying(false);
    playAmbient(id, settings.ambientVolume);
  }

  function handleAmbientVolume(v: number): void {
    setSettings((s) => ({ ...s, ambientVolume: v }));
    setAmbientVolume(v);
  }

  async function handleYoutubePlay(): Promise<void> {
    const id = extractVideoId(youtubeInput);
    if (!id) {
      setYoutubeError(t(lang, "youtubeInvalid"));
      return;
    }
    setYoutubeError(null);
    stopAmbient();
    setSettings((s) => ({ ...s, ambientSound: "none", youtubeUrl: youtubeInput }));
    await playYoutube(id, settings.youtubeVolume, () => setYoutubeError(t(lang, "youtubeError")));
    setYoutubePlaying(true);
  }

  function handleYoutubeStop(): void {
    stopYoutubePlayer();
    setYoutubePlaying(false);
  }

  function handleYoutubeVolume(v: number): void {
    setSettings((s) => ({ ...s, youtubeVolume: v }));
    setYoutubeVolume(v);
  }

  function speakSample(): void {
    duckAmbient();
    speak(lang === "en" ? "Voice reminders enabled." : "Đã bật nhắc bằng giọng nói.", lang, { onEnd: unduckAmbient });
  }

  const totalSec = (timer.mode === "break" ? settings.breakMinutes : settings.focusMinutes) * 60;
  const pct = totalSec > 0 ? Math.round(((totalSec - timer.remainingSec) / totalSec) * 100) : 0;
  const activeTask = tasks.find((tsk) => tsk.id === activeTaskId) ?? null;
  const canStartBreakDirect = timer.mode === "idle";

  return (
    <div className="focus-hub" data-focus-theme={settings.theme}>
      <div className="card">
        <div className="focus-ring" style={{ ["--pct" as string]: pct }}>
          <div className="focus-ring-inner">
            <div className="focus-time">{formatTime(timer.remainingSec)}</div>
            <div className="muted">{timer.mode === "idle" ? (timer.pendingKind === "break" ? "Break" : "Focus") : timer.mode}</div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "center" }}>
          {timer.mode === "idle" ? (
            <button className="primary" onClick={handleStart}>
              {t(lang, timer.pendingKind === "break" ? "breakStartBtn" : "focusStart")}
            </button>
          ) : (
            <button className="primary" onClick={handlePauseResume}>
              {t(lang, timer.running ? "pause" : "resume")}
            </button>
          )}
          <button onClick={handleReset}>{t(lang, "resetTimer")}</button>
        </div>
        <div className="focus-presets" style={{ justifyContent: "center", marginTop: "0.6rem" }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`chip ${timer.pendingKind === p.kind && (p.kind === "focus" ? settings.focusMinutes : settings.breakMinutes) === p.minutes ? "active" : ""}`}
              onClick={() => handlePreset(p.kind, p.minutes)}
            >
              {p.key}
            </button>
          ))}
        </div>
        <p className="muted" style={{ textAlign: "center" }}>
          {t(lang, "sessionsCompleted")}: {timer.sessionsCompleted}
        </p>
      </div>

      <div className="card">
        <h2>{t(lang, "workingOn")}</h2>
        <p className="muted">{activeTask ? activeTask.text : t(lang, "noTaskSelected")}</p>
        <form className="row" onSubmit={handleAddTask}>
          <input
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder={t(lang, "addTaskPlaceholder")}
            maxLength={120}
            style={{ flex: 1, minWidth: "10rem" }}
          />
          <button className="primary" type="submit">
            {t(lang, "addTask")}
          </button>
        </form>
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={`task-item ${task.id === activeTaskId ? "active" : ""}`}>
              <input type="checkbox" checked={task.done} onChange={() => toggleDone(task.id)} />
              <button onClick={() => setActiveTaskId(task.id)} title="Working on this">
                ▶
              </button>
              <span className={`task-text ${task.done ? "done" : ""}`}>{task.text}</span>
              <span className="muted">🍅 {task.pomodoros}</span>
              <button className="danger" onClick={() => removeTask(task.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>{t(lang, "ambientSound")}</h2>
        <div className="chip-row">
          {AMBIENTS.map((a) => (
            <button
              key={a.id}
              className={`chip ${settings.ambientSound === a.id && !youtubePlaying ? "active" : ""}`}
              onClick={() => chooseAmbient(a.id)}
            >
              {t(lang, a.key)}
            </button>
          ))}
        </div>
        <label>
          {t(lang, "volume")}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.ambientVolume}
            onChange={(e) => handleAmbientVolume(Number(e.target.value))}
          />
        </label>
        <div className="row">
          <input
            value={youtubeInput}
            onChange={(e) => setYoutubeInput(e.target.value)}
            placeholder={t(lang, "youtubeLink")}
            style={{ flex: 1, minWidth: "12rem" }}
          />
          {youtubePlaying ? (
            <button onClick={handleYoutubeStop}>{t(lang, "youtubeStop")}</button>
          ) : (
            <button className="primary" onClick={() => void handleYoutubePlay()}>
              {t(lang, "youtubePlay")}
            </button>
          )}
        </div>
        {youtubePlaying && (
          <label>
            {t(lang, "volume")}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.youtubeVolume}
              onChange={(e) => handleYoutubeVolume(Number(e.target.value))}
            />
          </label>
        )}
        {youtubeError && <p className="muted">{youtubeError}</p>}
      </div>

      <div className="card">
        <label>
          <input
            type="checkbox"
            checked={settings.voiceEnabled}
            onChange={(e) => {
              const on = e.target.checked;
              setSettings((s) => ({ ...s, voiceEnabled: on }));
              if (on) speakSample();
            }}
          />{" "}
          {t(lang, "voiceReminders")}
        </label>
        <label>
          Alarm {t(lang, "volume")}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.alarmVolume}
            onChange={(e) => setSettings((s) => ({ ...s, alarmVolume: Number(e.target.value) }))}
          />
        </label>
        <div>
          <label>{t(lang, "theme")}</label>
          <div className="theme-swatches">
            {THEMES.map((th) => (
              <button
                key={th.id}
                className={`swatch ${settings.theme === th.id ? "active" : ""}`}
                style={{ ["--sw" as string]: th.color }}
                title={th.id}
                onClick={() => setSettings((s) => ({ ...s, theme: th.id }))}
              />
            ))}
          </div>
        </div>
        <div className="row" style={{ marginTop: "0.6rem" }}>
          <button onClick={onCalibratePose}>{t(lang, "calibrateFocus")}</button>
          <span className="muted">
            pitch {fmt(signals.pitch)} yaw {fmt(signals.yaw)} roll {fmt(signals.roll)}
          </span>
        </div>
        {!canStartBreakDirect && (
          <p className="muted">{lang === "en" ? "Focus is running — break sync only, timer untouched." : "Focus đang chạy — chỉ đồng bộ nghỉ, không đụng đồng hồ."}</p>
        )}
      </div>

      <p className="local-notice">{t(lang, "localDataNotice")}</p>
    </div>
  );
});
