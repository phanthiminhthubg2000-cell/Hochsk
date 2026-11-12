// Trích window.LESSON của 30 bài giảng HSK6 (public/lectures/hsk6-*) thành JSON gọn cho trang Con Đường (/con-duong/hsk6-XX)
// Kèm "seg": câu → các mảnh từ (tách theo từ điển thẻ HSK + từ của bài), dùng cho dạng xếp mảnh.
// Chạy lại khi sửa bài giảng:  node tools/lessons/extract_hsk6.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const LDIR = path.join(ROOT, "public", "lectures");
const OUT = path.join(ROOT, "public", "data", "con-duong");
fs.mkdirSync(OUT, { recursive: true });

const dict = new Set();
for (const f of fs.readdirSync(path.join(ROOT, "public", "data", "cards"))) {
  if (!f.endsWith(".json")) continue;
  for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "cards", f), "utf8"))) if (c[0]) dict.add(c[0].replace(/[（(].*?[)）]/g, ""));
}
const strip = (x) => String(x || "").replace(/<[^>]+>/g, "");
const isHan = (c) => /[㐀-鿿]/.test(c);
// Ưu tiên jieba (cài tạm: npm i --no-save jieba-wasm); không có thì tách theo từ điển thẻ HSK
let jieba = null;
try { jieba = require(process.env.JIEBA || "jieba-wasm"); } catch (_) { console.log("Không có jieba-wasm — tách theo từ điển thẻ"); }
function seg(s, local) {
  if (jieba) {
    if (jieba.add_word) local.forEach((w) => { try { jieba.add_word(w); } catch (_) {} });
    // dấu câu trong câu → "|" (ranh giới vế, để khi ghép mảnh không ghép xuyên dấu phẩy)
    const t = jieba.cut(s, true).map((x) => x.trim()).filter(Boolean).map((x) => (/[\u3400-\u9fffA-Za-z0-9]/.test(x) ? x : "|"));
    return t.filter((x, i) => !(x === "|" && (i === 0 || i === t.length - 1 || t[i - 1] === "|")));
  }
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (!isHan(c)) {
      if (/[A-Za-z0-9]/.test(c)) { let j = i; while (j < s.length && /[A-Za-z0-9.%]/.test(s[j])) j++; out.push(s.slice(i, j)); i = j; continue; }
      i++; continue; // bỏ dấu câu
    }
    let w = c;
    for (let n = 6; n >= 2; n--) { const t = s.slice(i, i + n); if (t.length === n && [...t].every(isHan) && (local.has(t) || dict.has(t))) { w = t; break; } }
    out.push(w); i += w.length;
  }
  return out;
}
const files = [];
for (const d of ["hsk6-1", "hsk6-2"]) for (const f of fs.readdirSync(path.join(LDIR, d)).sort()) if (/^LESSON_\d+\.html$/.test(f)) files.push(path.join(LDIR, d, f));
const index = [];
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  const m = s.match(/<script>(window\.LESSON=[\s\S]*?)<\/script>/);
  if (!m) { console.log("bỏ qua", f); continue; }
  const window = {}; eval(m[1]); const L = window.LESSON;
  const local = new Set([...(L.V || []).map(v => v[1]), ...(L.extra || []).map(x => x[0]), ...(L.G || []).map(g => g.word).filter(Boolean)]);
  const sents = new Set();
  (L.G || []).forEach(g => { (g.ex || []).forEach(e => sents.add(e[0])); (g.practice?.items || []).forEach(it => sents.add(it[1])); });
  (L.EX2?.items || []).forEach(it => sents.add(it[2]));
  (L.V || []).forEach(v => v[10] && sents.add(v[10]));
  const segMap = {}; sents.forEach(x => { const t = strip(x); segMap[t] = seg(t, local); });
  const id = `hsk6-${String(L.num).padStart(2, "0")}`;
  const keep = { id, num: L.num, unit: L.unit, title: L.title, vn: L.vn, goals: L.goals, outline: L.outline, vgroups: L.vgroups, V: L.V, extra: L.extra, T: L.T, G: L.G, BX: L.BX, EX2: L.EX2, EX3: L.EX3, HSK: L.HSK, W: L.W, SUM: L.SUM, lecture: "/" + path.relative(path.join(ROOT, "public"), f).split(path.sep).join("/"), seg: segMap };
  fs.writeFileSync(path.join(OUT, id + ".json"), JSON.stringify(keep));
  index.push({ id, num: L.num, title: L.title, vn: L.vn, unit: L.unit });
}
fs.writeFileSync(path.join(OUT, "hsk6-index.json"), JSON.stringify(index));
console.log("Đã ghi", index.length, "bài vào", OUT);
