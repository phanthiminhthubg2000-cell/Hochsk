"use client";
// Bí cảnh nay nằm trong khu Tu luyện của Động phủ (tránh hai trang trùng nhau)
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function BiCanhPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/?tab=practice"); }, [router]);
  return <p style={{ padding: 24, fontFamily: "system-ui" }}>Đang mở Tu luyện…</p>;
}
