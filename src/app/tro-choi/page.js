"use client";
// ============================================================
// TRANG BỌC TRÒ CHƠI HTML — /tro-choi?g=<tên>
// Mở public/game-<tên>.html trong khung; khi trò kết thúc, trò gửi
//   postMessage({ type: "hg-game-result", game, solo, score, correct, total, level, wrong: [[hz,py,vn]] })
// Trang này lưu kết quả vào game_results (gắn tài khoản) và cộng XP vào users/{uid}.xp.
// ============================================================
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc, addDoc, collection, increment, serverTimestamp } from "firebase/firestore";

const GAMES = {
  "nghieng-dau": { title: "Quiz Nghiêng Đầu", icon: "🙆" },
  "trieu-phu": { title: "Ai là triệu phú", icon: "💰" },
  "san-bo-thu": { title: "Săn bộ thủ", icon: "🔎" },
  "doan-thanh-ngu": { title: "Đoán thành ngữ", icon: "🀄" },
  "duoi-hinh": { title: "Đuổi hình bắt chữ", icon: "🖼️" },
};
const XP_PER_CORRECT = 5, XP_CAP = 100;

export default function GameFrame() {
  const { userId, isLoaded } = useAuth();
  const [g, setG] = useState(null);
  const [toast, setToast] = useState(null);
  const uidRef = useRef(null);
  const frame = useRef(null);
  const lastAt = useRef(0);
  useEffect(() => { uidRef.current = userId || null; }, [userId]);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("g") || "";
    setG(GAMES[k] ? k : "");
  }, []);

  useEffect(() => {
    async function onMsg(e) {
      if (e.origin !== window.location.origin || !e.data || e.data.type !== "hg-game-result") return;
      if (frame.current && e.source !== frame.current.contentWindow) return;
      const now = Date.now(); if (now - lastAt.current < 1500) return; lastAt.current = now; // chống gửi trùng
      const r = e.data;
      const correct = Math.max(0, Math.min(500, +r.correct || 0));
      const xp = r.solo ? Math.min(XP_CAP, correct * XP_PER_CORRECT) : 0;
      const uid = uidRef.current;
      if (!uid) { setToast({ ok: false, msg: "Đăng nhập để lưu kết quả và nhận XP." }); return; }
      try {
        await addDoc(collection(db, "game_results"), {
          game: String(r.game || g), gameName: GAMES[r.game]?.title || String(r.game || ""), uid, personal: true, solo: !!r.solo,
          score: +r.score || 0, correct, total: +r.total || 0, level: String(r.level || ""),
          wrong: Array.isArray(r.wrong) ? r.wrong.slice(0, 40).map((w) => ({ z: String(w[0] || ""), py: String(w[1] || ""), vn: String(w[2] || "") })) : [],
          ...(Array.isArray(r.teams) ? { teams: r.teams.map((x) => +x || 0) } : {}),
          date: new Date().toLocaleDateString("vi-VN"), ts: now, createdAt: serverTimestamp(),
        });
        if (xp > 0) await setDoc(doc(db, "users", uid), { xp: increment(xp) }, { merge: true });
        setToast({ ok: true, msg: xp > 0 ? `✔ Đã lưu kết quả · +${xp} 🍃` : "✔ Đã lưu kết quả" });
      } catch (err) {
        setToast({ ok: false, msg: "Không lưu được kết quả (" + (err.code || err.message) + ")." });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [g]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);

  if (g === null) return null;
  if (!g) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Không tìm thấy trò chơi. <Link href="/?tab=play">Về khu Chơi</Link>
      </div>
    );
  }
  const info = GAMES[g];
  return (
    <div className="fixed inset-0 flex flex-col bg-[#F4F7EF]">
      <div className="h-11 shrink-0 flex items-center gap-3 px-3 border-b border-[#DDE6D3] bg-white text-[#13261C] text-sm">
        <Link href="/?tab=play" className="font-extrabold">‹ Khu Chơi</Link>
        <span className="text-[#9AAB9E]">/</span>
        <span className="font-extrabold truncate">{info.icon} {info.title}</span>
        <span className="ml-auto text-xs font-semibold text-[#5B7262] hidden sm:inline">{isLoaded ? (userId ? "Kết quả sẽ được lưu vào tài khoản" : "Chưa đăng nhập — kết quả không được lưu") : ""}</span>
        <a href={`/game-${g}.html`} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#1E7A45]" title="Mở toàn màn hình trong tab mới">⤢</a>
      </div>
      <iframe ref={frame} src={`/game-${g}.html`} title={info.title} className="flex-1 w-full border-0" allow="camera; fullscreen; autoplay" />
      {toast && (
        <div role="status" className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg ${toast.ok ? "bg-[#1E5C38] text-white" : "bg-[#FDE8E8] text-[#8A1C1C]"}`}>{toast.msg}</div>
      )}
    </div>
  );
}
