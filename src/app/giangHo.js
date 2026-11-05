"use client";
// ============================================================
// GIANG HỒ 江湖 — Thiên Bảng nhiều bảng (v2 · giai đoạn D)
// Tu vi (tổng) · Tuần (users.week) · Chăm chỉ (chuỗi ngày) · Luận võ (số trận thắng) · Bang chiến (tông môn = lớp, tu vi tuần)
// Đọc 200 thư sinh nhiều tu vi nhất rồi xếp các bảng phía máy; bỏ tài khoản giáo viên/quản trị
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { tuViState } from "./tuVi";
import { weekKey } from "./useTuVi";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const shortName = (s) => {
  const p = String(s || "Thư sinh ẩn danh").trim().split(/\s+/);
  return p.length <= 2 ? p.join(" ") : `${p[0]} ${p[p.length - 1]}`; // gọn: họ + tên
};
export const BOARDS = [
  { key: "tu-vi", vn: "Tu vi", unit: "tu vi" },
  { key: "tuan", vn: "Tuần này", unit: "tu vi tuần" },
  { key: "cham", vn: "Chăm chỉ", unit: "ngày liên tục" },
  { key: "luan-vo", vn: "Luận võ", unit: "trận thắng" },
  { key: "bang-chien", vn: "Bang chiến", unit: "tu vi tuần" },
];

let CACHE = null;
export function useGiangHo() {
  const [all, setAll] = useState(CACHE);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (CACHE) return;
    let off = false;
    getDocs(query(collection(db, "users"), orderBy("xp", "desc"), limit(200)))
      .then((snap) => {
        if (off) return;
        const wk = weekKey(); const list = [];
        snap.forEach((d) => {
          const u = d.data();
          if (["teacher", "admin"].includes(u.role)) return;
          list.push({ id: d.id, name: u.daoHieu?.vn || shortName(u.fullName), xp: u.xp || 0, week: u.week?.k === wk ? u.week.xp || 0 : 0, streak: u.streak || 0, win: u.luanVo?.win || 0, tongMon: u.tongMon || null, realm: tuViState(u.xp || 0, u.tuVi, u.doKiep) });
        });
        CACHE = list; setAll(list);
      })
      .catch((e) => { if (!off) { setErr(e?.message || "Không tải được Thiên Bảng."); setAll([]); } });
    return () => { off = true; };
  }, []);
  return { all, err };
}
export function rankBoard(all, key) {
  if (!all) return null;
  if (key === "bang-chien") {
    const m = new Map();
    all.forEach((r) => { if (!r.tongMon?.id) return; const x = m.get(r.tongMon.id) || { id: r.tongMon.id, name: r.tongMon.name, val: 0, n: 0 }; x.val += r.week; x.n += 1; m.set(r.tongMon.id, x); });
    return [...m.values()].sort((a, b) => b.val - a.val).map((x) => ({ ...x, sub: `${x.n} đệ tử` }));
  }
  const f = { "tu-vi": (r) => r.xp, tuan: (r) => r.week, cham: (r) => r.streak, "luan-vo": (r) => r.win }[key];
  return all.filter((r) => f(r) > 0).sort((a, b) => f(b) - f(a)).map((r) => ({ ...r, val: f(r), sub: `${r.realm.vn}${r.realm.provisional ? "" : ` · ${r.realm.stage}`}${r.tongMon ? ` · ${r.tongMon.name}` : ""}` }));
}

export function ThienBang({ n = 10, me, compact = false, tabs = false, board: fixed }) {
  const { all, err } = useGiangHo();
  const [board, setBoard] = useState(fixed || "tu-vi");
  const rows = useMemo(() => { const r = rankBoard(all, board); return r ? r.slice(0, n) : null; }, [all, board, n]);
  const B = BOARDS.find((b) => b.key === board);
  return (
    <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-3" aria-label="Thiên Bảng">
      <div className="flex items-baseline gap-2">
        <span className="font-brush text-[28px] leading-none text-[#9E2F22]" aria-hidden="true">天榜</span>
        <h2 className="font-serif-vn text-[18px] font-extrabold">Thiên Bảng</h2>
        <span className="ml-auto text-xs text-[#6B6253]">xếp theo {B.unit}</span>
      </div>
      {tabs && (
        <div role="tablist" aria-label="Loại bảng" className="flex flex-wrap gap-1.5">
          {BOARDS.map((b) => <button key={b.key} role="tab" aria-selected={board === b.key} onClick={() => setBoard(b.key)} className={`h-8 px-3 rounded-full text-xs font-bold ${board === b.key ? "bg-[#1C1A17] text-[#F3EEE2]" : "border border-[#CDBF9F] text-[#4A4238]"}`}>{b.vn}</button>)}
        </div>
      )}
      {rows === null ? (
        <p className="text-sm text-[#6B6253] py-3">Đang mở Thiên Bảng…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#6B6253] py-3">{err ? "Chưa xem được Thiên Bảng lúc này." : board === "bang-chien" ? "Chưa có tông môn nào ghi danh — gia nhập tông môn ở Đệ Tử Cư Sở." : "Bảng này chưa có ai ghi danh."}</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((r, i) => {
            const mine = me && (r.id === me || (board === "bang-chien" && all?.find((x) => x.id === me)?.tongMon?.id === r.id));
            return (
              <li key={r.id} className={`flex items-center gap-3 py-2 px-2 rounded-md ${mine ? "bg-[#F3E3D2]" : ""} ${i ? "border-t border-[#ECE3D0]" : ""}`}>
                <span className={`w-8 h-8 shrink-0 grid place-items-center rounded-[4px] font-extrabold text-sm ${i === 0 ? "bg-[#9E2F22] text-[#FBF3E4]" : i < 3 ? "bg-[#1C1A17] text-[#F3EEE2]" : "text-[#6B6253]"}`}>{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[15px] truncate">{r.name}{mine && <span className="ml-1.5 text-xs text-[#9E2F22] font-bold">(bạn)</span>}</span>
                  {!compact && <span className="block text-xs text-[#6B6253] truncate">{r.sub}</span>}
                </span>
                <span className="text-sm font-bold text-[#5C3D00] tabular-nums shrink-0">{fmt(r.val)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---------- Bục vinh danh Đấu Pháp Đài (khung ảnh /tt/dauphap-khung.png, toạ độ theo % khung 1024×1536) ----------
export function DauPhapPodium({ me, onFind, board = "luan-vo" }) {
  const { all } = useGiangHo();
  const [b, setB] = useState(board);
  const rows = useMemo(() => rankBoard(all, b) || [], [all, b]);
  const top = rows.slice(0, 3); const rest = rows.slice(3, 7);
  const mi = rows.findIndex((r) => r.id === me); const mine = mi >= 0 ? rows[mi] : null;
  const list = [...rest]; if (mine && mi >= 7) list.push({ ...mine, rank: mi + 1 });
  const seat = [[1, 25.4, 22, 13, 2], [0, 49.8, 14.8, 17, 1], [2, 74.2, 22, 13.5, 3]]; // [chỉ số top, x tâm %, y tâm %, đường kính %, hạng]
  const plate = [[1, 23.2, 38.8], [0, 49.4, 37.6], [2, 77.1, 38.8]];
  const rowsY = [47.2, 52.8, 58.5, 64.1, 69.8];
  const B = BOARDS.find((x) => x.key === b);
  return (
    <section className="relative w-full max-w-[460px] mx-auto aspect-[1024/1536] [container-type:inline-size]" aria-label={`Bục vinh danh Đấu Pháp Đài · ${B.vn}`}>
      <img src="/tt/dauphap-khung.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full" />
      <div role="tablist" aria-label="Loại bảng" className="absolute left-0 right-0 -top-1 flex justify-center gap-1 flex-wrap">
        {BOARDS.filter((x) => x.key !== "bang-chien").map((x) => <button key={x.key} role="tab" aria-selected={b === x.key} onClick={() => setB(x.key)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${b === x.key ? "bg-[#9E2F22] text-white" : "bg-[#FBF8F1]/90 text-[#1C1A17] border border-[#CDBF9F]"}`}>{x.vn}</button>)}
      </div>
      {seat.map(([i, x, y, d, rk]) => { const r = top[i]; return (
        <span key={rk} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full grid place-items-center font-brush text-[#F2D58C]" style={{ left: `${x}%`, top: `${y}%`, width: `${d}%`, aspectRatio: "1", fontSize: `${d * 0.55}cqw`, background: "radial-gradient(circle at 35% 30%,#3A3530,#141210)" }} aria-hidden="true">{r ? [...r.name][0] : "·"}</span>
      ); })}
      {plate.map(([i, x, y]) => { const r = top[i]; return (
        <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 w-[24%] flex flex-col items-center leading-tight text-center text-[#F6EBD2]" style={{ left: `${x}%`, top: `${y}%` }}>
          <b className="font-serif-vn truncate max-w-full" style={{ fontSize: "3.3cqw" }}>{r ? r.name : "—"}</b>
          <span className="text-[#E6C36E] whitespace-nowrap" style={{ fontSize: "2.4cqw" }}>{r ? `${r.realm?.vn || r.sub} · ${fmt(r.val)}` : ""}</span>
        </span>
      ); })}
      {list.slice(0, 5).map((r, k) => (
        <div key={r.id} className={`absolute left-[11%] right-[11%] flex items-center gap-2 ${r.id === me ? "text-[#7A2218]" : "text-[#2B2016]"}`} style={{ top: `${rowsY[k]}%`, height: "5.2%", fontSize: "3.4cqw" }}>
          <span className="w-[9%] text-center font-serif-vn font-extrabold text-[#8C6A3A]">{r.rank || rows.indexOf(r) + 1}</span>
          <span className="flex-1 font-bold truncate">{r.name}{r.id === me ? " (bạn)" : ""}</span>
          <span className="text-[#6B6253]" style={{ fontSize: "2.8cqw" }}>{r.realm?.vn}</span>
          <span className="w-[20%] text-right font-extrabold text-[#5C3D00]">{fmt(r.val)}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="absolute left-[12%] right-[12%] top-[52%] text-center text-[#6B6253]" style={{ fontSize: "3.4cqw" }}>Bảng {B.vn.toLowerCase()} chưa có ai — hãy là người đầu tiên.</p>}
      {onFind && <button onClick={onFind} className="absolute left-[21%] right-[21%] top-[77.5%] h-[6.4%] text-[#FBF3E4] font-extrabold" style={{ fontSize: "4cqw", textShadow: "0 1px 2px rgba(0,0,0,.4)" }}><span style={{ fontFamily: '"Noto Serif SC",serif' }}>战</span> Tìm đối thủ luận võ</button>}
    </section>
  );
}
