"use client";
// Bảng quản lý cũ đã được thay bằng trang Giáo viên (/teacher) — giữ địa chỉ này để link cũ không bị lỗi.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/teacher"); }, [router]);
  return <main className="min-h-screen grid place-items-center bg-[#F4F7EF] text-[#3F5546] font-semibold">Đang chuyển tới trang Giáo viên…</main>;
}
