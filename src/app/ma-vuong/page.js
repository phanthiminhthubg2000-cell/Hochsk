"use client";
// ============================================================
// MA VƯƠNG 魔王 — kiểm tra tổng hợp có thanh HP (v2 · giai đoạn C)
// 20 chiêu (nghĩa · chữ Hán · phiên âm) từ thẻ cấp HSK của cảnh giới, 20 giây mỗi chiêu, 3 hộ thể
// Đúng = gây sát thương (liên chiêu mạnh hơn) · sai / hết giờ = mất một hộ thể · hết HP Ma Vương = thắng
// Thắng lần đầu +150 tu vi + Lệnh bài; các lần sau +30 · câu sai vào Tâm Ma Động
// Lưu: users.maVuong.{idx} = { win, at, best, tries }
// ============================================================
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import GardenNav from "../GardenNav";
import { REALMS8 } from "../tuVi";
import { useTuVi } from "../useTuVi";
import { loadCards, loadLD, saveLD, grade, makeQ, shuffle, speakZh } from "../luyenDan";
import { BOSSES, BOSS_Q, BOSS_LIVES, BOSS_TV } from "./bosses";

const LABELS = ["甲", "乙", "丙", "丁"];
const SEC = 20;

function MaVuong() {
  const sp = useSearchParams();
  const { u, tv, userId, gain, loaded } = useTuVi();
  const myIdx = tv?.idx ?? 0;
  const [c, setC] = useState(null);
  useEffect(() => { if (c == null && loaded && !tv) setC(0); }, [loaded, tv, c]);
  useEffect(() => { if (c == null && tv) { const q = Number(sp.get("c")); setC(Number.isFinite(q) && sp.get("c") !== null ? Math.max(0, Math.min(7, q)) : myIdx); } }, [tv]); // eslint-disable-line react-hooks/exhaustive-deps
  const B = BOSSES[c ?? 0]; const locked = c != null && c > myIdx;
  const [pool, setPool] = useState([]);
  const [st, setSt] = useState(null); // { qs, i, hp, lives, combo, picked, left, log }
  const [end, setEnd] = useState(null);
  const [hit, setHit] = useState(0);
  const timer = useRef(null);
  useEffect(() => { if (B) loadCards(B.lv).then(setPool).catch(() => setPool([])); }, [B?.lv]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    const qs = shuffle(pool).slice(0, BOSS_Q).map((card, i) => makeQ(card, pool, B.modes[i % B.modes.length]));
    setEnd(null); setSt({ qs, i: 0, hp: B.hp, lives: BOSS_LIVES, combo: 0, picked: null, left: SEC, log: [] });
  };
  useEffect(() => {
    clearInterval(timer.current);
    if (!st || st.picked != null || end) return;
    timer.current = setInterval(() => setSt((s) => (s && s.picked == null ? (s.left <= 1 ? resolve(s, -1) : { ...s, left: s.left - 1 }) : s)), 1000);
    return () => clearInterval(timer.current);
  }, [st?.i, st?.picked, end]); // eslint-disable-line react-hooks/exhaustive-deps

  const dmgBase = () => Math.ceil(B.hp / 15);
  function resolve(s, k) {
    const q = s.qs[s.i]; const ok = k === q.right;
    const combo = ok ? s.combo + 1 : 0;
    const dmg = ok ? dmgBase() + (combo >= 3 ? Math.round(dmgBase() * 0.3) : 0) : 0;
    if (ok) setHit((h) => h + 1); else speakZh(q.zh);
    return { ...s, picked: k, combo, hp: Math.max(0, s.hp - dmg), lives: ok ? s.lives : s.lives - 1, lastDmg: dmg, log: [...s.log, { zh: q.zh, ok }] };
  }
  const answer = (k) => { if (st && st.picked == null) setSt(resolve(st, k)); };
  const next = async () => {
    const s = st; const over = s.hp <= 0 || s.lives <= 0 || s.i + 1 >= s.qs.length;
    if (!over) { setSt({ ...s, i: s.i + 1, picked: null, left: SEC }); return; }
    const win = s.hp <= 0; const prev = u?.maVuong?.[c];
    const tvGain = win ? (prev?.win ? 30 : BOSS_TV) : Math.min(20, s.log.filter((x) => x.ok).length);
    setEnd({ win, tvGain, correct: s.log.filter((x) => x.ok).length, total: s.log.length, hpLeft: s.hp });
    // Câu sai → Tâm Ma Động
    const wrong = s.log.filter((x) => !x.ok);
    if (wrong.length) { const ld = await loadLD(userId); wrong.forEach((x) => grade(ld, B.lv, x.zh, false)); await saveLD(userId, ld); }
    const best = Math.max(prev?.best || 0, B.hp - s.hp);
    await gain(tvGain, { maVuong: { [c]: { win: !!(win || prev?.win), at: win ? Date.now() : prev?.at || null, best, tries: (prev?.tries || 0) + 1 } } });
  };

  if (c == null) return <main className="max-w-[640px] mx-auto px-4 pt-10 text-center">Ma Vương đang hiện hình…</main>;
  const q = st?.qs[st.i];
  return (
    <main className="max-w-[680px] mx-auto px-4 pt-5 pb-28 md:pb-16 flex flex-col gap-4">
      <style>{`@keyframes mvShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}@keyframes mvDmg{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-40px);opacity:0}}@keyframes mvSlash{0%{opacity:0;transform:scaleX(.2)}30%{opacity:1}100%{opacity:0;transform:scaleX(1)}}@media (prefers-reduced-motion:reduce){.mv-a{animation:none!important}}`}</style>
      <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Chọn Ma Vương">
        {BOSSES.map((b) => <button key={b.idx} role="tab" aria-selected={c === b.idx} onClick={() => { setC(b.idx); setSt(null); setEnd(null); }} disabled={!!st && !end}
          className={`h-9 px-3 rounded-full text-xs font-bold ${c === b.idx ? "bg-[#C9472F] text-white" : b.idx > myIdx ? "bg-[#2A2230] text-[#6B6273]" : "bg-[#3A2E40] text-[#E9DDF0]"}`}>{REALMS8[b.idx].vn}{u?.maVuong?.[b.idx]?.win ? " ✓" : b.idx > myIdx ? " 🔒" : ""}</button>)}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap"><span className="font-brush text-[30px] text-[#E0614A] leading-none">{B.zh}</span><h1 className="font-serif-vn text-[19px] font-extrabold">{B.vn}</h1><span className="ml-auto text-xs text-[#B5AC9A]">Ma Vương {REALMS8[c].vn} · {REALMS8[c].hsk.split(" · ")[0]}</span></div>
      <div className="relative h-5 rounded-[3px] bg-[#3A2E40] border-[1.5px] border-[#C9472F] overflow-hidden" role="meter" aria-label="Máu Ma Vương" aria-valuemin={0} aria-valuemax={B.hp} aria-valuenow={st ? st.hp : B.hp}>
        <div className="h-full transition-all duration-500" style={{ width: `${((st ? st.hp : B.hp) / B.hp) * 100}%`, background: "linear-gradient(90deg,#7A2218,#C9472F)" }} />
        <span className="absolute inset-0 grid place-items-center text-[11px] font-extrabold">HP {st ? st.hp : B.hp} / {B.hp}</span>
      </div>
      <div key={hit} className="mv-a relative rounded-[14px] overflow-hidden aspect-[761/420]" style={{ animation: hit ? "mvShake .35s ease-in-out" : undefined }}>
        <img src="/tt/mavuong.jpg" alt={`Ma Vương ${B.vn}`} className="absolute inset-0 w-full h-full object-cover object-[30%_50%]" style={{ filter: `hue-rotate(${B.hue}deg)${end?.win ? " grayscale(1) brightness(.6)" : ""}` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(transparent 65%, #1A1420)" }} />
        {hit > 0 && st?.lastDmg > 0 && <>
          <span aria-hidden="true" className="mv-a absolute left-[20%] right-[10%] top-[45%] h-1.5 rounded-full bg-[#FFF3C4] shadow-[0_0_18px_6px_rgba(230,182,86,.7)] -rotate-[20deg]" style={{ animation: "mvSlash .5s ease-out forwards" }} />
          <span aria-hidden="true" className="mv-a absolute right-6 top-4 text-[30px] font-extrabold text-[#FFE08A]" style={{ textShadow: "0 2px 0 #7A2218", animation: "mvDmg .9s ease-out forwards" }}>−{st.lastDmg}</span>
        </>}
        {!st && !end && <p className="absolute left-4 bottom-3 right-4 font-serif-vn italic text-[15px] text-[#F1E6FF]">“{B.line}”</p>}
        {end && <div className="absolute inset-0 grid place-items-center"><span className="font-brush text-[64px] text-[#E6B656]" style={{ textShadow: "0 0 24px rgba(0,0,0,.8)" }}>{end.win ? "降魔" : "败退"}</span></div>}
      </div>

      {locked && !st && <p className="rounded-[10px] bg-[#2A2230] p-4 text-sm">Ma Vương này canh giữ {REALMS8[c].region}. Cần đạt {REALMS8[c].vn} mới khiêu chiến được.</p>}
      {!locked && !st && !end && (
        <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-3">
          <p className="text-[15px] leading-relaxed"><b>{BOSS_Q} chiêu</b> trộn nghĩa, chữ Hán{B.modes.includes("am") ? ", phiên âm" : ""} · {SEC} giây mỗi chiêu · <b>{BOSS_LIVES} hộ thể</b>. Đúng là chém, liên chiêu 3 lần trở lên sát thương mạnh hơn. Hạ Ma Vương lần đầu được <b>+{BOSS_TV} tu vi</b> và Lệnh bài.</p>
          {u?.maVuong?.[c] && <p className="text-sm text-[#6B6253]">Đã khiêu chiến {u.maVuong[c].tries || 1} lần{u.maVuong[c].win ? " · đã hạ ✓" : ` · gây tối đa ${u.maVuong[c].best || 0} sát thương`}.</p>}
          <button onClick={start} disabled={pool.length < 8} className="h-14 rounded-[8px] bg-[#C9472F] hover:bg-[#A63A26] disabled:bg-[#8C7F68] text-white font-serif-vn text-[17px] font-extrabold">Khiêu chiến</button>
        </section>
      )}
      {st && q && !end && (
        <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-4 flex flex-col gap-3" aria-label="Giao chiến">
          <div className="flex items-center gap-3 text-xs text-[#6B6253]">
            <span>Chiêu {st.i + 1}/{st.qs.length}</span>
            <span className="flex gap-1" aria-label={`Còn ${st.lives} hộ thể`}>{Array.from({ length: BOSS_LIVES }).map((_, i) => <span key={i} className={`w-3.5 h-3.5 rounded-full ${i < st.lives ? "bg-[#C9472F]" : "border border-[#C9472F]"}`} />)}</span>
            {st.combo >= 2 && <span className="font-extrabold text-[#9E2F22]">liên chiêu ×{st.combo}</span>}
            <span className={`ml-auto font-bold tabular-nums ${st.left <= 5 ? "text-[#9E2F22]" : ""}`}>⏱ {st.left}s</span>
          </div>
          <div className="text-center text-xs text-[#6B6253]">{q.sub}</div>
          <div className="text-center"><span className={q.mode === "han" ? "text-[22px] font-bold" : "text-[46px] leading-tight"} style={q.mode === "han" ? undefined : { fontFamily: '"Noto Serif SC",serif' }}>{q.ask}</span></div>
          <div role="radiogroup" aria-label="Đáp án" className="grid grid-cols-2 gap-2">
            {q.opts.map((o, k) => { const show = st.picked != null; const right = k === q.right; const mine = k === st.picked; return (
              <button key={k} role="radio" aria-checked={mine} onClick={() => answer(k)} disabled={show}
                className={`min-h-[50px] px-2 rounded-[6px] flex items-center gap-2 text-left border ${show && right ? "border-2 border-[#2F6E5A] bg-[#DDEBE4]" : show && mine ? "border-2 border-[#9E2F22] bg-[#F6DCD6]" : "border-[#1C1A17]/60 bg-white hover:border-[#C9472F]"}`}>
                <span className="w-6 h-6 shrink-0 grid place-items-center rounded-[3px] bg-[#EFE7D6] font-brush text-[15px]" aria-hidden="true">{LABELS[k]}</span>
                <span className="text-[15px]" style={/[一-鿿]/.test(o) ? { fontFamily: '"Noto Serif SC",serif' } : undefined}>{o}</span>
              </button>); })}
          </div>
          {st.picked != null && (
            <div className="flex items-center gap-3" role="status">
              <span className={`flex-1 text-sm font-semibold ${st.picked === q.right ? "text-[#2F6E5A]" : "text-[#9E2F22]"}`}>{st.picked === q.right ? `Trúng đòn −${st.lastDmg}` : `${st.picked === -1 ? "Hết giờ" : "Trượt"} — ${q.zh} · ${q.py} · ${q.vn}`}</span>
              <button onClick={next} className="h-11 px-5 rounded-[6px] bg-[#1C1A17] text-[#F3EEE2] font-bold">{st.hp <= 0 || st.lives <= 0 || st.i + 1 >= st.qs.length ? "Kết trận" : "Chiêu kế"}</button>
            </div>
          )}
        </section>
      )}
      {end && (
        <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-3 items-center text-center">
          <h2 className="font-serif-vn text-[21px] font-extrabold">{end.win ? `Hạ ${B.vn}!` : end.hpLeft > 0 && end.total >= BOSS_Q ? "Ma Vương còn sống sót" : "Hộ thể vỡ — tạm lui"}</h2>
          <p>Đúng <b>{end.correct}/{end.total}</b> · <b className="text-[#5C3D00]">+{end.tvGain} tu vi</b>{end.win && !(u?.maVuong?.[c]?.tries > 1) ? " · Lệnh bài Ma Vương vào túi" : ""}</p>
          {end.correct < end.total && <p className="text-sm text-[#6B6253]">{end.total - end.correct} từ trượt đã vào Tâm Ma Động.</p>}
          <div className="flex gap-2 w-full">
            <Link href="/tam-ma" className="flex-1 h-12 rounded-[6px] border-[1.5px] border-[#1C1A17] font-bold inline-flex items-center justify-center">Tâm Ma Động</Link>
            <button onClick={start} className="flex-[2] h-12 rounded-[6px] bg-[#C9472F] text-white font-extrabold">Đánh lại</button>
          </div>
        </section>
      )}
    </main>
  );
}

export default function MaVuongPage() {
  return (
    <div className="min-h-screen bg-[#1A1420] text-[#EFE7D6]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="practice" title="Ma Vương" />
      <Suspense fallback={null}><MaVuong /></Suspense>
    </div>
  );
}
