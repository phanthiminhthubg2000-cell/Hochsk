// ============================================================
// Trích MỌI bộ bài giảng (trừ HSK6 — xem extract_hsk6.js) thành JSON Con Đường cùng khuôn với HSK6
//   node tools/lessons/extract_all.js        (cần jieba-wasm để tách mảnh câu: npm i --no-save jieba-wasm, hoặc JIEBA=<đường dẫn>)
// Ba định dạng bài giảng đang có:
//   B  window.LESSON = { META, V, TEXT, GRAMMAR, BIANXI, GAME, PRACTICE, HSK … }   (HSK4 3.0, HSK5 2.0)
//   C  LESSON = { vocab{}, chars, radicals, texts[] }                                (HSK1 3.0, HSK2 3.0)
//   D  window.L = { texts[ {lines, words[]} ], lianxi, kz, exam, wb … }              (HSK4 2.0)
// Đầu ra: public/data/con-duong/<mã>.json (V, vgroups, T, G, BX[], FILL, ORDER, HSKQ, W, seg) + all-index.json
// ============================================================
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const LDIR = path.join(ROOT, "public", "lectures");
const OUT = path.join(ROOT, "public", "data", "con-duong");
fs.mkdirSync(OUT, { recursive: true });

let jieba = null;
try { jieba = require(process.env.JIEBA || "jieba-wasm"); } catch (_) { console.log("Không có jieba-wasm — tách mảnh theo từng chữ"); }
const strip = (x) => String(x ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
function seg(s, local) {
  s = strip(s);
  if (jieba) {
    if (jieba.add_word) local.forEach((w) => { try { jieba.add_word(w); } catch (_) {} });
    const t = jieba.cut(s, true).map((x) => x.trim()).filter(Boolean).map((x) => (/[㐀-鿿A-Za-z0-9]/.test(x) ? x : "|"));
    return t.filter((x, i) => !(x === "|" && (i === 0 || i === t.length - 1 || t[i - 1] === "|")));
  }
  return [...s].map((c) => (/[㐀-鿿\w]/.test(c) ? c : "|"));
}

// ---- đọc biến dữ liệu trong tệp HTML (khớp ngoặc, bỏ qua chuỗi) ----
function grabAt(src, i) {
  const open = src[i], close = open === "{" ? "}" : "]"; let d = 0, q = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === "\\") { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === open) d++; else if (c === close) { d--; if (!d) return src.slice(i, j + 1); }
  }
  return null;
}
function load(file) {
  const s = fs.readFileSync(file, "utf8");
  let m = /(?:window\.|const\s+|let\s+|var\s+)LESSON\s*=\s*/.exec(s);
  if (m) { const L = (0, eval)("(" + grabAt(s, m.index + m[0].length) + ")"); return { fmt: L.META ? "B" : "C", L }; }
  m = /window\.L\s*=\s*/.exec(s);
  if (m) return { fmt: "D", L: (0, eval)("(" + grabAt(s, m.index + m[0].length) + ")") };
  return null;
}

// ---- tiện ích ----
const chunk = (n, size) => { const k = Math.max(1, Math.ceil(n / size)); const s = Math.ceil(n / k); return Array.from({ length: k }, (_, i) => [i * s, Math.min(n, (i + 1) * s)]).filter(([a, b]) => b > a); };
const blank = (s) => String(s || "").replace(/_{2,}|＿{2,}|\{\}/g, "＿＿");
const lineOf = (lines, w) => lines.find((l) => l.includes(w)) || "";
const TF = (stmt, ok, say, why) => ({ ins: say ? "Nghe rồi chọn: câu sau đúng hay sai?" : "Câu sau đúng hay sai?", say: say || undefined, sent: stmt, opts: ["Đúng", "Sai"], a: ok ? 0 : 1, why: why || "" });

// ============ B: HSK4 3.0, HSK5 2.0 ============
function fromB(L) {
  const M = L.META || {}; const N = L._N || {};
  const V = (L.V || []).map((v, i) => [i + 1, v[0], v[1], v[2], "", v[3], v[4] === 0 ? 0 : 1, "", v[5] || "", v[6] || "", v[7] || "", v[8] || "", v[9] || [], [v[10], N[v[0]]].filter(Boolean).join("<br>")]);
  const vgroups = chunk(V.length, 13).map(([a, b], i) => ({ from: a + 1, to: b, name: `Nhóm ${i + 1}`, sub: V.slice(a, b).slice(0, 3).map((v) => v[1]).join(" · ") + "…" }));
  const T = (L.TEXT || []).map((t) => ({ zh: (t.paras || []).map(strip).join("\n"), vn: "", idea: strip(t.idea), title: strip(t.title), qs: (t.qs || []).filter((q) => Array.isArray(q[1])).map((q) => ({ q: strip(q[0]), o: q[1].map(strip), a: q[2] })) }));
  const G = (L.GRAMMAR || []).map((g) => ({
    zh: strip(g.word), py: g.py || "", tag: strip(g.pos), mean: g.vn || "", forms: (g.forms || []).map(strip),
    ex: (g.ex || []).map((e) => [strip(e[0]), strip(e[1])]),
    tips: (g.err || []).map((e) => `${e[0]} → ${e[1]} · ${e[2] || ""}`),
    practice: { items: (g.book || []).filter((b) => b[2]).map((b) => [strip(b[0]).replace(/_{3,}/g, "＿＿"), strip(b[2])]) },
    drill: (g.drill || []).filter((d) => Array.isArray(d[1])).map((d) => ({ q: d[0], o: d[1].map((x) => String(x)), a: d[2], why: d[3] || "" })),
  }));
  const BX = (L.BIANXI || []).map((b) => {
    const cols = (b.head || []).slice(1).map(strip);
    return {
      pair: strip(b.pair), cols,
      same: b.rows?.[0] ? [b.rows[0][1] || ""] : [],
      diff: (b.rows || []).slice(1).map((r) => [`<b>${r[0]}</b><br>${r[1] || ""}`, "", r[2] || ""]),
      task: b.quiz?.length ? { q: `Chọn từ thích hợp · ${strip(b.pair)}`, cols: (b.opts || cols).map(strip), items: b.quiz.map((q) => [q[0], q[1], q[2] || ""]) } : null,
    };
  });
  const FILL = [];
  (L.GAME?.fill || []).forEach((f) => FILL.push({ sent: blank(f[0]), ans: f[1], opts: f[2] }));
  const P = L.PRACTICE || {};
  if (P.ex1?.items) P.ex1.items.forEach((it) => { if (it[1].length === 1) FILL.push({ sent: blank(it[0]), ans: it[1][0], opts: P.ex1.bank }); });
  if (Array.isArray(P.ex2)) P.ex2.forEach((it) => { if (Array.isArray(it[1])) FILL.push({ sent: blank(it[0]), ans: it[1][it[2]], opts: it[1] }); });
  if (Array.isArray(P.ex3)) P.ex3.forEach((it) => { if (typeof it[0] === "string" && /<u>A<\/u>/.test(it[0]) && Number.isInteger(it[2])) FILL.push({ ins: `Đặt “${it[1]}” vào vị trí nào?`, sent: it[0], ans: "ABCD"[it[2]], opts: ["A", "B", "C", "D"], why: it[3] || "", html: true }); });
  const ORDER = (L.GAME?.order || []).map((o) => ({ tokens: String(o[0]).split("|").map(strip).filter(Boolean) }));
  const H = L.HSK || {}; const HSKQ = [];
  (H.l || []).forEach((q) => HSKQ.push({ ins: strip(q.q), say: String(q.d || "").replace(/\|/g, "\n"), o: q.o, a: q.a, why: q.why }));
  [...(H.r1 || [])].forEach((r) => { const text = (r.text || []).map(strip).join("\n"); (r.qs || []).forEach((q) => HSKQ.push({ ins: `Chọn từ điền vào chỗ (${q.n})`, passage: text.replace(new RegExp(`\\{${q.n}\\}`), `（${q.n}）＿＿`).replace(/\{(\d+)\}/g, "（$1）"), o: q.o, a: q.a, why: q.why })); });
  [...(H.r3 || [])].forEach((r) => { const text = (r.text || []).map(strip).join("\n"); (r.qs || []).forEach((q) => HSKQ.push({ ins: strip(q.s), passage: text, fold: true, o: q.o, a: q.a, why: q.why })); });
  if (H.w?.order) H.w.order.forEach((o) => ORDER.push({ tokens: String(o).split("|").map(strip).filter(Boolean) }));
  const ess = H.w?.essay || H.w72 || null;
  const W = ess ? { task: strip(ess.prompt), vn: strip(ess.vn), target: ess.min || (/(\d+)字/.exec(ess.prompt || "") || [])[1] || 100, steps: (ess.tips || []).map((t, i) => [`Gợi ý ${i + 1}`, t]), model: ess.sample || "", check: [] } : null;
  return { title: strip(M.title), vn: strip(M.vn), num: M.num, V, vgroups, T, G, BX, FILL, ORDER, HSKQ, W };
}

// ============ C: HSK1 3.0, HSK2 3.0 ============
function fromC(L, name) {
  const lineText = (l) => (l.t || []).map((x) => (Array.isArray(x) ? x[0] : x)).join("");
  const T = (L.texts || []).map((t) => {
    const ls = (t.lines || []).map((l) => ({ who: l.who || "", zh: lineText(l), vi: strip(l.vi), toks: (l.t || []).filter(Array.isArray).map((x) => x[0]) }));
    return { zh: ls.map((l) => (l.who ? `${l.who}：` : "") + l.zh).join("\n"), vn: ls.map((l) => (l.who ? `${l.who}: ` : "") + l.vi).join("\n"), idea: strip(t.sceneVi), lines: ls, groups: t.groups || [] };
  });
  const allLines = T.flatMap((t) => t.lines.map((l) => l.zh));
  const keys = Object.keys(L.vocab || {});
  const order = []; const vg = [];
  T.forEach((t, ti) => { const ws = [...new Set(t.groups.flatMap((g) => g.words || []))].filter((w) => keys.includes(w) && !order.includes(w)); if (ws.length) { vg.push({ from: order.length + 1, to: order.length + ws.length, name: `Bài khóa ${ti + 1}`, sub: strip(t.idea) }); order.push(...ws); } });
  const rest = keys.filter((k) => !order.includes(k)); if (rest.length) { vg.push({ from: order.length + 1, to: order.length + rest.length, name: "Từ khác", sub: rest.slice(0, 3).join(" · ") }); order.push(...rest); }
  const V = order.map((z, i) => { const v = L.vocab[z]; const e = (v.ex || [])[0] || []; return [i + 1, z, v.py || "", v.posVi || v.pos || "", v.hv || "", v.vi || "", 1, "", "", lineOf(allLines, z), e[0] || "", e[2] || "", [], [v.link, v.note].filter(Boolean).join("<br>")]; });
  // nhóm từ dài thì chia nhỏ
  const vgroups = []; vg.forEach((g) => { const n = g.to - g.from + 1; chunk(n, 9).forEach(([a, b], i, arr) => vgroups.push({ from: g.from + a, to: g.from + b - 1, name: g.name + (arr.length > 1 ? `.${i + 1}` : ""), sub: g.sub })); });
  const ORDER = T.flatMap((t) => t.lines.filter((l) => l.toks.length >= 4 && l.toks.length <= 10).map((l) => ({ tokens: l.toks, vn: l.vi })));
  return { title: name, vn: "", V, vgroups, T: T.map(({ zh, vn, idea }) => ({ zh, vn, idea })), G: [], BX: [], FILL: [], ORDER, HSKQ: [], W: null };
}

// ============ D: HSK4 2.0 ============
function fromD(L) {
  const texts = L.texts || [];
  const T = texts.map((t) => ({ zh: (t.lines || []).map((l) => (l[0] ? `${l[0]}：` : "") + l[2]).join("\n"), vn: (t.lines || []).map((l) => (l[0] ? `${l[0]}: ` : "") + (l[4] || "")).join("\n"), idea: strip(t.scenevn), qs: (t.tf || []).map((x) => ({ q: `Đúng hay sai: ${x[0]}`, o: ["Đúng", "Sai"], a: x[1] ? 0 : 1 })) }));
  const V = []; const vgroups = []; const G = []; const FILL = [];
  texts.forEach((t, ti) => {
    const lines = (t.lines || []).map((l) => l[2]);
    const start = V.length;
    (t.words || []).forEach((w) => {
      const notes = [w.diff ? `<b>${strip(w.diff.title)}</b>: ${(w.diff.rows || []).map((r) => r.map(strip).join(" — ")).join("; ")}` : "", (w.write || []).map((x) => `${x[0]} (${x[1]})`).join("<br>")].filter(Boolean).join("<br>");
      V.push([V.length + 1, w.z, w.py, w.pos, "", w.vn, w.extra ? 0 : 1, "", "", lineOf(lines, w.z), (w.ex || [])[0] || "", "", w.colloc || [], notes]);
      if (w.grammar) G.push({ zh: strip(w.grammar.title), py: "", tag: "", mean: w.grammar.use || "", forms: [], ex: [], tips: (w.grammar.rules || []).map((r) => `<b>${strip(r[0])}</b>: ${r[1]}`), practice: { items: [] }, drill: (w.grammar.check || []).map((c) => ({ q: "Câu nào đúng?", o: [strip(c[0]), strip(c[1])], a: 0, why: c[2] || "" })) });
      (w.check || []).forEach((c) => FILL.push({ ins: "Câu nào đúng?", sent: "", ans: strip(c[0]), opts: [strip(c[0]), strip(c[1])], why: c[2] || "" }));
      (w.quiz || []).forEach((q) => FILL.push({ sent: blank(q[0]), ans: q[1][q[2]], opts: q[1], why: q[3] || "" }));
    });
    chunk(V.length - start, 8).forEach(([a, b], i, arr) => vgroups.push({ from: start + a + 1, to: start + b, name: `Bài khóa ${t.n || ti + 1}${arr.length > 1 ? "." + (i + 1) : ""}`, sub: strip(t.scenevn) }));
  });
  (L.lianxi?.groups || []).forEach((g) => (g.items || []).forEach((it) => FILL.push({ sent: blank(it[0]), ans: it[1], opts: g.opts })));
  if (L.kz?.items) L.kz.items.forEach((it) => FILL.push({ sent: blank(it[0]), ans: it[1], opts: (L.kz.words || []).map((w) => w[0]) }));
  (L.wb?.fill || []).forEach((g) => (g.items || []).forEach((it) => FILL.push({ sent: blank(it[0]), ans: g.opts[it[1]], opts: g.opts })));
  const ORDER = [...(L.wb?.write || []), ...(L.exam?.write || [])].map((w) => ({ tokens: w.parts, ans: w.ans }));
  const HSKQ = [];
  const say = (lines) => (lines || []).map((l) => (l[0] ? `${l[0]}：` : "") + l[1]).join("\n");
  (L.exam?.listen || []).forEach((q) => { if (q.kind === "đúng/sai") HSKQ.push({ ...TF(strip(q.q).replace(/^★\s*/, ""), q.tf, say(q.lines)), ins: "Nghe, chọn đúng hay sai" }); else HSKQ.push({ ins: strip(q.q), say: say(q.lines), o: q.o, a: q.a, why: q.link ? `Liên quan: ${q.link}` : "" }); });
  (L.exam?.read || []).forEach((q) => HSKQ.push({ ins: strip(q.q), passage: strip(q.text), o: q.o, a: q.a, why: q.link ? `Liên quan: ${q.link}` : "" }));
  (L.wb?.listen1 || []).forEach((x) => HSKQ.push({ ...TF(strip(x[1]), x[2], strip(x[0])), ins: "Nghe, chọn đúng hay sai" }));
  [...(L.wb?.listen2 || []), ...(L.wb?.listen3 || [])].forEach((q) => HSKQ.push({ ins: strip(q.q), say: say(q.lines), o: q.o, a: q.a }));
  (L.wb?.mc || []).forEach((m) => (m.qs || []).forEach((q) => HSKQ.push({ ins: strip(q.q), passage: strip(m.t), o: q.o, a: q.a })));
  return { title: strip(L.zh), vn: strip(L.vn), num: L.num, V, vgroups, T, G, BX: [], FILL, ORDER, HSKQ: HSKQ.map((q) => (q.opts ? { ...q, o: q.opts, opts: undefined } : q)), W: null };
}

// ---- bộ bài: thư mục → mã ----
const SETS = [
  { dir: "hsk4-v2", code: "hsk4v2" }, { dir: "hsk5-1", code: "hsk5v2" }, { dir: "hsk5-2", code: "hsk5v2" },
  { dir: "hsk1-3", code: "hsk1v3" }, { dir: "hsk2-3", code: "hsk2v3" }, { dir: "hsk4-3", code: "hsk4v3" },
];
const names = {};
try { const s = fs.readFileSync(path.join(ROOT, "src/app/staticLectures.js"), "utf8"); for (const m of s.matchAll(/"lectureName":\s*"([^"]+)",\s*"level":\s*"[^"]+",\s*"fileUrl":\s*"([^"]+)"/g)) names[m[2]] = m[1]; } catch (_) {}

const index = [];
for (const S of SETS) {
  const files = fs.readdirSync(path.join(LDIR, S.dir)).filter((f) => /^LESSON_\d+\.html$/.test(f)).sort();
  for (const f of files) {
    const rel = `/lectures/${S.dir}/${f}`;
    const r = load(path.join(LDIR, S.dir, f));
    if (!r) { console.log("bỏ qua", rel); continue; }
    const fileNum = +/(\d+)/.exec(f)[1];
    const nm = (names[rel] || "").replace(/^Bài\s*\d+\s*[·–-]\s*/, "");
    const U = r.fmt === "B" ? fromB(r.L) : r.fmt === "C" ? fromC(r.L, nm) : fromD(r.L);
    const num = U.num || fileNum;
    const id = `${S.code}-${String(num).padStart(2, "0")}`;
    const local = new Set(U.V.map((v) => v[1]));
    const sents = new Set();
    U.G.forEach((g) => { g.ex.forEach((e) => sents.add(e[0])); g.practice.items.forEach((it) => sents.add(it[1])); });
    U.V.forEach((v) => v[10] && sents.add(strip(v[10])));
    const segMap = {}; sents.forEach((x) => { const t = strip(x); if (t) segMap[t] = seg(t, local); });
    const out = { id, num, title: U.title || nm, vn: U.vn, lecture: rel, V: U.V, vgroups: U.vgroups, T: U.T, G: U.G, BX: U.BX, FILL: U.FILL, ORDER: U.ORDER, HSKQ: U.HSKQ, W: U.W, seg: segMap };
    fs.writeFileSync(path.join(OUT, id + ".json"), JSON.stringify(out));
    index.push({ id, lecture: rel, title: out.title, vn: out.vn, fmt: r.fmt });
  }
}
// chỉ mục chung: node tools/lessons/build_index.mjs
console.log("Đã ghi", index.length, "bài:", Object.entries(index.reduce((m, x) => ((m[x.id.split("-")[0]] = (m[x.id.split("-")[0]] || 0) + 1), m), {})).map((x) => x.join(" ")).join(", "));
