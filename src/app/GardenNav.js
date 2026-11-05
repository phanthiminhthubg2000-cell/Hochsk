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
import { weekBump } from "./useTuVi";

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
export const GFrog = ({ className = "w-10 h-8" }) => <span aria-hidden="true" className={`${className} !aspect-square !h-auto shrink-0 grid place-items-center rounded-full bg-[#1C1A17] text-[#E6B656] border-2 border-[#C9A24E] font-brush text-[20px] leading-none`}>师</span>;

const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k" : String(n || 0));

/**
 * @param active  khu đang ở: "home" | "learn" | "practice" | "exam" | "play"
 * @param title   tên trang con, hiện ở dải thứ hai (tùy chọn)
 * @param right   nội dung thêm ở bên phải dải tiêu đề (tùy chọn)
 * @param onTab   (trang chủ) đổi khu tại chỗ thay vì chuyển trang
 * @param lite    (trang chủ) không theo dõi tu vi/đột phá — trang chủ tự làm
 * @param teacher hiện nút Chưởng Môn Điện cho giáo viên
 */
export default function GardenNav({ active = "practice", title, right, onTab, lite = false, teacher = false }) {
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
        const xp = d.xp || 0; const prevXp = lastXp.current; lastXp.current = xp; // ghi trước khi setDoc để không lặp lại khi thông báo đến ngay
        if (!lite && prevXp != null && xp > prevXp) {
          const n = xp - prevXp; const k = Date.now();
          setToast({ n, k }); setTimeout(() => setToast((t) => (t && t.k === k ? null : t)), 2400);
          // Nhận tu vi = có tu luyện hôm nay → giữ chuỗi ngày (trang chủ cũng làm việc này)
          const ns = nextStreak({ streak: d.streak || 0, last: d.lastActiveDay || "", pills: d.pills }, dayKey(), dayNum);
          setDoc(ref, { ...(ns ? { streak: ns.streak, lastActiveDay: ns.last, pills: ns.pills } : {}), ...weekBump(d, n) }, { merge: true }).catch(() => {});
        }
      }, () => {});
    } catch (_) {}
    return () => { try { off(); } catch (_) {} };
  }, [isSignedIn, userId, lite]);
  const tv = u ? tuViState(u.xp || 0, u.tuVi, u.doKiep) : null;
  const [dotPha, closeDotPha] = useDotPha(lite ? null : tv);
  const isTeacher = teacher || ["teacher", "admin"].includes(u?.role);

  const href = (k) => (k === "home" ? "/" : `/?tab=${k}`);
  const Tab = ({ t, mobile }) => {
    const cur = active === t.key ? "page" : undefined;
    const cls = mobile
      ? `flex flex-col items-center gap-0.5 py-1 min-h-[48px] text-[11px] ${cur ? "text-[#F6EBD2] font-bold" : "text-[#A89C84] font-semibold"}`
      : "tt-tab";
    const inner = mobile
      ? <><span className={`font-brush text-[24px] leading-none ${cur ? "text-[#E6B656]" : "text-[#8C7550]"}`} aria-hidden="true">{t.zh}</span>{t.label}</>
      : <><span className="zh" aria-hidden="true">{t.zh}</span><span className="hidden lg:inline">{t.label}</span></>;
    return onTab
      ? <button type="button" onClick={() => onTab(t.key)} aria-current={cur} aria-label={t.label} className={cls}>{inner}</button>
      : <Link href={href(t.key)} aria-current={cur} aria-label={t.label} className={cls}>{inner}</Link>;
  };

  return (
    <>
      <style>{`.hg-nav{font-family:"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.hg-nav a:focus-visible,.hg-nav button:focus-visible{outline:3px solid #E6B656;outline-offset:2px}
@media (max-width:767px){body{padding-bottom:76px}}
@keyframes hgNavPop{0%{transform:translateY(-6px) scale(.9);opacity:0}100%{transform:none;opacity:1}}`}</style>
      {!lite && <DotPha ev={dotPha} onClose={closeDotPha} />}
      <header className="hg-nav tt-bar-top sticky top-0 z-40">
        <div className="max-w-[1320px] mx-auto h-16 md:h-[68px] px-4 md:px-6 flex items-center gap-3 lg:gap-5 min-w-0">
          {onTab ? <button type="button" onClick={() => onTab("home")} className="shrink-0 [&_.flex-col]:!hidden xl:[&_.flex-col]:!flex" aria-label="Sơn Hải Thư Viện — về Động phủ"><BrandMark dark /></button>
            : <Link href="/" className="shrink-0 [&_.flex-col]:!hidden xl:[&_.flex-col]:!flex" aria-label="Sơn Hải Thư Viện — về Động phủ"><BrandMark dark /></Link>}
          <nav aria-label="Khu chính" className="hidden md:flex items-center gap-0.5 min-w-0">
            {GARDEN_TABS.map((t) => <Tab key={t.key} t={t} />)}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <span className="tt-chip" title={`Tu luyện liên tục ${streak} ngày`}>
              <GIcon name="flame" className="w-4 h-4 text-[#E0614A]" />{streak}<span className="hidden 2xl:inline font-semibold">&nbsp;ngày</span>
            </span>
            {tv && !isTeacher && (
              <Link href={tv.provisional ? "/linh-can" : "/de-tu"} className="tt-chip hidden xl:inline-flex" title={tv.provisional ? "Chưa định cảnh giới — lên Trắc Linh Đài" : `${tv.vn} · ${tv.stage} · tu vi ${tv.tv}/${tv.need}`}>
                <span className="zh" aria-hidden="true">{tv.zh}</span><span className="text-[#E6B656]">{tv.provisional ? "chưa định" : tv.stage}</span>
              </Link>
            )}
            <span className="tt-chip gold relative" title="Tu vi">
              <GIcon name="qi" className="w-4 h-4" />{fmt(leaves)}<span className="hidden 2xl:inline font-semibold">&nbsp;tu vi</span>
              {toast && (
                <span key={toast.k} role="status" className="absolute right-0 top-[calc(100%+10px)] z-50 flex items-center gap-2 rounded-md bg-[#1C1A17] border border-[#C9A24E] text-[#F3EEE2] pl-2 pr-3 py-1.5 shadow-lg whitespace-nowrap" style={{ animation: "hgNavPop .35s ease-out" }}>
                  <span className="font-brush text-[20px] text-[#E6B656] leading-none" aria-hidden="true">{el ? elementOf(el).zh : "修"}</span>
                  <span className="text-sm"><b className="text-[#E6B656]">+{toast.n} tu vi</b>{el ? ` · hệ ${elementOf(el).vn}` : ""}</span>
                </span>
              )}
            </span>
            {isTeacher && (
              <Link href="/truong-lao" className="tt-chip hidden sm:inline-flex" title="Chưởng Môn Điện · Trưởng lão">
                <span className="zh" aria-hidden="true">长老</span><span className="hidden xl:inline">Trưởng lão</span>
              </Link>
            )}
            {isSignedIn ? (
              <div className="ml-1"><UserButton afterSignOutUrl="/" /></div>
            ) : (
              <SignInButton mode="modal">
                <button className="h-9 px-4 rounded-[5px] whitespace-nowrap bg-[#9E2F22] hover:bg-[#7A2218] text-white text-sm font-bold">Đăng nhập</button>
              </SignInButton>
            )}
          </div>
        </div>
        {title && (
          <div className="border-t border-[#3A3328] bg-[#2A251E]">
            <div className="max-w-[1320px] mx-auto h-11 px-4 md:px-6 flex items-center gap-3">
              <Link href={href(active)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#CFC3A8] hover:text-[#E6B656] shrink-0">
                <GIcon name="back" className="w-4 h-4" />{GARDEN_TABS.find((t) => t.key === active)?.label}
              </Link>
              <span className="text-[#6B5A3A]">/</span>
              <h1 className="font-serif-vn font-bold text-[15px] truncate text-[#F6EBD2]">{title}</h1>
              {right && <div className="ml-auto flex items-center gap-2 shrink-0 [&_a]:text-[#E6B656]">{right}</div>}
            </div>
          </div>
        )}
      </header>
      <nav aria-label="Khu chính" className="hg-nav md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 bg-[#1C1A17] border-t-2 border-[#9E7A2E] pt-1.5 pb-[max(12px,env(safe-area-inset-bottom))]">
        {GARDEN_TABS.map((t) => <Tab key={t.key} t={t} mobile />)}
      </nav>
    </>
  );
}
