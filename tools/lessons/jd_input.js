// Tạo đầu vào cho jd_gen.py từ bài giảng HSK4 2.0 (window.L): node jd_input.js hsk4-v2 03 > in.json
const fs = require("fs"), path = require("path");
function grabAt(src, i) { const open = src[i], close = open === "{" ? "}" : "]"; let d = 0, q = null;
  for (let j = i; j < src.length; j++) { const c = src[j];
    if (q) { if (c === "\\") { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === open) d++; else if (c === close) { d--; if (!d) return src.slice(i, j + 1); } } }
function loadL(file) { const s = fs.readFileSync(file, "utf8"); const m = /window\.L\s*=\s*/.exec(s); return (0, eval)("(" + grabAt(s, m.index + m[0].length) + ")"); }
module.exports = { loadL, grabAt };
if (require.main === module) {
  const [set, nn] = process.argv.slice(2);
  const L = loadL(path.join(__dirname, "../../public/lectures", set, `LESSON_${nn}.html`));
  const out = {};
  for (const t of L.texts) if (t.lines) out[String(t.n)] = { kind: t.kind === "对话" ? "hội thoại" : "đoạn văn", title: t.scene, lines: t.lines.map((l) => l[2]), words: t.words.map((w) => w.z) };
  if (L.culture && L.culture.passage) out.cu = { kind: "bài đọc văn hoá", title: L.culture.title, lines: L.culture.passage, words: (L.culture.terms || []).map((x) => x[0]) };
  process.stdout.write(JSON.stringify(out, null, 1));
}
