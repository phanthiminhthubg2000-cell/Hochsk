"use client";
// ============================================================
// ÂM THANH — phát giọng đọc tiếng Trung
// Có file thu sẵn (Gemini TTS, public/audio/tts/manifest.json: chữ → đường dẫn) thì phát file;
// chưa có thì dùng giọng đọc của trình duyệt như cũ. Tạo file: tools/tts/make_audio.py
// ============================================================
let MAN = null, loading = null, cur = null;
function manifest() {
  if (MAN) return Promise.resolve(MAN);
  if (!loading) loading = fetch("/audio/tts/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => (MAN = m || {}));
  return loading;
}
export const preloadAudio = () => { if (typeof window !== "undefined") manifest(); };
export const hasRecorded = (text) => !!(MAN && MAN[String(text || "").trim()]);

function browserSpeak(text, rate = 0.85, onend) {
  try {
    const s = window.speechSynthesis; if (!s) return false; s.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = rate;
    const v = s.getVoices().find((x) => /zh[-_]CN/i.test(x.lang)) || s.getVoices().find((x) => /^zh/i.test(x.lang)); if (v) u.voice = v;
    if (onend) u.onend = onend;
    s.speak(u); return true;
  } catch (_) { return false; }
}
export function stopSpeak() { try { cur?.pause(); } catch (_) {} try { window.speechSynthesis?.cancel(); } catch (_) {} }

/** Đọc một từ / câu. Trả về Promise<boolean> (có phát được hay không). */
export async function speakZh(text, { rate = 0.85, onend } = {}) {
  const t = String(text || "").trim(); if (!t) return false;
  const m = await manifest();
  if (m[t]) {
    try {
      stopSpeak();
      cur = new Audio(`/audio/tts/${m[t]}`);
      if (onend) cur.onended = onend;
      await cur.play();
      return true;
    } catch (_) { /* lỗi phát file → giọng trình duyệt */ }
  }
  return browserSpeak(t, rate, onend);
}
export const canSpeakAny = () => typeof window !== "undefined" && (!!window.speechSynthesis || !!(MAN && Object.keys(MAN).length));
