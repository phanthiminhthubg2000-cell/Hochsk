"use client";
// BÀI TẬP VỀ NHÀ — học viên HSK4–5 chụp bài viết tay (tóm tắt 课文一/二/三 hoặc bài văn) gửi cô.
// AI chấm ở trang giáo viên; học viên chỉ thấy điểm & nhận xét khi cô trả bài.
import { useEffect, useMemo, useState } from "react";
import { collection, doc, setDoc, getDocs, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";
import { STATIC_LECTURES } from "../staticLectures";
import { HW_COL, HW_IMG, PARTS, partName, compressImage, rotateDataUrl, fmtTime } from "../../lib/homework";

const RED = "#9E2F22";
const card = "rounded-[10px] bg-[#FBF8F1] border border-[#D8CBAE] p-4 md:p-5";
const inp = "h-11 px-3 rounded-[8px] border border-[#D8CBAE] bg-white text-[15px] focus:outline-none focus:border-[#9E2F22] w-full";
const MAX_PAGES = 4, BUDGET = 900000; // giới hạn tài liệu Firestore ~1MB

export default function BaiTapPage() {
  const { u, userId } = useTuVi();
  const [classes, setClasses] = useState([]); const [lectures, setLectures] = useState(STATIC_LECTURES);
  const [me, setMe] = useState({ classId: "", studentId: "", name: "" });
  const [lecId, setLecId] = useState(""); const [part, setPart] = useState("kw1"); const [topic, setTopic] = useState("");
  const [ready, setReady] = useState(false); useEffect(() => setReady(true), []);
  const [pics, setPics] = useState([]); const [busy, setBusy] = useState(""); const [msg, setMsg] = useState(""); const [mine, setMine] = useState([]);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("hw_me") || "null"); if (s) setMe(s); } catch {}
    getDocs(collection(db, "classes")).then((s) => setClasses(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.className || "").localeCompare(b.className || "", "vi")))).catch(() => {});
    getDocs(collection(db, "lectures_bank")).then((s) => { const fs = s.docs.map((d) => ({ id: d.id, ...d.data() })); setLectures([...STATIC_LECTURES, ...fs.filter((x) => !STATIC_LECTURES.some((y) => y.level === x.level && y.lectureName === x.lectureName))]); }).catch(() => {});
  }, []);
  const cls = classes.find((c) => c.id === me.classId);
  const stu = cls?.students?.find((s) => s.id === me.studentId);
  const lvLecs = useMemo(() => {
    const lv = cls?.level || "";
    const list = lectures.filter((l) => (lv ? l.level === lv : /HSK\s*[45]/i.test(l.level || "")) && /bài|lesson|第/i.test(l.lectureName || ""));
    return list.sort((a, b) => (a.lectureName || "").localeCompare(b.lectureName || "", undefined, { numeric: true }));
  }, [lectures, cls]);
  const lec = lvLecs.find((l) => l.id === lecId);

  // bài đã nộp của mình
  useEffect(() => {
    if (!me.classId || !me.studentId) { setMine([]); return; }
    const q = query(collection(db, HW_COL), where("classId", "==", me.classId), where("studentId", "==", me.studentId));
    const off = onSnapshot(q, (s) => setMine(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))), () => {});
    return () => off();
  }, [me.classId, me.studentId]);

  const pickMe = (classId, studentId) => { const c = classes.find((x) => x.id === classId); const s = c?.students?.find((x) => x.id === studentId); const v = { classId, studentId: s ? studentId : "", name: s?.name || "" }; setMe(v); try { localStorage.setItem("hw_me", JSON.stringify(v)); } catch {} };
  const addFiles = async (files) => {
    setMsg(""); setBusy("Đang nén ảnh…");
    try {
      const room = MAX_PAGES - pics.length; const arr = [...files].slice(0, room);
      const per = Math.floor(BUDGET / Math.max(1, Math.min(MAX_PAGES, pics.length + arr.length)));
      const out = []; for (const f of arr) out.push(await compressImage(f, 1500, per));
      setPics((p) => [...p, ...out]);
      if (files.length > room) setMsg(`Chỉ gửi tối đa ${MAX_PAGES} trang.`);
    } catch { setMsg("Không đọc được ảnh, thử chụp lại nhé."); }
    setBusy("");
  };
  const size = pics.reduce((s, x) => s + x.length * 0.75, 0);
  const send = async () => {
    if (!cls || !stu) return setMsg("Chọn lớp và tên của bạn trước.");
    if (!lec) return setMsg("Chọn bài học.");
    if (!pics.length) return setMsg("Chụp ít nhất 1 trang bài làm.");
    if (size > BUDGET * 1.05) return setMsg("Ảnh hơi nặng — bớt 1 trang hoặc chụp gần hơn.");
    setBusy("Đang gửi bài…"); setMsg("");
    try {
      // ảnh lưu riêng (tài liệu nặng) để danh sách bài nộp tải nhanh
      const ref = doc(collection(db, HW_COL));
      await setDoc(doc(db, HW_IMG, ref.id), { images: pics, createdAt: serverTimestamp() });
      await setDoc(ref, {
        classId: cls.id, className: cls.className || "", level: cls.level || lec.level || "", studentId: stu.id, studentName: stu.name,
        userId: userId || null, userName: u?.name || u?.fullName || null,
        lectureId: lec.id, lectureName: lec.lectureName || "", lectureLevel: lec.level || "", lectureUrl: lec.fileUrl || "",
        part, topic: part === "essay" ? topic.trim().slice(0, 500) : "", pages: pics.length, status: "new", createdAt: serverTimestamp(),
      });
      setPics([]); setTopic(""); setMsg("✅ Đã gửi bài cho cô! Cô sẽ chấm và trả nhận xét ở mục bên dưới.");
    } catch (e) { setMsg("Gửi chưa được: " + (e.code === "permission-denied" ? "hệ thống chưa cho phép lưu bài tập, báo cô nhé." : e.message || e)); }
    setBusy("");
  };

  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Bài tập về nhà" />
      {ready && <main className="max-w-[860px] mx-auto px-3 md:px-6 pt-5 pb-28 md:pb-14 flex flex-col gap-4">
        <header className="flex items-end gap-3">
          <span className="font-brush text-[44px] leading-none" style={{ color: RED }} aria-hidden="true">作</span>
          <div><p className="tt-eyebrow">作业 · HSK 4 – 5</p><h1 className="font-serif-vn text-[26px] md:text-[30px] font-extrabold">Nộp bài tập về nhà</h1></div>
        </header>
        <p className="text-[14px] text-[#4A4238] -mt-2">Viết tay bài tóm tắt bài khoá (课文一、二、三) hoặc bài văn, chụp ảnh rõ nét rồi gửi cô. Cô chấm xong sẽ trả điểm và nhận xét ở cuối trang này.</p>

        <section className={card}>
          <h2 className="font-bold text-[16px] mb-3">1. Bạn là ai?</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <select className={inp} value={me.classId} onChange={(e) => pickMe(e.target.value, "")} aria-label="Lớp">
              <option value="">— Chọn lớp —</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.className}{c.level ? ` · ${c.level}` : ""}</option>)}
            </select>
            <select className={inp} value={me.studentId} onChange={(e) => pickMe(me.classId, e.target.value)} disabled={!cls} aria-label="Tên học viên">
              <option value="">— Chọn tên của bạn —</option>{(cls?.students || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </section>

        <section className={card}>
          <h2 className="font-bold text-[16px] mb-3">2. Bài tập nào?</h2>
          <select className={inp} value={lecId} onChange={(e) => setLecId(e.target.value)} aria-label="Bài học">
            <option value="">— Chọn bài học —</option>{lvLecs.map((l) => <option key={l.id} value={l.id}>{l.lectureName}{cls ? "" : ` (${l.level})`}</option>)}
          </select>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {PARTS.map(([k, zh]) => <button key={k} onClick={() => setPart(k)} className={`h-12 rounded-[8px] border text-[14px] font-bold ${part === k ? "bg-[#9E2F22] text-white border-[#9E2F22]" : "bg-white border-[#D8CBAE] hover:border-[#9E2F22]"}`}>{zh}</button>)}
          </div>
          {part === "essay" && <input className={inp + " mt-3"} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Đề bài / chủ đề cô giao (nếu có)" />}
        </section>

        <section className={card}>
          <h2 className="font-bold text-[16px] mb-1">3. Chụp bài làm</h2>
          <p className="text-[13px] text-[#6B6253] mb-3">Đặt giấy trên nền phẳng, đủ sáng, chụp thẳng từng trang (tối đa {MAX_PAGES} trang). Nếu ảnh bị ngang, bấm ⟳ để xoay.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {pics.map((p, i) => (
              <figure key={i} className="relative rounded-[8px] overflow-hidden border border-[#D8CBAE] bg-white">
                <img src={p} alt={`Trang ${i + 1}`} className="w-full h-40 object-contain" />
                <span className="absolute left-1 top-1 text-[11px] font-bold bg-[#1C1A17] text-white rounded px-1.5">Trang {i + 1}</span>
                <div className="absolute right-1 top-1 flex gap-1">
                  <button onClick={async () => { const r = await rotateDataUrl(p); setPics((x) => x.map((y, j) => (j === i ? r : y))); }} className="w-8 h-8 rounded-full bg-white/90 border text-[16px]" aria-label="Xoay ảnh">⟳</button>
                  <button onClick={() => setPics((x) => x.filter((_, j) => j !== i))} className="w-8 h-8 rounded-full bg-white/90 border text-[14px]" aria-label="Xoá ảnh">✕</button>
                </div>
              </figure>
            ))}
            {pics.length < MAX_PAGES && (
              <label className="h-40 rounded-[8px] border-2 border-dashed border-[#C9B99A] grid place-items-center text-center cursor-pointer bg-white hover:border-[#9E2F22]">
                <span><span className="block text-[30px]">📷</span><span className="text-[13px] font-bold">Chụp / chọn ảnh</span></span>
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addFiles(e.target.files || []); e.target.value = ""; }} />
              </label>
            )}
          </div>
          <button onClick={send} disabled={!!busy} className="mt-4 w-full h-12 rounded-[8px] font-bold text-white disabled:opacity-60" style={{ background: RED }}>{busy || "Gửi bài cho cô"}</button>
          {msg && <p className="text-[14px] mt-2">{msg}</p>}
        </section>

        <section className={card}>
          <h2 className="font-bold text-[16px] mb-3">Bài đã nộp {stu ? `· ${stu.name}` : ""}</h2>
          {!stu ? <p className="text-[14px] text-[#6B6253]">Chọn lớp và tên để xem bài đã nộp.</p> : mine.length === 0 ? <p className="text-[14px] text-[#6B6253]">Chưa nộp bài nào.</p> : (
            <div className="grid gap-2">
              {mine.map((h) => (
                <div key={h.id} className="rounded-[8px] bg-white border border-[#E2D6BC] p-3">
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="flex-1 min-w-0"><b className="font-zh">{partName(h.part)}</b> · {h.lectureName}<div className="text-[12px] text-[#6B6253]">Nộp {fmtTime(h.createdAt)} · {h.pages || 0} trang</div></div>
                    {h.status === "returned"
                      ? <span className="rounded-full px-3 py-1 text-[13px] font-bold bg-[#E6F2E8] text-[#2F7A3E]">{h.teacherScore != null && h.teacherScore !== "" ? `${h.teacherScore} điểm` : "Đã chấm"}</span>
                      : <span className="rounded-full px-3 py-1 text-[12px] font-bold bg-[#F3E9CF] text-[#8A6D3B]">Đang chờ cô chấm</span>}
                  </div>
                  {h.status === "returned" && (h.teacherComment || h.teacherFixes) && (
                    <div className="mt-2 rounded-[6px] bg-[#FBF8F1] border border-[#E2D6BC] p-3 text-[14px] whitespace-pre-line">
                      <div className="text-[12px] font-bold text-[#9E2F22] mb-1">Nhận xét của cô</div>{h.teacherComment}
                      {h.teacherFixes && <div className="mt-2 font-zh">{h.teacherFixes}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>}
    </div>
  );
}
