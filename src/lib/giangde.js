// GIẢNG ĐỀ (chữa đề HSK như một bài giảng): chuẩn hoá dữ liệu đề (2 trung tâm đề 3.0 / 2.0) thành danh sách câu hỏi
// có chữ để AI phân tích và để trình chiếu; tách bản chép lời nghe theo từng câu.
export const GD_COL = "exam_lessons"; // Firestore: exam_lessons/{dir__paperId} = { q: {n: {...}}, units: {i: {strategy}}, … }
export const CENTERS = [
  { dir: "hsk-exam", name: "HSK 3.0" },
  { dir: "hsk2-exam", name: "HSK 2.0" },
];
export const LETTERS = "ABCDEFGHIJ";
export const SEC_NAME = { L: "听力 Nghe", R: "阅读 Đọc", W: "书写 Viết" };
export const lessonKey = (dir, id) => `${dir}__${id}`;

export const strip = (s) =>
  String(s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

// một "mẩu chữ" trong đề có thể là chuỗi, {hz, py}, {img} hoặc mảng
export const tx = (x) => {
  if (x == null) return "";
  if (typeof x === "string" || typeof x === "number") return strip(x);
  if (Array.isArray(x)) return x.map(tx).filter(Boolean).join("\n");
  if (x.hz) return strip(x.hz);
  if (x.img) return "";
  return "";
};
const pyOf = (x) => (x && typeof x === "object" && !Array.isArray(x) && x.py ? x.py : "");
const imgOf = (x) => (x && typeof x === "object" && !Array.isArray(x) && x.img ? x.img : "");

// ---- Bản chép lời nghe → từng câu ----
const QLINE = /^\s*(\d{1,3})\s*[.．、](?!\d)\s*(.*)$/;
const QLINE2 = /^\s*第\s*(\d{1,3})\s*题\s*[：:]\s*(.*)$/;
const PASSAGE = /(?:现在开始)第\s*(\d{1,3})\s*(?:到|至|-|–|—|～|~)\s*(\d{1,3})\s*题|第\s*(\d{1,3})\s*(?:到|至|-|–|—|～|~)\s*(\d{1,3})\s*题(?:是)?根据|^第\s*(\d{1,3})\s*(?:到|至|-|–|—)\s*(\d{1,3})\s*题\s*[：:]\s*$|^(\d{1,3})\s*(?:—|–|-|～|~|到)\s*(\d{1,3})\s*[.．、：:]?\s*$/;
const JUNK = /^\s*(第[一二三四五]部分|第\s*\d{1,3}\s*(?:到|至|-|–|—)\s*\d{1,3}\s*题[^根]|一共\s*\d+\s*个题|例如|现在开始第|听力考试现在结束|请大家注意|大家好|HSK\s*[（(].{1,4}[）)]\s*听力考试分|（音乐|\(音乐|中文水平考试|听力文本|HSK\s*[（(].{1,6}[）)]\s*模拟试卷|（第\d)/;

export function splitScript(script) {
  const byQ = {};
  const passages = []; // {from, to, text}
  if (!script) return { byQ, passages };
  const lines = String(script).replace(/\r/g, "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").split("\n");
  let cur = null; // {kind:"q", n} | {kind:"p", p}
  let last = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const pm = line.match(PASSAGE);
    if (pm) {
      const p = { from: +(pm[1] || pm[3] || pm[5] || pm[7]), to: +(pm[2] || pm[4] || pm[6] || pm[8]), lines: [] };
      const rest = pm[1] ? line.slice(line.indexOf(pm[0]) + pm[0].length).replace(/^[：:，,。\s]+/, "").trim() : line.replace(/^.*?根据[^：:]*[：:]?/, "").trim();
      if (rest) p.lines.push(rest);
      passages.push(p);
      cur = { kind: "p", p };
      continue;
    }
    const qm = line.match(QLINE) || line.match(QLINE2);
    if (qm) {
      const n = +qm[1];
      if (n > last && n <= last + 25) {
        last = n;
        byQ[n] = qm[2] ? [qm[2]] : [];
        cur = { kind: "q", n };
        continue;
      }
    }
    if (JUNK.test(line)) { cur = null; continue; }
    if (!cur) continue;
    if (cur.kind === "q") byQ[cur.n].push(line);
    else cur.p.lines.push(line);
  }
  const out = {};
  Object.entries(byQ).forEach(([n, ls]) => (out[n] = ls.join("\n").trim()));
  return { byQ: out, passages: passages.map((p) => ({ from: p.from, to: p.to, text: p.lines.join("\n").trim() })) };
}

// ---- Đề → danh sách câu đã chuẩn hoá ----
// item: { n, sec, part, u (chỉ số unit), head, passage, listen, stem, opts:[{k,t,py,img}], ans, ansText, type, img, extra }
export function buildItems(paper) {
  const { byQ, passages } = splitScript(paper?.script || "");
  const items = [];
  const units = (paper?.units || []).map((u, ui) => {
    const ref = u.ref && typeof u.ref === "object" && Array.isArray(u.ref.items) ? u.ref.items : null;
    const passage = Array.isArray(u.passage) ? u.passage.map(tx).join("\n\n") : tx(u.passage);
    const nums = [];
    (u.qs || []).forEach((q) => {
      const t = q.t || "x";
      let opts = [];
      if (t === "c" && Array.isArray(q.o)) opts = q.o.map((o, i) => ({ k: LETTERS[i], t: tx(o), py: pyOf(o), img: imgOf(o) }));
      else if (t === "m" && ref) opts = ref.map((r) => ({ k: r.k, t: tx(r.hz ?? r.t ?? r), py: r.py || "", img: r.img || "" }));
      let stem = tx(q.s);
      if (!stem && (q.pre || q.post)) stem = `${strip(q.pre || "")}（　　）${strip(q.post || "")}`;
      const sPy = pyOf(q.s) || (typeof q.py === "string" ? q.py : "");
      const p = tx(q.p);
      const pPy = pyOf(q.p);
      let ans = q.a;
      let ansText = "";
      if (t === "c" || t === "m") {
        const o = opts.find((x) => x.k === ans);
        ansText = o ? `${ans}. ${o.t || "(hình)"}` : String(ans ?? "");
      } else if (Array.isArray(ans)) ansText = ans.join(" / ");
      else ansText = String(ans ?? "");
      let extra = "";
      if (t === "b") extra = (q.w || []).join("　");
      if (t === "w") extra = [q.prompt, q.word && !String(q.prompt || "").includes(q.word) ? `Từ: ${q.word}` : "", q.prompt2].filter(Boolean).map(strip).join("\n");
      if (t === "w" && !ansText) ansText = strip(q.ref || "");
      if (t === "w" && q.ref) ansText = strip(q.ref);
      let listen = "";
      if (u.sec === "L") {
        const ps = passages.find((x) => q.n >= x.from && q.n <= x.to);
        listen = [ps && ps.text ? ps.text : "", byQ[q.n] || ""].filter(Boolean).join("\n\n");
      }
      const it = {
        n: q.n, sec: u.sec, part: String(u.part), u: ui, head: strip(u.head), passage, listen,
        stem, sPy, p, pPy, opts, ans, ansText, type: t, img: q.img || "", extra, min: q.min || 0,
        at: Array.isArray(paper?.qtime?.[q.n]) ? paper.qtime[q.n] : null, // [đầu, cuối, (đầu nhóm, cuối nhóm)] giây trong file nghe
      };
      items.push(it);
      nums.push(q.n);
    });
    return { i: ui, sec: u.sec, part: String(u.part), label: u.label, head: strip(u.head), passage, img: u.img ? (String(u.img).startsWith("/") ? u.img : "") : "", nums };
  });
  return { items, units };
}

// Chữ gửi cho AI: một câu hỏi
export function itemPrompt(it) {
  const L = [];
  L.push(`### Câu ${it.n} [${it.sec}${it.part}${it.type === "b" ? " · sắp xếp câu" : it.type === "w" ? " · viết" : it.type === "m" ? " · ghép/chọn từ" : it.type === "i" ? " · viết chữ Hán" : ""}]`);
  if (it.listen) L.push(`Lời nghe:\n${it.listen}`);
  if (it.p) L.push(`Đoạn văn: ${it.p}`);
  if (it.stem) L.push(`Câu hỏi: ${it.stem}${it.sPy ? ` (${it.sPy})` : ""}`);
  if (it.extra) L.push(`Đề: ${it.extra}`);
  if (it.opts.length) L.push(`Phương án: ${it.opts.map((o) => `${o.k}. ${o.t || "(hình ảnh)"}`).join("　")}`);
  if (it.img && it.type !== "c") L.push(`(có hình ảnh minh hoạ)`);
  L.push(`Đáp án đúng: ${it.ansText || "(không có)"}`);
  return L.join("\n");
}

export const FIELDS = [
  { k: "key", label: "Đáp án & căn cứ", rows: 4 },
  { k: "traps", label: "Vì sao các phương án khác sai", rows: 4 },
  { k: "point", label: "Kiến thức trọng điểm", rows: 3 },
  { k: "vocab", label: "Từ vựng cần nhớ", rows: 4 },
  { k: "tip", label: "Mẹo làm dạng này", rows: 2 },
  { k: "note", label: "Ghi chú riêng của giáo viên (không hiện cho học viên)", rows: 2 },
];

// ---- Bài làm của học viên (hsk3_submissions) ----
export function subAnswers(h) {
  let ans = {};
  try { ans = JSON.parse(h?.answersJson || "{}") || {}; } catch (_) { ans = {}; }
  if (!Object.keys(ans).length) {
    // bài nộp cũ: dựng lại từ chuỗi chấm tự động "12:B✓ 13:C✗A"
    [h?.listeningDetail, h?.readingDetail, h?.writingAutoDetail].filter(Boolean).join(" ").split(/\s+/).forEach((x) => {
      const m = x.match(/^(\d+):(.*?)(✓|✗)/); if (m && m[2] !== "-") ans[m[1]] = m[2];
    });
  }
  return ans;
}
const normTxt = (s) => String(s ?? "").replace(/[\s，。！？、,.!?“”"'：:；;（）()]/g, "");
// đúng / sai / null (không chấm tự động được: bài viết)
export function isRight(it, v) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return false;
  if (it.type === "c" || it.type === "m") return String(v).trim().toUpperCase() === String(it.ans ?? "").trim().toUpperCase();
  if (it.type === "w") return null;
  const keys = (Array.isArray(it.ans) ? it.ans : [it.ans]).map(normTxt).filter(Boolean);
  if (!keys.length) return null;
  return keys.includes(normTxt(Array.isArray(v) ? v.join("") : v));
}
// thống kê cả lớp: { n: { total, ok, pct, pick: {A: 2, …}, wrong: [tên] } }
export function classStats(items, subs) {
  const out = {};
  items.forEach((it) => {
    if (it.type === "w") return;
    const s = { total: 0, ok: 0, pick: {}, wrong: [] };
    subs.forEach((h) => {
      const v = h.ans[it.n];
      const r = isRight(it, v);
      if (r == null) return;
      s.total++;
      if (r) s.ok++; else s.wrong.push(h.name);
      if (it.type === "c" || it.type === "m") { const k = v ? String(v).toUpperCase() : "–"; s.pick[k] = (s.pick[k] || 0) + 1; }
    });
    if (s.total) { s.pct = Math.round((s.ok / s.total) * 100); out[it.n] = s; }
  });
  return out;
}

// ---- Lưu bài chữa: ưu tiên exam_lessons; nếu Firestore chưa mở quyền cho collection này
// thì lưu sang schedule_config (đã được phép ghi) với id "gd__<khoá>" ----
export const GD_FALLBACK = "schedule_config";
const denied = (e) => /permission|insufficient/i.test(String(e?.code || e?.message || e));
export async function gdRead(fs, db, key) {
  const { doc, getDoc } = fs;
  let primary = null, err = null;
  try { const s = await getDoc(doc(db, GD_COL, key)); primary = s.exists() ? s.data() : null; } catch (e) { err = e; }
  if (primary) return { data: primary, where: GD_COL };
  try { const s = await getDoc(doc(db, GD_FALLBACK, "gd__" + key)); if (s.exists()) return { data: s.data(), where: GD_FALLBACK }; } catch (e) { if (!err) err = e; }
  return { data: null, where: err && denied(err) ? GD_FALLBACK : GD_COL };
}
export async function gdWrite(fs, db, key, patch, where) {
  const { doc, setDoc } = fs;
  if (where !== GD_FALLBACK) {
    try { await setDoc(doc(db, GD_COL, key), patch, { merge: true }); return GD_COL; }
    catch (e) { if (!denied(e)) throw e; }
  }
  await setDoc(doc(db, GD_FALLBACK, "gd__" + key), { ...patch, gdKey: key }, { merge: true });
  return GD_FALLBACK;
}
export async function gdListPublished(fs, db) {
  const { collection, getDocs, query, where } = fs;
  const out = new Map();
  for (const [col, pre] of [[GD_COL, ""], [GD_FALLBACK, "gd__"]]) {
    try {
      const s = await getDocs(query(collection(db, col), where("published", "==", true)));
      s.forEach((d) => { if (pre && !d.id.startsWith(pre)) return; const id = d.id.slice(pre.length); if (!out.has(id)) out.set(id, { id, ...d.data() }); });
    } catch (_) { /* collection chưa được phép đọc */ }
  }
  return [...out.values()];
}
