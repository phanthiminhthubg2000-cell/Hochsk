"use client";
// TRANG GIÁO VIÊN · SHADOWING — học viên nào đã luyện bao nhiêu câu, điểm trung bình, hôm nay luyện mấy câu, câu nào còn yếu.
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

const norm = (s) => String(s || "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const tone = (v) => (v >= 80 ? "text-emerald-700" : v >= 60 ? "text-amber-600" : "text-rose-600");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function ShadowStats({ db }) {
  const [rows, setRows] = useState(null); const [segs, setSegs] = useState({}); const [items, setItems] = useState([]); const [open, setOpen] = useState(""); const [cls, setCls] = useState("");
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    (async () => {
      const [u, c] = await Promise.all([getDocs(collection(db, "users")).catch(() => null), getDocs(collection(db, "classes")).catch(() => null)]);
      const cl = []; c?.forEach((d) => cl.push({ id: d.id, ...d.data() })); setClasses(cl);
      const byName = {}; cl.forEach((k) => (k.students || []).forEach((s) => (byName[norm(s.name)] = k.className)));
      const r = []; u?.forEach((d) => { const x = d.data(); if (!x.shadow || x.role === "teacher" || x.role === "admin") return; r.push({ id: d.id, name: x.fullName || x.email || "Học viên", cls: byName[norm(x.fullName)] || "", shadow: x.shadow, day: x.shadowDay }); });
      setRows(r);
    })();
    Promise.all([fetch("/shadowing/segments.json").then((r) => r.json()), fetch("/shadowing/items.json").then((r) => r.json())]).then(([s, i]) => { setSegs(s); setItems(i); }).catch(() => {});
  }, [db]);
  const textOf = useMemo(() => (k) => { const [id, i] = k.split("#"); const it = items.find((x) => x.id.replace(/[.\/]/g, "_") === id); return { t: segs[it?.id]?.[+i]?.t || k, it }; }, [segs, items]);
  const list = (rows || []).filter((r) => !cls || r.cls === cls).map((r) => {
    const v = Object.values(r.shadow); const n = v.length; const avg = n ? Math.round(v.reduce((a, b) => a + b, 0) / n) : 0;
    return { ...r, n, avg, ok: v.filter((x) => x >= 80).length, td: r.day?.d === today() ? r.day.n || 0 : 0 };
  }).sort((a, b) => b.td - a.td || b.n - a.n);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="text-xl font-black text-[#142033]">🗣️ Shadowing</h2>
        <p className="text-sm text-slate-500 mt-1">Tiến độ luyện nói nhại của học viên (trang <b>/shadowing</b>). Điểm là điểm cao nhất AI chấm cho từng câu. Bấm vào một học viên để xem những câu còn yếu.</p>
        <select value={cls} onChange={(e) => setCls(e.target.value)} className="mt-3 h-10 px-3 rounded-xl border border-slate-300 text-sm"><option value="">Tất cả lớp</option>{classes.map((c) => <option key={c.id} value={c.className}>{c.className}</option>)}</select>
      </div>
      {!rows ? <p className="text-slate-500">Đang tải…</p> : !list.length ? <p className="text-slate-500">Chưa có học viên nào luyện shadowing.</p> : (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-2 px-4 py-2 text-[11px] font-bold uppercase text-slate-500 bg-slate-50"><span>Học viên</span><span className="text-right">Hôm nay</span><span className="text-right">Đã luyện</span><span className="text-right">Đạt ≥80</span><span className="text-right">TB</span></div>
          {list.map((r) => (
            <div key={r.id} className="border-t border-slate-100">
              <button onClick={() => setOpen(open === r.id ? "" : r.id)} className="w-full grid grid-cols-[1fr_70px_70px_70px_70px] gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50">
                <span className="min-w-0"><b className="block truncate">{r.name}</b>{r.cls && <span className="text-xs text-slate-500">{r.cls}</span>}</span>
                <span className="text-right font-bold">{r.td}</span><span className="text-right">{r.n}</span><span className="text-right">{r.ok}</span><span className={`text-right font-black ${tone(r.avg)}`}>{r.avg}</span>
              </button>
              {open === r.id && (
                <div className="px-4 pb-3 text-sm">
                  <div className="text-xs font-bold text-slate-500 mb-1">Câu điểm thấp nhất</div>
                  <ul className="grid gap-1">
                    {Object.entries(r.shadow).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([k, v]) => { const { t, it } = textOf(k); return (
                      <li key={k} className="flex gap-2"><b className={`w-8 text-right ${tone(v)}`}>{v}</b><span style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{t}</span><span className="text-xs text-slate-400 ml-auto whitespace-nowrap">{it ? `${it.level} · Bài ${it.lesson}` : ""}</span></li>
                    ); })}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
