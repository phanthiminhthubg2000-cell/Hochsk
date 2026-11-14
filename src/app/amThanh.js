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

// Giọng trình duyệt: chỉ dùng khi máy có giọng tiếng Trung (không có thì nhiều máy im lặng hoặc đọc sai)
function zhVoice() { try { const v = window.speechSynthesis?.getVoices() || []; return v.find((x) => /zh[-_]CN/i.test(x.lang)) || v.find((x) => /^zh/i.test(x.lang)) || null; } catch (_) { return null; } }
function browserSpeak(text, rate = 0.85, onend) {
  try {
    const s = window.speechSynthesis; if (!s) return false;
    const v = zhVoice(); if (!v && s.getVoices().length) return false;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = rate; if (v) u.voice = v;
    if (onend) u.onend = onend;
    s.speak(u); return true;
  } catch (_) { return false; }
}
export function stopSpeak() { try { cur?.pause(); } catch (_) {} try { window.speechSynthesis?.cancel(); } catch (_) {} }

function playUrl(src, onend) {
  stopSpeak();
  cur = new Audio(src);
  if (onend) cur.onended = onend;
  return cur.play().then(() => true, () => false);
}

/** Đọc một từ / câu. Thứ tự: file thu sẵn → mp3 máy chủ (/api/tts, chạy trên mọi máy) → giọng trình duyệt.
 *  Không chờ tải danh mục trước khi phát để giữ "cú bấm" của người dùng (trình duyệt điện thoại chặn phát âm thanh nếu trễ). */
export async function speakZh(text, { rate = 0.85, onend } = {}) {
  const t = String(text || "").trim(); if (!t) return false;
  const m = MAN || {}; if (!MAN) manifest();
  if (m[t] && (await playUrl(`/audio/tts/${m[t]}`, onend))) return true;
  if (/[\u3400-\u9fff]/.test(t) && (await playUrl(`/api/tts?t=${encodeURIComponent(t)}${rate < 0.7 ? "&slow=1" : ""}`, onend))) return true;
  return browserSpeak(t, rate, onend);
}
export const canSpeakAny = () => typeof window !== "undefined";
