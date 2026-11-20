"use client";
// Thành phần dùng chung cho 玄门学宫 (giao diện tối, viền vàng)
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";
import { PASS, isDone } from "../../lib/hh";
import { PY_DICT } from "../../lib/hh/pydict";

export const C = { bg: "#16181C", panel: "#1E2126", card: "#262A31", line: "#363B45", gold: "#D4AF5F", goldDim: "#8F7642", goldSoft: "#3A3222", text: "#ECE4D3", mute: "#A39C8B", green: "#7CC48A", greenSoft: "#22382A", red: "#E07A63", redSoft: "#3D2420" };

let PY = null;
export function usePy() {
  const [fn, setFn] = useState(() => PY);
  useEffect(() => { if (!PY) import("pinyin-pro").then((m) => { try { m.customPinyin(PY_DICT); } catch {} PY = m.pinyin; setFn(() => m.pinyin); }).catch(() => {}); }, []);
  return (t) => (fn ? fn(t, { type: "string" }) : "");
}

// đọc to bằng giọng máy (zh-CN) — trình duyệt nào không có giọng Trung thì bỏ qua
export function speak(t, rate = 0.85) {
  try {
    const s = window.speechSynthesis; if (!s) return;
    s.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = "zh-CN"; u.rate = rate;
    const v = s.getVoices().find((x) => /zh[-_]CN/i.test(x.lang)) || s.getVoices().find((x) => /^zh/i.test(x.lang)); if (v) u.voice = v;
    s.speak(u);
  } catch {}
}
export function Speak({ t, className = "" }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); speak(t); }} aria-label={"Nghe " + t} title="Nghe đọc"
      className={"shrink-0 w-8 h-8 rounded-full grid place-items-center hover:bg-[#3A3222] text-[#D4AF5F] " + className}>
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
    </button>
  );
}

// Tiến độ: gộp localStorage với users/{uid}.hh (Firestore) — lấy điểm cao hơn
export function useProg() {
  const { u, gain, isSignedIn, loaded } = useTuVi();
  const [loc, setLoc] = useState({});
  useEffect(() => { try { setLoc(JSON.parse(localStorage.getItem("hh_prog") || "{}")); } catch {} }, []);
  const prog = useMemo(() => {
    const r = { ...(u?.hh || {}) };
    for (const k in loc) if (!r[k] || (loc[k].s ?? 0) > (r[k].s ?? 0)) r[k] = loc[k];
    return r;
  }, [u, loc]);
  const save = (id, s) => {
    const old = prog[id]; if (old && old.s >= s) return 0;
    const v = { s, t: Date.now() }; const nl = { ...loc, [id]: v }; setLoc(nl);
    try { localStorage.setItem("hh_prog", JSON.stringify(nl)); } catch {}
    const xp = !isDone(prog, id) && s >= PASS ? 30 : 0;
    gain(xp, { hh: { [id]: v } })?.catch?.(() => {});
    return xp;
  };
  const reset = () => { setLoc({}); try { localStorage.removeItem("hh_prog"); } catch {} };
  const all = u?.role === "teacher" || u?.role === "admin";
  return { prog, save, reset, all, isSignedIn, loaded };
}

export function Shell({ children, title = "Huyền Môn Học Cung", tab }) {
  const TABS = [["home", "学宫首页", "Trang chủ", "/huyen-hoc"], ["course", "修习课程", "Tu luyện", "/huyen-hoc?tab=course"], ["vocab", "词汇典籍", "Từ vựng", "/huyen-hoc?tab=vocab"], ["prog", "修为进度", "Tiến độ", "/huyen-hoc?tab=prog"], ["tool", "法器", "Công cụ", "/huyen-hoc/cong-cu"]];
  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title={title} />
      <main className="max-w-[1100px] mx-auto px-3 md:px-6 pt-4 pb-28 md:pb-14">
        {tab && (
          <nav className="grid grid-cols-5 gap-1.5 mb-5" aria-label="玄门学宫">
            {TABS.map(([k, zh, vi, href]) => (
              <Link key={k} href={href} className="rounded-[6px] border text-center py-2 px-1" style={tab === k ? { background: C.goldSoft, borderColor: C.gold, color: C.gold } : { background: C.panel, borderColor: C.line, color: C.mute }}>
                <span className="block font-zh font-bold text-[13px] md:text-[15px]">{zh}</span><span className="block text-[11px]">{vi}</span>
              </Link>
            ))}
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}

export function Panel({ children, className = "", style }) {
  return <section className={"rounded-[10px] border p-4 md:p-5 " + className} style={{ background: C.panel, borderColor: C.line, ...style }}>{children}</section>;
}
export function H2({ zh, children, right }) {
  return <h2 className="flex items-baseline gap-2 mb-3 text-[18px] md:text-[19px] font-extrabold"><span className="font-zh" style={{ color: C.gold }}>{zh}</span><span className="font-serif-vn">{children}</span>{right && <span className="ml-auto text-[12px] font-normal" style={{ color: C.mute }}>{right}</span>}</h2>;
}
export function Bar({ v, color = C.gold }) {
  return <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color }} /></div>;
}
export const Lock = ({ className = "w-4 h-4" }) => <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
export const Check = ({ className = "w-4 h-4" }) => <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>;

// xáo trộn cố định theo chuỗi (để đáp án đúng không luôn ở vị trí A)
export function seeded(arr, seed) {
  let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
