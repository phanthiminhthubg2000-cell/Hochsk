"use client";
// ============================================================
// THANH ĐIỀU HƯỚNG CHUNG — dùng cho mọi trang con (Từ vựng, Ngữ pháp, Nghe chép, Dịch, Nói, HSKK, Đánh giá…)
// Giống hệt thanh trên của trang chủ: logo · 5 khu (Vườn/Học/Luyện/Thi/Chơi) · chuỗi ngày · lá · tài khoản.
// Trên điện thoại: thanh 5 khu cố định ở đáy màn hình.
// ============================================================
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export const GARDEN_TABS = [
  { key: "home", label: "Vườn", icon: "leaf" },
  { key: "learn", label: "Học", icon: "book" },
  { key: "practice", label: "Luyện", icon: "target" },
  { key: "exam", label: "Thi", icon: "trophy" },
  { key: "play", label: "Chơi", icon: "gamepad" },
];

const PATHS = {
  leaf: <><path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" /><path d="M5 19l7-7" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0z" /><path d="M12 12v4" /><path d="M8 20h8" /><path d="M16 5h3a3 3 0 0 1-3 3" /><path d="M8 5H5a3 3 0 0 0 3 3" /></>,
  gamepad: <><path d="M7 8h10a5 5 0 0 1 4.6 7l-.7 1.6a2.5 2.5 0 0 1-4.3.4L15 15H9l-1.6 2a2.5 2.5 0 0 1-4.3-.4L2.4 15A5 5 0 0 1 7 8z" /><path d="M7 11v3" /><path d="M5.5 12.5h3" /></>,
  flame: <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-8z" />,
  back: <path d="M15 6l-6 6 6 6" />,
};
export const GIcon = ({ name, className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{PATHS[name]}</svg>
);

export const GFrog = ({ className = "w-10 h-8" }) => (
  <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
    <ellipse cx="60" cy="66" rx="50" ry="32" fill="#3DB46D" />
    <ellipse cx="60" cy="74" rx="32" ry="18" fill="#A6E3B4" />
    <circle cx="34" cy="34" r="20" fill="#3DB46D" /><circle cx="86" cy="34" r="20" fill="#3DB46D" />
    <circle cx="34" cy="34" r="13" fill="#FFFFFF" /><circle cx="86" cy="34" r="13" fill="#FFFFFF" />
    <circle cx="37" cy="36" r="6" fill="#13261C" /><circle cx="83" cy="36" r="6" fill="#13261C" />
    <path d="M44 62 Q60 74 76 62" stroke="#13261C" strokeWidth="4" fill="none" strokeLinecap="round" />
    <circle cx="26" cy="60" r="6" fill="#F59BB4" opacity="0.7" /><circle cx="94" cy="60" r="6" fill="#F59BB4" opacity="0.7" />
  </svg>
);

const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k" : String(n || 0));

/**
 * @param active  khu đang ở: "home" | "learn" | "practice" | "exam" | "play"
 * @param title   tên trang con, hiện ở dải thứ hai (tùy chọn)
 * @param right   nội dung thêm ở bên phải dải tiêu đề (tùy chọn)
 */
export default function GardenNav({ active = "practice", title, right }) {
  const { isSignedIn, userId } = useAuth();
  useUser();
  const [streak, setStreak] = useState(0);
  const [leaves, setLeaves] = useState(0);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let off = false;
    getDoc(doc(db, "users", userId)).then((s) => {
      if (off || !s.exists()) return;
      const d = s.data();
      setStreak(d.streak ?? 0);
      setLeaves(d.xp ?? 0);
    }).catch(() => {});
    return () => { off = true; };
  }, [isSignedIn, userId]);

  const href = (k) => (k === "home" ? "/" : `/?tab=${k}`);

  return (
    <>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap");
.hg-nav{font-family:"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.hg-nav a:focus-visible,.hg-nav button:focus-visible{outline:3px solid #2E9D5B;outline-offset:2px}
@media (max-width:767px){body{padding-bottom:76px}}`}</style>
      <header className="hg-nav sticky top-0 z-40 bg-[#F4F7EF]/95 backdrop-blur border-b border-[#DDE6D3] text-[#13261C]">
        <div className="max-w-[1200px] mx-auto h-16 md:h-[72px] px-4 md:px-8 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="HSK Garden — về Vườn">
            <GFrog className="w-10 h-8" />
            <span className="font-extrabold text-lg tracking-tight hidden sm:inline">HSK Garden</span>
          </Link>
          <nav aria-label="Khu chính" className="hidden md:flex items-center gap-1 ml-6 p-1 rounded-2xl bg-[#E3EADB]">
            {GARDEN_TABS.map((t) => (
              <Link key={t.key} href={href(t.key)} aria-current={active === t.key ? "page" : undefined}
                className={`h-10 px-5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold transition-colors ${active === t.key ? "bg-white text-[#1E5C38] shadow-sm" : "text-[#3F5546] hover:text-[#13261C]"}`}>
                <GIcon name={t.icon} />{t.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#FFF4DE] border border-[#F6D99A] text-sm font-bold text-[#7A4A00]" title="Chuỗi ngày học">
              <GIcon name="flame" className="w-4 h-4 text-[#C97A00]" />{streak}<span className="hidden lg:inline font-semibold"> ngày</span>
            </span>
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#E7F5EC] border border-[#BFE3CB] text-sm font-bold text-[#1E5C38]" title="Lá — điểm khu vườn">
              <GIcon name="leaf" className="w-4 h-4 text-[#1E7A45]" />{fmt(leaves)}<span className="hidden lg:inline font-semibold"> lá</span>
            </span>
            {isSignedIn ? (
              <div className="ml-1"><UserButton afterSignOutUrl="/" /></div>
            ) : (
              <SignInButton mode="modal">
                <button className="h-10 px-4 rounded-xl bg-[#2E9D5B] hover:bg-[#1E7A45] text-white text-sm font-bold">Đăng nhập</button>
              </SignInButton>
            )}
          </div>
        </div>
        {title && (
          <div className="border-t border-[#E3EADB] bg-white/70">
            <div className="max-w-[1200px] mx-auto h-12 px-4 md:px-8 flex items-center gap-3">
              <Link href={href(active)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#3F5546] hover:text-[#1E5C38] shrink-0">
                <GIcon name="back" className="w-4 h-4" />{GARDEN_TABS.find((t) => t.key === active)?.label}
              </Link>
              <span className="text-[#C9D6BE]">/</span>
              <h1 className="font-bold text-[15px] truncate">{title}</h1>
              {right && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
            </div>
          </div>
        )}
      </header>
      <nav aria-label="Khu chính" className="hg-nav md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 bg-white border-t border-[#DDE6D3] pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {GARDEN_TABS.map((t) => (
          <Link key={t.key} href={href(t.key)} aria-current={active === t.key ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-1.5 text-xs ${active === t.key ? "text-[#1E7A45] font-bold" : "text-[#5B7262] font-semibold"}`}>
            <GIcon name={t.icon} className="w-6 h-6" />{t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
