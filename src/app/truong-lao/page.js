"use client";
// ============================================================
// TRƯỞNG LÃO 长老 — giáo viên theo dõi tông môn (v2 · giai đoạn D)
// Chọn lớp → đệ tử đã gia nhập (users.tongMon.id) với cảnh giới, tu vi tuần, chuỗi ngày, linh căn yếu, tâm ma
// Ban pháp chỉ + nhiệm vụ tuần (classes/{id}.tuTien) · trao thưởng / điều chỉnh tu vi (ghi nhật ký trong classes/{id}.tuTien.log)
// ============================================================
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { db } from "../../firebase";
import { collection, doc, getDoc, getDocs, query, where, setDoc, increment } from "firebase/firestore";
import GardenNav from "../GardenNav";
import { tuViState } from "../tuVi";
import { judgeLinhCan, elementOf } from "../tuTien";
import { weekKey } from "../useTuVi";
import { ldStats } from "../luyenDan";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

export default function TruongLaoPage() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [role, setRole] = useState(null);
  const [classes, setClasses] = useState([]);
  const [cid, setCid] = useState("");
  const [cls, setCls] = useState(null);
  const [rows, setRows] = useState(null);
  const [phapChi, setPhapChi] = useState("");
  const [tasks, setTasks] = useState("");
  const [award, setAward] = useState({ id: "", n: 20, why: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    getDoc(doc(db, "users", userId)).then((s) => setRole(s.data()?.role || user?.publicMetadata?.role || "student")).catch(() => setRole("student"));
    getDocs(collection(db, "classes")).then((s) => { const l = []; s.forEach((d) => l.push({ id: d.id, ...d.data() })); setClasses(l); if (l[0]) setCid((c) => c || l[0].id); }).catch(() => {});
  }, [isSignedIn, userId, user]);
  const isTeacher = ["teacher", "admin"].includes(role) || ["teacher", "admin"].includes(user?.publicMetadata?.role);

  const load = async (id) => {
    if (!id) return; setRows(null);
    const c = await getDoc(doc(db, "classes", id)).then((s) => (s.exists() ? s.data() : {})).catch(() => ({}));
    setCls(c); setPhapChi(c.tuTien?.phapChi || ""); setTasks((c.tuTien?.tasks || []).map((t) => `${t.text}${t.tv ? ` | ${t.tv}` : ""}`).join("\n"));
    const snap = await getDocs(query(collection(db, "users"), where("tongMon.id", "==", id))).catch(() => null);
    const wk = weekKey(); const list = [];
    snap?.forEach((d) => { const u = d.data(); list.push({ id: d.id, u, name: u.daoHieu?.vn ? `${u.daoHieu.vn} (${u.fullName || "?"})` : u.fullName || d.id, tv: tuViState(u.xp || 0, u.tuVi, u.doKiep), week: u.week?.k === wk ? u.week.xp || 0 : 0, lc: u.linhCan?.scores ? judgeLinhCan(u.linhCan.scores) : null }); });
    const withLd = await Promise.all(list.map(async (r) => { const s = await getDoc(doc(db, "lien_dan", r.id)).then((x) => (x.exists() ? ldStats(x.data()) : null)).catch(() => null); return { ...r, ld: s }; }));
    setRows(withLd.sort((a, b) => b.week - a.week));
  };
  useEffect(() => { if (isTeacher && cid) load(cid); }, [isTeacher, cid]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveOrders = async () => {
    const t = tasks.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => { const [text, tv] = x.split("|").map((y) => y.trim()); return { text, tv: Number(tv) || 0 }; });
    await setDoc(doc(db, "classes", cid), { tuTien: { ...(cls?.tuTien || {}), phapChi: phapChi.trim(), tasks: t, at: Date.now() } }, { merge: true });
    setMsg("Đã ban pháp chỉ cho tông môn.");
  };
  const giveTv = async () => {
    const n = Math.round(Number(award.n) || 0); if (!award.id || !n) return;
    const r = rows.find((x) => x.id === award.id);
    await setDoc(doc(db, "users", award.id), { xp: increment(n), ...(n > 0 ? { week: r?.u?.week?.k === weekKey() ? { k: weekKey(), xp: increment(n) } : { k: weekKey(), xp: n } } : {}) }, { merge: true });
    const log = [...(cls?.tuTien?.log || []), { to: award.id, name: r?.name, n, why: award.why.trim(), by: userId, at: Date.now() }].slice(-50);
    await setDoc(doc(db, "classes", cid), { tuTien: { ...(cls?.tuTien || {}), log } }, { merge: true });
    setMsg(`${n > 0 ? "Đã trao" : "Đã trừ"} ${Math.abs(n)} tu vi cho ${r?.name}.`); setAward({ id: "", n: 20, why: "" }); load(cid);
  };
  const summary = useMemo(() => {
    if (!rows?.length) return null; const weak = {};
    rows.forEach((r) => { if (r.lc) weak[r.lc.weak] = (weak[r.lc.weak] || 0) + 1; });
    const topWeak = Object.entries(weak).sort((a, b) => b[1] - a[1])[0];
    return { n: rows.length, week: rows.reduce((a, r) => a + r.week, 0), tamMa: rows.reduce((a, r) => a + (r.ld?.tamMa || 0), 0), weak: topWeak ? elementOf(topWeak[0]) : null, idle: rows.filter((r) => !r.u.lastActiveDay || (Date.now() - Date.parse(r.u.lastActiveDay)) / 864e5 > 3).length };
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Trưởng lão · Chưởng Môn Điện" right={<Link href="/teacher" className="text-sm font-bold text-[#9E2F22]">Trang giáo viên cũ →</Link>} />
      <main className="max-w-[1200px] mx-auto px-4 md:px-8 pt-6 pb-28 md:pb-16 flex flex-col gap-5">
        {!isSignedIn ? <p>Đăng nhập bằng tài khoản giáo viên.</p> : role == null ? <p>Đang kiểm tra lệnh bài…</p> : !isTeacher ? (
          <p className="rounded-[10px] bg-[#FBF8F1] border border-[#D8CBAE] p-5">Chưởng Môn Điện chỉ dành cho Trưởng lão (giáo viên). <Link href="/tong-mon" className="font-bold text-[#9E2F22] underline">Xem tông môn của bạn</Link>.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-brush text-[40px] leading-none text-[#9E2F22]">长老</span>
              <h1 className="font-serif-vn text-[24px] font-extrabold">Trưởng lão</h1>
              <label className="ml-auto flex items-center gap-2 text-sm font-bold">Tông môn
                <select value={cid} onChange={(e) => setCid(e.target.value)} className="h-10 rounded-[6px] border border-[#CDBF9F] bg-white px-3 font-normal">
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.className}{c.level ? ` · ${c.level}` : ""}</option>)}
                </select>
              </label>
            </div>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[["Đệ tử", summary.n], ["Tu vi tuần", fmt(summary.week)], ["Tâm ma cả lớp", summary.tamMa], ["Hệ yếu nhiều nhất", summary.weak ? `${summary.weak.zh} ${summary.weak.vn}` : "–"], ["Vắng > 3 ngày", summary.idle]].map(([l, v]) => (
                  <div key={l} className="rounded-[10px] bg-[#FBF8F1] border border-[#D8CBAE] p-3"><div className="text-xs text-[#6B6253]">{l}</div><b className="text-[20px]">{v}</b></div>
                ))}
              </div>
            )}
            <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 overflow-x-auto">
              <h2 className="font-serif-vn text-[18px] font-extrabold mb-3">Đệ tử trong tông môn</h2>
              {rows === null ? <p className="text-sm">Đang điểm danh…</p> : rows.length === 0 ? <p className="text-sm text-[#6B6253]">Chưa có học sinh nào gia nhập tông môn này. Học sinh chọn tông môn ở trang Đệ Tử Cư Sở (/de-tu).</p> : (
                <table className="w-full text-sm min-w-[820px] [&_th]:px-2 [&_td]:px-2">
                  <thead><tr className="text-left text-xs text-[#6B6253]"><th className="py-2 pr-2">Đệ tử</th><th>Cảnh giới</th><th className="text-right">Tu vi tuần</th><th className="text-right">Tổng</th><th className="text-right">Chuỗi</th><th>Hệ yếu</th><th className="text-right">Tâm ma</th><th className="text-right">Từ nhớ vững</th><th>Hoạt động</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-[#ECE3D0]">
                        <td className="py-2 pr-2 font-semibold">{r.name}</td>
                        <td>{r.tv.vn}{r.tv.provisional ? " (tạm)" : ` · ${r.tv.stage}`}</td>
                        <td className="text-right font-bold text-[#5C3D00]">{fmt(r.week)}</td>
                        <td className="text-right">{fmt(r.u.xp)}</td>
                        <td className="text-right">{r.u.streak || 0}</td>
                        <td>{r.lc ? `${elementOf(r.lc.weak).zh} ${elementOf(r.lc.weak).skill}` : "–"}</td>
                        <td className="text-right">{r.ld?.tamMa ?? "–"}</td>
                        <td className="text-right">{r.ld?.learned ?? "–"}</td>
                        <td>{r.u.lastActiveDay || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <div className="grid gap-5 md:grid-cols-2">
              <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-2">
                <h2 className="font-serif-vn text-[18px] font-extrabold">Ban pháp chỉ & nhiệm vụ tuần</h2>
                <label className="text-sm font-bold" htmlFor="pc">Pháp chỉ (lời nhắn cho cả tông môn)</label>
                <textarea id="pc" value={phapChi} onChange={(e) => setPhapChi(e.target.value)} rows={3} className="rounded-[6px] border border-[#CDBF9F] p-2 bg-white" />
                <label className="text-sm font-bold" htmlFor="nv">Nhiệm vụ — mỗi dòng một việc, thêm “| số tu vi” nếu có thưởng</label>
                <textarea id="nv" value={tasks} onChange={(e) => setTasks(e.target.value)} rows={4} placeholder={"Tiểu thành Bài 5 | 50\nHạ Ma Vương Luyện Khí | 80"} className="rounded-[6px] border border-[#CDBF9F] p-2 bg-white font-mono text-[13px]" />
                <button onClick={saveOrders} className="self-start h-10 px-4 rounded-[6px] bg-[#9E2F22] text-white font-bold">Ban pháp chỉ</button>
              </section>
              <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-2">
                <h2 className="font-serif-vn text-[18px] font-extrabold">Trao thưởng / điều chỉnh tu vi</h2>
                <select value={award.id} onChange={(e) => setAward({ ...award, id: e.target.value })} className="h-10 rounded-[6px] border border-[#CDBF9F] bg-white px-3" aria-label="Đệ tử">
                  <option value="">— Chọn đệ tử —</option>
                  {(rows || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="number" value={award.n} onChange={(e) => setAward({ ...award, n: e.target.value })} className="w-28 h-10 rounded-[6px] border border-[#CDBF9F] bg-white px-3" aria-label="Số tu vi (âm để trừ)" />
                  <input value={award.why} onChange={(e) => setAward({ ...award, why: e.target.value })} placeholder="Lý do (vd: xong nhiệm vụ tuần)" className="flex-1 h-10 rounded-[6px] border border-[#CDBF9F] bg-white px-3" />
                </div>
                <p className="text-xs text-[#6B6253]">Số âm để trừ tu vi khi phát hiện gian lận. Mọi lần trao/trừ được ghi nhật ký.</p>
                <button onClick={giveTv} disabled={!award.id || !Number(award.n)} className="self-start h-10 px-4 rounded-[6px] bg-[#1C1A17] disabled:bg-[#8C7F68] text-white font-bold">Xác nhận</button>
                {(cls?.tuTien?.log || []).length > 0 && (
                  <ul className="mt-2 text-xs text-[#4A4238] flex flex-col gap-1 max-h-40 overflow-auto">
                    {[...cls.tuTien.log].reverse().map((l, i) => <li key={i}>{new Date(l.at).toLocaleDateString("vi-VN")} · {l.name}: <b className={l.n > 0 ? "text-[#2F6E5A]" : "text-[#9E2F22]"}>{l.n > 0 ? "+" : ""}{l.n}</b>{l.why ? ` — ${l.why}` : ""}</li>)}
                  </ul>
                )}
              </section>
            </div>
            {msg && <p className="text-sm font-semibold text-[#2F6E5A]" role="status">{msg}</p>}
          </>
        )}
      </main>
    </div>
  );
}
