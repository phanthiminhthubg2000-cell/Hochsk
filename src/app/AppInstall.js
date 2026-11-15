"use client";
// ============================================================
// APP · đăng ký service worker + lời mời cài app (PWA)
// Android/Chrome/Edge: nút "Cài app" dùng beforeinstallprompt. iPhone/iPad (Safari): hướng dẫn Chia sẻ → Thêm vào MH chính.
// Chỉ hiện ở trang chủ, khi chưa cài; bấm "Để sau" thì ẩn 7 ngày.
// ============================================================
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const KEY = "shtv_install_later";
const isStandalone = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function AppInstall() {
  const path = usePathname();
  const [evt, setEvt] = useState(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (isStandalone()) return;
    let later = 0; try { later = +localStorage.getItem(KEY) || 0; } catch (_) {}
    if (Date.now() < later) return;
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); setShow(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => { setShow(false); setEvt(null); };
    window.addEventListener("appinstalled", onInstalled);
    if (isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)) { setIos(true); setShow(true); }
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!show || path !== "/") return null;
  const later = () => { try { localStorage.setItem(KEY, String(Date.now() + 7 * 864e5)); } catch (_) {} setShow(false); setGuide(false); };
  const install = async () => {
    if (ios) { setGuide(true); return; }
    if (!evt) return;
    evt.prompt();
    try { const r = await evt.userChoice; if (r?.outcome === "accepted") setShow(false); } catch (_) {}
    setEvt(null);
  };
  return (
    <div role="dialog" aria-label="Cài app Sơn Hải Thư Viện" className="fixed z-[70] left-3 right-3 bottom-[84px] md:bottom-5 md:left-auto md:right-5 md:w-[380px] rounded-[10px] bg-[#1C1A17] text-[#F3EEE2] shadow-[0_10px_30px_rgba(0,0,0,.35)] border border-[#C9A24E]/60 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} className="w-12 h-12 rounded-[10px] shrink-0" />
        <div className="flex-1 min-w-0">
          <b className="block font-serif-vn text-[16px]">Cài app Sơn Hải Thư Viện</b>
          <span className="block text-[13px] text-[#CFC3A8]">Mở nhanh từ màn hình chính, toàn màn hình, xem lại bài khi mạng yếu.</span>
        </div>
      </div>
      {guide && (
        <ol className="text-[14px] leading-relaxed list-decimal pl-5 text-[#F3EEE2]">
          <li>Bấm nút <b>Chia sẻ</b> <svg viewBox="0 0 24 24" className="inline w-4 h-4 -mt-1" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg> ở thanh dưới của Safari.</li>
          <li>Chọn <b>Thêm vào MH chính</b> (Add to Home Screen).</li>
          <li>Bấm <b>Thêm</b>. Biểu tượng 山 sẽ hiện trên màn hình.</li>
        </ol>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={later} className="h-10 px-4 rounded-md text-sm font-semibold text-[#CFC3A8] hover:text-white">Để sau</button>
        {!guide && <button onClick={install} className="h-10 px-5 rounded-md bg-[#E6B656] text-[#1C1A17] text-sm font-extrabold">{ios ? "Xem cách cài" : "Cài app"}</button>}
      </div>
    </div>
  );
}
