export function unlockTts(): void {
  if (typeof speechSynthesis === "undefined") return;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function speak(text: string, lang: "vi" | "en", hooks?: { onStart?: () => void; onEnd?: () => void }): void {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "vi" ? "vi-VN" : "en-US";
  const voices = speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang.toLowerCase().startsWith(lang === "vi" ? "vi" : "en"));
  if (match) u.voice = match;
  if (hooks?.onStart) u.onstart = hooks.onStart;
  if (hooks?.onEnd) u.onend = hooks.onEnd;
  speechSynthesis.speak(u);
}
