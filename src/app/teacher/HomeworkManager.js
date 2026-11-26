"use client";
// TRANG GIÁO VIÊN · BÀI TẬP VỀ NHÀ — học viên gửi ảnh bài viết tay (tóm tắt 课文 / bài văn) qua nhóm Zalo;
// cô tải ảnh lên đây theo lớp/học viên → AI đọc chữ + chấm → cô duyệt, sửa điểm/nhận xét, sao chép gửi lại Zalo.
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { HW_COL, HW_IMG, PARTS, partName, kwNums, hasEssay, isHsk5, lectureText, lectureHw, fmtTime, compressImage, rotateDataUrl } from "../../lib/homework";
import { STATIC_LECTURES } from "../staticLectures";

const btn = "rounded-xl font-bold text-sm transition-colors disabled:opacity-50";
const SC = { summary: "Tóm tắt", essay: "Bài văn", content: "Nội dung", structure: "Bố cục", vocab: "Từ vựng", grammar: "Ngữ pháp", length: "Độ dài", coverage: "Đủ ý", own: "Lời của mình" };
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
    setCmt(h.teacherComment ?? (ai?.comment || ""));
  }, [h.id, ai, h.teacherScore, h.teacherComment]);
  const fixesText = (ai?.errors || []).map((e) => `✗ ${e.wrong} → ✓ ${e.right}${e.why ? ` (${e.why})` : ""}`).join("\n");
  const ret = async () => {
    setSaving(true);
    try { await updateDoc(doc(db, HW_COL, h.id), { status: "returned", teacherScore: score === "" ? null : Number(score), teacherComment: cmt.trim(), teacherFixes: fix ? fixesText : "", returnedAt: serverTimestamp() }); setOpen(null); }
    catch (e) { alert("Chưa lưu được: " + (e.message || e)); }
    setSaving(false);
  };
  const [copied, setCopied] = useState(false); const [up2, setUp2] = useState(false);
  const zalo = () => [`📝 ${h.studentName} · ${h.lectureName} · ${partName(h.part, h.level || h.lectureLevel)}`, score !== "" && score != null ? `Điểm: ${score}/10` : "", cmt.trim(), fix && fixesText ? "Sửa lỗi:\n" + fixesText : "", up2 && ai?.upgrades?.length ? "Viết thế này tự nhiên hơn:\n" + ai.upgrades.map((x) => "→ " + x.better).join("\n") : ""].filter(Boolean).join("\n\n");
  const copy = async () => { const t = zalo(); try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); } setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const del = async () => { if (!confirm(`Xoá bài của ${h.studentName}?`)) return; await deleteDoc(doc(db, HW_COL, h.id)).catch(() => {}); await deleteDoc(doc(db, HW_IMG, h.id)).catch(() => {}); };
  const total = ai?.score?.total;
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${open ? "border-emerald-300" : "border-[#E2E8F0]"}`}>
      <button onClick={() => setOpen(open ? null : h.id)} className="w-full text-left p-3 md:p-4 flex items-center gap-3">
        <div className={`w-12 h-12 shrink-0 rounded-xl border grid place-items-center font-black ${total != null ? tone(total) : "bg-slate-50 text-slate-400 border-slate-200"}`}>{grading ? "…" : total != null ? total : h.aiError ? "!" : "–"}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[#142033] break-words">{h.studentName} <span className="font-normal text-slate-500 text-sm">· {h.className}</span></div>
          <div className="text-xs text-slate-500 break-words"><b className="text-slate-700">{partName(h.part, h.level || h.lectureLevel)}</b> · {h.lectureName} · {fmtTime(h.createdAt)} · {h.pages || "?"} trang</div>
        </div>
        <span className={`text-[11px] font-bold px-2 py-1 rounded-full shrink-0 ${h.status === "returned" ? "bg-emerald-50 text-emerald-700" : grading ? "bg-sky-50 text-sky-700" : h.aiError ? "bg-rose-50 text-rose-600" : ai ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
          {h.status === "returned" ? "Đã chữa" : grading ? "AI đang chấm" : h.aiError ? "AI lỗi" : ai ? "Chờ cô duyệt" : "Chưa chấm"}
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
              {ai.sections?.length > 0 && (
                <div className="grid gap-2">
                  {ai.sections.map((sec) => (
                    <div key={sec.n} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-baseline gap-2"><b className="text-[#142033]" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>课文{isHsk5(h.level || h.lectureLevel) && ai.sections.length === 1 ? "" : "一二三四五"[sec.n - 1] || sec.n}</b>{sec.title && <span className="text-xs text-slate-500" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{sec.title}</span>}{sec.score != null && <span className={`text-xs font-bold px-1.5 rounded border ${tone(sec.score)}`}>{sec.score}</span>}{sec.written === false && <span className="text-xs font-bold text-rose-600">Chưa làm phần này</span>}</div>
                      {sec.points?.length > 0 && <ul className="grid gap-0.5 text-sm mt-1">{sec.points.map((p, i) => <li key={i} className={p.hit ? "text-emerald-700" : "text-rose-600"}>{p.hit ? "✓" : "✗"} {p.vi}</li>)}</ul>}
                      {(sec.kw_used?.length > 0 || sec.kw_missing?.length > 0) && <div className="text-xs mt-1" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{sec.kw_used?.length > 0 && <span className="text-emerald-700">Từ mới đã dùng: {sec.kw_used.join("、")}　</span>}{sec.kw_missing?.length > 0 && <span className="text-slate-500">Chưa dùng: {sec.kw_missing.join("、")}</span>}</div>}
                      {sec.comment && <div className="text-sm text-slate-600 mt-1">{sec.comment}</div>}
                    </div>
                  ))}
                </div>
              )}
              {ai.essay && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-baseline gap-2"><b className="text-[#142033]">Bài văn 作文</b>{ai.essay.topic && <span className="text-xs text-slate-500">{ai.essay.topic}</span>}{ai.essay.score?.total != null && <span className={`text-xs font-bold px-1.5 rounded border ${tone(ai.essay.score.total)}`}>{ai.essay.score.total}</span>}{ai.essay.written === false && <span className="text-xs font-bold text-rose-600">Chưa làm phần này</span>}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">{Object.entries(ai.essay.score || {}).filter(([k]) => k !== "total").map(([k, v]) => <span key={k} className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${tone(v)}`}>{SC[k] || k}: {v}</span>)}{ai.essay.chars != null && <span className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">{ai.essay.chars} chữ</span>}</div>
                  {ai.essay.comment && <div className="text-sm text-slate-600 mt-1">{ai.essay.comment}</div>}
                </div>
              )}
              {ai.req_check?.length > 0 && <div className="text-sm"><div className="text-xs font-bold text-slate-500 mb-1">Yêu cầu bài tập</div>{ai.req_check.map((r, i) => <div key={i} className={r.ok ? "text-emerald-700" : "text-rose-600"}>{r.ok ? "✓" : "✗"} {r.req}{r.note ? ` — ${r.note}` : ""}</div>)}</div>}
              {ai.points?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">Ý chính của bài khoá{ai.source_title ? ` · ${ai.source_title}` : ""}</div>
                  <ul className="grid gap-1 text-sm">{ai.points.map((p, i) => <li key={i} className={p.hit ? "text-emerald-700" : "text-rose-600"}>{p.hit ? "✓" : "✗"} {p.vi}</li>)}</ul>
                </div>
              )}
              {ai.source_found === false && kwNums(h.part).length > 0 && <div className="text-xs text-amber-700">AI không tìm thấy văn bản bài khoá trong bài giảng — chỉ chấm ngôn ngữ, chưa so ý chính.</div>}
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
            <div className="text-sm font-bold text-[#142033]">Chữa bài gửi học viên <span className="font-normal text-xs text-slate-500">— sửa lại rồi bấm “Sao chép” để dán vào Zalo</span></div>
            <div className="flex items-center gap-2 text-sm"><span>Điểm (thang 10)</span><input type="number" min="0" max="10" step="0.5" value={score} onChange={(e) => setScore(e.target.value)} className="w-24 h-9 px-2 rounded-lg border border-slate-300" /></div>
            <textarea rows={4} value={cmt} onChange={(e) => setCmt(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Nhận xét gửi học viên…" />
            {fixesText && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)} /> Kèm danh sách lỗi đã sửa ({ai.errors.length} lỗi)</label>}
            {ai?.upgrades?.length > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={up2} onChange={(e) => setUp2(e.target.checked)} /> Kèm câu viết tự nhiên hơn</label>}
            <div className="flex flex-wrap gap-2">
              <button onClick={copy} className={`${btn} px-4 py-2 bg-[#0068FF] hover:bg-[#0052CC] text-white`}>{copied ? "✓ Đã sao chép" : "📋 Sao chép gửi Zalo"}</button>
              <button onClick={ret} disabled={saving} className={`${btn} px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white`}>{h.status === "returned" ? "Lưu lại" : "✓ Đánh dấu đã chữa"}</button>
              <button onClick={() => regrade(h)} disabled={grading} className={`${btn} px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100`}>{grading ? "AI đang chấm…" : "↻ Chấm lại bằng AI"}</button>
              <button onClick={del} className={`${btn} px-4 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 ml-auto`}>Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Cô tải bài học viên gửi qua Zalo: chọn lớp – bài – dạng bài một lần, rồi thêm ảnh cho từng học viên
function Uploader({ db, onDone }) {
  const [classes, setClasses] = useState([]); const [lectures, setLectures] = useState(STATIC_LECTURES);
  const [clsId, setClsId] = useState(""); const [lecId, setLecId] = useState(""); const [topic, setTopic] = useState("");
  // kws: các bài khoá cần tóm tắt (HSK4: 3 bài, HSK5: 1 bài); essay: có viết bài văn — hai phần có thể nộp cùng
  const [kws, setKws] = useState([1, 2, 3]); const [essay, setEssay] = useState(false);
  const part = [kws.length ? "kw" + [...kws].sort().join("") : "", essay ? "essay" : ""].filter(Boolean).join("+") || "kw1";
  const mode = kws.length ? "kw" : "essay";
  const [hw, setHw] = useState([]); const [taskIx, setTaskIx] = useState(0);
  const [pics, setPics] = useState({}); const [active, setActive] = useState(""); const [extra, setExtra] = useState(""); const [busy, setBusy] = useState(""); const [msg, setMsg] = useState("");
  useEffect(() => {
    getDocs(collection(db, "classes")).then((s) => setClasses(s.docs.map((d) => ({ id: d.id, ...d.data() })))).catch(() => {});
    getDocs(collection(db, "lectures_bank")).then((s) => { const fs = s.docs.map((d) => ({ id: d.id, ...d.data() })); setLectures([...STATIC_LECTURES, ...fs.filter((x) => !STATIC_LECTURES.some((y) => y.level === x.level && y.lectureName === x.lectureName))]); }).catch(() => {});
  }, [db]);
  const cls = classes.find((c) => c.id === clsId);
  const lecs = lectures.filter((l) => (cls?.level ? l.level === cls.level : /HSK\s*[45]/i.test(l.level || ""))).sort((a, b) => (a.lectureName || "").localeCompare(b.lectureName || "", undefined, { numeric: true }));
  const lec = lecs.find((l) => l.id === lecId);
  const h5 = isHsk5(cls?.level || lec?.level);
  useEffect(() => { if (h5) { setKws([1]); setEssay(true); } else { setKws([1, 2, 3]); setEssay(false); } }, [h5]); // HSK5: 1 bài khoá + bài văn
  const KW = h5 ? [["kw1", "课文"]] : PARTS;
  // bài tập về nhà ghi trong slide (HSK4) → hiện cho cô xem & gửi kèm yêu cầu cho AI
  useEffect(() => { setHw([]); setTaskIx(0); if (lec) lectureHw(lec).then((h) => setHw(h.flatMap((b) => (b.tasks || []).filter((t) => /viết/i.test(t.kind || "")).map((t) => ({ ...t, range: b.range, s: b.s }))))); }, [lec]);
  const task = hw[taskIx];
  useEffect(() => { if (!task) return; const ns = [...(task.range || "").matchAll(/课文([一二三四五])/g)].map((m) => "一二三四五".indexOf(m[1]) + 1); if (/tóm tắt/i.test(task.t || "")) { if (!h5 && ns.length >= 2 && /～|~|-/.test(task.range)) { const r = []; for (let i = ns[0]; i <= ns[ns.length - 1]; i++) r.push(i); setKws(r.filter((x) => x <= 3)); } } else if (!h5) { setKws([]); setEssay(true); } }, [task]); // eslint-disable-line
  const students = [...(cls?.students || []), ...(pics["x:" + extra] && extra ? [{ id: "x:" + extra, name: extra }] : [])];
  const add = async (sid, files) => {
    setBusy("Đang nén ảnh…"); setActive(sid);
    try { const out = []; for (const f of [...files].slice(0, 6)) out.push(await compressImage(f, 1500, 150000)); setPics((p) => ({ ...p, [sid]: [...(p[sid] || []), ...out].slice(0, 6) })); } catch { setMsg("Không đọc được ảnh."); }
    setBusy("");
  };
  // dán ảnh (Ctrl+V) từ Zalo PC vào học viên đang chọn
  useEffect(() => {
    const h = (e) => { if (!active) return; const fs = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/")); if (fs.length) { e.preventDefault(); add(active, fs); } };
    window.addEventListener("paste", h); return () => window.removeEventListener("paste", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const ready = Object.entries(pics).filter(([, v]) => v.length);
  const save = async () => {
    if (!cls || !lec) return setMsg("Chọn lớp và bài học trước.");
    if (!ready.length) return setMsg("Chưa có ảnh bài làm nào.");
    setBusy("Đang lưu…"); setMsg("");
    try {
      for (const [sid, imgs] of ready) {
        const st = students.find((x) => x.id === sid) || { id: sid, name: sid.replace(/^x:/, "") };
        const ref = doc(collection(db, HW_COL));
        await setDoc(doc(db, HW_IMG, ref.id), { images: imgs, createdAt: serverTimestamp() });
        await setDoc(ref, { classId: cls.id, className: cls.className || "", level: cls.level || lec.level || "", studentId: st.id, studentName: st.name, lectureId: lec.id, lectureName: lec.lectureName || "", lectureLevel: lec.level || "", lectureUrl: lec.fileUrl || "", part, topic: essay ? topic.trim() : "", task: task ? { t: task.t, req: task.req || [], kw: (task.kw || []).filter(([k]) => essay || h5 || kwNums(part).some((n) => k.includes("一二三四五"[n - 1]))).map(([k, v]) => ({ k, v })) } : null, pages: imgs.length, status: "new", source: "teacher", createdAt: serverTimestamp() });
      }
      setMsg(`✅ Đã lưu ${ready.length} bài — AI đang chấm ở danh sách bên dưới.`); setPics({}); setActive(""); onDone?.();
    } catch (e) { setMsg("Chưa lưu được: " + (e.code === "permission-denied" ? "Firestore chưa cho phép ghi vào homework_submissions / homework_images." : e.message || e)); }
    setBusy("");
  };
  const sel = "h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white w-full";
  return (
    <div className="rounded-[24px] bg-white border border-emerald-200 p-5 md:p-6 shadow-sm grid gap-3">
      <h3 className="text-lg font-black text-[#142033]">＋ Tải bài học viên gửi qua Zalo</h3>
      <div className="grid sm:grid-cols-2 gap-2">
        <select className={sel} value={clsId} onChange={(e) => { setClsId(e.target.value); setLecId(""); setPics({}); }}><option value="">— Chọn lớp —</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.className}{c.level ? ` · ${c.level}` : ""}</option>)}</select>
        <select className={sel} value={lecId} onChange={(e) => setLecId(e.target.value)} disabled={!cls}><option value="">— Chọn bài học —</option>{lecs.map((l) => <option key={l.id} value={l.id}>{l.lectureName}</option>)}</select>
      </div>
      {hw.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
          <div className="font-bold text-amber-800 mb-1">📌 Bài tập về nhà trong slide bài này — AI chấm theo đúng yêu cầu</div>
          {hw.length > 1 && <div className="flex flex-wrap gap-1.5 mb-1.5">{hw.map((t, i) => <button key={i} onClick={() => setTaskIx(i)} className={`${btn} px-2.5 py-1 text-xs ${i === taskIx ? "bg-amber-600 text-white" : "bg-white border border-amber-200 text-amber-800"}`}>{t.s} · {t.t}</button>)}</div>}
          <div><b>{task.t}</b> <span className="text-xs text-slate-500">({task.range})</span></div>
          <ul className="list-disc ml-5 text-slate-700">{(task.req || []).map((r) => <li key={r}>{r}</li>)}</ul>
          {task.kw?.length > 0 && <div className="mt-1 grid gap-0.5">{task.kw.map(([k, v]) => <div key={k} style={{ fontFamily: '"Noto Sans SC",sans-serif' }}><b>{k}</b>：{v}</div>)}</div>}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-bold text-slate-600">Tóm tắt:</span>
        {KW.map(([k, l]) => { const n = +k.slice(2), on = kws.includes(n); return <button key={k} onClick={() => setKws((x) => (x.includes(n) ? (x.length > 1 || essay ? x.filter((y) => y !== n) : x) : [...x, n]))} className={`${btn} px-3 py-2 ${on ? "bg-[#142033] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{on ? "✓ " : ""}{l}</button>; })}
        {!h5 && <button onClick={() => setKws([1, 2, 3])} className={`${btn} px-3 py-2 text-xs underline text-slate-500`}>chọn cả 3</button>}
        <span className="text-slate-300">+</span>
        <button onClick={() => setEssay((e) => (e && !kws.length ? e : !e))} className={`${btn} px-3 py-2 ${essay ? "bg-[#142033] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{essay ? "✓ " : ""}Viết bài văn 作文</button>
      </div>
      <p className="text-xs text-slate-500 -mt-1">Đang chấm: <b>{partName(part, cls?.level || lec?.level)}</b>{kws.length && essay ? " — hai phần nằm trên cùng các ảnh, AI tự tách." : ""}</p>
      {essay && <input className={sel} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Đề bài / chủ đề bài văn đã giao" />}
      {cls && (
        <>
          <p className="text-xs text-slate-500">Bấm <b>📷 Thêm ảnh</b> ở dòng học viên để chọn ảnh (tối đa 6 trang/bạn). Trên máy tính: bấm vào tên học viên rồi <b>Ctrl+V</b> để dán ảnh vừa sao chép từ Zalo.</p>
          <div className="grid gap-1.5">
            {students.map((st) => { const ps = pics[st.id] || []; return (
              <div key={st.id} onClick={() => setActive(st.id)} className={`rounded-xl border p-2 flex flex-wrap items-center gap-2 cursor-pointer ${active === st.id ? "border-emerald-400 bg-emerald-50/40" : "border-slate-200"}`}>
                <span className="font-bold text-sm text-[#142033] min-w-[140px] flex-1 break-words">{st.name}{active === st.id && <span className="ml-1 text-[10px] text-emerald-600 font-bold">● dán ảnh vào đây</span>}</span>
                <div className="flex gap-1.5 flex-wrap">{ps.map((src, i) => (
                  <span key={i} className="relative"><img src={src} alt="" className="h-14 w-11 object-cover rounded border border-slate-200" />
                    <button onClick={async (e) => { e.stopPropagation(); const r = await rotateDataUrl(src); setPics((p) => ({ ...p, [st.id]: p[st.id].map((y, j) => (j === i ? r : y)) })); }} className="absolute -left-1 -top-1 w-5 h-5 rounded-full bg-white border text-[10px]" aria-label="Xoay">⟳</button>
                    <button onClick={(e) => { e.stopPropagation(); setPics((p) => ({ ...p, [st.id]: p[st.id].filter((_, j) => j !== i) })); }} className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-white border text-[10px]" aria-label="Xoá">✕</button></span>
                ))}</div>
                <label className={`${btn} px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer text-xs`} onClick={(e) => e.stopPropagation()}>📷 Thêm ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(st.id, e.target.files || []); e.target.value = ""; }} /></label>
              </div>
            ); })}
            <div className="flex gap-2 items-center"><input className={sel + " flex-1"} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Học viên ngoài danh sách (gõ tên)…" />
              {extra.trim() && <label className={`${btn} px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs cursor-pointer shrink-0`}>📷 Thêm ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add("x:" + extra.trim(), e.target.files || []); e.target.value = ""; }} /></label>}</div>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={!!busy || !ready.length} className={`${btn} px-5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white`}>{busy || `Lưu & chấm AI${ready.length ? ` (${ready.length} bài)` : ""}`}</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}

export default function HomeworkManager({ db }) {
  const [list, setList] = useState([]); const [cls, setCls] = useState(""); const [tab, setTab] = useState("todo"); const [open, setOpen] = useState(null);
  const [grading, setGrading] = useState({}); const tried = useRef(new Set()); const lecCache = useRef({}); const [up, setUp] = useState(false);
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
      const r = await fetch("/api/homework", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images, part: h.part, level: h.level || h.lectureLevel, prompt: h.topic, task: h.task || null, lectureText: text }) });
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
  const TABS = [["todo", "Chưa chữa xong", (h) => h.status !== "returned"], ["done", "Đã chữa", (h) => h.status === "returned"], ["all", "Tất cả", () => true]];
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
        <p className="text-sm text-slate-500 mt-1">Tải ảnh bài viết tay học viên gửi qua Zalo (tóm tắt 课文一/二/三 hoặc bài văn). AI đọc chữ và chấm ngay; cô duyệt, sửa điểm – nhận xét rồi bấm <b>📋 Sao chép gửi Zalo</b>.</p>
        <button onClick={() => setUp(!up)} className={`${btn} mt-3 px-4 py-2.5 ${up ? "bg-slate-100 text-slate-700" : "bg-[#10B981] hover:bg-[#059669] text-white"}`}>{up ? "Ẩn khung tải bài" : "＋ Tải bài lên"}</button>
        <div className="flex flex-wrap gap-2 mt-4 items-center">
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 text-sm"><option value="">Tất cả lớp</option>{classes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          {TABS.map(([k, l, f]) => <button key={k} onClick={() => setTab(k)} className={`${btn} px-3 py-2 ${tab === k ? "bg-[#142033] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l} ({inCls.filter(f).length})</button>)}
          {Object.keys(grading).length > 0 && <span className="text-xs text-sky-700 font-bold">AI đang chấm {Object.keys(grading).length} bài…</span>}
        </div>
      </div>
      {up && <Uploader db={db} onDone={() => setTab("todo")} />}
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
