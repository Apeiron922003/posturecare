import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, tabId, type ReportPayload, type SessionView } from "./api/client";
import { FocusHub, type FocusHubHandle } from "./focus/FocusHub";
import {
  computeK,
  defaultKnownCm,
  loadDistance,
  loadPose,
  resolutionMismatch,
  saveDistance,
  savePose,
} from "./calibration/storage";
import { cameraErrorMessage, listCameras, openCamera, stopStream } from "./capture/camera";
import { BgMonitor, type BgSummary } from "./capture/bgStats";
import { createLandmarker, detect } from "./capture/landmarker";
import { startFrameLoop } from "./capture/loop";
import { every } from "./capture/ticker";
import { HoldTracker, atomicFlags, defaultRules, type Rules } from "./detectors";
import {
  emptyGovernor,
  tickGovernor,
  type GovernorSnapshot,
  type HudLevel,
} from "./governor";
import { loadLang, saveLang, t, type Lang } from "./i18n";
import { drawOverlay } from "./overlay/draw";
import { PipHud, openPipWindow, pipSupported } from "./overlay/PipHud";
import { shouldSuggestBreak } from "./session/breakSuggestion";
import { speak, unlockTts } from "./session/tts";
import {
  notifyPermission,
  requestNotifyPermission,
  systemNotify,
  wantsSystemNotify,
  type NotifyPermission,
} from "./session/notify";
import { HEARTBEAT_INTERVAL_SEC } from "./signals/constants";
import { BlinkTracker, meanEar } from "./signals/ear";
import { distanceFromIpd, emaDistance, ipdPx } from "./signals/distance";
import { emptySignals, type Signals } from "./signals";
import { poseFromDetection, type Pose } from "./signals/pose";

type Screen = "boot" | "follower" | "wizard" | "dash" | "report" | "settings";
type Step = "camera" | "preview" | "calibrate";
type DashTab = "monitor" | "focus";
type Toast = { text: string; actionLabel?: string; onAction?: () => void };

export function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const [screen, setScreen] = useState<Screen>("boot");
  const [step, setStep] = useState<Step>("camera");
  const [session, setSession] = useState<SessionView | null>(null);
  const [lease, setLease] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>("");
  const [signals, setSignals] = useState<Signals>(emptySignals);
  const [hud, setHud] = useState<HudLevel>("normal");
  const [toast, setToast] = useState<Toast | null>(null);
  const [dashTab, setDashTab] = useState<DashTab>("monitor");
  const focusHubRef = useRef<FocusHubHandle>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [modelErr, setModelErr] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [rules, setRules] = useState<Rules>(defaultRules);
  const [knownCm, setKnownCm] = useState(defaultKnownCm());
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [recalHint, setRecalHint] = useState(false);
  const [qualified, setQualified] = useState<string[]>([]);
  const [notifyPerm, setNotifyPerm] = useState<NotifyPermission>(notifyPermission);
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const [bgSummary, setBgSummary] = useState<BgSummary | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const holdRef = useRef(new HoldTracker());
  const blinkRef = useRef(new BlinkTracker());
  const emaRef = useRef<number | null>(null);
  const poseRef = useRef<Pose | null>(loadPose()?.pose ?? null);
  const distRef = useRef(loadDistance());
  const snapRef = useRef<GovernorSnapshot>(emptyGovernor());
  const faceRef = useRef(false);
  const sessionRef = useRef<SessionView | null>(null);
  const leaseRef = useRef(1);
  const leaderRef = useRef(false);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const bgRef = useRef(new BgMonitor());
  const framesRef = useRef<{ t: number; n: number }>({ t: 0, n: 0 });
  const lastReading = useRef(0);

  const tid = tabId();

  const applySession = useCallback((s: SessionView) => {
    sessionRef.current = s;
    setSession(s);
    setLease(s.lease_generation);
    leaseRef.current = s.lease_generation;
    if (s.governor_state) snapRef.current = { ...emptyGovernor(), ...s.governor_state };
  }, []);

  const releaseCamera = useCallback(() => {
    leaderRef.current = false;
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  const becomeLeader = useCallback(async (s: SessionView) => {
    applySession(s);
    leaderRef.current = true;
    holdRef.current.resetHolds();
    setScreen("wizard");
    setStep("camera");
    try {
      const list = await listCameras();
      setCams(list);
      const pref = list.find((c) => /front|user|facetime/i.test(c.label)) ?? list[0];
      if (pref) setCamId(pref.deviceId);
    } catch {
      /* enumerate may need permission first */
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let started = await api.start(tid);
        if (cancelled) return;
        if (started.state === "ended") {
          started = await api.start(tid);
        }
        applySession(started);
        if (started.you_are_leader) {
          await becomeLeader(started);
          return;
        }
        if (started.owner_live) {
          setScreen("follower");
          return;
        }
        const claimed = await api.takeover(started.session_id, tid);
        if (cancelled) return;
        if (!claimed.you_are_leader) {
          applySession(claimed);
          setScreen("follower");
          return;
        }
        await becomeLeader(claimed);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, becomeLeader, tid]);

  useEffect(() => {
    api.rules().then(setRules).catch(() => setRules(defaultRules()));
  }, []);

  useEffect(() => {
    if (screen !== "follower" || !session) return;
    const id = window.setInterval(async () => {
      try {
        const s = await api.get(session.session_id);
        applySession(s);
        if (s.state === "ended") setScreen("report");
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(id);
  }, [screen, session, applySession]);

  useEffect(() => {
    if (!leaderRef.current || !sessionRef.current) return;
    // Worker-driven so a hidden leader tab keeps its lease (OWNER_LIVE_TIMEOUT_SEC).
    return every(HEARTBEAT_INTERVAL_SEC * 1000, async () => {
      const s = sessionRef.current;
      if (!s || !leaderRef.current) return;
      bgRef.current.heartbeat(performance.now());
      try {
        const next = await api.heartbeat(s.session_id, {
          tab_id: tid,
          lease_generation: leaseRef.current,
          face_present: faceRef.current,
          governor_state: snapRef.current,
        });
        applySession(next);
        if (next.state === "ended") {
          releaseCamera();
          setScreen("report");
        }
      } catch (e) {
        const status = (e as Error & { status?: number }).status;
        if (status === 409) {
          releaseCamera();
          setScreen("follower");
          setErr(t(lang, "takenOver"));
        }
      }
    });
  }, [screen, applySession, lang, releaseCamera, tid]);

  useEffect(() => {
    const onVis = () => {
      const s = bgRef.current.setHidden(document.hidden, performance.now());
      if (s) {
        setBgSummary(s);
        console.info("[PostureCare][bg]", s);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!pipWin) return;
    const onClose = () => setPipWin(null);
    pipWin.addEventListener("pagehide", onClose);
    return () => pipWin.removeEventListener("pagehide", onClose);
  }, [pipWin]);

  useEffect(() => {
    if (pipWin && screen !== "dash") pipWin.close();
  }, [pipWin, screen]);

  const togglePip = async () => {
    if (pipWin) {
      pipWin.close();
      return;
    }
    try {
      setPipWin(await openPipWindow());
    } catch (e) {
      setErr(String(e));
    }
  };

  const startPreview = async () => {
    setErr(null);
    unlockTts();
    // Ask while we still hold the click gesture; alerts reach the OS only when hidden.
    void requestNotifyPermission().then(setNotifyPerm);
    try {
      stopStream(streamRef.current);
      const stream = await openCamera(camId || undefined);
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      try {
        const devices = await listCameras();
        setCams(devices);
      } catch {
        /* ignore */
      }
      if (!landmarkerRef.current) {
        try {
          landmarkerRef.current = await createLandmarker();
        } catch {
          setModelErr(true);
          setErr(t(lang, "modelFail"));
          return;
        }
      }
      setStep("preview");
      runLoop();
    } catch (e) {
      const kind = cameraErrorMessage(e);
      const key = ({ denied: "camDenied", missing: "camMissing", busy: "camBusy", insecure: "camInsecure", other: "camOther" } as const)[kind];
      setErr(kind === "other" ? `${t(lang, key)} (${(e as Error)?.name ?? String(e)})` : t(lang, key));
    }
  };

  const runLoop = () => {
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const lm = landmarkerRef.current;
      if (!video || !canvas || !lm) return;
      const hidden = document.hidden;
      // Some browsers pause a muted <video> in a background tab; nudge it back.
      if (video.paused && streamRef.current) void video.play().catch(() => undefined);
      if (video.readyState < 2) return;
      const now = performance.now();
      bgRef.current.tick(now, video.currentTime);
      framesRef.current.n += 1;
      if (now - framesRef.current.t >= 1000) {
        setFps(framesRef.current.n);
        framesRef.current = { t: now, n: 0 };
      }
      let result;
      try {
        result = detect(lm, video, now);
      } catch {
        return;
      }
      const face = result.faceLandmarks[0];
      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      const w = video.videoWidth;
      const h = video.videoHeight;
      const present = Boolean(face);
      faceRef.current = present;
      const sig = emptySignals();
      sig.face_present = present;
      sig.blink_count = blinkRef.current.count;
      if (present && face) {
        const landmarks = face.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        const pose = poseFromDetection(landmarks, matrix, w, h, poseRef.current);
        if (pose) {
          sig.pitch = pose.pitch;
          sig.yaw = pose.yaw;
          sig.roll = pose.roll;
        }
        const ipd = ipdPx(landmarks, w, h);
        const raw = distanceFromIpd(ipd, distRef.current.K);
        emaRef.current = emaDistance(raw, emaRef.current);
        sig.distance_cm = emaRef.current;
        sig.ear = meanEar(landmarks);
        blinkRef.current.update(sig.ear, now);
        sig.blink_count = blinkRef.current.count;
        sig.blink_rate = blinkRef.current.ratePerMin(now);
        if (!hidden) drawOverlay(canvas, video, landmarks, pose);
        setRecalHint(resolutionMismatch(distRef.current, w, h));
      } else {
        emaRef.current = null;
        blinkRef.current.update(null, now);
        if (!hidden) drawOverlay(canvas, video, undefined, null);
      }
      setSignals({ ...sig });
      const atomic = atomicFlags(sig, rules);
      const q = holdRef.current.update(present, atomic, rules, now);
      setQualified(q);
      const sess = sessionRef.current;
      if (sess) {
        const g = tickGovernor({
          flags: q,
          sessionState: sess.state,
          nowSec: Date.now() / 1000,
          snap: snapRef.current,
          lang,
          voiceOn,
        });
        snapRef.current = g.snap;
        setHud(g.level);
        for (const ev of g.events) {
          if (ev.kind === "toast" || ev.kind === "escalate") {
            setToast({ text: ev.text });
            window.setTimeout(() => setToast(null), 4000);
          }
          if (ev.kind === "tts") speak(ev.text, lang);
          if (wantsSystemNotify(ev, hidden)) systemNotify(ev);
        }
        if (shouldSuggestBreak(sess.exposure_sec, rules, snapRef.current.break_suggested)) {
          snapRef.current.break_suggested = true;
          // UX addendum: this toast is never auto-dismissed and never suppressed by
          // a running Pomodoro Focus — only the one-click action below is gated on
          // the Focus Hub timer being idle (BRULE-F002).
          setToast({
            text: lang === "en" ? "Time for a short break." : "Nên nghỉ một chút.",
            actionLabel: t(lang, "breakStartBtn"),
            onAction: () => {
              doAction("break_start");
              if (focusHubRef.current?.isIdle()) focusHubRef.current.startBreakFromToast();
              setToast(null);
            },
          });
        }
        if (now - lastReading.current > 1500) {
          lastReading.current = now;
          api
            .readings(sess.session_id, [
              {
                ts: Date.now() / 1000,
                pitch: sig.pitch,
                yaw: sig.yaw,
                roll: sig.roll,
                distance_cm: sig.distance_cm,
                ear: sig.ear,
                blink_count: sig.blink_count,
                face_present: sig.face_present,
                flags: q,
              },
            ])
            .catch(() => undefined);
        }
      }
    };
    stopLoopRef.current?.();
    stopLoopRef.current = startFrameLoop(tick);
  };

  const onCalibratePose = () => {
    if (!signals.face_present || signals.pitch == null) {
      setErr(t(lang, "noFace"));
      return;
    }
    const abs: Pose = {
      pitch: (poseRef.current?.pitch ?? 0) + (signals.pitch ?? 0),
      yaw: (poseRef.current?.yaw ?? 0) + (signals.yaw ?? 0),
      roll: (poseRef.current?.roll ?? 0) + (signals.roll ?? 0),
    };
    poseRef.current = abs;
    savePose(abs, true);
    setErr(null);
  };

  const onCalibrateDistance = () => {
    const video = videoRef.current;
    if (!video || !signals.face_present) {
      setErr(t(lang, "noFace"));
      return;
    }
    const lm = landmarkerRef.current;
    if (!lm) return;
    try {
      const result = detect(lm, video, performance.now());
      const face = result.faceLandmarks[0];
      if (!face) throw new Error("no face");
      const ipd = ipdPx(
        face.map((p) => ({ x: p.x, y: p.y })),
        video.videoWidth,
        video.videoHeight,
      );
      if (!ipd) throw new Error("no eyes");
      const K = computeK(knownCm, ipd);
      const cal = { K, width: video.videoWidth, height: video.videoHeight, user_calibrated: true };
      distRef.current = cal;
      saveDistance(cal);
      emaRef.current = knownCm;
      setRecalHint(false);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
  };

  const doTakeover = async () => {
    if (!session) return;
    try {
      const claimed = await api.takeover(session.session_id, tid);
      if (!claimed.you_are_leader) {
        applySession(claimed);
        setScreen("follower");
        return;
      }
      await becomeLeader(claimed);
    } catch (e) {
      setErr(String(e));
    }
  };

  const doStop = async () => {
    if (!session) return;
    await api.stop(session.session_id, tid).catch(() => undefined);
    releaseCamera();
    try {
      setReport(await api.report(session.session_id));
    } catch {
      setReport(null);
    }
    setScreen("report");
  };

  const doAction = async (type: string) => {
    if (!session) return;
    try {
      const r = await api.action(session.session_id, tid, leaseRef.current, type);
      snapRef.current = { ...snapRef.current, ...r.governor_state };
      setSession({ ...session, state: r.state, governor_state: r.governor_state });
    } catch (e) {
      setErr(String(e));
    }
  };

  const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(1));

  const header = (
    <div className="row">
      <h1>{t(lang, "app")}</h1>
      <label>
        {t(lang, "lang")}{" "}
        <select
          value={lang}
          onChange={(e) => {
            const next = e.target.value as Lang;
            setLang(next);
            saveLang(next);
          }}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>
      {session && (
        <span className="muted">
          {t(lang, "state")}: {session.state} · {t(lang, "exposure")}: {(session.exposure_sec / 60).toFixed(1)}
        </span>
      )}
    </div>
  );

  if (screen === "boot") {
    return (
      <div className="app">
        {header}
        <p className="muted">{err ?? "…"}</p>
      </div>
    );
  }

  if (screen === "follower") {
    return (
      <div className="app">
        {header}
        <div className="card">
          <p>{t(lang, "otherTab")}</p>
          <p className="muted">{session?.state}</p>
          <div className="row">
            <button className="primary" onClick={doTakeover}>
              {t(lang, "takeover")}
            </button>
            <button className="danger" onClick={doStop}>
              {t(lang, "stop")}
            </button>
          </div>
          {err && <p className="muted">{err}</p>}
        </div>
      </div>
    );
  }

  if (screen === "report") {
    return (
      <div className="app">
        {header}
        <div className="card">
          <h2>{t(lang, "report")}</h2>
          {report ? (
            <pre className="debug">
              {JSON.stringify(
                {
                  exposure_sec: report.exposure_sec,
                  blink_count: report.blink_count,
                  flag_durations_sec: report.flag_durations_sec,
                },
                null,
                2,
              )}
            </pre>
          ) : (
            <p className="muted">—</p>
          )}
          <button onClick={() => window.location.reload()}>{t(lang, "continue")}</button>
        </div>
      </div>
    );
  }

  if (screen === "settings") {
    return (
      <div className="app">
        {header}
        <div className="card">
          <h2>{t(lang, "settings")}</h2>
          <label>
            pitch
            <input
              type="number"
              value={rules.pitch_threshold_deg}
              onChange={(e) => setRules({ ...rules, pitch_threshold_deg: Number(e.target.value) })}
            />
          </label>
          <label>
            {t(lang, "demoMode")}
            <input
              type="checkbox"
              checked={rules.demo_mode}
              onChange={(e) => setRules({ ...rules, demo_mode: e.target.checked })}
            />
          </label>
          <div className="row">
            <button
              className="primary"
              onClick={() => api.putRules(rules).then(() => setScreen("dash"))}
            >
              {t(lang, "continue")}
            </button>
            <button onClick={() => setScreen("dash")}>{t(lang, "back")}</button>
          </div>
        </div>
      </div>
    );
  }

  const stage = (
    <div className="stage">
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} />
    </div>
  );

  if (screen === "wizard") {
    return (
      <div className="app">
        {header}
        {step === "camera" && (
          <div className="card">
            <h2>{t(lang, "wizardCamera")}</h2>
            <select value={camId} onChange={(e) => setCamId(e.target.value)}>
              {cams.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || c.deviceId.slice(0, 8)}
                </option>
              ))}
            </select>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="primary" onClick={startPreview}>
                {t(lang, "continue")}
              </button>
              <button
                onClick={() => {
                  unlockTts();
                  startPreview().then(() => setScreen("dash"));
                }}
              >
                {t(lang, "skip")}
              </button>
            </div>
          </div>
        )}
        {step !== "camera" && stage}
        {step === "preview" && (
          <div className="card">
            <h2>{t(lang, "wizardPreview")}</h2>
            <button className="primary" onClick={() => setStep("calibrate")}>
              {t(lang, "continue")}
            </button>
          </div>
        )}
        {step === "calibrate" && (
          <div className="card">
            <h2>{t(lang, "wizardCalibrate")}</h2>
            <p>{t(lang, "wizardPose")}</p>
            <div className="row">
              <button onClick={onCalibratePose}>{t(lang, "calibratePose")}</button>
              <label>
                {t(lang, "knownDistance")}
                <input type="number" value={knownCm} min={10} max={200} onChange={(e) => setKnownCm(Number(e.target.value))} />
              </label>
              <button onClick={onCalibrateDistance}>{t(lang, "calibrateDistance")}</button>
              <button className="primary" onClick={() => setScreen("dash")}>
                {t(lang, "dashboard")}
              </button>
            </div>
            {recalHint && <p className="muted">{t(lang, "recalibrate")}</p>}
          </div>
        )}
        {err && <p className="muted">{err}</p>}
        {modelErr && <p className="muted">{t(lang, "modelFail")}</p>}
        <pre className="debug">
          pitch {fmt(signals.pitch)} yaw {fmt(signals.yaw)} roll {fmt(signals.roll)} cm {fmt(signals.distance_cm)} face{" "}
          {String(signals.face_present)}
        </pre>
      </div>
    );
  }

  return (
    <div className="app">
      {header}
      <div className="row" style={{ marginBottom: "0.6rem" }}>
        <button className={dashTab === "monitor" ? "primary" : ""} onClick={() => setDashTab("monitor")}>
          {t(lang, "tabMonitor")}
        </button>
        <button className={dashTab === "focus" ? "primary" : ""} onClick={() => setDashTab("focus")}>
          {t(lang, "tabFocus")}
        </button>
      </div>
      {/* Camera + detection loop stay mounted regardless of tab so exposure/posture
          tracking never pauses just because the user is looking at Focus Hub. */}
      <div className={dashTab === "focus" ? "hidden-stage" : undefined}>{stage}</div>
      {dashTab === "monitor" && (
        <>
          <div className={`hud ${hud}`}>
            HUD {hud} · EAR {fmt(signals.ear)} · blink {signals.blink_count} · {t(lang, "fps")}: {fps ?? "—"}
            <div>flags: {qualified.join(", ") || "—"}</div>
          </div>
          <div className="row">
            <button onClick={() => doAction("snooze")}>{t(lang, "snooze")}</button>
            <button onClick={() => doAction(snapRef.current.dnd ? "dnd_off" : "dnd_on")}>{t(lang, "dnd")}</button>
            {hud === "escalated" && (
              <button className="primary" onClick={() => doAction("ack")}>
                {t(lang, "ack")}
              </button>
            )}
            <button onClick={() => doAction(session?.state === "break" ? "break_end" : "break_start")}>
              {session?.state === "break" ? t(lang, "breakEnd") : t(lang, "breakStart")}
            </button>
            <label>
              {t(lang, "voice")}
              <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
            </label>
            {pipSupported() && (
              <button className={pipWin ? "primary" : ""} onClick={togglePip} title={t(lang, "pipHint")}>
                ⧉ {t(lang, "pip")}
              </button>
            )}
            <button onClick={() => setScreen("settings")}>{t(lang, "settings")}</button>
            <button className="danger" onClick={doStop}>
              {t(lang, "stop")}
            </button>
          </div>
          {recalHint && <p className="muted">{t(lang, "recalibrate")}</p>}
          {notifyPerm === "denied" && <p className="muted">{t(lang, "notifyDenied")}</p>}
          <pre className="debug">
            {bgSummary &&
              `bg: ${Math.round(bgSummary.hidden_ms / 1000)}s ticks ${bgSummary.ticks} gap avg/max ${bgSummary.gap_avg_ms ?? "—"}/${bgSummary.gap_max_ms ?? "—"}ms stale ${bgSummary.stale_frames} hb ${bgSummary.heartbeats} hb-gap max ${bgSummary.hb_gap_max_ms ?? "—"}ms\n`}
            pitch {fmt(signals.pitch)} (cúi → head_too_low nếu &gt; {rules.pitch_threshold_deg}°) yaw {fmt(signals.yaw)} roll{" "}
            {fmt(signals.roll)} cm {fmt(signals.distance_cm)}
          </pre>
        </>
      )}
      {dashTab === "focus" && (
        <FocusHub
          ref={focusHubRef}
          lang={lang}
          signals={signals}
          onCalibratePose={onCalibratePose}
          onBreakStart={() => doAction("break_start")}
          onBreakEnd={() => doAction("break_end")}
        />
      )}
      {/* err is rendered outside the tab switch — a Calibrate error from Focus Hub
          must be visible without forcing the user back to the Monitor tab. */}
      {err && <p className="muted">{err}</p>}
      {pipWin &&
        createPortal(
          <PipHud
            level={hud}
            state={session?.state ?? "idle"}
            facePresent={signals.face_present}
            distanceCm={signals.distance_cm}
            flags={qualified}
            lang={lang}
            onAck={() => doAction("ack")}
          />,
          pipWin.document.body,
        )}
      {toast && (
        <div className="toast">
          {toast.text}
          {toast.actionLabel && (
            <div className="row" style={{ marginTop: "0.5rem" }}>
              <button className="primary" onClick={toast.onAction}>
                {toast.actionLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
