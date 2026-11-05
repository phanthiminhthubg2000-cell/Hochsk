"use client";
// ============================================================
// GIANG HỒ 江湖 — Thiên Bảng (bảng xếp hạng linh khí) dùng chung cho khu Giang hồ và trang Luận võ
// Đọc users (xp = tu vi, tuVi = cảnh giới), bỏ tài khoản giáo viên/quản trị
// ============================================================
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { tuViState } from "./tuVi";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const shortName = (s) => {
  const p = String(s || "Thư sinh ẩn danh").trim().split(/\s+/);
  return p.length <= 2 ? p.join(" ") : `${p[0]} ${p[p.length - 1]}`; // gọn: họ + tên
};

export function useThienBang(n = 10) {
  const [rows, setRows] = useState(null); // null = đang tải
  const [err, setErr] = useState("");
  useEffect(() => {
    let off = false;
    getDocs(query(collection(db, "users"), orderBy("xp", "desc"), limit(n + 15)))
      .then((snap) => {
        if (off) return;
        const list = [];
        snap.forEach((d) => {
          const u = d.data();
          if (["teacher", "admin"].includes(u.role) || !(u.xp > 0)) return;
          list.push({ id: d.id, name: shortName(u.fullName), xp: u.xp || 0, realm: tuViState(u.xp || 0, u.tuVi, u.doKiep), streak: u.streak || 0, duel: u.luanVo || null });
        });
        setRows(list.slice(0, n));
      })
      .catch((e) => { if (!off) { setErr(e?.message || "Không tải được Thiên Bảng."); setRows([]); } });
    return () => { off = true; };
  }, [n]);
  return { rows, err };
}

export function ThienBang({ n = 10, me, compact = false }) {
  const { rows, err } = useThienBang(n);
  return (
    <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-3" aria-label="Thiên Bảng">
      <div className="flex items-baseline gap-2">
        <span className="font-brush text-[28px] leading-none text-[#9E2F22]" aria-hidden="true">天榜</span>
        <h2 className="font-serif-vn text-[18px] font-extrabold">Thiên Bảng</h2>
        <span className="ml-auto text-xs text-[#6B6253]">xếp theo tu vi</span>
      </div>
      {rows === null ? (
        <p className="text-sm text-[#6B6253] py-3">Đang mở Thiên Bảng…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#6B6253] py-3">{err ? "Chưa xem được Thiên Bảng lúc này." : "Chưa có thư sinh nào ghi danh."}</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((r, i) => {
            const mine = me && r.id === me;
            return (
              <li key={r.id} className={`flex items-center gap-3 py-2 px-2 rounded-md ${mine ? "bg-[#F3E3D2]" : ""} ${i ? "border-t border-[#ECE3D0]" : ""}`}>
                <span className={`w-8 h-8 shrink-0 grid place-items-center rounded-[4px] font-extrabold text-sm ${i === 0 ? "bg-[#9E2F22] text-[#FBF3E4]" : i < 3 ? "bg-[#1C1A17] text-[#F3EEE2]" : "text-[#6B6253]"}`}>{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[15px] truncate">{r.name}{mine && <span className="ml-1.5 text-xs text-[#9E2F22] font-bold">(bạn)</span>}</span>
                  {!compact && <span className="block text-xs text-[#6B6253] truncate">{r.realm.vn}{r.realm.provisional ? "" : ` · ${r.realm.stage}`}{r.duel?.win ? ` · luận võ thắng ${r.duel.win}` : ""}</span>}
                </span>
                <span className="text-sm font-bold text-[#5C3D00] tabular-nums shrink-0">{fmt(r.xp)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
