"use client";
// AI chấm trước để cô duyệt — dùng ở tab "Chấm bài HSK 3.0" (phần viết) và "Chấm thi HSKK" (ghi âm từng câu).
// Kết quả AI được lưu vào Firestore (trường ai / aiSummary) để mở lại không phải chấm lại.
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { hskWritingKind, HSK_W_KIND, hskWritingScore, hskkPlan, hskkKind, HSKK_KIND } from "@/lib/scoring";

const zh = { fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif" };
const tone = (v) => (v >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : v >= 60 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-rose-50 text-rose-600 border-rose-200");
const abs = (u) => { try { return u && !u.startsWith("data:") ? new URL(u, window.location.origin).href : u; } catch { return u; } };
async function call(body) {
  const r = await fetch("/api/grade-exam", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({})); if (!r.ok || d.error) throw new Error(d.error || "Lỗi " + r.status); return d;
}

export function Fixes({ fixes }) {
  if (!fixes?.length) return null;
  return <ul className="mt-1 grid gap-0.5 text-sm">{fixes.map((e, i) => <li key={i}><span className="text-rose-600" style={zh}>{e.wrong}</span> → <b className="text-emerald-700" style={zh}>{e.right}</b> <span className="text-xs text-slate-500">{e.why}</span></li>)}</ul>;
}

export function Crit({ crit }) {
  if (!crit?.length) return null;
  return <div className="mt-1 flex flex-wrap gap-1">{crit.map((c, i) => <span key={i} title={`trọng số ${c.w}%`} className={`text-[11px] px-1.5 py-0.5 rounded border ${tone(c.score)}`}>{c.name.split(" — ")[0]}: <b>{c.score}</b></span>)}</div>;
}

// ---------------- HSK: phần viết ----------------
export function HskWritingAI({ db, sub, meta, onFill }) {
  const [ai, setAi] = useState(sub.ai || null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const items = (Array.isArray(sub.writingItems) && sub.writingItems.length ? sub.writingItems : [71, 72].filter((n) => sub[`writing${n}`] != null).map((n) => ({ n, text: sub[`writing${n}`] || "", min: n === 71 ? 100 : 200 })))
    .map((raw) => ({ ...(meta?.[raw.n] || {}), ...Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== "" && v != null)) }))
    .map((x) => ({ ...x, kind: hskWritingKind(x) }));
  const run = async () => {
    if (!items.length) return;
    setBusy(true); setErr("");
    try {
      const d = await call({ mode: "writing", level: sub.level, items: items.map((x) => ({ n: x.n, kind: x.kind === "picture" ? "picture_w" : x.kind, text: x.text || "", word: x.word || "", prompt: x.prompt || "", ref: x.ref || "", min: x.min || "", img: x.img ? abs(x.img) : "" })) });
      setAi(d); await updateDoc(doc(db, "hsk3_submissions", sub.id), { ai: d }).catch(() => {});
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const ran = useRef(false);
  useEffect(() => { if (!ai && !ran.current && items.length) { ran.current = true; run(); } /* eslint-disable-next-line */ }, []);
  const W = ai?.items?.length ? hskWritingScore(sub, items, ai.items) : null;
  useEffect(() => { if (ai && W != null) onFill?.(W, [ai.comment, ...(ai.items || []).filter((x) => x.comment).map((x) => `Câu ${x.n}: ${x.comment}`)].filter(Boolean).join("\n")); /* eslint-disable-next-line */ }, [ai]);
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4 grid gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-[#142033]">🤖 AI chấm phần viết</b>
        {busy ? <span className="text-xs text-sky-700 font-bold">Đang chấm… (khoảng 20–30 giây)</span> : <button onClick={run} className="text-xs font-bold underline text-sky-700">{ai ? "↻ Chấm lại" : "Chấm ngay"}</button>}
        {W != null && <span className="ml-auto text-sm">Gợi ý điểm Viết 书写: <b className="text-lg text-[#10B981]">{W}</b>/100</span>}
      </div>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      {ai?.items?.map((x) => (
        <div key={x.n} className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="flex items-center gap-2 flex-wrap"><b className="text-sm">Câu {x.n}</b><span className="text-[11px] text-slate-500">{HSK_W_KIND[items.find((y) => String(y.n) === String(x.n))?.kind || "essay"]?.vi}</span><span className={`text-xs font-black px-2 py-0.5 rounded border ${tone(x.score)}`}>{x.score}/100</span><span className="text-sm text-slate-600">{x.comment}</span></div>
          <Crit crit={x.crit} />
          <Fixes fixes={x.fixes} />
          {x.better && <div className="text-sm mt-1"><span className="text-xs text-slate-500">Viết tự nhiên hơn: </span><span className="text-sky-700" style={zh}>{x.better}</span></div>}
        </div>
      ))}
      {ai?.comment && <div className="text-sm"><b>Nhận xét chung:</b> {ai.comment}</div>}
      {ai && <p className="text-xs text-slate-500">Điểm Viết = trung bình có trọng số: câu tự chấm (sắp xếp/điền chữ) ×1, đặt câu ×2, viết đoạn ×6. Đã điền sẵn vào ô Viết bên dưới — cô sửa lại rồi bấm gửi.</p>}
    </div>
  );
}

// Văn bản gốc / bài mẫu của từng câu, lấy từ tệp đề (window.EXAM trong /hskk-exam/*.html)
async function loadHskkRefs(exam) {
  try {
    const list = await (await fetch("/hskk-exam/exams.json")).json();
    const code = String(exam.examName || exam.level || "").match(/H\d{5}/)?.[0];
    const lv = Number(String(exam.level || "").match(/HSKK\s*(\d)/)?.[1]);
    const e = code ? list.find((x) => String(x.file).includes(code)) : list.find((x) => x.level === lv && !x.tier && (x.name === exam.examName || x.label === exam.examName)) || list.find((x) => x.level === lv && !x.tier);
    if (!e) return {};
    const html = await (await fetch(e.file)).text();
    const m = html.match(/window\.EXAM=(\{[\s\S]*?\});<\/script>/); if (!m) return {};
    const E = JSON.parse(m[1]); const out = {};
    const strip = (t) => String(t || "").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").trim();
    for (const [label, body] of E.samples || []) {
      const src = /Lời|朗读|Đoạn văn|ghi âm/.test(label) ? "source" : "sample";
      const r = label.match(/Câu\s*(\d+)(?:\s*[–-]\s*(\d+))?/); if (!r) continue;
      const a = +r[1], b = r[2] ? +r[2] : a, t = strip(body);
      if (b > a) { const seg = t.split(/(?:^|\s|\n)(\d+)\.\s*/); for (let i = 1; i < seg.length; i += 2) out[+seg[i]] = { ref: seg[i + 1].trim(), refKind: src }; }
      else out[a] = { ref: t, refKind: src };
    }
    for (const [q, t] of Object.entries(E.qText || {})) if (!out[q] && t && !/^(听后重复|听后复述|朗读|看图说话)$/.test(t) && /[。？！?]$/.test(t) && (E.qMeta?.[q]?.type === "repeat")) out[q] = { ref: t, refKind: "source" };
    return out;
  } catch { return {}; }
}

// ---------------- HSKK: từng câu ghi âm, chia phần như đề ----------------
export function useHskkAI({ db, exam, answers, onFill }) {
  const [ai, setAi] = useState({}); const [busy, setBusy] = useState({}); const [sum, setSum] = useState(null); const [err, setErr] = useState("");
  const started = useRef(null); const refs = useRef({});
  const plan = useMemo(() => hskkPlan(answers), [answers]);
  const gradeOne = async (a) => {
    setBusy((b) => ({ ...b, [a.id]: true }));
    try {
      const kind = hskkKind(a); const r = refs.current[a.questionIndex] || {};
      const d = await call({ mode: "hskk", level: exam.level, type: a.type, kind, max: plan.per[a.id], question: a.question, ref: r.ref || "", refKind: r.refKind || "", img: a.images?.[0] ? abs(a.images[0]) : "", audio: a.audioBase64 || abs(a.audioUrl) || "" });
      setAi((x) => ({ ...x, [a.id]: d }));
      await updateDoc(doc(db, "hskk_exams", exam.id, "answers", a.id), { ai: d }).catch(() => {});
      return d;
    } catch (e) { setErr(e.message || String(e)); return null; }
    finally { setBusy((b) => { const n = { ...b }; delete n[a.id]; return n; }); }
  };
  const pts = (d, id) => Math.round(((Number(d?.score) || 0) * (plan.per[id] || 0)) / 10) / 10;
  const runAll = async (force) => {
    setErr("");
    if (!Object.keys(refs.current).length) refs.current = await loadHskkRefs(exam);
    const got = {}; answers.forEach((a) => { if (!force && a.ai?.crit) got[a.id] = a.ai; });
    setAi(got);
    const todo = answers.filter((a) => !got[a.id]);
    for (let i = 0; i < todo.length; i += 3) { const r = await Promise.all(todo.slice(i, i + 3).map(gradeOne)); r.forEach((d, k) => { if (d) got[todo[i + k].id] = d; }); }
    const scores = {}, comments = {};
    answers.forEach((a) => { const d = got[a.id]; if (!d) return; scores[a.id] = String(pts(d, a.id)); comments[a.id] = [d.comment, d.pron].filter(Boolean).join(" "); });
    const total = Math.round(answers.reduce((s, a) => s + pts(got[a.id], a.id), 0));
    let s = exam.aiSummary?.v2 ? exam.aiSummary : null;
    if (force || !s) {
      try { s = { ...(await call({ mode: "hskk_sum", level: exam.level, total, items: answers.map((a, i) => ({ n: i + 1, type: HSKK_KIND[hskkKind(a)].zh, score: got[a.id]?.score ?? 0, transcript: got[a.id]?.transcript || "", comment: got[a.id]?.comment || "" })) })), v2: 1 }; await updateDoc(doc(db, "hskk_exams", exam.id), { aiSummary: s }).catch(() => {}); } catch (e) { setErr(e.message || String(e)); }
    }
    setSum(s); onFill?.(scores, comments, s?.comment || "");
  };
  useEffect(() => { if (answers.length && started.current !== exam.id) { started.current = exam.id; refs.current = {}; runAll(false); } /* eslint-disable-next-line */ }, [answers, exam?.id]);
  return { ai, busy, sum, err, plan, per: plan.per, rerun: () => runAll(true), regradeOne: gradeOne };
}

export function HskkAINote({ d, busy, per, onRe }) {
  if (busy) return <div className="mb-3 text-xs font-bold text-sky-700">🤖 AI đang nghe và chấm câu này…</div>;
  if (!d) return null;
  return (
    <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-xs text-sky-800">🤖 AI</b>
        <span className={`text-xs font-black px-2 py-0.5 rounded border ${tone(d.score)}`}>{d.score}/100 → {Math.round(((Number(d.score) || 0) * per) / 10) / 10}/{per} điểm</span>
        <span className="text-sm text-slate-700">{d.comment}</span>
        {onRe && <button onClick={onRe} className="ml-auto text-xs underline text-sky-700">↻ chấm lại câu này</button>}
      </div>
      {d.transcript && <div className="mt-1.5 text-[15px] leading-7" style={zh}><span className="text-xs text-slate-500 font-sans">Lời học viên: </span>{d.transcript}</div>}
      <Crit crit={d.crit} />
      {d.pron && <div className="text-sm text-slate-600 mt-0.5">🔊 {d.pron}</div>}
      <Fixes fixes={d.fixes} />
    </div>
  );
}
