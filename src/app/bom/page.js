"use client";
// Bom nổ chậm — máy học sinh đã gộp vào trang /choi (dùng chung phần vào phòng).
// Giữ đường dẫn cũ /bom?r=MÃ để mã QR / liên kết cũ vẫn hoạt động.
import { useEffect } from "react";

export default function BombRedirect() {
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("r") || "";
    window.location.replace(r ? `/choi?r=${encodeURIComponent(r)}` : "/choi");
  }, []);
  return <div style={{ padding: 24, fontFamily: "system-ui" }}>Đang chuyển tới phòng chơi…</div>;
}
