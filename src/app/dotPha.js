"use client";
// ============================================================
// ĐỘT PHÁ 突破 — màn toàn màn hình khi lên tầng / lên cảnh giới (v2)
// useDotPha(state): so sánh tuViState trước–sau; lần đọc đầu chỉ ghi nhớ, không bật màn.
// ============================================================
import { useEffect, useRef, useState } from "react";

export function useDotPha(state, ready = true) {
  const prev = useRef(null);
  const [ev, setEv] = useState(null);
  useEffect(() => {
    if (!ready || !state) return;
    const key = { idx: state.idx, tang: state.peak ? 10 : state.tang, placed: state.placed };
    const p = prev.current; prev.current = key;
    if (!p || !p.placed || !key.placed) return; // chưa định cảnh giới thì không có đột phá
    if (key.idx > p.idx) setEv({ type: "realm", s: state, k: Date.now() });
    else if (key.idx === p.idx && key.tang > p.tang) setEv({ type: key.tang === 10 ? "peak" : "tang", s: state, k: Date.now() });
  }, [ready, state?.idx, state?.tang, state?.peak, state?.placed]); // eslint-disable-line react-hooks/exhaustive-deps
  return [ev, () => setEv(null)];
}

export function DotPha({ ev, onClose }) {
  useEffect(() => {
    if (!ev) return;
    const t = ev.type === "realm" ? null : setTimeout(onClose, 4200);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { if (t) clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [ev]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ev) return null;
  const s = ev.s; const big = ev.type === "realm";
  const title = big ? "渡劫成功" : ev.type === "peak" ? "巅峰" : "突破";
  const line = big ? `Đột phá lên ${s.vn}` : ev.type === "peak" ? `${s.vn} Đỉnh phong` : `${s.vn} · Tầng ${s.tang}`;
  const sub = big ? `${s.region} đã mở · ${s.hsk}` : ev.type === "peak" ? (s.kiepN ? "Hoàn thành nhiệm vụ cảnh giới rồi lên Độ Kiếp Đài." : s.idx === 0 ? "Hoàn thành nhiệm vụ cảnh giới rồi nhập môn Luyện Khí." : "Tu vi đã viên mãn ở cảnh giới này.") : `Còn ${s.toNext} tu vi lên tầng kế.`;
  return (
    <div role="dialog" aria-modal="true" aria-label={line} onClick={big ? undefined : onClose}
      className="fixed inset-0 z-[90] grid place-items-center overflow-hidden" style={{ background: "radial-gradient(circle at 50% 45%, rgba(60,48,30,.92), rgba(12,11,14,.97))" }}>
      <style>{`@keyframes dpRing{0%{transform:scale(.3);opacity:.9}100%{transform:scale(2.6);opacity:0}}
@keyframes dpIn{0%{transform:scale(1.6);opacity:0;letter-spacing:.4em}100%{transform:scale(1);opacity:1;letter-spacing:.06em}}
@keyframes dpUp{0%{transform:translateY(14px);opacity:0}100%{transform:none;opacity:1}}
@keyframes dpBolt{0%,100%{opacity:0}6%{opacity:1}9%{opacity:.2}12%{opacity:.9}18%{opacity:0}}
@keyframes dpRise{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-70vh);opacity:0}}
@media (prefers-reduced-motion:reduce){.dp *{animation:none!important}}`}</style>
      <div className="dp relative flex flex-col items-center text-center gap-3 px-6 text-[#F6EBD2]">
        {[0, 1, 2].map((i) => <span key={i} aria-hidden="true" className="absolute left-1/2 top-[38%] w-56 h-56 -ml-28 -mt-28 rounded-full border-2 border-[#E6B656]" style={{ animation: `dpRing 2.4s ease-out ${i * 0.5}s infinite` }} />)}
        {big && <svg aria-hidden="true" viewBox="0 0 120 200" className="absolute -top-24 left-1/2 -ml-10 w-20 h-36" style={{ animation: "dpBolt 3s linear infinite" }}><path d="M70 0 L36 90 L62 90 L28 200 L100 70 L72 70 L94 0 Z" fill="#F4D27A" /></svg>}
        {Array.from({ length: 14 }).map((_, i) => <span key={`q${i}`} aria-hidden="true" className="absolute bottom-[-40vh] w-1.5 h-1.5 rounded-full bg-[#F2D58C]" style={{ left: `${(i * 37) % 100 - 50}vw`, animation: `dpRise ${2.6 + (i % 5) * 0.4}s ease-out ${(i % 7) * 0.3}s infinite` }} />)}
        <div className="font-brush text-[72px] md:text-[96px] leading-none text-[#E6B656]" style={{ animation: "dpIn .9s ease-out both", textShadow: "0 0 30px rgba(230,182,86,.55)" }}>{title}</div>
        <div className="font-serif-vn text-[24px] md:text-[30px] font-extrabold" style={{ animation: "dpUp .6s ease-out .5s both" }}>{line}</div>
        <div className="font-brush text-[40px] leading-none text-[#CFC3A8]" aria-hidden="true" style={{ animation: "dpUp .6s ease-out .7s both" }}>{s.zh}{big ? "" : ` · ${s.stageZh}`}</div>
        <p className="text-[15px] text-[#CFC3A8] max-w-[340px]" style={{ animation: "dpUp .6s ease-out .9s both" }}>{sub}</p>
        <button onClick={onClose} className="mt-3 h-12 px-7 rounded-[4px] bg-[#E6B656] text-[#121318] font-serif-vn font-extrabold" style={{ animation: "dpUp .6s ease-out 1.1s both" }}>Tiếp tục tu luyện</button>
      </div>
    </div>
  );
}
