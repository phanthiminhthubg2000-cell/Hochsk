"use client";
// ============================================================
// LUYỆN ĐAN PHÒNG 炼丹房 — dữ liệu ôn từ vựng kiểu Leitner (v2 · giai đoạn C)
// Thẻ từ: public/data/cards/{hsk1..hsk6,hsk7-9}.json = [[hanzi, pinyin, nghĩa, ví dụ], …]
// Tiến độ: lien_dan/{uid} = { w: { "<lv>|<hanzi>": [hộp 1–6, ngày đến hạn (số ngày), số lần sai] }, at }
//   Hộp 1 → ôn sau 1 ngày, 2 → 3, 3 → 7, 4 → 14, 5 → 30, 6 = Viên mãn (đã thuộc lâu)
//   Trả lời sai → về hộp 1 và tăng số lần sai → hiện ở Tâm Ma Động; Tâm Ma trả lời đúng 2 lần liên tiếp thì giải
// ============================================================
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { dayKey, dayNum } from "./tuTien";

export const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60];
export const levelKeyOfRealm = (idx) => (idx <= 1 ? "hsk1" : idx >= 7 ? "hsk7-9" : `hsk${idx}`);
export const LEVEL_NAME = { hsk1: "HSK 1", hsk2: "HSK 2", hsk3: "HSK 3", "hsk4": "HSK 4", hsk5: "HSK 5", hsk6: "HSK 6", "hsk7-9": "HSK 7–9" };
export const today = () => dayNum(dayKey());

const cache = {};
export async function loadCards(lv) {
  if (cache[lv]) return cache[lv];
  const r = await fetch(`/data/cards/${lv}.json`);
  if (!r.ok) throw new Error("Không tải được thẻ từ");
  cache[lv] = await r.json();
  return cache[lv];
}

export async function loadLD(uid) {
  if (!uid) { try { return JSON.parse(localStorage.getItem("sh_lien_dan") || "null") || { w: {} }; } catch (_) { return { w: {} }; } }
  try { const s = await getDoc(doc(db, "lien_dan", uid)); return s.exists() ? { w: {}, ...s.data() } : { w: {} }; } catch (_) { return { w: {} }; }
}
export async function saveLD(uid, ld) {
  try { localStorage.setItem("sh_lien_dan", JSON.stringify(ld)); } catch (_) {}
  if (uid) await setDoc(doc(db, "lien_dan", uid), { w: ld.w, at: Date.now() }).catch(() => {});
}

export const wkey = (lv, zh) => `${lv}|${zh}`;
// Thống kê cho trang chủ / sư phụ
export function ldStats(ld, t = today()) {
  const vals = Object.values(ld?.w || {});
  return {
    due: vals.filter((v) => v[0] < 6 && v[1] <= t).length,
    tamMa: vals.filter((v) => (v[2] || 0) > 0).length,
    learned: vals.filter((v) => v[0] >= 3).length,
    vienMan: vals.filter((v) => v[0] >= 6).length,
    total: vals.length,
  };
}

// Chọn một lò: từ đến hạn trước, rồi bổ sung từ mới của cấp đang tu
export function pickBatch(ld, cards, lv, n = 10, t = today()) {
  const w = ld.w || {};
  const due = cards.filter((c) => { const v = w[wkey(lv, c[0])]; return v && v[0] < 6 && v[1] <= t; });
  const fresh = cards.filter((c) => !w[wkey(lv, c[0])]);
  const pick = [...shuffle(due).slice(0, n)];
  if (pick.length < n) pick.push(...fresh.slice(0, n - pick.length));
  return pick.map((c) => ({ c, isNew: !w[wkey(lv, c[0])] }));
}
export function grade(ld, lv, zh, ok, t = today()) {
  const k = wkey(lv, zh); const v = ld.w[k] || [0, t, 0];
  const box = ok ? Math.min(6, Math.max(1, v[0]) + (v[0] ? 1 : 0)) : 1;
  ld.w[k] = [box, t + BOX_DAYS[Math.min(6, box)], ok ? v[2] || 0 : (v[2] || 0) + 1];
  return ld.w[k];
}

export function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
// Câu hỏi trắc nghiệm từ một thẻ: mode "nghia" (Hán → nghĩa), "han" (nghĩa → Hán), "am" (Hán → pinyin)
export function makeQ(card, pool, mode = "nghia") {
  const [zh, py, vn] = card;
  const short = (s) => String(s || "").split(/[;；]/)[0].trim();
  const others = shuffle(pool.filter((x) => x[0] !== zh && short(x[2]) !== short(vn))).slice(0, 3);
  if (mode === "han") { const opts = shuffle([zh, ...others.map((x) => x[0])]); return { mode, ask: short(vn), sub: "Chọn chữ Hán đúng", opts, right: opts.indexOf(zh), zh, py, vn }; }
  if (mode === "am") { const opts = shuffle([py, ...others.map((x) => x[1])]); return { mode, ask: zh, sub: "Chọn phiên âm đúng", opts, right: opts.indexOf(py), zh, py, vn }; }
  const opts = shuffle([short(vn), ...others.map((x) => short(x[2]))]);
  return { mode, ask: zh, sub: "Từ này nghĩa là gì?", opts, right: opts.indexOf(short(vn)), zh, py, vn };
}

export function speakZh(text) {
  try {
    const s = window.speechSynthesis; if (!s) return false; s.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = 0.85;
    const v = s.getVoices().find((x) => /zh[-_]CN/i.test(x.lang)) || s.getVoices().find((x) => /^zh/i.test(x.lang)); if (v) u.voice = v;
    s.speak(u); return true;
  } catch (_) { return false; }
}

// Đan dược thành phẩm của một lò (users.danDuoc)
export function danOfBatch(correct, total, reviewed) {
  const pct = total ? correct / total : 0;
  if (total >= 10 && pct >= 0.95 && reviewed >= 5) return { key: "cuuChuyen", zh: "九转金丹", vn: "Cửu Chuyển Kim Đan" };
  if (total >= 10 && pct >= 0.9) return { key: "kimDan", zh: "金丹", vn: "Kim Đan" };
  if (total >= 10 && pct >= 0.8) return { key: "trucCo", zh: "筑基丹", vn: "Trúc Cơ Đan" };
  if (correct >= 5) return { key: "tuKhi", zh: "聚气丹", vn: "Tụ Khí Đan" };
  return null;
}
