"use client";
// THỜI KHOÁ BIỂU — học viên xem lịch, bấm buổi để mở bài giảng; giáo viên/quản trị sửa được ngay tại đây
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";
import Schedule from "./Schedule";

export default function TkbPage() {
  const { u } = useTuVi();
  const editable = u?.role === "teacher" || u?.role === "admin";
  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Thời khoá biểu" />
      <main className="max-w-[1280px] mx-auto px-3 md:px-6 pt-5 pb-28 md:pb-14">
        <Schedule editable={editable} />
      </main>
    </div>
  );
}
