"use client";
// ============================================================
// ĐỆ TỬ CƯ SỞ 弟子居所 — hồ sơ thư sinh (v2 · giai đoạn B)
// Đạo hiệu · cảnh giới · chứng thư · túi trữ vật · linh thú · tông môn (lớp)
// ============================================================
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import GardenNav from "../GardenNav";
import { KimThiem, judgeLinhCan, elementOf, ELEMENTS } from "../tuTien";
import { REALMS8 } from "../tuVi";
import { useTuVi } from "../useTuVi";
import { loadLD, ldStats } from "../luyenDan";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const THU = ["Thiềm Nhi", "Thanh Thiềm", "Kim Thiềm", "Ngân Nguyệt Thiềm", "Hỏa Vân Thiềm", "Tử Điện Thiềm", "Cửu Thiên Thiềm", "Thiên Thư Thần Thiềm"];
const card = "rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-3";

export default function DeTuPage() {
  const { u, tv, userId, isSignedIn, loaded } = useTuVi();
  const [classes, setClasses] = useState([]);
  const [ld, setLd] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { getDocs(collection(db, "classes")).then((s) => { const l = []; s.forEach((d) => l.push({ id: d.id, name: d.data().className || "Lớp", level: d.data().level || "" })); setClasses(l); }).catch(() => {}); }, []);
  useEffect(() => { if (userId) loadLD(userId).then(setLd); }, [userId]);

  if (loaded && !isSignedIn) return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]"><GardenNav active="home" title="Đệ Tử Cư Sở" />
      <main className="max-w-[560px] mx-auto px-4 pt-10 text-center flex flex-col gap-3"><p>Đăng nhập để xem hồ sơ thư sinh.</p><Link href="/" className="text-[#9E2F22] font-bold underline">Về Động phủ</Link></main></div>
  );
  const dh = u?.daoHieu?.vn || u?.fullName || "Thư sinh";
  const seal = u?.daoHieu?.zh?.[0] || dh[0];
  const lc = u?.linhCan?.scores ? judgeLinhCan(u.linhCan.scores) : null;
  const st = ldStats(ld || { w: {} });
  const pills = { trucCo: 0, hoiXuan: 0, ...(u?.pills || {}) }; const dan = { tuKhi: 0, kimDan: 0, cuuChuyen: 0, ...(u?.danDuoc || {}) };
  const bossWins = Object.keys(u?.maVuong || {}).filter((k) => u.maVuong[k]?.win).length;
  const joinClass = async (id) => {
    const c = classes.find((x) => x.id === id);
    const tongMon = c ? { id: c.id, name: c.name } : null;
    await setDoc(doc(db, "users", userId), { tongMon }, { merge: true }).catch(() => {});
    setMsg(c ? `Đã gia nhập tông môn ${c.name}.` : "Đã rời tông môn.");
  };
  const items = [
    { zh: "筑基丹", vn: "Trúc Cơ Đan", n: pills.trucCo, d: "Tu vi ×2 trong 1 giờ (dùng ở Động phủ)" },
    { zh: "回春丹", vn: "Hồi Xuân Đan", n: pills.hoiXuan, d: "Tự giữ chuỗi ngày khi lỡ 1 ngày" },
    { zh: "聚气丹", vn: "Tụ Khí Đan", n: dan.tuKhi, d: "Luyện xong một lò ≥5 từ đúng" },
    { zh: "金丹", vn: "Kim Đan", n: dan.kimDan, d: "Một lò đúng ≥90%" },
    { zh: "九转金丹", vn: "Cửu Chuyển Kim Đan", n: dan.cuuChuyen, d: "Lò ôn đúng ≥95%" },
    { zh: "魔令", vn: "Lệnh bài Ma Vương", n: bossWins, d: "Hạ Ma Vương các cảnh giới" },
  ];
  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Đệ Tử Cư Sở" />
      <main className="max-w-[1100px] mx-auto px-4 md:px-8 pt-6 pb-28 md:pb-16 grid gap-5 md:grid-cols-2 items-start">
        <section className="rounded-[14px] bg-[#1C1A17] text-[#F3EEE2] p-5 flex items-center gap-4 shadow-[4px_4px_0_#9E2F22] md:col-span-2">
          <span className="w-20 h-20 shrink-0 rounded-full bg-[#9E2F22] text-[#FBF3E4] grid place-items-center font-brush text-[42px] border-4 border-[#D9A23A]" aria-hidden="true">{seal}</span>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.14em] text-[#CFC3A8]">ĐẠO HIỆU</span>
            <h1 className="font-serif-vn text-[26px] font-extrabold leading-tight">{dh} {u?.daoHieu?.zh && <span className="text-[#E6B656] text-[22px]" style={{ fontFamily: '"Noto Serif SC",serif' }}>{u.daoHieu.zh}</span>}</h1>
            <span className="text-sm text-[#E6B656] font-bold">{tv ? (tv.provisional ? "Chưa định cảnh giới — lên Trắc Linh Đài để được xếp theo trình độ" : `${tv.zh} ${tv.vn} · ${tv.stage} · ${tv.region}`) : "…"}</span>
            <span className="text-xs text-[#CFC3A8]">{u?.tongMon ? `Tông môn: ${u.tongMon.name}` : "Chưa gia nhập tông môn"} · chuỗi {u?.streak || 0} ngày · tổng tu vi {fmt(u?.xp)}</span>
          </div>
          <Link href="/thien-thu" className="hidden sm:inline-flex h-10 px-4 rounded-[6px] border border-[#CFC3A8] text-sm font-bold items-center">Đổi đạo hiệu</Link>
        </section>

        <section className={card} aria-label="Cảnh giới">
          <h2 className="font-serif-vn text-[18px] font-extrabold flex items-baseline gap-2"><span className="font-brush text-[26px] text-[#9E2F22]">境界</span>Cảnh giới</h2>
          {tv && <>
            <div className="flex justify-between text-sm"><span>{tv.vn} · {tv.stage}</span><span>Tu vi <b>{fmt(tv.tv)}</b> / {fmt(tv.need)}</span></div>
            <div className="relative h-3 rounded-[2px] bg-[#DCD1BA] overflow-hidden"><div className="h-full" style={{ width: `${Math.max(2, tv.pct)}%`, background: "linear-gradient(90deg,#9E2F22,#D9A23A)" }} />{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <span key={i} className="absolute top-0 bottom-0 w-px bg-[#FBF8F1]/70" style={{ left: `${(i / 9) * 100}%` }} />)}</div>
          </>}
          <h3 className="font-bold text-sm mt-1">Chứng thư cảnh giới</h3>
          <ol className="grid grid-cols-4 gap-2">
            {REALMS8.map((R) => {
              const got = tv && R.idx < tv.idx; const cur = tv && R.idx === tv.idx;
              const k = u?.doKiep?.[`hsk${R.idx}`];
              return (
                <li key={R.key} className={`rounded-[6px] border p-2 text-center flex flex-col items-center gap-0.5 ${got ? "border-[#9E2F22] bg-[#FFF8EA]" : cur ? "border-[#1C1A17] bg-white" : "border-dashed border-[#CDBF9F] opacity-60"}`} title={got && k?.at ? `Độ kiếp ngày ${new Date(k.at).toLocaleDateString("vi-VN")}` : ""}>
                  <span className="font-brush text-[22px] leading-none">{R.zh}</span>
                  <span className="text-[11px] font-bold">{R.vn}</span>
                  <span className={`text-[10px] font-bold ${got ? "text-[#9E2F22]" : "text-[#6B6253]"}`}>{got ? (k?.passed ? "✓ độ kiếp" : "✓ đã qua") : cur ? "đang tu" : "chưa mở"}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className={card} aria-label="Linh thú">
          <h2 className="font-serif-vn text-[18px] font-extrabold flex items-baseline gap-2"><span className="font-brush text-[26px] text-[#9E2F22]">灵兽</span>Linh thú</h2>
          <div className="flex items-center gap-4">
            <span className="w-24 h-24 shrink-0 rounded-full bg-[#F3E3D2] grid place-items-center" style={{ filter: `hue-rotate(${(tv?.idx || 0) * 40}deg)` }}><KimThiem bob className="w-20 h-16" /></span>
            <div className="flex flex-col gap-1">
              <b className="font-serif-vn text-[17px]">{THU[tv?.idx || 0]} · cấp {(tv?.idx || 0) + 1}</b>
              <span className="text-sm text-[#4A4238]">Linh thú tiến hóa mỗi lần bạn độ kiếp thành công. Cấp sau: <b>{THU[Math.min(7, (tv?.idx || 0) + 1)]}</b>.</span>
            </div>
          </div>
          <h3 className="font-bold text-sm mt-1">Linh căn</h3>
          {lc ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2"><span className="font-brush text-[24px]">{lc.zh}</span><span className="text-sm">{lc.vn} · {lc.grade.vn}</span></div>
              <div className="grid grid-cols-5 gap-1.5">{ELEMENTS.map((e) => <span key={e.key} className={`rounded-[4px] py-1 text-center text-xs ${e.key === lc.weak ? "bg-[#F3E3D2] text-[#9E2F22] font-bold" : "bg-[#EFE7D6]"}`}><span className="block font-brush text-[18px] leading-none">{e.zh}</span>{u.linhCan.scores[e.key] || 0}</span>)}</div>
              <span className="text-xs text-[#6B6253]">Tâm ma: hệ {elementOf(lc.weak).vn} ({elementOf(lc.weak).skill}) — Tâm Ma Động thưởng ×1,5 cho hệ này.</span>
            </div>
          ) : <Link href="/linh-can" className="text-sm font-bold text-[#9E2F22] underline">Chưa đo linh căn — lên Trắc Linh Đài</Link>}
        </section>

        <section className={card} aria-label="Túi trữ vật">
          <h2 className="font-serif-vn text-[18px] font-extrabold flex items-baseline gap-2"><span className="font-brush text-[26px] text-[#9E2F22]">储物袋</span>Túi trữ vật</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((it) => (
              <li key={it.vn} className={`rounded-[8px] border p-3 flex flex-col gap-0.5 ${it.n ? "border-[#D9B970] bg-[#FFF8EA]" : "border-[#E4DAC4] bg-white opacity-70"}`}>
                <span className="flex items-baseline justify-between"><span className="font-brush text-[20px]">{it.zh}</span><b className="text-[#5C3D00]">×{it.n}</b></span>
                <span className="text-[13px] font-bold">{it.vn}</span>
                <span className="text-[11px] text-[#6B6253] leading-snug">{it.d}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-[6px] bg-[#EFE7D6] py-2"><b className="block text-[18px]">{fmt(st.learned)}</b>từ đã nhớ</div>
            <div className="rounded-[6px] bg-[#EFE7D6] py-2"><b className="block text-[18px]">{fmt(st.vienMan)}</b>từ Viên mãn</div>
            <div className="rounded-[6px] bg-[#EFE7D6] py-2"><b className="block text-[18px]">{u?.luanVo?.win || 0}</b>trận luận võ thắng</div>
          </div>
        </section>

        <section className={card} aria-label="Tông môn">
          <h2 className="font-serif-vn text-[18px] font-extrabold flex items-baseline gap-2"><span className="font-brush text-[26px] text-[#9E2F22]">宗门</span>Tông môn</h2>
          <p className="text-sm text-[#4A4238]">Tông môn là lớp học của bạn. Gia nhập để vào bảng xếp hạng tông môn, bang chiến tuần và nhận nhiệm vụ từ Trưởng lão (giáo viên).</p>
          <label className="text-sm font-bold" htmlFor="tm">Chọn tông môn</label>
          <select id="tm" value={u?.tongMon?.id || ""} onChange={(e) => joinClass(e.target.value)} className="h-11 rounded-[6px] border border-[#CDBF9F] bg-white px-3">
            <option value="">— Chưa gia nhập —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.level ? ` · ${c.level}` : ""}</option>)}
          </select>
          {msg && <p className="text-sm text-[#2F6E5A] font-semibold" role="status">{msg}</p>}
          <Link href="/tong-mon" className="self-start h-10 px-4 rounded-[6px] bg-[#9E2F22] text-white text-sm font-bold inline-flex items-center">Xem tông môn & bang chiến</Link>
        </section>
      </main>
    </div>
  );
}
