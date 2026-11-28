"use client";
import Link from "next/link";

// Lỗi khi đang chạy một trang — thay màn hình trắng bằng lời giải thích + nút thử lại
export default function Error({ error, reset }) {
  return (
    <main className="min-h-screen bg-[#EFE7D6] text-[#1C1A17] grid place-items-center px-6">
      <div className="max-w-md text-center flex flex-col items-center gap-3">
        <span className="font-brush text-[72px] leading-none text-[#9E2F22]" aria-hidden="true">岔气</span>
        <h1 className="font-serif-vn text-2xl font-extrabold">Trang gặp trục trặc</h1>
        <p className="text-[#4A4238]">Có lỗi khi tải trang này. Thường thử lại là được; nếu mạng yếu, đợi một chút rồi bấm “Thử lại”.</p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => reset()} className="tt-btn">Thử lại</button>
          <Link href="/" className="tt-btn ghost">Về Động phủ</Link>
        </div>
        {error?.digest && <p className="text-xs text-[#8A7F6B] mt-2">Mã lỗi: {error.digest}</p>}
        {error?.message && <details className="text-xs text-[#8A7F6B] mt-1 max-w-full"><summary className="cursor-pointer">Chi tiết lỗi (chụp gửi giáo viên)</summary><p className="mt-1 break-all text-left">{String(error.message).slice(0, 300)}</p></details>}
      </div>
    </main>
  );
}
