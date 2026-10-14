// ============================================================
// BOM NỔ CHẬM 传炸弹 — logic dùng chung (máy giáo viên & máy học sinh)
// Phòng chơi lưu ở Firestore: game_rooms/{code}
//   ├─ players/{pid}   : tên, điểm, số lần nổ
//   └─ answers/{auto}  : câu trả lời học sinh gửi lên (máy giáo viên chấm)
// ============================================================

export const ROOMS = "game_rooms";

export const MODES = [
  ["mix", "🎲 Trộn"],
  ["hz2vi", "汉字 → Nghĩa"],
  ["vi2hz", "Nghĩa → 汉字"],
  ["hz2def", "汉字 → 释义"],
  ["def2hz", "释义 → 汉字"],
  ["py2hz", "Pinyin → 汉字"],
  ["hz2py", "汉字 → Pinyin"],
];

const KEYOF = { hz2vi: 2, vi2hz: 0, hz2def: 3, def2hz: 0, py2hz: 0, hz2py: 1 };
const NEED = (m) => (/vi/.test(m) ? 2 : /def/.test(m) ? 3 : 0);

export const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const pickOne = (a) => a[(Math.random() * a.length) | 0];

export function hasField(level, idx) {
  return level.lessons.some((l) => l.w.some((w) => w[idx]));
}
export function modeAllowed(level, m) {
  if (m === "mix") return true;
  const n = NEED(m);
  return n ? hasField(level, n) : true;
}

export function buildPool(level, lessonIdx) {
  const seen = new Set();
  const out = [];
  lessonIdx.forEach((i) =>
    (level.lessons[i]?.w || []).forEach((w) => {
      if (!seen.has(w[0])) {
        seen.add(w[0]);
        out.push(w);
      }
    })
  );
  return out;
}

function modesForWord(w) {
  const m = ["py2hz", "hz2py"];
  if (w[2]) m.push("hz2vi", "vi2hz", "vi2hz");
  if (w[3]) m.push("hz2def", "def2hz", "def2hz");
  return m;
}

// Tạo 1 câu hỏi 4 đáp án. Trả về { id, mode, word, prompt, opts, ans, key }
export function makeQuestion(pool, mode, avoid = new Set()) {
  let cand = pool.filter((w) => !avoid.has(w[0]));
  if (cand.length < 1) cand = pool;
  let w = pickOne(cand);
  let m = mode;
  if (m === "mix" || (NEED(m) && !w[NEED(m)])) m = pickOne(modesForWord(w));
  const key = KEYOF[m];
  const need = NEED(m);
  const others = shuffle(
    pool.filter((x) => x[0] !== w[0] && x[key] && x[key] !== w[key] && x[1] !== w[1] && (!need || x[need]))
  );
  const same = others.filter((x) => x[0].length === w[0].length);
  const ds = [];
  for (const x of same.concat(others)) {
    if (ds.length >= 3) break;
    if (!ds.includes(x[key])) ds.push(x[key]);
  }
  const opts = shuffle([w[key], ...ds]);
  return {
    id: Math.random().toString(36).slice(2, 10),
    mode: m,
    word: w,
    opts,
    ans: opts.indexOf(w[key]),
    key,
  };
}

// Câu hỏi hiển thị (không chứa đáp án) — gửi lên phòng cho mọi máy
export function publicQuestion(q) {
  const w = q.word;
  let ask = "", big = "", kind = "hz";
  switch (q.mode) {
    case "hz2vi": ask = "Từ này nghĩa là gì?"; big = w[0]; kind = "hz"; break;
    case "vi2hz": ask = "Từ nào nghĩa là"; big = `“${w[2]}”`; kind = "vi"; break;
    case "hz2def": ask = "这个词是什么意思？"; big = w[0]; kind = "hz"; break;
    case "def2hz": ask = "哪个词的意思是："; big = w[3]; kind = "def"; break;
    case "py2hz": ask = "Chữ nào đọc là"; big = w[1]; kind = "py"; break;
    default: ask = "Từ này đọc là gì?"; big = w[0]; kind = "hz";
  }
  const optKind = q.key === 0 ? "hz" : q.key === 1 ? "py" : q.key === 3 ? "def" : "vi";
  return { id: q.id, ask, big, kind, opts: q.opts, optKind };
}

export const newCode = () => String(100000 + Math.floor(Math.random() * 900000));
export const newPid = () => Math.random().toString(36).slice(2, 12);

export async function loadVocab() {
  const r = await fetch("/games/vocab.json", { cache: "force-cache" });
  return r.json();
}
