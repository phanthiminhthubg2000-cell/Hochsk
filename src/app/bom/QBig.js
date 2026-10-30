"use client";
// Phần "đề" to của một câu hỏi — dùng chung cho mọi màn hình trò chơi lớp.
// host: cỡ chữ màn hình chiếu · auto: tự đọc khi là câu Nghe
import { useEffect } from "react";
import { speak } from "./game";

export default function QBig({ q, host = false, auto = false, className = "" }) {
  useEffect(() => { if (auto && q && q.kind === "audio") { const t = setTimeout(() => speak(q.say), 250); return () => clearTimeout(t); } }, [q && q.id, auto]); // eslint-disable-line
  if (!q) return null;
  if (q.kind === "audio") {
    return (
      <div className={`flex justify-center ${host ? "" : "my-2"} ${className}`}>
        <button type="button" onClick={() => speak(q.say)} aria-label="Nghe lại"
          className={`${host ? "w-32 h-32 text-6xl" : "w-24 h-24 text-5xl"} rounded-full bg-[#E7F5EC] border-2 border-[#7BCB9A] grid place-items-center active:scale-95`}>🔊</button>
      </div>
    );
  }
  const cls = host
    ? q.kind === "hz" ? "zh text-6xl md:text-7xl" : q.kind === "def" ? "zh text-2xl md:text-3xl" : "text-4xl md:text-5xl text-[#1E7A45]"
    : q.kind === "hz" ? "zh text-6xl" : q.kind === "def" ? "zh text-xl" : "text-3xl text-[#1E7A45]";
  return <div className={`font-extrabold leading-tight ${cls} ${className}`}>{q.big}</div>;
}
