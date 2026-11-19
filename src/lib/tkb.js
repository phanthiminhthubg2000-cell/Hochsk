// THỜI KHOÁ BIỂU — bộ máy xếp lịch dùng chung (trang /thoi-khoa-bieu và tab Thời khoá biểu ở trang giáo viên)
// Lịch của lớp nằm trong trường `tkb` của tài liệu classes/{id}:
// { place, color, order, sched:[{from:"YYYY-MM-DD", days:[{d:0..6 (T2..CN), start:"19:00", end:"20:45"}]}],
//   lessons:["Lesson 1.1", …], cancel:{date:lý do}, extra:{date:{start,end}} (học bù), ov:{date:{start,end}} (đổi giờ),
//   notes:{date:text}, breaks:[{from,to?}] (tạm dừng), tpl:"hsk4"|"hsk5"|null, series:"hsk4v2"|… (giáo trình bài giảng), archived }
// Ngày nghỉ lễ chung: schedule_config/main { holidays:{date:tên} }
// Bài học tự xếp lần lượt vào từng buổi: nghỉ, dời, đổi lịch → các bài sau tự lùi/tiến.

export const COLORS = { teal: ["#0F7C74", "#E3F3F1"], indigo: ["#3F4BB8", "#E7E9FA"], amber: ["#A86400", "#FCF0DC"], rose: ["#B0306A", "#FBE6EF"], green: ["#3C8A2E", "#E6F3E2"], violet: ["#6B4FA0", "#EFE9F8"], sky: ["#1C6FA8", "#E2EFF8"], orange: ["#C4511A", "#FBE9DF"], slate: ["#4B5A6B", "#E9EDF1"], crimson: ["#B3122E", "#FAE3E7"] };
export const COLOR_KEYS = Object.keys(COLORS);
export const HAN = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
export const DOW = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
export const DS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addD = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const dowIdx = (d) => (d.getDay() + 6) % 7;
export const mins = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const dm = (s) => { const d = parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const fmtD = (s) => { const d = parse(s); return `${DOW[dowIdx(d)]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const fmtS = (s) => { const d = parse(s); return `${DS[dowIdx(d)]} ${dm(s)}`; };
export const tm = (x) => (x.end ? `${x.start}–${x.end}` : x.start);
export const today = () => ymd(new Date());
export const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
export const weekStart = (d) => addD(d, -dowIdx(d));
export const TOPTS = []; for (let m = 5 * 60; m < 24 * 60; m += 5) TOPTS.push(hm(m));
export const clone = (o) => JSON.parse(JSON.stringify(o));

export const emptyTkb = () => ({ place: "", color: "teal", order: 99, sched: [], lessons: [], cancel: {}, extra: {}, ov: {}, notes: {}, breaks: [], tpl: null, series: "" });

const segAt = (sched, ds) => { let s = null; for (const x of sched) if (x.from <= ds) s = x; return s; };
export function firstDate(c) { const xs = [...(c.sched || []).map((x) => x.from), ...Object.keys(c.extra || {})].sort(); return xs[0] || null; }

// Sinh danh sách buổi học của một lớp
export function gen(c, cid, holidays = {}) {
  const L = c.lessons || [], out = [], sched = [...(c.sched || [])].sort((a, b) => a.from.localeCompare(b.from));
  const extra = c.extra || {}, cancel = c.cancel || {}, ov = c.ov || {}, notes = c.notes || {}, brk = c.breaks || [];
  const st = firstDate(c); let i = 0, paused = null;
  if (!st || !L.length) return { list: out, left: L.length, paused: null };
  let d = parse(st), guard = 0;
  while (i < L.length && guard++ < 2000) {
    const ds = ymd(d);
    const b = brk.find((x) => ds >= x.from && (!x.to || ds <= x.to));
    if (b && !b.to) { paused = b.from; break; }
    if (!b) {
      let slot = null;
      if (extra[ds]) slot = { start: extra[ds].start, end: extra[ds].end || "", extra: true };
      else { const sg = segAt(sched, ds); const dd = sg && sg.days.find((x) => x.d === dowIdx(d)); if (dd) slot = { start: dd.start, end: dd.end || "" }; }
      if (slot) {
        if (ov[ds]) Object.assign(slot, { start: ov[ds].start, end: ov[ds].end || "" });
        const base = { cid, date: ds, ...slot, note: notes[ds] || "" };
        if (cancel[ds] !== undefined) out.push({ ...base, off: true, reason: cancel[ds] || "Nghỉ", idx: i });
        else if (holidays[ds] !== undefined) out.push({ ...base, off: true, hol: true, reason: holidays[ds] || "Nghỉ lễ", idx: i });
        else { out.push({ ...base, idx: i, lesson: L[i], no: 0 }); i++; }
      }
    }
    d = addD(d, 1);
  }
  let n = 0; out.forEach((s) => { if (!s.off) s.no = ++n; });
  return { list: out, left: L.length - i, paused };
}

export const isPast = (s) => { const t = today(); if (s.date < t) return true; if (s.date > t) return false; const e = mins(s.end) ?? mins(s.start) + 90; return nowMin() >= e; };
export const isNow = (s) => s.date === today() && nowMin() >= mins(s.start) && nowMin() < (mins(s.end) ?? mins(s.start) + 90);

// Toàn bộ lịch: courses = {id: {name, ...tkb}}
export function buildAll(courses, holidays = {}) {
  const g = {}, byDate = {};
  for (const [id, c] of Object.entries(courses)) {
    const x = gen(c, id, holidays); g[id] = x;
    x.list.forEach((s) => { (byDate[s.date] ||= []).push(s); });
  }
  for (const k in byDate) byDate[k].sort((a, b) => mins(a.start) - mins(b.start) || (courses[a.cid].order ?? 0) - (courses[b.cid].order ?? 0));
  return { gen: g, byDate };
}

export const STL = { active: "Đang học", soon: "Sắp khai giảng", paused: "Tạm dừng", done: "Đã kết thúc" };
export function stat(c, g) {
  const taught = g.list.filter((s) => !s.off && isPast(s)).length;
  const total = (c.lessons || []).length, next = g.list.find((s) => !s.off && !isPast(s));
  const real = g.list.filter((s) => !s.off), first = real[0], last = real[real.length - 1];
  let status;
  if (c.archived) status = "done";
  else if (g.paused && g.left > 0 && !next) status = "paused";
  else if (!next && g.left === 0) status = "done";
  else if (first && first.date > today()) status = "soon";
  else status = "active";
  return { taught, total, next, first, last, status };
}
export function schedText(c, ds) {
  const sg = segAt([...(c.sched || [])].sort((a, b) => a.from.localeCompare(b.from)), ds || today()) || (c.sched || [])[0];
  if (!sg || !sg.days.length) return "Chưa có lịch cố định";
  const groups = {}; sg.days.slice().sort((a, b) => a.d - b.d).forEach((x) => { const k = tm(x); (groups[k] ||= []).push(DS[x.d]); });
  return Object.entries(groups).map(([t, ds]) => `${ds.join(" · ")}  ${t}`).join("  |  ");
}

// ---------- giáo trình mẫu (danh sách buổi) ----------
export const TPL = {
  hsk4: { name: "HSK4", sub: "20 bài · 43 buổi", series: "hsk4v2", bai: 20, desc: ["Bài 1–10: mỗi bài 2 buổi (1.1, 1.2)", "Kiểm tra giữa khóa", "Bài 11–20: mỗi bài 2 buổi", "Ôn tập + Kiểm tra HSKK", "Kiểm tra cuối khóa"],
    build() { const o = []; for (let n = 1; n <= 10; n++) o.push({ t: `Lesson ${n}.1`, b: n }, { t: `Lesson ${n}.2`, b: n }); o.push({ t: "Kiểm tra giữa khóa", b: 10.5 }); for (let n = 11; n <= 20; n++) o.push({ t: `Lesson ${n}.1`, b: n }, { t: `Lesson ${n}.2`, b: n }); o.push({ t: "Ôn tập + Kiểm tra HSKK", b: 20.5 }, { t: "Kiểm tra cuối khóa", b: 20.6 }); return o; } },
  hsk5: { name: "HSK5", sub: "36 bài · 58 buổi", series: "hsk5v2", bai: 36, desc: ["Bài 1–18: mỗi bài 2 buổi (1.1, 1.2)", "Ôn tập", "Kiểm tra giữa khóa", "Bài 19–36: mỗi bài 1 buổi", "Ôn tập + HSKK", "Kiểm tra cuối khóa"],
    build() { const o = []; for (let n = 1; n <= 18; n++) o.push({ t: `Lesson ${n}.1`, b: n }, { t: `Lesson ${n}.2`, b: n }); o.push({ t: "Ôn tập", b: 18.5 }, { t: "Kiểm tra giữa khóa", b: 18.6 }); for (let n = 19; n <= 36; n++) o.push({ t: `Lesson ${n}`, b: n }); o.push({ t: "Ôn tập + HSKK", b: 36.5 }, { t: "Kiểm tra cuối khóa", b: 36.6 }); return o; } },
  hsk6: { name: "HSK6", sub: "40 bài · 82 buổi", series: "hsk6", bai: 40, desc: ["Bài 1–20: mỗi bài 2 buổi", "Ôn tập + Kiểm tra giữa khóa", "Bài 21–40: mỗi bài 2 buổi", "Ôn tập + HSKK", "Kiểm tra cuối khóa"],
    build() { const o = []; for (let n = 1; n <= 20; n++) o.push({ t: `Lesson ${n}.1`, b: n }, { t: `Lesson ${n}.2`, b: n }); o.push({ t: "Ôn tập + Kiểm tra giữa khóa", b: 20.5 }); for (let n = 21; n <= 40; n++) o.push({ t: `Lesson ${n}.1`, b: n }, { t: `Lesson ${n}.2`, b: n }); o.push({ t: "Ôn tập + HSKK", b: 40.5 }, { t: "Kiểm tra cuối khóa", b: 40.6 }); return o; } },
};
export const tplLessons = (k, from) => TPL[k].build().filter((x) => x.b >= from).map((x) => x.t);
export const guessTpl = (name) => { const m = String(name).toUpperCase().replace(/\s+/g, "").match(/HSK([456])/); return m ? "hsk" + m[1] : null; };

// ---------- liên kết bài giảng ----------
// series → { label, lecture id của bài n, chuỗi ải tự học }
export const SERIES = {
  hsk1v3: { label: "HSK1 · 3.0", lec: (n) => `static-hsk1-3-${pad(n)}`, cd: (n) => `hsk1v3-${pad(n)}`, max: 15 },
  hsk2v3: { label: "HSK2 · 3.0", lec: (n) => `static-hsk2-3-${pad(n)}`, cd: (n) => `hsk2v3-${pad(n)}`, max: 15 },
  hsk4v2: { label: "HSK4 · 2.0", lec: (n) => `static-hsk4-v2-${pad(n)}`, cd: (n) => `hsk4v2-${pad(n)}`, max: 20 },
  hsk4v3: { label: "HSK4 · 3.0", lec: (n) => `static-hsk4-3-${pad(n)}`, cd: (n) => `hsk4v3-${pad(n)}`, max: 22 },
  hsk5v2: { label: "HSK5 · 2.0", lec: (n) => `static-hsk5-${n <= 18 ? 1 : 2}-${pad(n)}`, cd: (n) => `hsk5v2-${pad(n)}`, max: 36 },
  hsk6: { label: "HSK6 · 2.0", lec: (n) => `static-hsk6-${n <= 20 ? 1 : 2}-${pad(n)}`, cd: (n) => `hsk6-${pad(n)}`, max: 40 },
};
export function lessonLinks(c, lesson) {
  const sr = SERIES[c.series || (c.tpl && TPL[c.tpl]?.series) || ""];
  const m = /(?:lesson|bài|第)\s*(\d+)/i.exec(lesson || "");
  if (!sr || !m) return null;
  const n = +m[1]; if (n < 1 || n > sr.max) return null;
  return { n, lecture: `/?tab=learn&lec=${sr.lec(n)}`, conDuong: `/con-duong/${sr.cd(n)}`, label: sr.label };
}

// Lịch có sẵn từ bản thời khoá biểu cũ (claude.ai) — để nhập một lần
export const LEGACY = [
  { name: "HSK5 – NB50", level: "HSK5", tkb: { place: "CS Yên Dũng", color: "crimson", order: 1, sched: [{ from: "2026-10-06", days: [{ d: 1, start: "19:00", end: "20:45" }, { d: 3, start: "19:00", end: "20:45" }, { d: 5, start: "19:00", end: "20:45" }] }], cancel: { "2026-11-14": "Nghỉ" }, extra: {}, ov: {}, notes: {}, breaks: [], tpl: "hsk5", series: "hsk5v2" } },
  { name: "HSK4 - MC272", level: "HSK4", tkb: { place: "CS Bắc Giang", color: "sky", order: 6, sched: [{ from: "2026-11-06", days: [{ d: 0, start: "19:35", end: "21:20" }, { d: 2, start: "19:35", end: "21:20" }, { d: 4, start: "19:35", end: "21:20" }] }], cancel: { "2026-11-13": "Nghỉ" }, extra: {}, ov: {}, notes: {}, breaks: [], tpl: "hsk4", series: "hsk4v2" } },
];
