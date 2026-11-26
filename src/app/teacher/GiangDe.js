"use client";
// TRANG GIÁO VIÊN · GIẢNG ĐỀ — chọn một đề HSK, AI soạn phần chữa từng câu (giáo viên sửa lại, lưu Firestore),
// rồi trình chiếu như một bài giảng: từng câu một, bấm để lộ đáp án → phân tích → kiến thức; có bút vẽ, hẹn giờ, lời nghe.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from "firebase/firestore";
import { CENTERS, FIELDS, GD_COL, SEC_NAME, buildItems, classStats, isRight, itemPrompt, lessonKey, subAnswers } from "@/lib/giangde";

const ZH = { fontFamily: '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif' };
const AI_FIELDS = ["key", "traps", "point", "vocab", "tip"];
const hasA = (a) => a && AI_FIELDS.some((k) => (a[k] || "").trim());
const partLabel = (u) => `${SEC_NAME[u.sec] || u.sec} · phần ${u.part}${u.label ? ` · câu ${u.label}` : ""}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Hiển thị một câu hỏi (dùng chung cho soạn & trình chiếu) ----------
const norm = (s) => String(s || "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const tone = (p) => (p >= 80 ? "text-emerald-700" : p >= 50 ? "text-amber-600" : "text-rose-600");

// Thanh thống kê lớp cho một câu: % đúng + số người chọn từng phương án + ai sai
export function StatBar({ it, st, names = true }) {
  if (!st) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b className={tone(st.pct)}>📊 Lớp đúng {st.pct}%</b><span className="text-slate-500">({st.ok}/{st.total} bài)</span>
        {Object.keys(st.pick).length > 0 && <span className="flex flex-wrap gap-1">{Object.entries(st.pick).sort().map(([k, v]) => <span key={k} className={`px-1.5 rounded ${k === String(it.ans) ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100"}`}>{k}: {v}</span>)}</span>}
      </div>
      {names && st.wrong.length > 0 && <div className="text-xs text-slate-500 mt-1">Sai: {st.wrong.join(", ")}</div>}
    </div>
  );
}

export function QView({ it, step = 0, showScript = false, big = false, narrow = false, mine }) {
  const reveal = step >= 1;
  const myRight = mine !== undefined ? isRight(it, mine) : null;
  const sz = big ? "text-[1.45em]" : "text-base";
  return (
    <div className="grid gap-3">
      {it.listen && showScript && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
          <div className="text-xs font-bold text-amber-700 mb-1">🎧 Lời nghe</div>
          <div className="whitespace-pre-line leading-relaxed" style={ZH}>{it.listen}</div>
        </div>
      )}
      {it.sec === "L" && !it.listen && showScript && <div className="text-xs text-slate-400">(Đề này chưa có lời nghe cho câu {it.n})</div>}
      {it.p && <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 whitespace-pre-line leading-relaxed" style={ZH}>{it.pPy && <div className="text-xs text-slate-400">{it.pPy}</div>}{it.p}</div>}
      <div className={`${sz} font-bold text-[#142033] leading-relaxed`} style={ZH}>
        <span className="inline-flex items-center justify-center min-w-[2em] h-[2em] px-1 mr-2 rounded-lg bg-[#142033] text-white text-[0.8em] align-middle">{it.n}</span>
        {it.sPy && <span className="block text-xs font-normal text-slate-400 ml-[2.6em]">{it.sPy}</span>}
        {it.stem || (it.type === "b" ? "Sắp xếp thành câu hoàn chỉnh" : it.type === "w" ? "Viết" : it.sec === "L" ? "Nghe và chọn đáp án đúng" : "")}
      </div>
      {it.extra && (it.type === "b" ? (
        <div className="flex flex-wrap gap-2" style={ZH}>{it.extra.split("　").map((w, i) => <span key={i} className={`px-3 py-1.5 rounded-lg border border-slate-300 bg-white ${sz}`}>{w}</span>)}</div>
      ) : <div className="whitespace-pre-line text-slate-700" style={ZH}>{it.extra}</div>)}
      {it.img && <img src={it.img} alt="" className="max-h-[40vh] w-auto rounded-xl border border-slate-200 self-start" />}
      {it.opts.length > 0 && (
        <div className={`grid gap-2 ${it.opts.some((o) => o.img) ? "grid-cols-3 sm:grid-cols-6" : narrow || it.opts.length > 4 || it.opts.some((o) => (o.t || "").length > 14) ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          {it.opts.map((o) => {
            const ok = reveal && o.k === it.ans;
            const me = mine !== undefined && String(mine).toUpperCase() === o.k;
            const bad = reveal && me && !ok;
            return (
              <div key={o.k} className={`relative rounded-xl border-2 px-3 py-2 flex items-start gap-2 transition-colors ${ok ? "border-emerald-500 bg-emerald-50" : bad ? "border-rose-400 bg-rose-50" : reveal ? "border-slate-200 opacity-60" : me ? "border-sky-400 bg-white" : "border-slate-200 bg-white"}`}>
                {me && <span className={`absolute -top-2 right-2 text-[10px] font-bold px-1.5 rounded ${bad ? "bg-rose-500 text-white" : ok ? "bg-emerald-600 text-white" : "bg-sky-500 text-white"}`}>Bạn chọn</span>}
                <b className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm ${ok ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>{o.k}</b>
                <div className="min-w-0">
                  {o.img && <img src={o.img} alt={o.k} className="max-h-28 w-auto rounded" />}
                  {o.t && <div className={sz} style={ZH}>{o.t}</div>}
                  {o.py && <div className="text-xs text-slate-400">{o.py}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {mine !== undefined && !it.opts.length && (
        <div className={`rounded-xl border p-3 ${reveal && myRight === false ? "border-rose-300 bg-rose-50" : "border-sky-200 bg-sky-50"}`}>
          <div className="text-xs font-bold text-slate-500 mb-1">Bài của bạn{reveal && myRight != null ? (myRight ? " · ✓ đúng" : " · ✗ chưa đúng") : ""}</div>
          <div className="whitespace-pre-line" style={ZH}>{mine ? String(Array.isArray(mine) ? mine.join("") : mine) : "(bỏ trống)"}</div>
        </div>
      )}
      {reveal && !it.opts.length && it.ansText && (
        <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-3">
          <div className="text-xs font-bold text-emerald-700 mb-1">{it.type === "w" ? "Bài mẫu" : "Đáp án"}</div>
          <div className={`whitespace-pre-line ${sz}`} style={ZH}>{it.ansText}</div>
        </div>
      )}
    </div>
  );
}

function Analysis({ a, step, big }) {
  if (!a || step < 2) return null;
  const box = (title, text, cls) => text?.trim() ? (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="text-xs font-black uppercase tracking-wide mb-1 opacity-70">{title}</div>
      <div className={`whitespace-pre-line leading-relaxed ${big ? "text-[1.15em]" : "text-sm"}`} style={ZH}>{text}</div>
    </div>
  ) : null;
  return (
    <div className="grid gap-2">
      {box("✅ Đáp án & căn cứ", a.key, "border-emerald-200 bg-emerald-50/60")}
      {box("⚠️ Bẫy ở các phương án", a.traps, "border-rose-200 bg-rose-50/60")}
      {step >= 3 && box("📌 Kiến thức trọng điểm", a.point, "border-indigo-200 bg-indigo-50/60")}
      {step >= 3 && box("📚 Từ vựng", a.vocab, "border-sky-200 bg-sky-50/60")}
      {step >= 3 && box("💡 Mẹo", a.tip, "border-amber-200 bg-amber-50/60")}
    </div>
  );
}

// ---------- Trình chiếu ----------
export function Present({ paper, units, items, lesson, startN, onClose, student = false, mine = null, stats = null, only = null }) {
  const slides = useMemo(() => {
    const s = [];
    units.forEach((u) => {
      const its = items.filter((x) => x.u === u.i && (!only || only.has(x.n)));
      if (!its.length) return;
      const st = lesson?.units?.[u.i]?.strategy;
      if (u.passage || st || s.length === 0 || s[s.length - 1]?.u?.sec !== u.sec || s[s.length - 1]?.u?.part !== u.part) s.push({ kind: "unit", u, st });
      its.forEach((it) => s.push({ kind: "q", u, it }));
    });
    return s;
  }, [units, items, lesson]);
  const [idx, setIdx] = useState(() => Math.max(0, slides.findIndex((s) => s.kind === "q" && s.it.n === startN)));
  const [step, setStep] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [script, setScript] = useState(false);
  const [pen, setPen] = useState(false);
  const [grid, setGrid] = useState(false);
  const [showStat, setShowStat] = useState(true);
  const [timer, setTimer] = useState(null); // {end, total}
  const [now, setNow] = useState(Date.now());
  const cv = useRef(null); const drawing = useRef(null); const wrap = useRef(null);
  const sl = slides[idx] || slides[0];
  const a = sl?.kind === "q" ? lesson?.q?.[sl.it.n] : null;
  const maxStep = sl?.kind === "q" ? (hasA(a) ? 3 : 1) : 0;

  const clearPen = () => { const c = cv.current; if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height); };
  const go = useCallback((d) => { setIdx((i) => Math.min(slides.length - 1, Math.max(0, i + d))); setStep(0); clearPen(); }, [slides.length]);
  const next = useCallback(() => { if (step < maxStep) setStep(step + 1); else go(1); }, [step, maxStep, go]);
  const prev = useCallback(() => { if (step > 0) setStep(step - 1); else go(-1); }, [step, go]);

  useEffect(() => {
    const k = (e) => {
      if (e.target?.tagName === "TEXTAREA" || e.target?.tagName === "INPUT") return;
      const K = e.key.toLowerCase();
      if (["arrowright", " ", "enter", "pagedown"].includes(K)) { e.preventDefault(); next(); }
      else if (["arrowleft", "pageup", "backspace"].includes(K)) { e.preventDefault(); prev(); }
      else if (K === "escape") { if (grid) setGrid(false); else onClose(); }
      else if (K === "s") setScript((v) => !v);
      else if (K === "p") setPen((v) => !v);
      else if (K === "c") clearPen();
      else if (K === "g") setGrid((v) => !v);
      else if (K === "l") setShowStat((v) => !v);
      else if (K === "f") toggleFs();
      else if (K === "t") cycleTimer();
      else if (K === "+" || K === "=") setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)));
      else if (K === "-") setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  useEffect(() => { if (!timer) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [timer]);
  useEffect(() => {
    const fit = () => { const c = cv.current, w = wrap.current; if (!c || !w) return; c.width = w.clientWidth; c.height = w.scrollHeight; };
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, [idx, step, zoom, script]);
  useEffect(() => () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }, []);

  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); };
  const TIMES = [30, 60, 90, 120, 180];
  const cycleTimer = () => setTimer((t) => { const i = t ? TIMES.indexOf(t.total) + 1 : 0; if (i >= TIMES.length) return null; return { total: TIMES[i], end: Date.now() + TIMES[i] * 1000 }; });
  const left = timer ? Math.max(0, Math.ceil((timer.end - now) / 1000)) : 0;

  const down = (e) => { if (!pen) return; const r = cv.current.getBoundingClientRect(); drawing.current = [e.clientX - r.left, e.clientY - r.top]; cv.current.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    if (!pen || !drawing.current) return; const r = cv.current.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    const g = cv.current.getContext("2d"); g.strokeStyle = "#e11d48"; g.lineWidth = 3.5; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(...drawing.current); g.lineTo(x, y); g.stroke(); drawing.current = [x, y];
  };
  const up = () => { drawing.current = null; };

  const qSlides = slides.map((s, i) => [s, i]).filter(([s]) => s.kind === "q");
  const qPos = sl?.kind === "q" ? qSlides.findIndex(([, i]) => i === idx) + 1 : 0;
  const twoCol = sl?.kind === "q" && sl.u.passage && sl.u.sec === "R";
  const audio = Array.isArray(paper.audio) ? paper.audio[0] : paper.audio;
  const Btn = ({ on, children, ...p }) => <button {...p} className={`h-9 px-3 rounded-lg text-sm font-bold border ${on ? "bg-white text-[#142033] border-white" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`}>{children}</button>;

  return (
    <div className="fixed inset-0 z-[200] bg-[#F7F4EC] flex flex-col">
      <div className="flex items-center gap-3 px-4 h-12 bg-[#142033] text-white shrink-0">
        <b className="truncate">HSK {paper.level} · {paper.name}</b>
        <span className="text-white/60 text-sm hidden sm:inline">{sl ? partLabel(sl.u) : ""}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-sm text-white/70">{qPos ? `Câu ${qPos}/${qSlides.length}` : "Giới thiệu phần"}</span>
        {timer && <span className={`font-black tabular-nums px-2 rounded ${left === 0 ? "bg-rose-600 animate-pulse" : left <= 10 ? "text-rose-300" : ""}`}>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
        <button onClick={onClose} className="shrink-0 whitespace-nowrap h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold">✕ Thoát</button>
      </div>

      <div ref={wrap} className="relative flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6" style={{ fontSize: `${zoom * 18}px` }}>
          {sl?.kind === "unit" && (
            <div className="grid gap-4 py-6">
              <div className="text-sm font-bold text-[#9E2F22] uppercase tracking-widest">{SEC_NAME[sl.u.sec]} · Phần {sl.u.part}</div>
              <h2 className="text-[2em] font-black text-[#142033] leading-tight" style={ZH}>{sl.u.head || partLabel(sl.u)}</h2>
              {sl.st && <div className="rounded-2xl bg-white border border-amber-200 p-4"><div className="text-xs font-black text-amber-700 mb-1">🎯 CHIẾN LƯỢC LÀM PHẦN NÀY</div><div className="whitespace-pre-line leading-relaxed" style={ZH}>{sl.st}</div></div>}
              {sl.u.passage && <div className="rounded-2xl bg-white border border-slate-200 p-5 whitespace-pre-line leading-loose text-[1.1em]" style={ZH}>{sl.u.passage}</div>}
              {sl.u.img && <img src={sl.u.img} alt="" className="max-h-[50vh] w-auto rounded-xl" />}
            </div>
          )}
          {sl?.kind === "q" && (
            <div className={twoCol ? "grid lg:grid-cols-[1fr_1fr] gap-6" : "grid gap-5"}>
              {twoCol && <div className="rounded-2xl bg-white border border-slate-200 p-5 whitespace-pre-line leading-loose lg:max-h-[75vh] lg:overflow-auto" style={ZH}>{sl.u.passage}</div>}
              <div className="grid gap-5 content-start">
                <QView it={sl.it} step={step} showScript={script} big narrow={twoCol} mine={mine ? (mine[sl.it.n] ?? "") : undefined} />
                {step >= 1 && showStat && stats?.[sl.it.n] && <StatBar it={sl.it} st={stats[sl.it.n]} names={!student} />}
                <Analysis a={a} step={step} big />
                {step === 0 && <div className="text-sm text-slate-400">Bấm <b>Hiện đáp án</b> (hoặc phím Space / →){hasA(a) ? ", bấm tiếp để xem phân tích" : ""}.</div>}
                {step >= 1 && !hasA(a) && !student && <div className="text-sm text-slate-400">Câu này chưa có phần phân tích — soạn ở màn hình chỉnh sửa.</div>}
              </div>
            </div>
          )}
        </div>
        <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          className={`absolute inset-0 ${pen ? "cursor-crosshair touch-none" : "pointer-events-none"}`} />
        {grid && (
          <div className="fixed inset-0 z-[210] bg-black/50 grid place-items-center p-6" onClick={() => setGrid(false)}>
            <div className="bg-white rounded-2xl p-5 max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="font-black mb-3">Chuyển tới câu</div>
              <div className="flex flex-wrap gap-1.5">
                {qSlides.map(([s, i]) => (
                  <button key={i} onClick={() => { setIdx(i); setStep(0); setGrid(false); clearPen(); }}
                    className={`w-11 h-9 rounded-lg text-sm font-bold border ${i === idx ? "bg-[#142033] text-white" : mine ? (isRight(s.it, mine[s.it.n]) === false ? "bg-rose-50 border-rose-300" : "bg-white border-slate-200") : hasA(lesson?.q?.[s.it.n]) ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"}`}>{s.it.n}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[#142033] text-white shrink-0">
        <Btn onClick={prev}>←</Btn>
        <Btn onClick={next}>{step < maxStep ? (step === 0 ? "Hiện đáp án" : "Phân tích tiếp") : "Câu sau"} →</Btn>
        <div className="flex gap-1 mx-1">{Array.from({ length: maxStep + 1 }).map((_, i) => <span key={i} className={`w-2 h-2 rounded-full ${i <= step ? "bg-amber-300" : "bg-white/25"}`} />)}</div>
        <span className="w-px h-6 bg-white/20 mx-1" />
        {sl?.it?.sec === "L" && <Btn on={script} onClick={() => setScript((v) => !v)} title="S">🎧 Lời nghe</Btn>}
        {stats && <Btn on={showStat} onClick={() => setShowStat((v) => !v)} title="L">📊 Lớp</Btn>}
        {!student && <Btn on={pen} onClick={() => setPen((v) => !v)} title="P">✏️ Bút</Btn>}
        {pen && <Btn onClick={clearPen} title="C">🧽 Xoá</Btn>}
        {!student && <Btn on={!!timer} onClick={cycleTimer} title="T">⏱ {timer ? `${timer.total}s` : "Hẹn giờ"}</Btn>}
        <Btn onClick={() => setGrid(true)} title="G">▦ Câu</Btn>
        <Btn onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}>A−</Btn>
        <Btn onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}>A+</Btn>
        <Btn onClick={toggleFs} title="F">⛶</Btn>
        {audio && <audio src={audio} controls preload="none" className="h-9 ml-auto max-w-[320px]" />}
      </div>
    </div>
  );
}

// ---------- Màn hình soạn ----------
export default function GiangDe({ db }) {
  const [dir, setDir] = useState("hsk-exam");
  const [list, setList] = useState([]);
  const [level, setLevel] = useState("");
  const [pid, setPid] = useState("");
  const [paper, setPaper] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [selN, setSelN] = useState(null);
  const [lang, setLang] = useState("vi");
  const [busy, setBusy] = useState(""); // thông báo tiến độ AI
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [present, setPresent] = useState(false);
  const [script, setScript] = useState(true);
  const [step, setStep] = useState(3);
  const stop = useRef(false);
  const tmr = useRef({});
  const [subs, setSubs] = useState([]); // bài làm của học viên cho đề này: [{name, cls, ans}]
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState("");
  const [onlyWeak, setOnlyWeak] = useState(false);
  useEffect(() => { getDocs(collection(db, "classes")).then((c) => { const a = []; c.forEach((d) => a.push({ id: d.id, ...d.data() })); setClasses(a); }).catch(() => {}); }, [db]);

  useEffect(() => {
    setList([]); setPid(""); setPaper(null);
    fetch(`/${dir}/papers.json`).then((r) => r.json()).then(setList).catch(() => setList([]));
  }, [dir]);
  const levels = useMemo(() => [...new Set(list.map((p) => p.level))].sort((a, b) => a - b), [list]);
  useEffect(() => { if (levels.length && !levels.includes(+level)) setLevel(String(levels[0])); }, [levels, level]);
  const papers = list.filter((p) => String(p.level) === String(level));

  useEffect(() => {
    if (!pid) { setPaper(null); setLesson(null); return; }
    const meta = list.find((p) => p.id === pid); if (!meta) return;
    setPaper(null); setLesson(null); setSelN(null); setErr("");
    fetch(`/${dir}/${meta.file}`).then((r) => r.json()).then((p) => setPaper({ ...p, name: p.name || meta.name })).catch(() => setErr("Không tải được đề."));
    setSubs([]);
    getDocs(query(collection(db, "hsk3_submissions"), where("examId", "==", `${dir}/${pid}`))).then((qs) => {
      const a = []; qs.forEach((d) => { const h = d.data(); const ans = subAnswers(h); if (Object.keys(ans).length) a.push({ id: d.id, name: h.studentTypedName || h.userName || "Học viên", user: h.userName || "", ans }); });
      setSubs(a);
    }).catch(() => {});
    getDoc(doc(db, GD_COL, lessonKey(dir, pid))).then((s) => { const d = s.exists() ? s.data() : {}; setLesson({ q: {}, units: {}, ...d }); if (d.lang) setLang(d.lang); }).catch(() => setLesson({ q: {}, units: {} }));
  }, [pid, dir, list, db]);

  const built = useMemo(() => (paper ? buildItems(paper) : { items: [], units: [] }), [paper]);
  const { items, units } = built;
  useEffect(() => { if (items.length && selN == null) setSelN(items[0].n); }, [items, selN]);
  const it = items.find((x) => x.n === selN);
  const un = it ? units[it.u] : null;
  const done = items.filter((x) => hasA(lesson?.q?.[x.n])).length;
  const clsOf = useMemo(() => { const m = {}; classes.forEach((k) => (k.students || []).forEach((st) => (m[norm(st.name)] = k.className))); return m; }, [classes]);
  const subsF = useMemo(() => subs.filter((h) => !cls || clsOf[norm(h.name)] === cls || clsOf[norm(h.user)] === cls), [subs, cls, clsOf]);
  const stats = useMemo(() => (subsF.length ? classStats(items, subsF) : null), [items, subsF]);
  const weak = useMemo(() => (stats ? new Set(Object.entries(stats).filter(([, v]) => v.pct < 60).map(([n]) => +n)) : null), [stats]);

  const meta = { dir, paperId: pid, name: paper?.name || "", level: paper?.level || +level || 0 };
  const save = useCallback(async (patch) => {
    setSaved("Đang lưu…");
    try { await setDoc(doc(db, GD_COL, lessonKey(dir, pid)), { ...patch, ...meta, updatedAt: serverTimestamp() }, { merge: true }); setSaved("Đã lưu ✓"); }
    catch (e) { setSaved("Lỗi lưu: " + String(e?.message || e).slice(0, 80)); }
  }, [db, dir, pid, meta.name, meta.level]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (n, k, v) => {
    setLesson((L) => ({ ...L, q: { ...L.q, [n]: { ...(L.q?.[n] || {}), [k]: v } } }));
    clearTimeout(tmr.current[n + k]);
    tmr.current[n + k] = setTimeout(() => save({ q: { [n]: { [k]: v } } }), 900);
  };
  const editStrategy = (i, v) => {
    setLesson((L) => ({ ...L, units: { ...L.units, [i]: { ...(L.units?.[i] || {}), strategy: v } } }));
    clearTimeout(tmr.current["u" + i]);
    tmr.current["u" + i] = setTimeout(() => save({ units: { [i]: { strategy: v } } }), 900);
  };

  const genUnit = async (u) => {
    const its = items.filter((x) => x.u === u.i);
    const body = { level: paper.level, center: CENTERS.find((c) => c.dir === dir)?.name, part: partLabel(u), head: u.head, passage: u.passage, qs: its.map(itemPrompt).join("\n\n"), lang };
    for (let t = 0; t < 2; t++) {
      const r = await fetch("/api/giang-de", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.items) {
        const q = {}; d.items.forEach((x) => { if (its.some((y) => y.n === x.n)) q[x.n] = { key: x.key, traps: x.traps, point: x.point, vocab: x.vocab, tip: x.tip }; });
        setLesson((L) => { const nq = { ...L.q }; Object.entries(q).forEach(([n, v]) => (nq[n] = { ...(nq[n] || {}), ...v })); return { ...L, q: nq, units: { ...L.units, [u.i]: { ...(L.units?.[u.i] || {}), strategy: d.strategy } } }; });
        await save({ q, units: { [u.i]: { strategy: d.strategy } }, lang });
        return true;
      }
      if (t === 0 && (r.status === 429 || r.status >= 500)) { setBusy((b) => b + " · AI bận, thử lại sau 15 giây…"); await sleep(15000); continue; }
      throw new Error(d.error || `Lỗi ${r.status}`);
    }
    throw new Error("AI đang quá tải, thử lại sau.");
  };

  const genAll = async (onlyMissing) => {
    stop.current = false; setErr("");
    const todo = units.filter((u) => u.nums.length && (!onlyMissing || u.nums.some((n) => !hasA(lesson?.q?.[n]))));
    for (let i = 0; i < todo.length; i++) {
      if (stop.current) break;
      setBusy(`AI đang soạn ${partLabel(todo[i])} (${i + 1}/${todo.length})…`);
      try { await genUnit(todo[i]); } catch (e) { setErr(`${partLabel(todo[i])}: ${e.message}`); break; }
    }
    setBusy("");
  };
  const genOne = async (u) => { setErr(""); setBusy(`AI đang soạn ${partLabel(u)}…`); try { await genUnit(u); } catch (e) { setErr(e.message); } setBusy(""); };

  const listenMissing = paper && items.some((x) => x.sec === "L") && !paper.script;

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 grid gap-3">
        <div>
          <h2 className="text-xl font-black text-[#142033]">🎓 Giảng đề</h2>
          <p className="text-sm text-slate-500 mt-1">Chọn đề → AI soạn phần chữa cho từng câu (đáp án & căn cứ, bẫy, kiến thức, từ vựng, mẹo) → cô sửa lại cho vừa ý → bấm <b>Trình chiếu</b> để giảng trên lớp.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="inline-flex rounded-xl border border-slate-300 overflow-hidden">
            {CENTERS.map((c) => <button key={c.dir} onClick={() => setDir(c.dir)} className={`h-10 px-4 text-sm font-bold ${dir === c.dir ? "bg-[#142033] text-white" : "bg-white"}`}>{c.name}</button>)}
          </div>
          <select value={level} onChange={(e) => { setLevel(e.target.value); setPid(""); }} className="h-10 px-3 rounded-xl border border-slate-300 text-sm">{levels.map((l) => <option key={l} value={l}>HSK {l}</option>)}</select>
          <select value={pid} onChange={(e) => setPid(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 text-sm min-w-[220px] max-w-full"><option value="">— Chọn đề —</option>{papers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 text-sm" title="Ngôn ngữ AI viết phần phân tích"><option value="vi">Phân tích: Tiếng Việt</option><option value="zh">Phân tích: 中文</option></select>
        </div>
        {paper && lesson && (
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => setPresent(true)} className="h-10 px-4 rounded-xl bg-[#9E2F22] text-white text-sm font-black">▶ Trình chiếu</button>
            {!busy ? <>
              <button onClick={() => genAll(true)} className="h-10 px-4 rounded-xl bg-[#142033] text-white text-sm font-bold">✨ AI soạn {done ? "các câu còn thiếu" : "cả đề"}</button>
              {done > 0 && <button onClick={() => confirm("Soạn lại toàn bộ sẽ ghi đè phần đã sửa (trừ ghi chú riêng). Tiếp tục?") && genAll(false)} className="h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold">Soạn lại tất cả</button>}
            </> : <button onClick={() => (stop.current = true)} className="h-10 px-4 rounded-xl border border-rose-300 text-rose-700 text-sm font-bold">■ Dừng sau phần này</button>}
            <button onClick={async () => { const v = !lesson.published; if (v && !done && !confirm("Đề này chưa có phần phân tích nào. Vẫn gửi cho học viên?")) return; setLesson((L) => ({ ...L, published: v })); await save({ published: v, publishedAt: v ? serverTimestamp() : null }); }}
              className={`h-10 px-4 rounded-xl text-sm font-bold border ${lesson.published ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-500 text-emerald-700"}`}>{lesson.published ? "✓ Đã gửi học viên · bấm để thu hồi" : "📤 Gửi cho học viên xem"}</button>
            {lesson.published && <button onClick={() => { const u = `${location.origin}/giang-de?p=${lessonKey(dir, pid)}`; navigator.clipboard?.writeText(u).then(() => setSaved("Đã chép link ✓"), () => prompt("Link bài chữa:", u)); }} className="h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold">🔗 Chép link</button>}
            <span className="text-sm text-slate-600">Đã soạn <b>{done}</b>/{items.length} câu</span>
            <span className="text-xs text-slate-400">{saved}</span>
          </div>
        )}
        {paper && lesson && (
          <div className="flex flex-wrap gap-2 items-center text-sm border-t border-slate-100 pt-3">
            <b className="text-[#142033]">📊 Bài làm của lớp:</b>
            {subs.length ? <>
              <select value={cls} onChange={(e) => setCls(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300"><option value="">Tất cả ({subs.length} bài)</option>{classes.map((c) => <option key={c.id} value={c.className}>{c.className}</option>)}</select>
              <span className="text-slate-500">{subsF.length} bài{stats ? ` · ${weak.size} câu dưới 60% làm đúng` : ""}</span>
              {weak?.size > 0 && <label className="flex items-center gap-1 font-bold text-rose-700"><input type="checkbox" checked={onlyWeak} onChange={(e) => setOnlyWeak(e.target.checked)} />Chỉ chiếu câu lớp làm sai nhiều</label>}
            </> : <span className="text-slate-500">chưa có học viên nào nộp đề này trên web.</span>}
          </div>
        )}
        {busy && <div className="text-sm text-indigo-700 font-bold animate-pulse">{busy}</div>}
        {err && <div className="text-sm text-rose-700">⚠ {err}</div>}
        {listenMissing && <div className="text-sm text-amber-700">Đề này chưa có bản chép lời nghe — AI chỉ dựa vào phương án nên phần Nghe sẽ sơ sài hơn.</div>}
      </div>

      {paper && lesson && (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3 lg:sticky lg:top-20 lg:max-h-[80vh] overflow-auto">
            {units.map((u) => (
              <div key={u.i} className="mb-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase">{partLabel(u)}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {u.nums.map((n) => <button key={n} onClick={() => setSelN(n)} title={stats?.[n] ? `Lớp đúng ${stats[n].pct}%` : ""} className={`w-9 rounded-lg text-xs font-bold border leading-tight ${stats ? "h-10" : "h-8"} ${selN === n ? "bg-[#142033] text-white border-[#142033]" : hasA(lesson.q?.[n]) ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-slate-200"}`}>{n}{stats?.[n] && <span className={`block text-[9px] ${selN === n ? "text-white/80" : tone(stats[n].pct)}`}>{stats[n].pct}%</span>}</button>)}
                </div>
              </div>
            ))}
          </div>

          {it && un && (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm text-[#9E2F22]">{partLabel(un)}</b>
                  <span className="text-xs text-slate-400">{un.head}</span>
                  <button disabled={!!busy} onClick={() => genOne(un)} className="ml-auto h-8 px-3 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-40">✨ AI soạn lại phần này</button>
                  <button onClick={() => setPresent(true)} className="h-8 px-3 rounded-lg bg-[#9E2F22] text-white text-xs font-bold">▶ Chiếu từ câu này</button>
                </div>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-amber-700">🎯 Chiến lược làm phần này (hiện ở trang mở đầu phần)</span>
                  <textarea value={lesson.units?.[un.i]?.strategy || ""} onChange={(e) => editStrategy(un.i, e.target.value)} rows={2} className="rounded-xl border border-slate-300 p-2 text-sm" style={ZH} />
                </label>
                {un.passage && <details className="rounded-xl bg-slate-50 border border-slate-200 p-3"><summary className="text-sm font-bold cursor-pointer">Bài đọc của nhóm câu</summary><div className="whitespace-pre-line mt-2 leading-relaxed" style={ZH}>{un.passage}</div></details>}
              </div>

              <div className="grid xl:grid-cols-2 gap-4 items-start">
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 grid gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-500">Xem trước:</span>
                    {[["Câu hỏi", 0], ["Đáp án", 1], ["Đầy đủ", 3]].map(([l, s]) => <button key={s} onClick={() => setStep(s)} className={`px-2 py-1 rounded-md border ${step === s ? "bg-[#142033] text-white" : ""}`}>{l}</button>)}
                    {it.sec === "L" && <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={script} onChange={(e) => setScript(e.target.checked)} />Lời nghe</label>}
                  </div>
                  <QView it={it} step={step} showScript={script} />
                  {stats?.[it.n] && <StatBar it={it} st={stats[it.n]} />}
                  <Analysis a={lesson.q?.[it.n]} step={step} />
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 grid gap-3">
                  <div className="text-sm font-black text-[#142033]">Phần chữa câu {it.n}</div>
                  {FIELDS.map((f) => (
                    <label key={f.k} className="grid gap-1">
                      <span className="text-xs font-bold text-slate-500">{f.label}</span>
                      <textarea value={lesson.q?.[it.n]?.[f.k] || ""} onChange={(e) => edit(it.n, f.k, e.target.value)} rows={f.rows} className={`rounded-xl border p-2 text-sm leading-relaxed ${f.k === "note" ? "border-dashed border-slate-300 bg-slate-50" : "border-slate-300"}`} style={ZH} />
                    </label>
                  ))}
                  <div className="flex gap-2">
                    {(() => { const i = items.findIndex((x) => x.n === it.n); return <>
                      <button disabled={i <= 0} onClick={() => setSelN(items[i - 1].n)} className="h-9 px-3 rounded-lg border border-slate-300 text-sm font-bold disabled:opacity-30">← Câu trước</button>
                      <button disabled={i >= items.length - 1} onClick={() => setSelN(items[i + 1].n)} className="h-9 px-3 rounded-lg border border-slate-300 text-sm font-bold disabled:opacity-30">Câu sau →</button>
                    </>; })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {!pid && <p className="text-slate-500 text-sm">Chọn một đề để bắt đầu.</p>}
      {pid && (!paper || !lesson) && !err && <p className="text-slate-500 text-sm">Đang tải đề…</p>}

      {present && paper && lesson && <Present paper={paper} units={units} items={items} lesson={lesson} startN={selN} stats={stats} only={onlyWeak && weak?.size ? weak : null} onClose={() => setPresent(false)} />}
    </div>
  );
}
