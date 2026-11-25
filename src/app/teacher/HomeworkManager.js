"use client";
// TRANG GIÁO VIÊN · BÀI TẬP VỀ NHÀ — học viên chụp bài viết tay (tóm tắt 课文 / bài văn) gửi lên;
// trang này tự gọi AI đọc chữ + chấm, cô xem, sửa điểm/nhận xét rồi trả bài (học viên chỉ thấy phần cô trả).
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { HW_COL, HW_IMG, partName, lectureText, fmtTime } from "../../lib/homework";
import { STATIC_LECTURES } from "../staticLectures";

const btn = "rounded-xl font-bold text-sm transition-colors disabled:opacity-50";
const SC = { content: "Nội dung", structure: "Bố cục", vocab: "Từ vựng", grammar: "Ngữ pháp", length: "Độ dài", coverage: "Đủ ý", own: "Lời của mình" };
const tone = (v) => (v >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : v >= 60 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-rose-50 text-rose-600 border-rose-200");

// Tô đỏ các cụm sai trong bản chép
function Marked({ text, errors }) {
  const parts = useMemo(() => {
    const ws = (errors || []).map((e) => e.wrong).filter((w) => w && text.includes(w)).sort((a, b) => b.length - a.length);
    if (!ws.length) return [text];
    const re = new RegExp("(" + ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g");
    return text.split(re);
  }, [text, errors]);
  return <>{parts.map((p, i) => { const e = (errors || []).find((x) => x.wrong === p); return e ? <mark key={i} title={`→ ${e.right} · ${e.why || ""}`} className="bg-rose-100 text-rose-700 rounded px-0.5 underline decoration-rose-400">{p}<sup className="text-emerald-700 font-bold ml-0.5 no-underline">{e.right}</sup></mark> : <span key={i}>{p}</span>; })}</>;
}

function Item({ db, h, open, setOpen, regrade, grading }) {
  const [imgs, setImgs] = useState(null); const [big, setBig] = useState(null);
  const ai = h.ai;
  const [score, setScore] = useState(""); const [cmt, setCmt] = useState(""); const [fix, setFix] = useState(true); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open && !imgs) getDoc(doc(db, HW_IMG, h.id)).then((s) => setImgs(s.data()?.images || [])).catch(() => setImgs([])); }, [open, imgs, db, h.id]);
  useEffect(() => {
    setScore(h.teacherScore ?? (ai?.score?.total != null ? Math.round(ai.score.total / 10) : ""));
    setCmt(h.teacherComment ?? (ai ? [ai.comment, ...(ai.tips || []).map((t) => "• " + t)].filter(Boolean).join("\n") : ""));
  }, [h.id, ai, h.teacherScore, h.teacherComment]);
  const fixesText = (ai?.errors || []).map((e) => `✗ ${e.wrong} → ✓ ${e.right}${e.why ? `（${e.why}）` : ""}`).join("\n");
  const ret = async () => {
    setSaving(true);
    try { await updateDoc(doc(db, HW_COL, h.id), { status: "returned", teacherScore: score === "" ? null : Number(score), teacherComment: cmt.trim(), teacherFixes: fix ? fixesText : "", returnedAt: serverTimestamp() }); setOpen(null); }
    catch (e) { alert("Chưa lưu được: " + (e.message || e)); }
    setSaving(false);
  };
  const del = async () => { if (!confirm(`Xoá bài của ${h.studentName}?`)) return; await deleteDoc(doc(db, HW_COL, h.id)).catch(() => {}); await deleteDoc(doc(db, HW_IMG, h.id)).catch(() => {}); };
  const total = ai?.score?.total;
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${open ? "border-emerald-300" : "border-[#E2E8F0]"}`}>
      <button onClick={() => setOpen(open ? null : h.id)} className="w-full text-left p-3 md:p-4 flex items-center gap-3">
        <div className={`w-12 h-12 shrink-0 rounded-xl border grid place-items-center font-black ${total != null ? tone(total) : "bg-slate-50 text-slate-400 border-slate-200"}`}>{grading ? "…" : total != null ? total : h.aiError ? "!" : "–"}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[#142033] break-words">{h.studentName} <span className="font-normal text-slate-500 text-sm">· {h.className}</span></div>
          <div className="text-xs text-slate-500 break-words"><b className="text-slate-700">{partName(h.part)}</b> · {h.lectureName} · {fmtTime(h.createdAt)} · {h.pages || "?"} trang</div>
        </div>
        <span className={`text-[11px] font-bold px-2 py-1 rounded-full shrink-0 ${h.status === "returned" ? "bg-emerald-50 text-emerald-700" : grading ? "bg-sky-50 text-sky-700" : h.aiError ? "bg-rose-50 text-rose-600" : ai ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
          {h.status === "returned" ? "Đã trả" : grading ? "AI đang chấm" : h.aiError ? "AI lỗi" : ai ? "Chờ cô duyệt" : "Chưa chấm"}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3 md:p-4 grid gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imgs == null ? <span className="text-sm text-slate-400">Đang tải ảnh…</span> : imgs.map((src, i) => <button key={i} onClick={() => setBig(src)} className="shrink-0"><img src={src} alt={`Trang ${i + 1}`} className="h-44 rounded-lg border border-slate-200 object-contain bg-slate-50" /></button>)}
          </div>
          {big && <div className="fixed inset-0 z-[300] bg-black/85 grid place-items-center p-3" onClick={() => setBig(null)}><img src={big} alt="" className="max-w-full max-h-full object-contain" /></div>}
          {h.topic && <div className="text-sm"><b>Đề bài:</b> {h.topic}</div>}
          {h.aiError && !ai && <div className="text-sm text-rose-600">AI chưa chấm được: {h.aiError}</div>}
          {ai && (
            <>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ai.score || {}).filter(([k]) => k !== "total").map(([k, v]) => <span key={k} className={`text-xs font-bold px-2 py-1 rounded-lg border ${tone(v)}`}>{SC[k] || k}: {v}</span>)}
                <span className={`text-xs font-black px-2 py-1 rounded-lg border ${tone(total)}`}>Tổng AI: {total}/100</span>
                {ai.chars != null && <span className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-600">{ai.chars} chữ</span>}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">Bản chép bài viết tay (cụm đỏ = lỗi, chữ xanh nhỏ = sửa)</div>
                <div className="rounded-xl bg-[#FFFDF7] border border-amber-100 p-3 text-[17px] leading-[2.1] whitespace-pre-wrap" style={{ fontFamily: '"Noto Serif SC","Noto Sans SC",serif' }}><Marked text={ai.ocr || ""} errors={ai.errors} /></div>
                {ai.hand && <div className="text-xs text-slate-500 mt-1">✍️ Chữ viết: {ai.hand}</div>}
              </div>
              {ai.points?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">Ý chính của bài khoá{ai.source_title ? ` · ${ai.source_title}` : ""}</div>
                  <ul className="grid gap-1 text-sm">{ai.points.map((p, i) => <li key={i} className={p.hit ? "text-emerald-700" : "text-rose-600"}>{p.hit ? "✓" : "✗"} {p.vi}</li>)}</ul>
                </div>
              )}
              {ai.source_found === false && h.part !== "essay" && <div className="text-xs text-amber-700">AI không tìm thấy văn bản {partName(h.part).replace("Tóm tắt ", "")} trong bài giảng — chỉ chấm ngôn ngữ, chưa so ý chính.</div>}
              {ai.errors?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-2">Sai</th><th className="py-1 pr-2">Sửa</th><th className="py-1 pr-2">Loại</th><th className="py-1">Giải thích</th></tr></thead>
                    <tbody>{ai.errors.map((e, i) => <tr key={i} className="border-t border-slate-100 align-top"><td className="py-1.5 pr-2 text-rose-600" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{e.wrong}</td><td className="py-1.5 pr-2 text-emerald-700 font-bold" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{e.right}</td><td className="py-1.5 pr-2 text-xs text-slate-500 whitespace-nowrap">{e.type}</td><td className="py-1.5 text-slate-600">{e.why}</td></tr>)}</tbody></table>
                </div>
              )}
              {ai.upgrades?.length > 0 && <div><div className="text-xs font-bold text-slate-500 mb-1">Câu nâng cấp</div>{ai.upgrades.map((x, i) => <div key={i} className="text-sm mb-1" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}><span className="text-slate-500">{x.orig}</span> → <b className="text-sky-700">{x.better}</b></div>)}</div>}
              {ai.strengths?.length > 0 && <div className="text-sm text-emerald-700">👍 {ai.strengths.join(" · ")}</div>}
              {ai.sample && <details className="text-sm"><summary className="cursor-pointer font-bold text-slate-600">Bài mẫu tham khảo (AI)</summary><div className="mt-1 whitespace-pre-wrap leading-relaxed" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{ai.sample}</div></details>}
            </>
          )}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 grid gap-2">
            <div className="text-sm font-bold text-[#142033]">Trả bài cho học viên <span className="font-normal text-xs text-slate-500">— học viên chỉ thấy phần này, không thấy điểm AI</span></div>
            <div className="flex items-center gap-2 text-sm"><span>Điểm (thang 10)</span><input type="number" min="0" max="10" step="0.5" value={score} onChange={(e) => setScore(e.target.value)} className="w-24 h-9 px-2 rounded-lg border border-slate-300" /></div>
            <textarea rows={4} value={cmt} onChange={(e) => setCmt(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Nhận xét gửi học viên…" />
            {fixesText && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)} /> Gửi kèm danh sách lỗi đã sửa ({ai.errors.length} lỗi)</label>}
            <div className="flex flex-wrap gap-2">
              <button onClick={ret} disabled={saving} className={`${btn} px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white`}>{h.status === "returned" ? "Cập nhật bài đã trả" : "✓ Trả bài"}</button>
              <button onClick={() => regrade(h)} disabled={grading} className={`${btn} px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100`}>{grading ? "AI đang chấm…" : "↻ Chấm lại bằng AI"}</button>
              <button onClick={del} className={`${btn} px-4 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 ml-auto`}>Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomeworkManager({ db }) {
  const [list, setList] = useState([]); const [cls, setCls] = useState(""); const [tab, setTab] = useState("todo"); const [open, setOpen] = useState(null);
  const [grading, setGrading] = useState({}); const tried = useRef(new Set()); const lecCache = useRef({});
  useEffect(() => onSnapshot(collection(db, HW_COL), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))), (e) => console.error("homework:", e)), [db]);

  const grade = async (h) => {
    setGrading((g) => ({ ...g, [h.id]: true }));
    try {
      const im = await getDoc(doc(db, HW_IMG, h.id)); const images = im.data()?.images || [];
      if (!images.length) throw new Error("không tìm thấy ảnh bài làm");
      let text = lecCache.current[h.lectureId];
      if (text == null) {
        let lec = STATIC_LECTURES.find((x) => x.id === h.lectureId);
        if (!lec && h.lectureId) { const s = await getDoc(doc(db, "lectures_bank", h.lectureId)).catch(() => null); lec = s?.exists() ? s.data() : null; }
        if (!lec && h.lectureUrl) lec = { fileUrl: h.lectureUrl };
        text = lecCache.current[h.lectureId] = await lectureText(lec);
      }
      const r = await fetch("/api/homework", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images, part: h.part, level: h.level || h.lectureLevel, prompt: h.topic, lectureText: text }) });
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || "Lỗi " + r.status);
      await updateDoc(doc(db, HW_COL, h.id), { ai: d, aiAt: serverTimestamp(), aiError: null, ...(h.status === "new" ? { status: "ai" } : {}) });
    } catch (e) { await updateDoc(doc(db, HW_COL, h.id), { aiError: String(e.message || e).slice(0, 300) }).catch(() => {}); }
    setGrading((g) => { const n = { ...g }; delete n[h.id]; return n; });
  };
  // tự chấm bài mới (2 bài một lúc)
  useEffect(() => {
    const todo = list.filter((h) => !h.ai && !h.aiError && !tried.current.has(h.id));
    const free = 2 - Object.keys(grading).length;
    todo.slice(0, Math.max(0, free)).forEach((h) => { tried.current.add(h.id); grade(h); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, grading]);

  const classes = [...new Map(list.map((h) => [h.classId, h.className])).entries()];
  const inCls = list.filter((h) => !cls || h.classId === cls);
  const TABS = [["todo", "Cần xử lý", (h) => h.status !== "returned"], ["done", "Đã trả", (h) => h.status === "returned"], ["all", "Tất cả", () => true]];
  const shown = inCls.filter(TABS.find((t) => t[0] === tab)[2]);
  // lỗi hay gặp của lớp đang lọc
  const common = useMemo(() => {
    const m = new Map();
    inCls.forEach((h) => (h.ai?.errors || []).forEach((e) => { const k = (e.type || "khác") + "|" + (e.why || "").slice(0, 60); const v = m.get(k) || { type: e.type, why: e.why, n: 0, ex: e }; v.n++; m.set(k, v); }));
    return [...m.values()].filter((x) => x.n > 1).sort((a, b) => b.n - a.n).slice(0, 8);
  }, [inCls]);

  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] bg-white border border-[#E2E8F0] p-5 md:p-6 shadow-sm">
        <h2 className="text-2xl font-black text-[#142033]">📝 Bài tập về nhà</h2>
        <p className="text-sm text-slate-500 mt-1">Học viên vào <b>/bai-tap</b>, chụp bài viết tay (tóm tắt 课文一/二/三 hoặc bài văn) gửi lên. AI tự đọc chữ và chấm khi cô mở trang này; cô duyệt, sửa điểm – nhận xét rồi bấm <b>Trả bài</b>. Học viên chỉ thấy phần cô trả.</p>
        <div className="flex flex-wrap gap-2 mt-4 items-center">
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 text-sm"><option value="">Tất cả lớp</option>{classes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          {TABS.map(([k, l, f]) => <button key={k} onClick={() => setTab(k)} className={`${btn} px-3 py-2 ${tab === k ? "bg-[#142033] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l} ({inCls.filter(f).length})</button>)}
          {Object.keys(grading).length > 0 && <span className="text-xs text-sky-700 font-bold">AI đang chấm {Object.keys(grading).length} bài…</span>}
        </div>
      </div>
      {common.length > 0 && (
        <details className="rounded-[20px] bg-white border border-[#E2E8F0] p-4 shadow-sm">
          <summary className="cursor-pointer font-bold text-[#142033]">📊 Lỗi hay gặp {cls ? "của lớp" : "của các lớp"} — để chữa chung trên lớp</summary>
          <ul className="mt-2 grid gap-1 text-sm">{common.map((c, i) => <li key={i}><b className="text-rose-600">{c.n}×</b> <span className="text-xs text-slate-500">[{c.type}]</span> {c.why} — <span style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{c.ex.wrong} → <b className="text-emerald-700">{c.ex.right}</b></span></li>)}</ul>
        </details>
      )}
      {shown.length === 0 ? <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-6 text-center text-slate-500">Chưa có bài nào.</div>
        : shown.map((h) => <Item key={h.id} db={db} h={h} open={open === h.id} setOpen={setOpen} regrade={grade} grading={!!grading[h.id]} />)}
    </div>
  );
}
