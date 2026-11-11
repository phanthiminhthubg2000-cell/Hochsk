"use client";
// ============================================================
// SƠN HẢI DƯ ĐỒ 山海舆图 — bản đồ thế giới 7 vùng (v2 · giai đoạn B)
// Vùng mở theo cảnh giới (tuVi); bấm vùng để xem nội dung, công pháp và Ma Vương của vùng
// ============================================================
import Link from "next/link";
import { useState } from "react";
import GardenNav from "../GardenNav";
import { WorldMap, REGIONS, regionOfRealm } from "../tongMon";
import { REALMS8 } from "../tuVi";
import { useTuVi } from "../useTuVi";
import { BOSSES } from "../ma-vuong/bosses";

const STORY = {
  "pham-nhan": "Làng nhỏ dưới chân núi, nơi chữ đầu tiên của Thiên Thư rơi xuống. Thư sinh học thanh điệu, pinyin, nét chữ — đặt nền cho cả con đường.",
  "thanh-van": "Mây xanh quấn đỉnh, tiếng chuông sớm vọng xuống thung. Ở đây thư sinh luyện khí bằng những câu đầu tiên: chào hỏi, gia đình, số đếm.",
  "kim-dan": "Thung lũng cây vàng, thác bạc. Thư sinh dựng cơ: ngữ pháp vững, hội thoại trôi chảy.",
  "nguyen-anh": "Biển lớn giữa đất liền, đảo hoa đào lơ lửng. Đọc hiểu, nghe hiểu, diễn đạt — Kim Đan thành hình.",
  "van-phap": "Thành có vạn cửa, mỗi cửa một pháp môn. Văn bản dài, ngữ pháp nâng cao.",
  "thien-co": "Tháp quan tinh trên vách đá, nơi người ta đọc cả thiên cơ. Từ chuyên sâu, nghe đọc học thuật, lập luận.",
  "tien-gioi": "Cung khuyết trên mây. Ai tới được đây đã gom gần đủ Vạn Chữ Thiên Thư.",
};

export default function TheGioiPage() {
  const { tv, isSignedIn } = useTuVi();
  const unplaced = !tv || tv.provisional;
  const idx = tv?.idx ?? 0;
  const here = regionOfRealm(idx);
  const [pick, setPick] = useState(null);
  const r = pick || here;
  const locked = Math.min(...r.realms) > idx; const passed = Math.max(...r.realms) < idx;
  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Sơn Hải Dư Đồ" />
      <main className="max-w-[1200px] mx-auto px-4 md:px-8 pt-6 pb-28 md:pb-16 grid gap-6 items-start">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-brush text-[44px] md:text-[54px] leading-none text-[#9E2F22]">山海舆图</h1>
            <span className="font-serif-vn text-[22px] md:text-[26px] font-extrabold">Sơn Hải Dư Đồ</span>
          </div>
          <p className="font-serif-vn italic text-[15px] text-[#3B2F22]">Bảy vùng đất, một con đường. Mỗi vùng mở khi thư sinh độ kiếp thành công ở vùng trước.</p>
          <WorldMap realmIdx={idx} picked={r.key} onPick={setPick} unplaced={unplaced} />
          {unplaced && <p className="tt-card px-4 py-3 text-sm">{isSignedIn ? <>Bạn chưa định cảnh giới nên chưa biết mình ở vùng nào. <Link href="/linh-can" className="font-bold text-[#9E2F22] underline">Lên Trắc Linh Đài</Link> để được xếp theo trình độ thật.</> : "Đăng nhập và lên Trắc Linh Đài để biết mình đang ở vùng nào."}</p>}
        </div>
        <section className="rounded-[14px] bg-[#FBF6EA] border-[1.5px] border-[#3B2F22] p-5 flex flex-col gap-3 shadow-[4px_4px_0_rgba(59,47,34,.3)]" aria-live="polite">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-brush text-[34px] leading-none text-[#9E2F22]">{r.zh}</span>
            <h2 className="font-serif-vn text-[21px] font-extrabold">{r.vn}</h2>
            {!unplaced && <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-[3px] text-white ${locked ? "bg-[#5E5446]" : passed ? "bg-[#2F6E5A]" : "bg-[#9E2F22]"}`}>{locked ? "Chưa mở" : passed ? "Đã qua" : "Bạn đang ở đây"}</span>}
          </div>
          <p className="text-[15px] leading-relaxed text-[#3A352C]">{STORY[r.key]}</p>
          <ul className="flex flex-col gap-2">
            {r.realms.map((x) => { const R = REALMS8[x]; const B = BOSSES[x]; return (
              <li key={x} className="rounded-[6px] border border-[#D8CBAE] bg-white p-3 flex flex-col gap-1">
                <div className="flex items-baseline gap-2"><span className="font-brush text-[22px]">{R.zh}</span><b className="font-serif-vn">{R.vn}</b><span className="text-sm text-[#6B6253]">· {R.hsk}</span></div>
                <div className="text-sm text-[#4A4238]">Công pháp: <span style={{ fontFamily: '"Noto Serif SC",serif' }}>{R.book}</span></div>
                {B && <div className="text-sm text-[#4A4238]">Ma Vương: <b>{B.vn}</b> <span style={{ fontFamily: '"Noto Serif SC",serif' }}>{B.zh}</span></div>}
                <div className="text-sm text-[#4A4238]">Đột phá: {x === 0 ? "đủ Đỉnh phong + nhiệm vụ → nhập môn" : x >= 7 ? "cảnh giới tối cao" : x <= 5 ? `thiên kiếp HSK ${x}` : "thiên kiếp HSK 6 (đề đang chuẩn bị)"}</div>
              </li>
            ); })}
          </ul>
          {locked ? (
            <p className="text-sm font-semibold text-[#7A2218]">Cần đạt {REALMS8[Math.min(...r.realms)].vn} mới vào được vùng này.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Link href="/" className="h-11 px-5 rounded-[6px] bg-[#9E2F22] hover:bg-[#7A2218] text-white font-bold inline-flex items-center">Vào tông môn</Link>
              <Link href={`/ma-vuong?c=${Math.min(...r.realms)}`} className="h-11 px-5 rounded-[6px] border-[1.5px] border-[#1C1A17] font-bold inline-flex items-center">Khiêu chiến Ma Vương</Link>
            </div>
          )}
          <ol className="mt-1 grid grid-cols-7 gap-1" aria-label="Bảy vùng">
            {REGIONS.map((x, i) => <li key={x.key}><button onClick={() => setPick(x)} className={`w-full h-9 rounded-[4px] text-xs font-extrabold ${x.key === r.key ? "bg-[#1C1A17] text-[#F3EEE2]" : Math.min(...x.realms) > idx ? "bg-[#E4DAC4] text-[#8C7F68]" : "bg-[#F3E3D2] text-[#7A2218]"}`} aria-label={x.vn}>{i + 1}</button></li>)}
          </ol>
        </section>
      </main>
    </div>
  );
}
