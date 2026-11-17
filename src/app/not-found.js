import Link from "next/link";

// Trang không tồn tại (404) — cùng phong cách Sơn Hải Thư Viện
export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#EFE7D6] text-[#1C1A17] grid place-items-center px-6">
      <div className="max-w-md text-center flex flex-col items-center gap-3">
        <span className="font-brush text-[72px] leading-none text-[#9E2F22]" aria-hidden="true">迷路</span>
        <h1 className="font-serif-vn text-2xl font-extrabold">Lạc đường rồi</h1>
        <p className="text-[#4A4238]">Trang bạn tìm không có trong thư viện. Có thể đường dẫn đã cũ hoặc gõ nhầm.</p>
        <div className="flex gap-2 mt-2">
          <Link href="/" className="tt-btn">Về Động phủ</Link>
          <Link href="/?tab=learn" className="tt-btn ghost">Mở Công pháp</Link>
        </div>
      </div>
    </main>
  );
}
