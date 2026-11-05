"use client";
// ============================================================
// TÔNG MÔN 宗门 — lớp học của thư sinh (v2 · giai đoạn D)
// Pháp chỉ + nhiệm vụ tuần của Trưởng lão (classes/{id}.tuTien), xếp hạng đồng môn, bang chiến tuần giữa các tông môn
// ============================================================
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";
import { ThienBang, useGiangHo, rankBoard } from "../giangHo";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

export default function TongMonPage() {
  const { u, userId, isSignedIn, loaded } = useTuVi();
  const [cls, setCls] = useState(null);
  const tm = u?.tongMon;
  useEffect(() => { if (tm?.id) getDoc(doc(db, "classes", tm.id)).then((s) => setCls(s.exists() ? s.data() : {})).catch(() => setCls({})); }, [tm?.id]);
  const { all } = useGiangHo();
  const members = useMemo(() => (all || []).filter((r) => r.tongMon?.id === tm?.id).sort((a, b) => b.week - a.week || b.xp - a.xp), [all, tm?.id]);
  const war = useMemo(() => rankBoard(all, "bang-chien") || [], [all]);
  const myRank = war.findIndex((x) => x.id === tm?.id);
  const tt = cls?.tuTien || {};
  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="play" title="Tông môn" />
      <main className="max-w-[1100px] mx-auto px-4 md:px-8 pt-6 pb-28 md:pb-16 grid gap-5 lg:grid-cols-[1.3fr_1fr] items-start">
        <section className="lg:col-span-2 rounded-[14px] bg-[#1C1A17] text-[#F3EEE2] p-5 flex items-center gap-4 shadow-[4px_4px_0_#9E2F22]">
          <span className="font-brush text-[54px] leading-none text-[#E6B656]" aria-hidden="true">宗门</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold tracking-[0.14em] text-[#CFC3A8]">TÔNG MÔN</div>
            <h1 className="font-serif-vn text-[24px] font-extrabold">{tm ? tm.name : "Chưa gia nhập tông môn"}</h1>
            <div className="text-sm text-[#E6B656] font-bold">{tm ? `${members.length} đệ tử trên Thiên Bảng · bang chiến tuần hạng ${myRank >= 0 ? myRank + 1 : "–"}/${war.length || "–"}` : "Tông môn là lớp học của bạn — gia nhập ở Đệ Tử Cư Sở."}</div>
          </div>
          {!tm && loaded && isSignedIn && <Link href="/de-tu" className="h-11 px-4 rounded-[6px] bg-[#E6B656] text-[#121318] font-extrabold inline-flex items-center shrink-0">Gia nhập</Link>}
        </section>

        <div className="flex flex-col gap-5">
          {tm && (
            <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-3" aria-label="Pháp chỉ của Trưởng lão">
              <h2 className="font-serif-vn text-[18px] font-extrabold flex items-baseline gap-2"><span className="font-brush text-[26px] text-[#9E2F22]">法旨</span>Pháp chỉ của Trưởng lão</h2>
              {tt.phapChi ? <p className="text-[15px] leading-relaxed whitespace-pre-line">{tt.phapChi}</p> : <p className="text-sm text-[#6B6253]">Trưởng lão chưa ban pháp chỉ tuần này.</p>}
              {Array.isArray(tt.tasks) && tt.tasks.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {tt.tasks.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-[8px] border border-[#E4DAC4] bg-white px-3 py-2.5">
                      <span className="font-brush text-[18px] text-[#9E2F22]" aria-hidden="true">任</span>
                      <span className="flex-1 text-[15px]">{t.text}</span>
                      {t.tv ? <b className="text-sm text-[#5C3D00]">+{t.tv}</b> : null}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-[#6B6253]">Hoàn thành nhiệm vụ, Trưởng lão sẽ trao thưởng tu vi.</p>
            </section>
          )}
          {tm && (
            <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-2" aria-label="Đồng môn">
              <h2 className="font-serif-vn text-[18px] font-extrabold flex items-baseline gap-2"><span className="font-brush text-[26px] text-[#9E2F22]">同门</span>Đồng môn tuần này</h2>
              {members.length === 0 ? <p className="text-sm text-[#6B6253]">Chưa có đồng môn nào tích tu vi.</p> : (
                <ol className="flex flex-col">
                  {members.map((m, i) => (
                    <li key={m.id} className={`flex items-center gap-3 py-2 px-2 rounded-md ${m.id === userId ? "bg-[#F3E3D2]" : ""} ${i ? "border-t border-[#ECE3D0]" : ""}`}>
                      <span className="w-7 text-center font-extrabold text-[#6B6253]">{i + 1}</span>
                      <span className="flex-1 min-w-0"><b className="block truncate">{m.name}{m.id === userId ? " (bạn)" : ""}</b><span className="block text-xs text-[#6B6253]">{m.realm.vn}{m.realm.provisional ? "" : ` · ${m.realm.stage}`} · chuỗi {m.streak} ngày</span></span>
                      <span className="text-right"><b className="block text-sm text-[#5C3D00]">{fmt(m.week)}</b><span className="text-[11px] text-[#6B6253]">tuần</span></span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
        <div className="flex flex-col gap-5">
          <ThienBang n={10} me={userId} board="bang-chien" />
          <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 text-sm text-[#4A4238] leading-relaxed">
            <b className="font-serif-vn text-[16px] text-[#1C1A17]">Bang chiến tuần</b><br />Tông môn cộng tu vi tuần của mọi đệ tử. Bảng làm mới mỗi thứ Hai. Mọi tu vi đều phải đến từ học thật — câu đúng, ôn từ, luận võ, độ kiếp.
          </section>
        </div>
      </main>
    </div>
  );
}
