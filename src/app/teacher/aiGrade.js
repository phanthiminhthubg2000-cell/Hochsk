"use client";
// AI chấm trước để cô duyệt — dùng ở tab "Chấm bài HSK 3.0" (phần viết) và "Chấm thi HSKK" (ghi âm từng câu).
// Kết quả AI được lưu vào Firestore (trường ai / aiSummary) để mở lại không phải chấm lại.
import { useEffect, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";

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

// ---------------- HSK: phần viết ----------------
export function HskWritingAI({ db, sub, meta, onFill }) {
  const [ai, setAi] = useState(sub.ai || null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const items = (Array.isArray(sub.writingItems) && sub.writingItems.length ? sub.writingItems : [71, 72].filter((n) => sub[`writing${n}`] != null).map((n) => ({ n, text: sub[`writing${n}`] || "", min: n === 71 ? 100 : 200 })))
    .map((raw) => ({ ...(meta?.[raw.n] || {}), ...Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== "" && v != null)) }));
  const L = Number(sub.listeningScore), R = Number(sub.readingScore);
  const run = async () => {
    if (!items.length) return;
    setBusy(true); setErr("");
    try {
      const d = await call({ mode: "writing", level: sub.level, items: items.map((x) => ({ n: x.n, text: x.text || "", word: x.word || "", prompt: x.prompt || "", ref: x.ref || "", min: x.min || "", img: x.img ? abs(x.img) : "" })) });
      setAi(d); await updateDoc(doc(db, "hsk3_submissions", sub.id), { ai: d }).catch(() => {});
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const ran = useRef(false);
  useEffect(() => { if (!ai && !ran.current && items.length) { ran.current = true; run(); } /* eslint-disable-next-line */ }, []);
  const W = ai?.items?.length ? Math.round(ai.items.reduce((s, x) => s + (Number(x.score) || 0), 0) / ai.items.length) : null;
  const parts = [L, R, W].filter((x) => Number.isFinite(x));
  const total = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  useEffect(() => { if (ai && total != null) onFill?.(total, [ai.comment, ...(ai.items || []).filter((x) => x.comment).map((x) => `Câu ${x.n}: ${x.comment}`)].filter(Boolean).join("\n")); /* eslint-disable-next-line */ }, [ai]);
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4 grid gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-[#142033]">🤖 AI chấm phần viết</b>
        {busy ? <span className="text-xs text-sky-700 font-bold">Đang chấm… (khoảng 20–30 giây)</span> : <button onClick={run} className="text-xs font-bold underline text-sky-700">{ai ? "↻ Chấm lại" : "Chấm ngay"}</button>}
        {total != null && <span className="ml-auto text-sm">Gợi ý điểm tổng: <b className="text-lg text-[#10B981]">{total}</b>/100 <span className="text-xs text-slate-500">(Nghe {Number.isFinite(L) ? L : "–"} · Đọc {Number.isFinite(R) ? R : "–"} · Viết {W ?? "–"})</span></span>}
      </div>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      {ai?.items?.map((x) => (
        <div key={x.n} className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="flex items-center gap-2"><b className="text-sm">Câu {x.n}</b><span className={`text-xs font-black px-2 py-0.5 rounded border ${tone(x.score)}`}>{x.score}</span><span className="text-sm text-slate-600">{x.comment}</span></div>
          <Fixes fixes={x.fixes} />
          {x.better && <div className="text-sm mt-1"><span className="text-xs text-slate-500">Viết tự nhiên hơn: </span><span className="text-sky-700" style={zh}>{x.better}</span></div>}
        </div>
      ))}
      {ai?.comment && <div className="text-sm"><b>Nhận xét chung:</b> {ai.comment}</div>}
      {ai && <p className="text-xs text-slate-500">Điểm và nhận xét AI đã điền sẵn vào ô bên dưới — cô sửa lại rồi bấm gửi.</p>}
    </div>
  );
}

// ---------------- HSKK: từng câu ghi âm ----------------
export function useHskkAI({ db, exam, answers, onFill }) {
  const [ai, setAi] = useState({}); const [busy, setBusy] = useState({}); const [sum, setSum] = useState(null); const [err, setErr] = useState("");
  const started = useRef(null);
  const per = answers.length ? Math.round((100 / answers.length) * 10) / 10 : 0; // điểm tối đa mỗi câu để tổng = 100
  const gradeOne = async (a) => {
    setBusy((b) => ({ ...b, [a.id]: true }));
    try {
      const d = await call({ mode: "hskk", level: exam.level, type: a.type, question: a.question, img: a.images?.[0] ? abs(a.images[0]) : "", audio: a.audioBase64 || abs(a.audioUrl) || "" });
      setAi((x) => ({ ...x, [a.id]: d }));
      await updateDoc(doc(db, "hskk_exams", exam.id, "answers", a.id), { ai: d }).catch(() => {});
      return d;
    } catch (e) { setErr(e.message || String(e)); return null; }
    finally { setBusy((b) => { const n = { ...b }; delete n[a.id]; return n; }); }
  };
  const runAll = async (force) => {
    setErr("");
    const got = {}; answers.forEach((a) => { if (!force && a.ai) got[a.id] = a.ai; });
    setAi(got);
    const todo = answers.filter((a) => force || !a.ai);
    for (let i = 0; i < todo.length; i += 3) { const r = await Promise.all(todo.slice(i, i + 3).map(gradeOne)); r.forEach((d, k) => { if (d) got[todo[i + k].id] = d; }); }
    // điền điểm/nhận xét từng câu + nhận xét chung
    const scores = {}, comments = {};
    answers.forEach((a) => { const d = got[a.id]; if (!d) return; scores[a.id] = String(Math.round(((Number(d.score) || 0) * per) / 10) / 10); comments[a.id] = [d.comment, d.pron].filter(Boolean).join(" "); });
    let s = exam.aiSummary || null;
    if (force || !s) {
      try { s = await call({ mode: "hskk_sum", level: exam.level, items: answers.map((a, i) => ({ n: i + 1, type: a.type, score: got[a.id]?.score ?? 0, transcript: got[a.id]?.transcript || "", comment: got[a.id]?.comment || "" })) }); await updateDoc(doc(db, "hskk_exams", exam.id), { aiSummary: s }).catch(() => {}); } catch (e) { setErr(e.message || String(e)); }
    }
    setSum(s); onFill?.(scores, comments, s?.comment || "");
  };
  useEffect(() => { if (answers.length && started.current !== exam.id) { started.current = exam.id; runAll(false); } /* eslint-disable-next-line */ }, [answers, exam?.id]);
  return { ai, busy, sum, err, per, rerun: () => runAll(true), regradeOne: gradeOne };
}

export function HskkAINote({ d, busy, per, onRe }) {
  if (busy) return <div className="mb-3 text-xs font-bold text-sky-700">🤖 AI đang nghe và chấm câu này…</div>;
  if (!d) return null;
  return (
    <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-xs text-sky-800">🤖 AI</b>
        <span className={`text-xs font-black px-2 py-0.5 rounded border ${tone(d.score)}`}>{d.score}/100 → {Math.round(((Number(d.score) || 0) * per) / 10) / 10}/{per}đ</span>
        <span className="text-sm text-slate-700">{d.comment}</span>
        {onRe && <button onClick={onRe} className="ml-auto text-xs underline text-sky-700">↻ chấm lại câu này</button>}
      </div>
      {d.transcript && <div className="mt-1.5 text-[15px] leading-7" style={zh}><span className="text-xs text-slate-500 font-sans">Lời học viên: </span>{d.transcript}</div>}
      {d.pron && <div className="text-sm text-slate-600 mt-0.5">🔊 {d.pron}</div>}
      <Fixes fixes={d.fixes} />
    </div>
  );
}
