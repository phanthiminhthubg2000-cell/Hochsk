"use client";
// ============================================================
// THANH ĐIỀU HƯỚNG CHUNG — Sơn Hải Thư Viện 山海书院
// Dùng cho mọi trang con (Từ vựng, Ngữ pháp, Nghe chép, Dịch, Nói, HSKK, Đánh giá, Linh căn…)
// Giống thanh trên của trang chủ: logo · 5 khu (Động phủ/Công pháp/Tu luyện/Độ kiếp/Giang hồ) · chuỗi ngày · tu vi · tài khoản.
// Trên điện thoại: thanh 5 khu cố định ở đáy màn hình.
// ============================================================
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { BrandMark, KimThiem, dayKey, dayNum, elementOf } from "./tuTien";
import { tuViState, nextStreak, PAGE_ELEMENT } from "./tuVi";
import { DotPha, useDotPha } from "./dotPha";

export const GARDEN_TABS = [
  { key: "home", label: "Động phủ", zh: "府", icon: "qi" },
  { key: "learn", label: "Công pháp", zh: "法", icon: "book" },
  { key: "practice", label: "Tu luyện", zh: "修", icon: "target" },
  { key: "exam", label: "Độ kiếp", zh: "劫", icon: "trophy" },
  { key: "play", label: "Giang hồ", zh: "江湖", icon: "gamepad" },
];

const PATHS = {
  leaf: <><path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" /><path d="M5 19l7-7" /></>,
  qi: <><path d="M12 3c1.2 4.2 3.6 6.6 7.8 7.8-4.2 1.2-6.6 3.6-7.8 7.8-1.2-4.2-3.6-6.6-7.8-7.8C8.4 9.6 10.8 7.2 12 3z" /><path d="M19 17.5c.4 1.2 1 1.9 2.2 2.3-1.2.4-1.8 1-2.2 2.2-.4-1.2-1-1.8-2.2-2.2 1.2-.4 1.8-1.1 2.2-2.3z" /></>,
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

// Linh thú cũ (Ếch) nay là Kim Thiềm — giữ tên GFrog để các trang con không phải sửa
export const GFrog = ({ className = "w-10 h-8" }) => <KimThiem className={className} />;

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
  const [u, setU] = useState(null); // hồ sơ thư sinh (đọc trực tiếp, cập nhật khi trang con cộng tu vi)
  const [toast, setToast] = useState(null);
  const path = usePathname() || "";
  const el = PAGE_ELEMENT[Object.keys(PAGE_ELEMENT).find((k) => path.startsWith(k)) || ""];
  const lastXp = useRef(null);

  // v2: mọi trang con cùng một thông báo tu vi + chuỗi ngày + màn đột phá
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    const ref = doc(db, "users", userId);
    let off = () => {};
    try {
      off = onSnapshot(ref, (s) => {
        if (!s.exists()) return;
        const d = s.data();
        setU(d); setStreak(d.streak ?? 0); setLeaves(d.xp ?? 0);
        const xp = d.xp || 0;
        if (lastXp.current != null && xp > lastXp.current) {
          const n = xp - lastXp.current; const k = Date.now();
          setToast({ n, k }); setTimeout(() => setToast((t) => (t && t.k === k ? null : t)), 2400);
          // Nhận tu vi = có tu luyện hôm nay → giữ chuỗi ngày (trang chủ cũng làm việc này)
          const ns = nextStreak({ streak: d.streak || 0, last: d.lastActiveDay || "", pills: d.pills }, dayKey(), dayNum);
          if (ns) setDoc(ref, { streak: ns.streak, lastActiveDay: ns.last, pills: ns.pills }, { merge: true }).catch(() => {});
        }
        lastXp.current = xp;
      }, () => {});
    } catch (_) {}
    return () => { try { off(); } catch (_) {} };
  }, [isSignedIn, userId]);
  const tv = u ? tuViState(u.xp || 0, u.tuVi, u.doKiep) : null;
  const [dotPha, closeDotPha] = useDotPha(tv);

  const href = (k) => (k === "home" ? "/" : `/?tab=${k}`);

  return (
    <>
      <style>{`.hg-nav{font-family:"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.hg-nav a:focus-visible,.hg-nav button:focus-visible{outline:3px solid #9E2F22;outline-offset:2px}
@media (max-width:767px){body{padding-bottom:76px}}
@keyframes hgNavPop{0%{transform:translateY(-6px) scale(.9);opacity:0}100%{transform:none;opacity:1}}`}</style>
      <DotPha ev={dotPha} onClose={closeDotPha} />
      <header className="hg-nav sticky top-0 z-40 bg-[#EFE7D6]/95 backdrop-blur border-b border-[#D8CBAE] text-[#1C1A17]">
        <div className="max-w-[1200px] mx-auto h-16 md:h-[72px] px-4 md:px-8 flex items-center gap-4">
          <Link href="/" className="shrink-0" aria-label="Sơn Hải Thư Viện — về Động phủ">
            <BrandMark />
          </Link>
          <nav aria-label="Khu chính" className="hidden md:flex items-center gap-1 ml-4 p-1 rounded-xl bg-[#E4DAC4]">
            {GARDEN_TABS.map((t) => (
              <Link key={t.key} href={href(t.key)} aria-current={active === t.key ? "page" : undefined}
                className={`h-10 px-3 lg:px-4 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] font-semibold transition-colors ${active === t.key ? "bg-[#FBF8F1] text-[#9E2F22] shadow-sm" : "text-[#4A4238] hover:text-[#1C1A17]"}`}>
                <span className="font-brush text-[20px] leading-none" aria-hidden="true">{t.zh}</span>{t.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg whitespace-nowrap border border-[#1C1A17]/70 text-sm font-bold text-[#1C1A17]" title="Tu luyện liên tục (chuỗi ngày)">
              <GIcon name="flame" className="w-4 h-4 text-[#9E2F22]" />{streak}<span className="hidden xl:inline font-semibold"> ngày</span>
            </span>
            {tv && (
              <Link href={tv.provisional ? "/linh-can" : "/"} className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg whitespace-nowrap bg-[#1C1A17] text-[#F3EEE2] text-sm font-bold" title={tv.provisional ? "Chưa định cảnh giới — lên Trắc Linh Đài" : `Tu vi ${tv.tv}/${tv.need} trong cảnh giới`}>
                <span className="font-brush text-[18px] leading-none text-[#E6B656]" aria-hidden="true">{tv.zh}</span>{tv.vn}<span className="hidden lg:inline font-semibold text-[#E6B656]">{tv.provisional ? " · chưa định" : ` · ${tv.stage}`}</span>
              </Link>
            )}
            <span className="relative inline-flex items-center gap-1.5 h-9 px-3 rounded-lg whitespace-nowrap bg-[#F0E3BF] border border-[#D9B970] text-sm font-bold text-[#5C3D00]" title="Tu vi">
              <GIcon name="qi" className="w-4 h-4 text-[#9A6B12]" />{fmt(leaves)}<span className="hidden xl:inline font-semibold"> tu vi</span>
              {toast && (
                <span key={toast.k} role="status" className="absolute right-0 top-[calc(100%+8px)] z-50 flex items-center gap-2 rounded-md bg-[#1C1A17] text-[#F3EEE2] pl-2 pr-3 py-1.5 shadow-lg whitespace-nowrap" style={{ animation: "hgNavPop .35s ease-out" }}>
                  <span className="font-brush text-[20px] text-[#E6B656] leading-none" aria-hidden="true">{el ? elementOf(el).zh : "修"}</span>
                  <span className="text-sm"><b className="text-[#E6B656]">+{toast.n} tu vi</b>{el ? ` · hệ ${elementOf(el).vn}` : ""}</span>
                </span>
              )}
            </span>
            {isSignedIn ? (
              <div className="ml-1"><UserButton afterSignOutUrl="/" /></div>
            ) : (
              <SignInButton mode="modal">
                <button className="h-10 px-4 rounded-lg whitespace-nowrap bg-[#9E2F22] hover:bg-[#7A2218] text-white text-sm font-bold">Đăng nhập</button>
              </SignInButton>
            )}
          </div>
        </div>
        {title && (
          <div className="border-t border-[#E4DAC4] bg-[#FBF8F1]/70">
            <div className="max-w-[1200px] mx-auto h-12 px-4 md:px-8 flex items-center gap-3">
              <Link href={href(active)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#4A4238] hover:text-[#9E2F22] shrink-0">
                <GIcon name="back" className="w-4 h-4" />{GARDEN_TABS.find((t) => t.key === active)?.label}
              </Link>
              <span className="text-[#CDBF9F]">/</span>
              <h1 className="font-bold text-[15px] truncate">{title}</h1>
              {right && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
            </div>
          </div>
        )}
      </header>
      <nav aria-label="Khu chính" className="hg-nav md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 bg-[#FBF8F1] border-t-2 border-[#1C1A17] pt-1.5 pb-[max(12px,env(safe-area-inset-bottom))]">
        {GARDEN_TABS.map((t) => (
          <Link key={t.key} href={href(t.key)} aria-current={active === t.key ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-1 min-h-[48px] text-[11px] ${active === t.key ? "text-[#9E2F22] font-bold" : "text-[#6B6253] font-semibold"}`}>
            <span className="font-brush text-[24px] leading-none" aria-hidden="true">{t.zh}</span>{t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
