"use client";
// ============================================================
// BÍ CẢNH 秘境 — bảy bí cảnh theo kỹ năng (v2 · giai đoạn C)
// Mỗi bí cảnh là một trang luyện sẵn có, khoác tên tu tiên + hệ ngũ hành; tầng bí cảnh = cảnh giới hiện tại
// ============================================================
import Link from "next/link";
import GardenNav from "../GardenNav";
import { elementOf } from "../tuTien";
import { useTuVi } from "../useTuVi";

const BI_CANH = [
  { key: "van-tu", zh: "万字秘境", vn: "Vạn Từ Bí Cảnh", el: "moc", href: "/vocab", d: "Thẻ từ vựng theo bài, học từ mới và ôn tập." },
  { key: "van-tuong", zh: "万象林", vn: "Vạn Tượng Lâm", el: "moc", href: "/topic", d: "Từ vựng theo chủ đề đời sống." },
  { key: "thien-am", zh: "天音谷", vn: "Thiên Âm Cốc", el: "kim", href: "/dictation", d: "Nghe chép chính tả — luyện tai." },
  { key: "van-tu-thap", zh: "文字塔", vn: "Văn Tự Tháp", el: "thuy", href: "/translate", d: "Dịch và đọc hiểu câu." },
  { key: "thien-co", zh: "天机阵", vn: "Thiên Cơ Trận", el: "tho", href: "/arrange", d: "Sắp xếp câu, vững ngữ pháp." },
  { key: "khau-ngu", zh: "口语台", vn: "Khẩu Ngữ Đài", el: "hoa", href: "/roleplay", d: "Nhập vai hội thoại với AI." },
  { key: "thien-ngon", zh: "天言殿", vn: "Thiên Ngôn Điện", el: "hoa", href: "/hskk", d: "Phòng thi nói HSKK." },
];

export default function BiCanhPage() {
  const { tv } = useTuVi();
  const tang = (tv?.idx || 0) + 1;
  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="practice" title="Bí Cảnh" />
      <main className="max-w-[1100px] mx-auto px-4 md:px-8 pt-6 pb-28 md:pb-16 flex flex-col gap-5">
        <div className="flex items-baseline gap-3 flex-wrap"><h1 className="font-brush text-[44px] leading-none text-[#2F6E5A]">秘境</h1><span className="font-serif-vn text-[24px] font-extrabold">Bí Cảnh</span><span className="text-sm text-[#6B6253]">Bạn đang ở tầng {tang} · mỗi lần độ kiếp mở tầng sâu hơn</span></div>
        <p className="text-[15px] text-[#4A4238] max-w-[720px]">Bảy bí cảnh, mỗi nơi luyện một kỹ năng và nuôi một hệ ngũ hành. Tu vi nhận trong bí cảnh hiện ngay trên thanh trên cùng.</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BI_CANH.map((b) => { const e = elementOf(b.el); return (
            <li key={b.key}>
              <Link href={b.href} className="group h-full rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] hover:border-[#2F6E5A] p-5 flex flex-col gap-2 shadow-[3px_3px_0_rgba(47,110,90,.25)]">
                <div className="flex items-center gap-3"><span className="font-brush text-[34px] leading-none text-[#2F6E5A]">{e.zh}</span><span className="flex flex-col"><b className="font-serif-vn text-[17px]">{b.vn}</b><span className="text-xs text-[#6B6253]" style={{ fontFamily: '"Noto Serif SC",serif' }}>{b.zh} · hệ {e.vn}</span></span><span className="ml-auto text-xs font-bold px-2 py-0.5 rounded bg-[#1C1A17] text-[#F3EEE2]">Tầng {tang}</span></div>
                <p className="text-sm text-[#4A4238]">{b.d}</p>
                <span className="mt-auto text-sm font-bold text-[#2F6E5A] group-hover:underline">Vào bí cảnh →</span>
              </Link>
            </li>
          ); })}
        </ul>
      </main>
    </div>
  );
}
