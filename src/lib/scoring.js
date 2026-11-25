// Thang điểm theo cấu trúc đề thi thật — dùng chung cho trang giáo viên (chấm) và trang học viên (phiếu điểm).
//
// HSK: mỗi kỹ năng 100 điểm. Có phần Viết → tổng 300, đạt 180; không có Viết (HSK 1–2) → tổng 200, đạt 120.
// HSKK: tổng 100, đạt 60. Điểm từng phần chia theo dạng câu và thời gian nói
// (Hanban không công bố điểm từng phần, chỉ công bố tổng — đây là cách chia gần với độ nặng của từng phần).

// ---------------- HSK ----------------
// Dạng câu viết (để AI chấm đúng tiêu chí và tính trọng số trong 100 điểm Viết)
export function hskWritingKind(it = {}) {
  const p = String(it.prompt || ""), min = Number(it.min) || 0;
  if (/缩写/.test(p) || min >= 350) return "suoxie";
  if (min >= 60 || /短文|作文|写一篇/.test(p)) return "essay";
  if (it.img) return "picture";
  return "sentence";
}
export const HSK_W_KIND = {
  sentence: { vi: "Đặt câu / hoàn thành câu", w: 2 },
  picture: { vi: "Nhìn tranh, dùng từ đặt câu", w: 2 },
  essay: { vi: "Viết đoạn văn", w: 6 },
  suoxie: { vi: "Tóm tắt (缩写)", w: 100 },
};

// Điểm Viết /100 = trung bình có trọng số: câu tự chấm (sắp xếp, điền chữ) mỗi câu trọng số 1, câu viết mở theo dạng.
export function hskWritingScore(sub, items, aiItems) {
  const auto = { c: Number(sub.writingAutoCorrect) || 0, t: Number(sub.writingAutoTotal) || 0 };
  let sum = auto.c * 100, w = auto.t;
  const byN = Object.fromEntries((aiItems || []).map((x) => [String(x.n), x]));
  for (const it of items || []) {
    const k = HSK_W_KIND[hskWritingKind(it)].w; const a = byN[String(it.n)];
    if (!a) return null;              // chưa chấm xong
    sum += (Number(a.score) || 0) * k; w += k;
  }
  return w ? Math.round(sum / w) : null;
}

export const hasWriting = (sub) => !!(Number(sub?.writingAutoTotal) || (Array.isArray(sub?.writingItems) && sub.writingItems.length) || sub?.writing71 != null || sub?.writing72 != null);

export function hskReport({ L, R, W, withW }) {
  const sections = [["Nghe 听力", L], ["Đọc 阅读", R], ...(withW ? [["Viết 书写", W]] : [])].map(([name, v]) => ({ name, score: clamp(v, 100), max: 100 }));
  const max = sections.length * 100, total = sections.reduce((s, x) => s + x.score, 0);
  const pass = sections.length * 60;
  return { kind: "hsk", sections, total, max, pass, passed: total >= pass };
}

// ---------------- HSKK ----------------
// Dạng câu: repeat (nghe nhắc lại 1 câu ngắn) | retell (nghe rồi thuật lại đoạn) | read (đọc to) | picture | answer
export function hskkKind(a = {}) {
  if (a.type === "repeat") return /复述|thuật lại/.test(a.question || "") ? "retell" : "repeat";
  return ["read", "picture", "answer"].includes(a.type) ? a.type : "answer";
}
export const HSKK_KIND = {
  repeat: { zh: "听后重复", vi: "Nghe rồi nhắc lại", w: 1 },
  retell: { zh: "听后复述", vi: "Nghe rồi thuật lại", w: 5 },
  read: { zh: "朗读", vi: "Đọc thành tiếng", w: 5 },
  picture: { zh: "看图说话", vi: "Nhìn tranh nói", w: 5 },
  answer: { zh: "回答问题", vi: "Trả lời câu hỏi", w: 5 },
};
const NO = ["一", "二", "三", "四", "五"];
export const HSKK_PASS = 60;

// Chia bài HSKK thành các phần như đề (第一部分…), tính điểm tối đa mỗi câu sao cho tổng = 100.
export function hskkPlan(answers = []) {
  const parts = [];
  for (const a of answers) {
    const k = hskkKind(a);
    let p = parts[parts.length - 1];
    if (!p || p.kind !== k) { p = { kind: k, ids: [] }; parts.push(p); }
    p.ids.push(a.id);
  }
  // nhìn tranh nhiều câu ngắn (HSKK 3 – 5 tranh) → mỗi câu nhẹ hơn
  const wOf = (p) => (p.kind === "picture" && p.ids.length >= 3 ? 2 : HSKK_KIND[p.kind].w);
  const W = parts.reduce((s, p) => s + wOf(p) * p.ids.length, 0) || 1;
  // điểm mỗi phần là số nguyên, tổng 100; trong phần chia đều cho các câu (lẻ 0,1)
  const per = {}; let used = 0;
  const maxes = parts.map((p, i) => { const v = i === parts.length - 1 ? 100 - used : Math.round((wOf(p) * p.ids.length / W) * 100); used += v; return v; });
  parts.forEach((p, i) => { let u = 0; p.ids.forEach((id, j) => { const v = j === p.ids.length - 1 ? round1(maxes[i] - u) : round1(maxes[i] / p.ids.length); per[id] = v; u += v; }); });
  return {
    per,
    parts: parts.map((p, i) => ({ no: i + 1, title: `第${NO[i] || i + 1}部分 · ${HSKK_KIND[p.kind].zh}`, vi: HSKK_KIND[p.kind].vi, kind: p.kind, ids: p.ids, max: maxes[i] })),
  };
}

export function hskkReport(plan, itemScores) {
  const sections = plan.parts.map((p) => ({ name: p.title, score: round1(p.ids.reduce((s, id) => s + Math.min(Number(itemScores[id]) || 0, plan.per[id]), 0)), max: p.max }));
  const total = Math.round(sections.reduce((s, x) => s + x.score, 0));
  return { kind: "hskk", sections, total, max: 100, pass: HSKK_PASS, passed: total >= HSKK_PASS };
}

const round1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, m) => Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
