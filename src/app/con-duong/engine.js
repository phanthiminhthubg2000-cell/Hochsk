// ============================================================
// CON ĐƯỜNG TU LUYỆN 修行之路 — biến một bài giảng HSK6 thành chuỗi ải kiểu Duolingo
// Dữ liệu: public/data/con-duong/hsk6-XX.json (trích từ window.LESSON của bài giảng, xem tools/lessons/extract_hsk6.js)
// Mỗi ải sinh câu hỏi ngẫu nhiên từ dữ liệu bài: chọn đáp án, ghép cặp, xếp mảnh chữ.
// ============================================================

export const strip = (x) => String(x ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
export const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const uniq = (a) => [...new Set(a)];
const shares = (a, b) => [...a].some((c) => /[㐀-鿿]/.test(c) && b.includes(c));
const short = (vn) => strip(vn).split(/[;,]/)[0].trim();
const PUNCT = /[，。！？、；：“”‘’（）《》…,.!?;:()"'\s—-]/g;
export const norm = (s) => String(s || "").replace(PUNCT, "");

const cache = {};
export async function loadLesson(id) {
  if (cache[id]) return cache[id];
  const r = await fetch(`/data/con-duong/${id}.json`);
  if (!r.ok) throw new Error("Không tải được bài");
  cache[id] = await r.json();
  return cache[id];
}
export async function loadIndex() {
  const r = await fetch("/data/con-duong/hsk6-index.json");
  return r.ok ? r.json() : [];
}

// câu hỏi chọn đáp án: đưa đáp án đúng vào cùng 3 phương án nhiễu rồi xáo
function choice(base, right, wrong) {
  const opts = shuffle(uniq([right, ...wrong.filter((w) => w && w !== right)]).slice(0, 4));
  if (opts.length < 2) return null;
  return { k: "choice", ...base, opts, a: opts.indexOf(right) };
}
// phương án nhiễu: ưu tiên cùng độ dài + có chung chữ, rồi cùng độ dài, rồi bất kỳ
function near(word, pool, n = 3) {
  const others = pool.filter((w) => w !== word);
  const a = shuffle(others.filter((w) => w.length === word.length && shares(w, word)));
  const b = shuffle(others.filter((w) => w.length === word.length && !a.includes(w)));
  const c = shuffle(others.filter((w) => !a.includes(w) && !b.includes(w)));
  return [...a.slice(0, 2), ...b, ...c].slice(0, n);
}

// xếp mảnh: tối đa `max` mảnh (ghép mảnh ngắn liền nhau), thêm 2 mảnh nhiễu
function tiles(base, tokens, extraPool, max = 10) {
  // "|" = ranh giới vế (dấu câu): chỉ ghép mảnh trong cùng một vế
  let t = []; const cut = new Set();
  (tokens || []).forEach((x) => { if (x === "|") { if (t.length) cut.add(t.length); } else if (x) t.push(x); });
  if (t.length < 3) return null;
  while (t.length > max) {
    let best = -1, bl = Infinity;
    for (let i = 0; i < t.length - 1; i++) { if (cut.has(i + 1)) continue; const l = t[i].length + t[i + 1].length; if (l < bl) { bl = l; best = i; } }
    if (best < 0) break;
    t = [...t.slice(0, best), t[best] + t[best + 1], ...t.slice(best + 2)];
    const nc = new Set(); cut.forEach((c) => nc.add(c > best + 1 ? c - 1 : c)); cut.clear(); nc.forEach((c) => cut.add(c));
  }
  const dis = shuffle(uniq(extraPool.filter((x) => x && x !== "|" && !t.includes(x) && x.length <= 4))).slice(0, 2);
  return { k: "tiles", ...base, ans: t.join(""), tiles: shuffle([...t, ...dis]) };
}

// ---------- ải ----------
// kind: vocab | grammar | text | bt | boss | write
export function buildNodes(L) {
  const nodes = [];
  const V = L.V || [];
  (L.vgroups || []).forEach((g, gi) => {
    const words = V.filter((v) => v[0] >= g.from && v[0] <= g.to);
    const n = Math.max(1, Math.ceil(words.length / 8)); const size = Math.ceil(words.length / n);
    for (let c = 0; c < n; c++) {
      const ws = words.slice(c * size, (c + 1) * size);
      if (!ws.length) continue;
      nodes.push({ key: `v${gi + 1}-${c + 1}`, kind: "vocab", zh: "领", vn: `Lĩnh ngộ ${gi + 1}${n > 1 ? "." + (c + 1) : ""}`, sub: `${ws.length} từ · ${strip(g.sub || g.name)}`, words: ws.map((v) => v[1]) });
    }
  });
  // ngữ pháp: ≤3 điểm một ải; ải cuối kèm phần phân biệt từ
  const G = L.G || [];
  if (G.length) {
    const n = Math.ceil(G.length / 3); const size = Math.ceil(G.length / n);
    for (let c = 0; c < n; c++) {
      const part = G.slice(c * size, (c + 1) * size); const last = c === n - 1;
      nodes.push({ key: c ? `g${c + 1}` : "g", kind: "grammar", zh: "招", vn: `Chiêu thức${n > 1 ? " " + "I".repeat(c + 1).replace("III", "III") : ""}`, sub: part.map((g) => strip(g.zh)).join(" · ") + (last && L.BX?.pair ? ` · phân biệt ${strip(L.BX.pair)}` : ""), gs: [c * size, (c + 1) * size], bx: last });
    }
  }
  const T = L.T || [];
  if (T.length) {
    const h = Math.ceil(T.length / 2);
    nodes.push({ key: "t1", kind: "text", zh: "读", vn: "Bài khóa I", sub: `Đoạn 1–${h}`, paras: [0, h] });
    if (T.length > 1) nodes.push({ key: "t2", kind: "text", zh: "悟", vn: "Bài khóa II", sub: `Đoạn ${h + 1}–${T.length} · bố cục`, paras: [h, T.length] });
  }
  if (L.EX3 || L.EX2) nodes.push({ key: "bt", kind: "bt", zh: "练", vn: "Luyện tập", sub: "Điền từ · viết lại câu" });
  if (L.HSK) nodes.push({ key: "boss", kind: "boss", zh: "试", vn: "Thí luyện", sub: "Đề HSK6 · chỉ 3 mạng", hearts: 3 });
  if (L.W) nodes.push({ key: "w", kind: "write", zh: "道", vn: "Ngộ đạo", sub: `Viết tóm tắt ~${L.W.target || 300} chữ` });
  return nodes;
}

// ---------- câu hỏi theo ải ----------
// Loại từ, phong cách (theo ký hiệu trong bài giảng)
const POS = { "dt.": "danh từ", "đgt.": "động từ", "đt.": "động từ", "tt.": "tính từ", "phó.": "phó từ", "liên.": "liên từ", "giới.": "giới từ", "lượng.": "lượng từ", "trợ.": "trợ từ", "thán.": "thán từ", "ct.": "cụm từ", "cụm": "cụm từ", "cụm đgt.": "cụm động từ" };
export const posName = (p) => String(p || "").split("/").map((x) => POS[x.trim()] || POS[x.trim() + "."] || x.trim()).filter(Boolean).join(" / ");
export const STYLE = { "书": "văn viết", "口": "khẩu ngữ", "成": "thành ngữ", "方": "phương ngữ" };
// thẻ từ: đủ thông tin như bài giảng (V = [stt, chữ, pinyin, loại, Hán Việt, nghĩa, cần dùng, phong cách, 释义, trong bài, ví dụ, dịch ví dụ, kết hợp[], ghi chú])
const wordCard = (v) => ({ k: "card", kind: "word", zh: v[1], py: v[2], pos: posName(v[3]), hv: v[4], vn: strip(v[5]), use: v[6] !== 0, style: STYLE[v[7]] || "", def: strip(v[8]), inText: strip(v[9]), ex: strip(v[10]), exVn: strip(v[11]), col: (v[12] || []).map(strip), note: v[13] || "" });

// opts.intro: lần đầu vào ải → có thẻ học (từ mới, ngữ pháp, phân biệt) trước câu hỏi
export function makeQuestions(L, node, opts = {}) {
  const V = L.V || [];
  const allZh = V.map((v) => v[1]);
  const byZh = Object.fromEntries(V.map((v) => [v[1], v]));
  const segOf = (s) => L.seg?.[strip(s)] || null;
  const segPool = Object.values(L.seg || {}).flat();

  if (node.kind === "vocab") {
    const ws = node.words.map((z) => byZh[z]).filter(Boolean);
    const news = ws.map((v) => choice({ ins: "Từ mới · chọn nghĩa đúng", big: v[1], py: v[2], hv: v[4], isNew: true, word: v[1], why: v[10] ? `${strip(v[10])} — ${strip(v[11])}` : "" },
      short(v[5]), shuffle(V.filter((x) => x[1] !== v[1] && short(x[5]) !== short(v[5]))).slice(0, 3).map((x) => short(x[5]))));
    const hard = ws.map((v, i) => {
      const w = v[1]; const kinds = [];
      const ex = strip(v[10]);
      if (ex && ex.split(w).length === 2) kinds.push(() => choice({ ins: "Điền từ vào chỗ trống", sent: ex.replace(w, "＿＿"), word: w, zhOpts: true, why: `${ex} — ${strip(v[11])}` }, w, near(w, allZh)));
      const col = (v[12] || []).map(strip).find((c) => c.includes(w) && c !== w && c.split(w).length === 2);
      if (col) kinds.push(() => choice({ ins: "Hoàn thành cụm từ thường gặp", sent: col.replace(w, "＿＿"), word: w, zhOpts: true, why: (v[12] || []).map(strip).join(" · ") }, w, near(w, allZh)));
      kinds.push(() => choice({ ins: "Nghe và chọn từ vừa đọc", say: w, word: w, zhOpts: true, why: `${w} · ${v[2]} — ${strip(v[5])}` }, w, near(w, allZh)));
      kinds.push(() => choice({ ins: `Từ nào nghĩa là “${short(v[5])}”?`, word: w, zhOpts: true, why: `${w} · ${v[2]} — ${strip(v[5])}` }, w, near(w, allZh)));
      return kinds[(i + Math.floor(Math.random() * kinds.length)) % kinds.length]();
    });
    // giải nghĩa tiếng Trung (释义) → chọn từ
    const defs = ws.filter((v) => strip(v[8]).length >= 4).map((v) => choice({ ins: "Đọc giải nghĩa tiếng Trung, chọn từ phù hợp", sent: strip(v[8]).replace(new RegExp(v[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "～"), word: v[1], zhOpts: true, why: `${v[1]} · ${v[2]} — ${strip(v[5])}` }, v[1], near(v[1], allZh)));
    const out = [];
    if (opts.intro) {
      // thẻ từ i → câu luyện của từ i−1 (kiểu Duolingo: học mới xen ôn ngay)
      ws.forEach((v, i) => { out.push(wordCard(v)); if (i >= 1) out.push(hard[i - 1]); if (i === 3) out.push({ k: "match", ins: "Ghép từ với nghĩa", pairs: ws.slice(0, 4).map((x) => [x[1], short(x[5])]) }); });
      out.push(hard[hard.length - 1]);
      out.push(...shuffle(defs).slice(0, 4));
    } else {
      news.forEach((q, i) => { out.push(q); if (i >= 1) out.push(hard[i - 1]); if (i === 3) out.push({ k: "match", ins: "Ghép từ với nghĩa", pairs: ws.slice(0, 4).map((v) => [v[1], short(v[5])]) }); });
      out.push(hard[hard.length - 1]);
      out.push(...shuffle(defs).slice(0, 3));
    }
    if (ws.length > 4) out.push({ k: "match", ins: "Ghép từ với nghĩa", pairs: shuffle(ws).slice(0, 5).map((v) => [v[1], short(v[5])]) });
    return out.filter(Boolean);
  }

  if (node.kind === "grammar") {
    const out = [];
    const pats = (L.G || []).map((g) => strip(g.zh));
    const [ga, gb] = node.gs || [0, (L.G || []).length];
    (L.G || []).slice(ga, gb).forEach((g) => {
      if (opts.intro) out.push({ k: "card", kind: "gram", zh: strip(g.zh), py: g.py || "", tag: strip(g.tag), mean: g.mean || "", forms: (g.forms || []).map(strip), ex: (g.ex || []).slice(0, 3).map((e) => [strip(e[0]), strip(e[1])]), tips: g.tips || [] });
      const mine = [];
      const pat = strip(g.zh); const parts = pat.split(/……|…|\.\.\./).map((x) => x.trim()).filter(Boolean);
      const exs = shuffle((g.ex || []).map((e) => [strip(e[0]), strip(e[1])]));
      // điền cấu trúc vào câu
      const ex1 = exs.find(([z]) => parts.length && parts.every((p) => z.includes(p)));
      if (ex1) {
        let s = ex1[0]; parts.forEach((p) => { s = s.replace(p, "＿＿"); });
        if (pats.length > 1) mine.push(choice({ ins: "Chọn cấu trúc điền vào chỗ trống", sent: s, zhOpts: true, why: `${ex1[0]} — ${ex1[1]}<br>${strip(g.mean)}` }, pat, shuffle(pats.filter((p) => p !== pat)).slice(0, 3)));
      }
      // xếp câu ví dụ theo nghĩa
      const vnOk = (x) => /[a-zà-ỹđ]{2,}/i.test(x);
      const ex2 = exs.find(([z, v]) => vnOk(v) && z !== ex1?.[0] && (segOf(z) || []).length >= 4 && (segOf(z) || []).length <= 18) || exs.find(([z, v]) => vnOk(v) && (segOf(z) || []).length >= 4);
      if (ex2) mine.push(tiles({ ins: "Xếp thành câu đúng nghĩa", vn: ex2[1], hint: pat, full: ex2[0] }, segOf(ex2[0]), segPool));
      // viết lại câu
      const pr = shuffle(g.practice?.items || []).find((it) => (segOf(it[1]) || []).length >= 4);
      if (pr) mine.push(tiles({ ins: `Viết lại câu, dùng “${pat}”`, src: strip(pr[0]), full: strip(pr[1]) }, segOf(pr[1]), segPool));
      out.push(...shuffle(mine.filter(Boolean)));
    });
    const bx = node.bx === false ? null : L.BX;
    if (bx && opts.intro) out.push({ k: "card", kind: "bx", pair: strip(bx.pair), cols: (bx.cols || strip(bx.pair).split(/\s*[—–-]\s*/)).map(strip), same: bx.same || [], diff: bx.diff || [] });
    if (bx?.task?.items?.length && bx.task.cols?.length) {
      shuffle(bx.task.items.filter((it) => Number.isInteger(it[1]) && it[1] < bx.task.cols.length)).slice(0, 4).forEach((it) => {
        const cols = bx.task.cols.map(strip);
        out.push({ k: "choice", ins: strip(bx.task.q) || `Phân biệt ${strip(bx.pair)}`, sent: strip(it[0]).replace(/_{2,}/g, "＿＿"), opts: cols, a: it[1], zhOpts: cols.every((c) => /[㐀-鿿]/.test(c)), why: it[2] || "" });
      });
    }
    return opts.intro ? out.filter(Boolean) : shuffle(out.filter(Boolean)).slice(0, 14);
  }

  if (node.kind === "text") {
    const T = L.T || []; const out = [];
    const [a, b] = node.paras;
    const ideas = T.map((t) => strip(t.idea)).filter(Boolean);
    for (let i = a; i < b; i++) {
      const t = T[i]; const zh = strip(t.zh);
      if (t.idea && ideas.length >= 3) out.push(choice({ ins: `Đọc đoạn ${i + 1} · đoạn này nói gì?`, passage: zh, say: zh, why: strip(t.vn) }, strip(t.idea), shuffle(ideas.filter((x) => x !== strip(t.idea))).slice(0, 3)));
      const sents = zh.split(/(?<=[。！？])/).map((s) => s.replace(/^[”’」\s]+/, "").trim()).filter((s) => s.length >= 8);
      const used = new Set(); let n = 0;
      for (const s of shuffle(sents)) {
        if (n >= 2) break;
        const w = shuffle(allZh.filter((z) => z.length >= 2 && !used.has(z) && s.split(z).length === 2))[0];
        if (!w) continue; used.add(w); n++;
        out.push(choice({ ins: `Đoạn ${i + 1} · điền từ còn thiếu`, sent: s.replace(w, "＿＿"), zhOpts: true, word: w, why: byZh[w] ? `${w} · ${byZh[w][2]} — ${strip(byZh[w][5])}` : "" }, w, near(w, allZh)));
      }
    }
    if (node.key === "t2" && (L.outline || []).length >= 3) {
      out.push({ k: "tiles", ins: "Xếp diễn biến bài khóa theo đúng thứ tự", vn: L.outline.map((o) => o.tag).join(" → "), ans: L.outline.map((o) => strip(o.zh)).join(""), tiles: shuffle(L.outline.map((o) => strip(o.zh))), full: L.outline.map((o) => `${o.tag} · ${strip(o.zh)}`).join("<br>"), big: true });
    }
    return out.filter(Boolean);
  }

  if (node.kind === "bt") {
    const out = [];
    (L.EX3?.parts || []).forEach((p) => {
      const bank = (p.bank || []).map(strip);
      const text = String(p.text || "");
      const sents = text.split(/(?<=[。！？])/).map((x) => x.replace(/^[”’」\s]+/, ""));
      sents.forEach((s) => {
        const blanks = [...s.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
        blanks.forEach((w) => {
          let shown = s; blanks.forEach((x) => { shown = shown.replace(`{${x}}`, x === w ? "＿＿" : x); });
          out.push(choice({ ins: "Chọn từ thích hợp điền vào chỗ trống", sent: strip(shown), zhOpts: true, word: w, why: strip(s.replace(/\{([^}]+)\}/g, "$1")) }, w, shuffle(bank.filter((x) => x !== w)).slice(0, 3)));
        });
      });
    });
    (L.EX2?.items || []).forEach((it) => {
      const sg = segOf(it[2]); if (!sg || sg.length < 4) return;
      const complete = L.EX2.type === "complete";
      out.push(tiles(complete ? { ins: `Hoàn thành câu, dùng “${strip(it[1])}”`, src: strip(it[0]), full: strip(it[2]) } : { ins: `Viết lại câu, dùng “${strip(it[1])}”`, src: strip(it[0]), full: strip(it[2]) }, sg, segPool, 12));
    });
    return shuffle(out.filter(Boolean)).slice(0, 14);
  }

  if (node.kind === "boss") {
    const H = L.HSK || {}; const out = [];
    (H.listen || []).forEach((p) => {
      if (p.say) return;
      shuffle(p.qs || []).slice(0, 3).forEach((q) => out.push(choice({ ins: "Nghe, chọn câu khớp với nội dung", say: strip(q.say), hideText: true, zhOpts: true, why: strip(q.why) }, strip(q.o[q.a]), q.o.map(strip))));
    });
    const lp = (H.listen || []).filter((p) => p.say).sort((x, y) => strip(x.say).length - strip(y.say).length)[0];
    if (lp) (lp.qs || []).slice(0, 2).forEach((q) => out.push(choice({ ins: `Nghe đoạn văn · ${strip(q.q)}`, say: strip(lp.say), hideText: true, zhOpts: true, why: strip(q.why) }, strip(q.o[q.a]), q.o.map(strip))));
    (H.read1?.qs || []).slice(0, 2).forEach((q) => out.push(choice({ ins: "Chọn câu có lỗi sai (病句)", zhOpts: true, long: true, why: strip(q.why) }, strip(q.o[q.a]), q.o.map(strip))));
    (H.read2?.qs || []).slice(0, 2).forEach((q) => out.push(choice({ ins: "Chọn nhóm từ điền vào các chỗ trống", passage: strip(q.text).replace(/_{2,}/g, "＿＿"), zhOpts: true, why: strip(q.why) }, strip(q.o[q.a]), q.o.map(strip))));
    const r4 = [].concat(H.read4 || [])[0];
    if (r4) (r4.qs || []).slice(0, 3).forEach((q) => out.push(choice({ ins: strip(q.q) || "Chọn đáp án đúng", passage: strip(r4.text), fold: true, zhOpts: true, why: strip(q.why) }, strip(q.o[q.a]), q.o.map(strip))));
    return out.filter(Boolean);
  }
  return [];
}

// tu vi của một ải: +2 mỗi câu đúng ngay lần đầu, +10 hoàn thành, +10 không sai câu nào; Thí luyện ×2
export function tuViOf(node, firstTry, total, firstTime) {
  const base = firstTry * 2 + (firstTime ? 10 : 3) + (firstTry === total ? 10 : 0);
  return node.kind === "boss" ? base * 2 : base;
}
