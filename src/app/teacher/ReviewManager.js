"use client";
// ============================================================
// KIỂM TRA BÀI CŨ — quản lý lớp, kho bài, chấm trực tiếp, báo cáo
// Kết quả mỗi lần kiểm tra lưu thành 1 bản ghi riêng trong "review_results"
// (không ghi đè lẫn nhau, không làm phình bản ghi lớp). Lịch sử cũ nằm trong
// classes/{id}.students[].history vẫn được đọc và hiển thị như trước.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc,
  serverTimestamp, writeBatch,
} from "firebase/firestore";

const PENALTY_TIMES = 10;

const uid = () => `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const norm = (s) => (s || "").normalize("NFC").trim().replace(/\s+/g, " ");
const today = () => new Date().toLocaleDateString("vi-VN");
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// "28/10/2026" → timestamp
function parseViDate(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || "");
  return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0;
}

// Câu hỏi trong kho: chuỗi (bài cũ) hoặc items {z,py,vn,ans,why}
function testItems(t) {
  if (Array.isArray(t.items) && t.items.length) return t.items.map((it) => ({ z: it.z, py: it.py || "", vn: it.vn || "", ans: it.ans || "", why: it.why || "" }));
  return (t.questions || []).map((q) => {
    const p = String(q).split("|").map((x) => x.trim());
    return { z: p[0], py: p[1] || "", vn: p[2] || "", ans: "", why: "" };
  });
}

// Nội dung ô soạn bài ⇄ items
function itemsToText(items, kind) {
  return items.map((it) => kind === "error"
    ? [it.z, it.ans, it.why].filter((x, i) => i === 0 || x).join(" | ")
    : [it.z, it.py, it.vn].filter((x, i) => i === 0 || x).join(" | ")).join("\n");
}
function textToItems(text, kind) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const p = l.split("|").map((x) => x.trim());
    return kind === "error"
      ? { z: p[0], py: "", vn: p[1] ? `Sửa: ${p[1]}${p[2] ? " — " + p[2] : ""}` : "", ans: p[1] || "", why: p[2] || "" }
      : { z: p[0], py: p[1] || "", vn: p[2] || "" };
  });
}

function speak(text) {
  try {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN"; u.rate = 0.85;
    const v = window.speechSynthesis.getVoices().find((x) => /zh[-_]CN/i.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) { /* bỏ qua */ }
}

const btn = "rounded-xl font-bold text-xs transition disabled:opacity-50";
const card = "bg-white rounded-[32px] border border-[#E2E8F0] p-6 md:p-8 shadow-sm";
const overlay = "fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm";
const labelCls = "block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1";
const inputCls = "w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]";

export default function ReviewManager({ db, levels }) {
  const [classes, setClasses] = useState([]);
  const [tests, setTests] = useState([]);
  const [newResults, setNewResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [importing, setImporting] = useState(false);

  // modal states
  const [classForm, setClassForm] = useState(null);     // {id?, className, level, rows:[{id,name,history}], addText}
  const [testForm, setTestForm] = useState(null);       // {id?, testName, level, kind, text}
  const [setup, setSetup] = useState(null);             // {cls, st, level, testId, n, dir, sec, prioritize}
  const [session, setSession] = useState(null);         // live test
  const [reportFor, setReportFor] = useState(null);     // {cls, testName}
  const [profileFor, setProfileFor] = useState(null);   // {cls, st}

  // ---------------- tải dữ liệu ----------------
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([getDocs(collection(db, "classes")), getDocs(collection(db, "tests_bank"))]);
      const cl = []; c.forEach((d) => cl.push({ id: d.id, ...d.data() }));
      cl.sort((a, b) => (a.className || "").localeCompare(b.className || "", "vi", { numeric: true }));
      const tl = []; t.forEach((d) => tl.push({ id: d.id, ...d.data() }));
      const rank = (n) => (/Từ vựng cả bài$/.test(n) ? 0 : /Từ vựng/.test(n) ? 1 : /Lỗi câu$/.test(n) ? 2 : 0);
      const base = (n) => n.replace(/ · (Từ vựng.*|Lỗi câu)$/, "");
      tl.sort((a, b) => base(a.testName || "").localeCompare(base(b.testName || ""), undefined, { numeric: true, sensitivity: "base" }) || rank(a.testName || "") - rank(b.testName || ""));
      setClasses(cl); setTests(tl);
    } catch (e) { setNotice("Lỗi tải lớp/kho bài: " + e.message); }
    try {
      const r = await getDocs(collection(db, "review_results"));
      const rl = []; r.forEach((d) => rl.push({ id: d.id, ...d.data() }));
      setNewResults(rl);
    } catch (e) { setNewResults([]); }
    setLoading(false);
  }, [db]);
  useEffect(() => { loadAll(); }, [loadAll]);

  // Gộp kết quả mới + lịch sử cũ thành 1 danh sách thống nhất
  const results = useMemo(() => {
    const out = newResults.map((r) => ({ ...r, ts: r.ts || parseViDate(r.date), source: "new" }));
    classes.forEach((cls) => (cls.students || []).forEach((st) => (st.history || []).forEach((h, i) => {
      out.push({
        id: `legacy_${cls.id}_${st.id}_${i}`, source: "legacy", classId: cls.id, studentId: st.id, studentName: st.name,
        testId: "", testName: h.testName, level: h.level, kind: "vocab", date: h.date, ts: parseViDate(h.date) + i,
        correct: h.correct, total: h.total, score: h.score,
        logs: (h.logs || []).map((l) => ({ z: typeof l.question === "string" ? l.question : l.question?.z, py: "", vn: "", ok: !!l.correct })),
        penaltyDone: !!h.penaltyDone,
      });
    })));
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [newResults, classes]);

  const resultsOf = useCallback((classId, studentId) => results.filter((r) => r.classId === classId && r.studentId === studentId), [results]);
  const testsByLevel = useMemo(() => {
    const m = {}; tests.forEach((t) => { (m[t.level] = m[t.level] || []).push(t); }); return m;
  }, [tests]);

  // ---------------- lớp học ----------------
  const openNewClass = () => setClassForm({ className: "", level: levels[0], rows: [], addText: "" });
  const openEditClass = (cls) => setClassForm({
    id: cls.id, className: cls.className, level: cls.level,
    rows: (cls.students || []).map((s) => ({ ...s })), addText: "",
  });
  const saveClass = async (e) => {
    e.preventDefault();
    const f = classForm;
    if (!norm(f.className)) return alert("Vui lòng nhập tên lớp.");
    const added = f.addText.split("\n").map(norm).filter(Boolean);
    const rows = f.rows.map((r) => ({ ...r, name: norm(r.name) })).filter((r) => r.name);
    const names = [...rows.map((r) => r.name), ...added];
    const dup = names.filter((n, i) => names.findIndex((x) => x.toLowerCase() === n.toLowerCase()) !== i);
    if (dup.length && !window.confirm(`Có tên bị trùng: ${[...new Set(dup)].join(", ")}.\nVẫn lưu (mỗi bạn vẫn có hồ sơ riêng)?`)) return;
    const students = [...rows, ...added.map((name) => ({ id: uid(), name, history: [] }))];
    if (!students.length) return alert("Lớp cần ít nhất 1 học sinh.");
    try {
      if (f.id) {
        await updateDoc(doc(db, "classes", f.id), { className: norm(f.className), level: f.level, students });
      } else {
        await addDoc(collection(db, "classes"), { className: norm(f.className), level: f.level, students, createdAt: serverTimestamp() });
      }
      setClassForm(null); await loadAll(); setNotice("✅ Đã lưu lớp " + norm(f.className));
    } catch (err) { alert("Lỗi lưu lớp: " + err.message); }
  };
  const removeRow = (i) => {
    const r = classForm.rows[i];
    const n = r.id ? results.filter((x) => x.classId === classForm.id && x.studentId === r.id).length : 0;
    if (n && !window.confirm(`${r.name} đã có ${n} lần kiểm tra. Xoá khỏi lớp thì hồ sơ sẽ không còn hiện trong lớp này. Tiếp tục?`)) return;
    setClassForm({ ...classForm, rows: classForm.rows.filter((_, k) => k !== i) });
  };
  const deleteClass = async (cls) => {
    if (!window.confirm(`Xoá lớp "${cls.className}"? Lịch sử kiểm tra của lớp sẽ không còn hiển thị.`)) return;
    try { await deleteDoc(doc(db, "classes", cls.id)); await loadAll(); } catch (err) { alert("Lỗi xoá lớp: " + err.message); }
  };

  // ---------------- kho bài ----------------
  const importBank = async () => {
    if (!window.confirm("Nhập toàn bộ bài kiểm tra tạo từ bài giảng (từ vựng + lỗi câu) vào kho?\nBài đã nhập trước sẽ được cập nhật, bài cô tự tạo giữ nguyên.")) return;
    setImporting(true);
    try {
      const res = await fetch("/data/review_bank.json?v=" + Date.now());
      if (!res.ok) throw new Error("Không tải được dữ liệu nguồn (" + res.status + ")");
      const data = await res.json();
      const list = data.tests || [];
      for (let i = 0; i < list.length; i += 400) {
        const b = writeBatch(db);
        list.slice(i, i + 400).forEach((t) => b.set(doc(db, "tests_bank", t.key), {
          testName: t.testName, level: t.level, kind: t.kind || "vocab", questions: t.questions,
          items: t.items || [], lectureId: t.lectureId || "", source: "lecture_auto",
          bankVersion: data.version || 1, updatedAt: serverTimestamp(),
        }, { merge: true }));
        await b.commit();
      }
      await loadAll(); setNotice(`✅ Đã nhập ${list.length} bài kiểm tra vào kho.`);
    } catch (err) { alert("Lỗi khi nhập kho: " + err.message); }
    setImporting(false);
  };
  const openNewTest = () => setTestForm({ testName: "", level: levels[0], kind: "vocab", text: "" });
  const openEditTest = (t) => setTestForm({ id: t.id, testName: t.testName, level: t.level, kind: t.kind || "vocab", text: itemsToText(testItems(t), t.kind || "vocab"), auto: t.source === "lecture_auto" });
  const saveTest = async (e) => {
    e.preventDefault();
    const f = testForm;
    const items = textToItems(f.text, f.kind);
    if (!norm(f.testName) || !items.length) return alert("Vui lòng nhập tên bài và ít nhất 1 câu.");
    const data = { testName: norm(f.testName), level: f.level, kind: f.kind, questions: items.map((i) => i.z), items };
    try {
      if (f.id) await updateDoc(doc(db, "tests_bank", f.id), data);
      else await addDoc(collection(db, "tests_bank"), { ...data, createdAt: serverTimestamp() });
      setTestForm(null); await loadAll();
    } catch (err) { alert("Lỗi lưu bài: " + err.message); }
  };
  const deleteTest = async (t) => {
    if (!window.confirm(`Xoá bài "${t.testName}" khỏi kho?`)) return;
    try { await deleteDoc(doc(db, "tests_bank", t.id)); await loadAll(); } catch (err) { alert("Lỗi xoá bài: " + err.message); }
  };

  // ---------------- bắt đầu kiểm tra ----------------
  const openSetup = (cls, st, preset) => {
    const lvl = preset?.level || (testsByLevel[cls.level] ? cls.level : levels.find((l) => testsByLevel[l]) || cls.level);
    setSetup({ cls, st, level: lvl, testId: preset?.testId || "", n: preset?.n ?? 8, dir: preset?.dir || "zh", sec: preset?.sec ?? 0, prioritize: preset?.prioritize ?? true });
  };
  const startSession = (cfg, onlyItems) => {
    const t = tests.find((x) => x.id === cfg.testId);
    if (!t) return alert("Vui lòng chọn bài kiểm tra.");
    let pool = onlyItems || testItems(t);
    if (!pool.length) return alert("Bài này chưa có câu hỏi.");
    const kind = t.kind || "vocab";
    let picked;
    if (onlyItems) picked = shuffle(pool);
    else {
      // ưu tiên từ bạn này từng sai (cùng cấp độ), rồi từ chưa hỏi gần đây
      const past = resultsOf(cfg.cls.id, cfg.st.id).filter((r) => r.level === t.level);
      const wrongSet = new Set(); const askedSet = new Set();
      past.forEach((r) => (r.logs || []).forEach((l) => { askedSet.add(l.z); if (!l.ok) wrongSet.add(l.z); }));
      const sh = shuffle(pool);
      const score = (it) => (cfg.prioritize && wrongSet.has(it.z) ? 0 : askedSet.has(it.z) ? 2 : 1);
      picked = cfg.prioritize ? [...sh].sort((a, b) => score(a) - score(b)) : sh;
      const n = cfg.n === 0 ? pool.length : Math.min(cfg.n, pool.length);
      picked = shuffle(picked.slice(0, n));
    }
    setSetup(null);
    setSession({
      cfg, test: t, kind, items: picked, idx: 0, log: [], shown: false, paused: false, retry: !!onlyItems, saveStarted: false,
      left: cfg.sec, done: false, saving: false, saved: false, saveError: "",
    });
  };

  // ---------------- lưu kết quả ----------------
  const saveResult = async (s, log) => {
    const correct = log.filter((l) => l.ok).length;
    const rec = {
      classId: s.cfg.cls.id, className: s.cfg.cls.className, studentId: s.cfg.st.id, studentName: s.cfg.st.name,
      testId: s.test.id, testName: s.test.testName, level: s.test.level, kind: s.kind,
      date: today(), ts: Date.now(), createdAt: serverTimestamp(),
      correct, total: log.length, score: log.length ? Math.round((correct / log.length) * 100) : 0,
      logs: log.map((l) => ({ z: l.z, py: l.py || "", vn: l.vn || "", ok: l.ok })),
      mode: { n: s.cfg.n, dir: s.cfg.dir, sec: s.cfg.sec }, retry: !!s.retry, penaltyDone: false,
    };
    setSession((cur) => cur && { ...cur, saving: true, saveError: "" });
    try {
      const ref = await addDoc(collection(db, "review_results"), rec);
      setNewResults((cur) => [{ id: ref.id, ...rec }, ...cur]);
      setSession((cur) => cur && { ...cur, saving: false, saved: true });
    } catch (err) {
      // Dự phòng: ghi vào hồ sơ cũ trong bản ghi lớp (cách lưu trước đây)
      try {
        const cref = doc(db, "classes", s.cfg.cls.id);
        const snap = await getDoc(cref);
        const studs = (snap.data()?.students || []).map((st) => st.id === s.cfg.st.id ? {
          ...st, history: [...(st.history || []), {
            testName: rec.testName, level: rec.level, date: rec.date, correct: rec.correct, total: rec.total, score: rec.score,
            logs: log.map((l) => ({ question: l.z, correct: l.ok })),
          }],
        } : st);
        await updateDoc(cref, { students: studs });
        await loadAll();
        setSession((cur) => cur && { ...cur, saving: false, saved: true });
      } catch (err2) {
        setSession((cur) => cur && { ...cur, saving: false, saveError: err2.message || err.message });
      }
    }
  };

  // ---------------- điều khiển phiên kiểm tra ----------------
  const mark = useCallback((ok) => {
    setSession((s) => {
      if (!s || s.done) return s;
      const it = s.items[s.idx];
      const log = [...s.log, { ...it, ok }];
      const next = s.idx + 1;
      if (next >= s.items.length) return { ...s, log, done: true, shown: true };
      return { ...s, log, idx: next, shown: false, left: s.cfg.sec };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const undo = () => setSession((s) => (!s || s.done || !s.log.length ? s : { ...s, log: s.log.slice(0, -1), idx: s.idx - 1, shown: true, left: s.cfg.sec }));
  const reveal = () => setSession((s) => {
    if (!s || s.done) return s;
    const it = s.items[s.idx];
    if (s.kind === "vocab") speak(it.z);
    return { ...s, shown: true };
  });
  const exitSession = () => {
    const s = session;
    if (!s) return;
    if (s.done || !s.log.length) { setSession(null); return; }
    const save = window.confirm(`Đã hỏi ${s.log.length}/${s.items.length} câu.\nOK = lưu kết quả các câu đã hỏi · Cancel = bỏ, không lưu.`);
    if (save) setSession({ ...s, done: true, items: s.items.slice(0, s.log.length) });
    else setSession(null);
  };

  // lưu ngay khi phiên kết thúc (một lần)
  useEffect(() => {
    if (session && session.done && !session.saveStarted) {
      setSession((s) => s && { ...s, saveStarted: true });
      saveResult(session, session.log);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // đồng hồ theo từng câu
  useEffect(() => {
    if (!session || session.done || session.paused || !session.cfg.sec || session.shown) return;
    if (session.left <= 0) { mark(false); return; }
    const t = setTimeout(() => setSession((s) => s && { ...s, left: s.left - 1 }), 1000);
    return () => clearTimeout(t);
  }, [session, mark]);

  // tự đọc câu hỏi ở chế độ nghe
  const lastSpoken = useRef("");
  useEffect(() => {
    if (!session || session.done || session.cfg.dir !== "listen" || session.kind !== "vocab") return;
    const key = session.test.id + ":" + session.idx;
    if (lastSpoken.current === key) return;
    lastSpoken.current = key; speak(session.items[session.idx].z);
  }, [session]);

  // phím tắt
  useEffect(() => {
    if (!session || session.done) return;
    const h = (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select")) return;
      if (e.key === " ") { e.preventDefault(); reveal(); }
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); mark(true); }
      else if (e.key === "ArrowLeft" || e.key === "Backspace") { e.preventDefault(); mark(false); }
      else if (e.key.toLowerCase() === "z") undo();
      else if (e.key.toLowerCase() === "p") setSession((s) => s && { ...s, paused: !s.paused });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const nextStudent = () => {
    const s = session; const cls = s.cfg.cls;
    const doneToday = new Set(results.filter((r) => r.classId === cls.id && r.testName === s.test.testName && r.date === today()).map((r) => r.studentId));
    doneToday.add(s.cfg.st.id);
    const left = (cls.students || []).filter((st) => !doneToday.has(st.id));
    if (!left.length) { alert("Cả lớp đã kiểm tra bài này hôm nay."); return; }
    const st = left[Math.floor(Math.random() * left.length)];
    startSession({ ...s.cfg, st });
  };

  const setPenalty = async (r, val) => {
    if (r.source !== "new") return;
    try {
      await updateDoc(doc(db, "review_results", r.id), { penaltyDone: val });
      setNewResults((cur) => cur.map((x) => (x.id === r.id ? { ...x, penaltyDone: val } : x)));
    } catch (err) { alert("Không cập nhật được: " + err.message); }
  };

  // ---------------- giao diện ----------------
  return (
    <div className="space-y-10 animate-fade-in">
      {notice && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-sm font-bold rounded-2xl px-5 py-3 flex justify-between">
          <span>{notice}</span><button onClick={() => setNotice("")}>✕</button>
        </div>
      )}

      {/* 1. LỚP HỌC */}
      <div className={card}>
        <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-black text-[#142033]">1. Danh Sách Lớp Học</h3>
            <p className="text-xs font-medium text-[#64748B] mt-1">Bấm ▶ để kiểm tra từng bạn · 📜 xem hồ sơ · 📊 báo cáo cả lớp theo bài.</p>
          </div>
          <button onClick={openNewClass} className={`${btn} px-5 py-2.5 bg-[#10B981] text-white font-black shadow-md hover:bg-[#059669]`}>+ Thêm lớp</button>
        </div>
        {loading ? <p className="text-slate-400 text-xs py-6">Đang tải…</p> : classes.length === 0 ? (
          <p className="text-slate-400 text-xs py-6">Chưa có lớp học nào được tạo.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {classes.map((cls) => {
              const cr = results.filter((r) => r.classId === cls.id);
              const testNames = [...new Set(cr.map((r) => r.testName))];
              const pending = cr.filter((r) => r.source === "new" && r.logs?.some((l) => !l.ok) && !r.penaltyDone).length;
              return (
                <div key={cls.id} className="p-5 rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC] flex flex-col">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h4 className="font-black text-base text-[#142033]">{cls.className}</h4>
                    <span className="shrink-0 bg-[#ECFDF5] text-[#10B981] text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-[#A7F3D0]">{cls.level}</span>
                  </div>
                  <p className="text-xs text-[#64748B] font-medium mb-3">
                    Sĩ số: <strong className="text-[#142033]">{cls.students?.length || 0}</strong>
                    {pending > 0 && <span className="ml-2 text-rose-600 font-bold">· {pending} lượt chưa nộp chép phạt</span>}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button onClick={() => openEditClass(cls)} className={`${btn} px-3 py-1.5 bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50`}>✏️ Sửa lớp</button>
                    <button onClick={() => deleteClass(cls)} className={`${btn} px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100`}>🗑️ Xoá</button>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-3">
                    {(cls.students || []).map((st) => {
                      const sr = resultsOf(cls.id, st.id);
                      const last = sr[0];
                      return (
                        <div key={st.id} className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex justify-between items-center gap-2 shadow-sm">
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-[#142033] truncate">{st.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {last ? `${last.date} · ${last.score}% · ${last.testName}` : "Chưa kiểm tra"}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => setProfileFor({ cls, st })} className={`${btn} px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200`} title="Hồ sơ">📜</button>
                            <button onClick={() => openSetup(cls, st)} className={`${btn} px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white`}>▶ Test</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-3 border-t border-slate-200 mt-auto">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Báo cáo lớp theo bài</p>
                    {testNames.length === 0 ? <p className="text-[10px] text-slate-400 italic">Chưa có bài nào được kiểm tra.</p> : (
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {testNames.map((tn) => (
                          <button key={tn} onClick={() => setReportFor({ cls, testName: tn })} className={`${btn} px-2.5 py-1 bg-white hover:bg-[#10B981] hover:text-white border border-[#E2E8F0] text-[#142033] text-[10px]`}>📊 {tn}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. KHO BÀI */}
      <div className={card}>
        <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-black text-[#142033]">2. Kho Bài Kiểm Tra (Theo Cấp Độ)</h3>
            <p className="text-xs font-medium text-[#64748B] mt-1">Từ vựng kèm pinyin & nghĩa · bài lỗi câu kèm đáp án. Bài nhập từ bài giảng có nhãn “Tự động”.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={importBank} disabled={importing} className={`${btn} px-5 py-2.5 bg-[#10B981] text-white font-black shadow-md hover:bg-[#059669]`}>{importing ? "Đang nhập…" : "⬇ Nhập từ bài giảng"}</button>
            <button onClick={openNewTest} className={`${btn} px-5 py-2.5 bg-[#142033] text-white font-black shadow-md hover:bg-black`}>+ Thêm bài</button>
          </div>
        </div>
        <div className="space-y-4">
          {levels.filter((l) => testsByLevel[l]).concat(Object.keys(testsByLevel).filter((l) => !levels.includes(l))).map((lvl) => {
            const list = testsByLevel[lvl]; const open = collapsed[lvl] === false;
            return (
              <div key={lvl} className="bg-[#F8FAFC] p-5 rounded-2xl border border-[#E2E8F0]">
                <div onClick={() => setCollapsed((c) => ({ ...c, [lvl]: open }))} className="flex justify-between items-center cursor-pointer select-none">
                  <h4 className="font-black text-sm text-[#10B981] uppercase tracking-widest flex items-center gap-2">📁 {lvl} <span className="text-xs font-bold text-slate-400">({list.length} bài)</span></h4>
                  <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-xl border border-[#E2E8F0]">{open ? "▲ Thu gọn" : "▼ Mở rộng"}</span>
                </div>
                {open && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    {list.map((t) => (
                      <div key={t.id} className="p-4 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex gap-1 mb-1">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${t.kind === "error" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>{t.kind === "error" ? "Lỗi câu" : "Từ vựng"}</span>
                            {t.source === "lecture_auto" && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Tự động</span>}
                          </div>
                          <h5 className="font-black text-sm text-[#142033] mb-1">{t.testName}</h5>
                          <p className="text-xs text-[#64748B] font-medium mb-3">{testItems(t).length} câu</p>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <button onClick={() => openEditTest(t)} className={`${btn} flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px]`}>✏️ Sửa</button>
                          <button onClick={() => deleteTest(t)} className={`${btn} flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px]`}>🗑️ Xoá</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!loading && tests.length === 0 && <p className="text-slate-400 text-xs py-6 text-center">Kho trống. Bấm “⬇ Nhập từ bài giảng” để có sẵn bài cho mọi cấp độ.</p>}
        </div>
      </div>

      {/* MODAL LỚP */}
      {classForm && (
        <div className={overlay}>
          <form onSubmit={saveClass} className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <h3 className="text-xl font-black text-[#142033]">{classForm.id ? "Sửa Lớp" : "Tạo Lớp Mới"}</h3>
            <div><label className={labelCls}>Tên lớp</label>
              <input value={classForm.className} onChange={(e) => setClassForm({ ...classForm, className: e.target.value })} className={inputCls} placeholder="VD: HSK4 tối 2-4-6" required /></div>
            <div><label className={labelCls}>Cấp độ</label>
              <select value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })} className={inputCls}>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select></div>
            {classForm.rows.length > 0 && (
              <div>
                <label className={labelCls}>Học sinh hiện có · sửa tên không làm mất hồ sơ</label>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {classForm.rows.map((r, i) => (
                    <div key={r.id} className="flex gap-2">
                      <input value={r.name} onChange={(e) => { const rows = [...classForm.rows]; rows[i] = { ...r, name: e.target.value }; setClassForm({ ...classForm, rows }); }} className="flex-1 p-2 rounded-lg border border-[#E2E8F0] text-sm font-medium outline-none focus:border-[#10B981]" />
                      <button type="button" onClick={() => removeRow(i)} className="px-3 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div><label className={labelCls}>{classForm.id ? "Thêm học sinh mới (mỗi bạn 1 dòng)" : "Danh sách học sinh (mỗi bạn 1 dòng)"}</label>
              <textarea rows="4" value={classForm.addText} onChange={(e) => setClassForm({ ...classForm, addText: e.target.value })} className={`${inputCls} font-medium resize-none`} placeholder={"Nguyễn Văn A\nTrần Thị B"} /></div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setClassForm(null)} className={`${btn} flex-1 py-3 bg-slate-100 text-slate-600`}>Huỷ</button>
              <button type="submit" className={`${btn} flex-1 py-3 bg-[#10B981] text-white shadow-md`}>Lưu</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL BÀI KIỂM TRA */}
      {testForm && (
        <div className={overlay}>
          <form onSubmit={saveTest} className="bg-white rounded-[32px] p-8 max-w-xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <h3 className="text-xl font-black text-[#142033]">{testForm.id ? "Sửa Bài Kiểm Tra" : "Thêm Bài Kiểm Tra"}</h3>
            {testForm.auto && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Bài này nhập tự động từ bài giảng. Nếu bấm “Nhập từ bài giảng” lần nữa, nội dung sẽ bị thay bằng bản gốc.</p>}
            <div><label className={labelCls}>Tên bài</label>
              <input value={testForm.testName} onChange={(e) => setTestForm({ ...testForm, testName: e.target.value })} className={inputCls} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Cấp độ</label>
                <select value={testForm.level} onChange={(e) => setTestForm({ ...testForm, level: e.target.value })} className={inputCls}>{levels.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
              <div><label className={labelCls}>Loại</label>
                <select value={testForm.kind} onChange={(e) => setTestForm({ ...testForm, kind: e.target.value })} className={inputCls}>
                  <option value="vocab">Từ vựng</option><option value="error">Lỗi câu</option>
                </select></div>
            </div>
            <div><label className={labelCls}>{testForm.kind === "error" ? "Mỗi dòng: câu sai | câu đúng | giải thích" : "Mỗi dòng: chữ Hán | pinyin | nghĩa"}</label>
              <textarea rows="10" value={testForm.text} onChange={(e) => setTestForm({ ...testForm, text: e.target.value })} className={`${inputCls} font-medium resize-y`} placeholder={testForm.kind === "error" ? "我养成了早起。 | 我养成了早起的习惯。 | 养成 đi với 习惯" : "流利 | liúlì | lưu loát\n厉害 | lìhai | giỏi, lợi hại"} required />
              <p className="text-[10px] text-slate-400 mt-1">Pinyin và nghĩa không bắt buộc, nhưng có thì cô sẽ thấy đáp án khi chấm và dùng được chế độ Việt → Hán.</p></div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setTestForm(null)} className={`${btn} flex-1 py-3 bg-slate-100 text-slate-600`}>Huỷ</button>
              <button type="submit" className={`${btn} flex-1 py-3 bg-[#10B981] text-white shadow-md`}>Lưu</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CHỌN BÀI & CÁCH HỎI */}
      {setup && (() => {
        const t = tests.find((x) => x.id === setup.testId);
        const isErr = (t?.kind || "vocab") === "error";
        const hasVn = t ? testItems(t).some((i) => i.vn) : true;
        const levelOpts = [...new Set([...levels.filter((l) => testsByLevel[l]), ...Object.keys(testsByLevel)])];
        return (
          <div className={overlay}>
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-xl font-black text-[#142033]">Kiểm tra: <span className="text-[#10B981]">{setup.st.name}</span></h3>
              <div><label className={labelCls}>Cấp độ</label>
                <select value={setup.level} onChange={(e) => setSetup({ ...setup, level: e.target.value, testId: "" })} className={inputCls}>
                  {levelOpts.map((l) => <option key={l} value={l}>{l}</option>)}
                </select></div>
              <div><label className={labelCls}>Bài kiểm tra</label>
                <select value={setup.testId} onChange={(e) => setSetup({ ...setup, testId: e.target.value })} className={inputCls}>
                  <option value="">-- Chọn bài --</option>
                  {(testsByLevel[setup.level] || []).map((x) => <option key={x.id} value={x.id}>{x.testName} ({testItems(x).length})</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Số câu</label>
                  <select value={setup.n} onChange={(e) => setSetup({ ...setup, n: +e.target.value })} className={inputCls}>
                    {[3, 5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n} câu</option>)}<option value={0}>Tất cả</option>
                  </select></div>
                <div><label className={labelCls}>Thời gian / câu</label>
                  <select value={setup.sec} onChange={(e) => setSetup({ ...setup, sec: +e.target.value })} className={inputCls}>
                    <option value={0}>Không giới hạn</option>{[5, 8, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} giây</option>)}
                  </select></div>
              </div>
              {!isErr && (
                <div><label className={labelCls}>Cách hỏi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[["zh", "Hán → nghĩa"], ["vn", "Việt → Hán"], ["listen", "Nghe → viết"]].map(([v, l]) => (
                      <button type="button" key={v} disabled={v === "vn" && !hasVn} onClick={() => setSetup({ ...setup, dir: v })}
                        className={`${btn} py-2.5 border ${setup.dir === v ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-slate-600 border-[#E2E8F0]"}`}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input type="checkbox" checked={setup.prioritize} onChange={(e) => setSetup({ ...setup, prioritize: e.target.checked })} />
                Ưu tiên hỏi lại những từ bạn này từng sai
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSetup(null)} className={`${btn} flex-1 py-3 bg-slate-100 text-slate-600`}>Huỷ</button>
                <button type="button" onClick={() => startSession(setup)} className={`${btn} flex-1 py-3 bg-[#10B981] text-white shadow-md`}>▶ Bắt đầu</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PHIÊN KIỂM TRA */}
      {session && (() => {
        const s = session; const it = s.items[s.idx]; const isErr = s.kind === "error";
        const correct = s.log.filter((l) => l.ok).length; const wrong = s.log.filter((l) => !l.ok);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#142033]/90 backdrop-blur-md">
            <div className="bg-white rounded-[40px] p-6 md:p-10 max-w-3xl w-full shadow-2xl flex flex-col items-center max-h-[95vh] overflow-y-auto">
              {!s.done ? (
                <>
                  <div className="w-full flex justify-between items-center gap-3 mb-4">
                    <span className="bg-[#ECFDF5] text-[#10B981] font-black text-xs px-3 py-1 rounded-full border border-[#A7F3D0]">
                      {s.cfg.st.name} · Câu {s.idx + 1}/{s.items.length} · ✓ {correct}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 truncate">{s.test.testName}</span>
                    {s.cfg.sec > 0 && (
                      <button onClick={() => setSession({ ...s, paused: !s.paused })} title="Tạm dừng (P)"
                        className={`w-16 h-16 shrink-0 rounded-full flex flex-col items-center justify-center font-black text-sm ${s.paused ? "bg-amber-100 text-amber-700" : s.left <= 3 ? "bg-rose-100 text-rose-600 animate-pulse" : "bg-slate-100 text-[#142033]"}`}>
                        {s.paused ? "⏸" : `${s.left}s`}<span className="text-[8px] font-bold">{s.paused ? "tiếp" : "dừng"}</span>
                      </button>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mb-6 overflow-hidden">
                    <div className="h-full bg-[#10B981] transition-all" style={{ width: `${(s.idx / s.items.length) * 100}%` }} />
                  </div>
                  <div className="w-full min-h-[260px] py-8 px-6 bg-[#F8FAFC] rounded-3xl border-2 border-[#E2E8F0] flex flex-col items-center justify-center gap-4 text-center">
                    {isErr ? (
                      <>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Câu này sai ở đâu? Sửa thế nào?</p>
                        <p className="text-3xl md:text-4xl font-black text-[#142033] leading-snug">{it.z}</p>
                      </>
                    ) : s.cfg.dir === "vn" ? (
                      <p className="text-3xl md:text-5xl font-black text-[#142033] leading-snug">{it.vn || "(chưa có nghĩa)"}</p>
                    ) : s.cfg.dir === "listen" ? (
                      <button onClick={() => speak(it.z)} className="text-6xl" title="Nghe lại">🔊</button>
                    ) : (
                      <p className="text-7xl md:text-8xl font-black text-[#142033] tracking-wider">{it.z}</p>
                    )}
                    <div className={`transition ${s.shown ? "opacity-100" : "opacity-0 select-none"}`}>
                      {isErr ? (
                        <>
                          <p className="text-2xl font-black text-[#047857]">{it.ans ? `✓ ${it.ans}` : it.vn}</p>
                          {it.why && <p className="text-sm font-medium text-slate-500 mt-1">{it.why}</p>}
                        </>
                      ) : (
                        <p className="text-2xl font-bold text-slate-600">
                          {s.cfg.dir !== "zh" && <span className="text-5xl font-black text-[#142033] mr-3">{it.z}</span>}
                          {it.py && <span className="mr-2">{it.py}</span>}
                          {s.cfg.dir !== "vn" && it.vn && <span>· {it.vn}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 w-full mt-6">
                    <button onClick={() => mark(false)} className="py-5 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl font-black text-base hover:bg-rose-100 active:scale-95">{isErr ? "✗ Sai" : "✗ Chưa thuộc"}</button>
                    <button onClick={reveal} className="py-5 bg-white text-[#142033] border-2 border-[#142033] rounded-2xl font-black text-base hover:bg-slate-50 active:scale-95">{s.shown ? "🔊 Nghe" : "👁 Đáp án"}</button>
                    <button onClick={() => mark(true)} className="py-5 bg-[#10B981] text-white rounded-2xl font-black text-base shadow-lg hover:bg-[#059669] active:scale-95">{isErr ? "✓ Đúng" : "✓ Thuộc"}</button>
                  </div>
                  <div className="w-full flex justify-between items-center mt-4 text-xs font-bold text-slate-400">
                    <button onClick={undo} disabled={!s.log.length} className="hover:text-slate-600 disabled:opacity-40">↶ Hoàn tác (Z)</button>
                    <span className="hidden md:inline">Phím: Space đáp án · → {isErr ? "đúng" : "thuộc"} · ← {isErr ? "sai" : "chưa thuộc"} · P dừng</span>
                    <button onClick={exitSession} className="hover:text-slate-600">Thoát</button>
                  </div>
                </>
              ) : (
                <div className="w-full space-y-5 text-center">
                  <div className="text-5xl">{wrong.length ? "📝" : "🏆"}</div>
                  <h2 className="text-2xl font-black text-[#142033]">{s.cfg.st.name}: {correct}/{s.log.length} {s.kind === "error" ? "câu đúng" : "từ thuộc"}</h2>
                  <p className="text-xs font-bold text-slate-400">{s.test.testName} · {today()}</p>
                  {wrong.length > 0 ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 text-left">
                      <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-3">
                        {s.kind === "error" ? "Câu sửa sai — chép lại câu đúng" : "Chép phạt"} mỗi {s.kind === "error" ? "câu" : "từ"} {PENALTY_TIMES} lần · tổng {wrong.length * PENALTY_TIMES} lần
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {wrong.map((w, i) => (
                          <span key={i} className="px-3 py-2 bg-white rounded-xl border border-rose-200 text-sm">
                            <b className="text-[#142033] text-base">{s.kind === "error" ? (w.ans || w.z) : w.z}</b>
                            {s.kind !== "error" && w.py && <span className="text-slate-500"> {w.py}</span>}
                            {s.kind !== "error" && w.vn && <span className="text-slate-400"> · {w.vn}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-[#047857] font-black">Thuộc hết, không phải chép phạt 👏</p>}
                  <p className={`text-xs font-bold ${s.saveError ? "text-rose-600" : "text-slate-400"}`}>
                    {s.saving ? "Đang lưu kết quả…" : s.saved ? "✓ Đã lưu vào hồ sơ" : s.saveError ? "⚠ Chưa lưu được: " + s.saveError : ""}
                    {s.saveError && <button onClick={() => saveResult(s, s.log)} className="ml-2 underline">Thử lại</button>}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {wrong.length > 0 && <button onClick={() => startSession(s.cfg, wrong.map(({ ok, ...r }) => r))} className="py-3.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl font-black text-xs">↻ Hỏi lại từ sai</button>}
                    <button onClick={nextStudent} className="py-3.5 bg-[#10B981] text-white rounded-2xl font-black text-xs">🎲 Bạn tiếp theo</button>
                    <button onClick={() => setSession(null)} className="py-3.5 bg-[#142033] text-white rounded-2xl font-black text-xs">Đóng</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* BÁO CÁO LỚP */}
      {reportFor && (
        <ClassReport cls={reportFor.cls} testName={reportFor.testName} results={results}
          onPenalty={setPenalty} onClose={() => setReportFor(null)} />
      )}

      {/* HỒ SƠ HỌC SINH */}
      {profileFor && (
        <StudentProfile cls={profileFor.cls} st={profileFor.st} results={resultsOf(profileFor.cls.id, profileFor.st.id)}
          onPenalty={setPenalty} onClose={() => setProfileFor(null)}
          onTest={() => { const p = profileFor; setProfileFor(null); openSetup(p.cls, p.st); }} />
      )}
    </div>
  );
}

// ------------------------------------------------------------
function wrongLabel(l, kind) {
  return l.z + (kind !== "error" && l.py ? ` (${l.py})` : "");
}

function ClassReport({ cls, testName, results, onPenalty, onClose }) {
  const rows = (cls.students || []).map((st) => {
    const all = results.filter((r) => r.classId === cls.id && r.studentId === st.id && r.testName === testName);
    return { st, last: all.find((r) => !r.retry) || all[0], count: all.length };
  });
  const kind = rows.find((r) => r.last)?.last.kind || "vocab";
  const freq = {};
  rows.forEach(({ last }) => (last?.logs || []).forEach((l) => { if (!l.ok) { const k = l.z; freq[k] = freq[k] || { l, n: 0 }; freq[k].n++; } }));
  const top = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 12);
  const tested = rows.filter((r) => r.last);
  const avg = tested.length ? Math.round(tested.reduce((s, r) => s + r.last.score, 0) / tested.length) : 0;

  const exportCsv = () => {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    let csv = "﻿Học sinh,Ngày,Điểm (%),Đúng/Tổng,Số lần kiểm tra,Từ/câu sai,Số lần chép phạt,Đã nộp chép phạt\r\n";
    rows.forEach(({ st, last, count }) => {
      if (!last) { csv += [q(st.name), "", "", "", 0, q("Chưa kiểm tra"), "", ""].join(",") + "\r\n"; return; }
      const w = (last.logs || []).filter((l) => !l.ok);
      csv += [q(st.name), q(last.date), last.score, q(`${last.correct}/${last.total}`), count, q(w.map((l) => wrongLabel(l, kind)).join(", ")), w.length * PENALTY_TIMES, w.length ? (last.penaltyDone ? "Đã nộp" : "Chưa") : ""].join(",") + "\r\n";
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Bao_cao_${cls.className}_${testName}.csv`.replace(/[\\/:*?"<>|]+/g, "_");
    document.body.appendChild(a); a.click(); a.remove();
  };
  const copyText = () => {
    const lines = [`KIỂM TRA BÀI CŨ · ${cls.className} · ${testName}`];
    rows.forEach(({ st, last }) => {
      if (!last) return lines.push(`- ${st.name}: chưa kiểm tra`);
      const w = (last.logs || []).filter((l) => !l.ok);
      lines.push(`- ${st.name} (${last.date}): ${last.correct}/${last.total}` + (w.length ? ` · sai: ${w.map((l) => wrongLabel(l, kind)).join(", ")} → chép phạt mỗi ${kind === "error" ? "câu" : "từ"} ${PENALTY_TIMES} lần` : " · thuộc hết"));
    });
    navigator.clipboard?.writeText(lines.join("\n")).then(() => alert("Đã sao chép báo cáo."), () => alert(lines.join("\n")));
  };

  return (
    <div className={overlay}>
      <div className="bg-white rounded-[40px] p-6 md:p-10 w-[95vw] max-w-5xl shadow-2xl space-y-5 max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-4 shrink-0">
          <div>
            <h3 className="text-xl font-black text-[#142033]">Báo Cáo Lớp</h3>
            <p className="text-xs font-bold text-[#10B981] mt-0.5">{cls.className} · {testName} · đã kiểm tra {tested.length}/{rows.length} · TB {avg}%</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full font-bold text-slate-500">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {top.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">{kind === "error" ? "Câu cả lớp hay sai" : "Từ cả lớp hay sai"}</p>
              <div className="flex flex-wrap gap-2">
                {top.map(({ l, n }) => <span key={l.z} className="px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-xs font-bold text-[#142033]">{wrongLabel(l, kind)} <span className="text-rose-600">×{n}</span></span>)}
              </div>
            </div>
          )}
          <table className="w-full text-left text-xs">
            <thead><tr className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
              <th className="p-3 rounded-l-xl">Học sinh</th><th className="p-3">Lần gần nhất</th><th className="p-3">Từ/câu sai</th><th className="p-3 rounded-r-xl">Chép phạt</th>
            </tr></thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {rows.map(({ st, last, count }) => {
                const w = (last?.logs || []).filter((l) => !l.ok);
                return (
                  <tr key={st.id} className="align-top">
                    <td className="p-3 font-bold text-[#142033]">{st.name}</td>
                    <td className="p-3">{last ? <><b className="text-[#10B981]">{last.score}%</b> ({last.correct}/{last.total})<br /><span className="text-slate-400">{last.date}{count > 1 ? ` · ${count} lần` : ""}</span></> : <span className="text-slate-400">Chưa kiểm tra</span>}</td>
                    <td className="p-3">{last && (w.length ? <div className="flex flex-wrap gap-1">{w.map((l, i) => <span key={i} className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-md font-bold" title={l.vn}>{wrongLabel(l, kind)}</span>)}</div> : <span className="text-[#10B981] font-bold">Thuộc hết 🎉</span>)}</td>
                    <td className="p-3 whitespace-nowrap">{last && w.length > 0 && (
                      <label className={`flex items-center gap-1.5 font-bold ${last.penaltyDone ? "text-[#10B981]" : "text-rose-600"}`}>
                        <input type="checkbox" disabled={last.source !== "new"} checked={!!last.penaltyDone} onChange={(e) => onPenalty(last, e.target.checked)} />
                        {w.length * PENALTY_TIMES} lần{last.source === "new" ? (last.penaltyDone ? " · đã nộp" : " · chưa nộp") : ""}
                      </label>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap gap-3 shrink-0">
          <button onClick={exportCsv} className="flex-1 py-3.5 bg-[#10B981] text-white rounded-2xl font-black text-xs uppercase tracking-widest">📥 Xuất Excel</button>
          <button onClick={copyText} className="flex-1 py-3.5 bg-white border border-[#E2E8F0] text-[#142033] rounded-2xl font-black text-xs uppercase tracking-widest">📋 Sao chép tin nhắn</button>
          <button onClick={onClose} className="py-3.5 px-6 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function StudentProfile({ cls, st, results, onPenalty, onClose, onTest }) {
  const [open, setOpen] = useState(null);
  const freq = {};
  results.forEach((r) => (r.logs || []).forEach((l) => { if (!l.ok) { freq[l.z] = freq[l.z] || { l, n: 0 }; freq[l.z].n++; } }));
  const top = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 15);
  const avg = results.length ? Math.round(results.reduce((s, r) => s + (r.score || 0), 0) / results.length) : 0;
  return (
    <div className={overlay}>
      <div className="bg-white rounded-[40px] p-6 md:p-10 w-[96vw] max-w-5xl shadow-2xl space-y-5 max-h-[94vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-4 shrink-0">
          <div>
            <h3 className="text-2xl font-black text-[#142033]">{st.name}</h3>
            <p className="text-xs font-bold text-[#10B981] mt-0.5">{cls.className} · {results.length} lần kiểm tra · trung bình {avg}%</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onTest} className="px-4 py-2.5 bg-[#10B981] text-white rounded-xl font-black text-xs">▶ Kiểm tra</button>
            <button onClick={onClose} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full font-bold text-slate-500">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {top.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Từ/câu hay sai</p>
              <div className="flex flex-wrap gap-2">{top.map(({ l, n }) => <span key={l.z} className="px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-xs font-bold" title={l.vn}>{l.z}{l.py ? ` (${l.py})` : ""} <span className="text-rose-600">×{n}</span></span>)}</div>
            </div>
          )}
          {results.length === 0 ? <p className="text-sm text-slate-400 py-12 text-center">Chưa có lần kiểm tra nào.</p> : results.map((r, i) => {
            const w = (r.logs || []).filter((l) => !l.ok);
            return (
              <div key={r.id} className="rounded-3xl border border-[#E2E8F0] overflow-hidden">
                <div onClick={() => setOpen(open === i ? null : i)} className="p-4 bg-[#F8FAFC] hover:bg-slate-100 cursor-pointer flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <span className="bg-[#142033] text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mr-2">{r.level}</span>
                    <b className="text-sm text-[#142033]">{r.testName}</b>
                    <p className="text-xs text-slate-400">{r.date}{w.length ? ` · ${w.length} sai · chép phạt ${w.length * PENALTY_TIMES} lần${r.source === "new" ? (r.penaltyDone ? " · đã nộp" : " · chưa nộp") : ""}` : " · thuộc hết"}{r.retry ? " · hỏi lại từ sai" : ""}</p>
                  </div>
                  <div className="text-right shrink-0"><p className="font-black text-lg text-[#10B981]">{r.score}%</p><p className="text-xs font-bold text-slate-500">{r.correct}/{r.total}</p></div>
                </div>
                {open === i && (
                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {(r.logs || []).map((l, k) => (
                        <span key={k} title={l.vn} className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${l.ok ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" : "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]"}`}>
                          {l.z}{l.py ? <span className="font-medium opacity-70"> {l.py}</span> : null} {l.ok ? "✓" : "✗"}
                        </span>
                      ))}
                    </div>
                    {w.length > 0 && r.source === "new" && (
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input type="checkbox" checked={!!r.penaltyDone} onChange={(e) => onPenalty(r, e.target.checked)} /> Đã nộp chép phạt
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
