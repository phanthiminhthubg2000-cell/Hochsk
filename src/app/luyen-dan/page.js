"use client";
// ============================================================
// LUYỆN ĐAN PHÒNG 炼丹房 — ôn từ vựng kiểu Leitner (v2 · giai đoạn C)
// Một lò = 10 từ (đến hạn trước, rồi từ mới của cấp đang tu). Từ mới xem thẻ trước rồi mới luyện.
// Tu vi: +2 / từ mới đúng, +3 / từ ôn đúng, +20 khi một từ lên Viên mãn; hệ Mộc yếu ×1,5; Trúc Cơ Đan ×2
// Thành đan theo kết quả lò: Tụ Khí (≥5 đúng) · Trúc Cơ (≥80%) · Kim Đan (≥90%) · Cửu Chuyển (≥95% có ≥5 từ ôn)
// ============================================================
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { increment } from "firebase/firestore";
import GardenNav from "../GardenNav";
import { judgeLinhCan } from "../tuTien";
import { useTuVi } from "../useTuVi";
import { loadCards, loadLD, saveLD, ldStats, pickBatch, grade, makeQ, speakZh, danOfBatch, levelKeyOfRealm, LEVEL_NAME, wkey, today, BOX_DAYS } from "../luyenDan";

const LEVELS = ["hsk1", "hsk2", "hsk3", "hsk4", "hsk5", "hsk6", "hsk7-9"];
const MODES = ["nghia", "nghia", "han", "am"];
const LABELS = ["甲", "乙", "丙", "丁"];

export default function LuyenDanPage() {
  const { u, tv, userId, gain } = useTuVi();
  const [lv, setLv] = useState(null);
  const [cards, setCards] = useState([]);
  const [ld, setLd] = useState(null);
  const [run, setRun] = useState(null); // { items, i, phase: "the"|"hoi", q, picked, ok, log: [] }
  const [done, setDone] = useState(null);
  useEffect(() => { if (tv && !lv) setLv(levelKeyOfRealm(tv.idx)); }, [tv]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!tv && !lv) { const t = setTimeout(() => setLv((x) => x || "hsk1"), 1500); return () => clearTimeout(t); } }, [tv, lv]);
  useEffect(() => { if (lv) loadCards(lv).then(setCards).catch(() => setCards([])); }, [lv]);
  useEffect(() => { loadLD(userId).then(setLd); }, [userId]);

  const st = ld ? ldStats(ld) : null;
  const lvStat = useMemo(() => {
    if (!ld || !cards.length) return null; const t = today(); let due = 0, seen = 0, vm = 0;
    cards.forEach((c) => { const v = ld.w[wkey(lv, c[0])]; if (v) { seen++; if (v[0] >= 6) vm++; else if (v[1] <= t) due++; } });
    return { due, seen, vm, total: cards.length };
  }, [ld, cards, lv]);
  const weakMoc = u?.linhCan?.scores && judgeLinhCan(u.linhCan.scores).weak === "moc";
  const boost = (u?.boostUntil || 0) > Date.now();
  const mult = (weakMoc ? 1.5 : 1) * (boost ? 2 : 1);

  const start = () => {
    const items = pickBatch(ld, cards, lv, 10);
    if (!items.length) return;
    setDone(null);
    setRun({ items, i: 0, phase: items[0].isNew ? "the" : "hoi", q: items[0].isNew ? null : makeQ(items[0].c, cards, MODES[Math.floor(Math.random() * MODES.length)]), picked: null, log: [] });
  };
  const toQuiz = () => setRun((r) => ({ ...r, phase: "hoi", q: makeQ(r.items[r.i].c, cards, "nghia") }));
  const answer = (k) => {
    if (!run || run.picked != null) return;
    const it = run.items[run.i]; const ok = k === run.q.right;
    const before = ld.w[wkey(lv, it.c[0])]?.[0] || 0;
    const v = grade(ld, lv, it.c[0], ok);
    setRun({ ...run, picked: k, log: [...run.log, { zh: it.c[0], ok, isNew: it.isNew, box: v[0], vm: ok && before < 6 && v[0] >= 6 }] });
    if (!ok) speakZh(it.c[0]);
  };
  const next = async () => {
    const i = run.i + 1;
    if (i < run.items.length) { const it = run.items[i]; setRun({ ...run, i, phase: it.isNew ? "the" : "hoi", q: it.isNew ? null : makeQ(it.c, cards, MODES[Math.floor(Math.random() * MODES.length)]), picked: null }); return; }
    // Kết lò
    const log = run.log; const correct = log.filter((x) => x.ok).length; const reviewed = log.filter((x) => x.ok && !x.isNew).length;
    const base = log.reduce((a, x) => a + (x.ok ? (x.isNew ? 2 : 3) : 0) + (x.vm ? 20 : 0), 0);
    const tvGain = Math.round(base * mult);
    const dan = danOfBatch(correct, log.length, reviewed);
    setDone({ correct, total: log.length, tvGain, dan, log });
    setRun(null);
    await saveLD(userId, ld); setLd({ ...ld });
    const extra = dan ? (dan.key === "trucCo" ? { pills: { trucCo: increment(1) } } : { danDuoc: { [dan.key]: increment(1) } }) : {};
    await gain(tvGain, extra);
  };

  const cur = run?.items[run.i];
  return (
    <div className="min-h-screen bg-[#2A1F1A] text-[#EFE7D6]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="practice" title="Luyện Đan Phòng" />
      <style>{`@keyframes ldFlick{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.15);opacity:1}}@media (prefers-reduced-motion:reduce){.ld-a{animation:none!important}}`}</style>
      <main className="max-w-[720px] mx-auto px-4 pt-5 pb-28 md:pb-16 flex flex-col gap-4">
        <div className="relative rounded-[16px] overflow-hidden aspect-[765/360] max-h-[320px]">
          <img src="/tt/luyendan.jpg" alt="Lò luyện đan bằng đồng có hai rồng, lửa vàng bốc lên trong phòng đan" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(rgba(42,31,26,.55), transparent 35%, transparent 65%, #2A1F1A)" }} />
          <div aria-hidden="true" className="ld-a absolute left-[42%] top-[38%] w-[16%] aspect-square rounded-full mix-blend-screen" style={{ background: "radial-gradient(closest-side, rgba(255,214,120,.75), transparent)", animation: "ldFlick 1.3s ease-in-out infinite" }} />
          <div className="absolute left-4 top-3 flex items-baseline gap-2"><span className="font-brush text-[34px] text-[#E6B656] leading-none">炼丹房</span><span className="font-serif-vn text-[18px] font-extrabold">Luyện Đan Phòng</span></div>
          {run && <div className="absolute right-4 top-4 text-sm font-bold bg-black/40 rounded px-2 py-0.5">lò {run.i + 1}/{run.items.length}</div>}
        </div>

        {!run && !done && (
          <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Cấp dược liệu">
              {LEVELS.map((x) => <button key={x} role="tab" aria-selected={lv === x} onClick={() => setLv(x)} className={`h-9 px-3 rounded-full text-sm font-bold ${lv === x ? "bg-[#1C1A17] text-[#F3EEE2]" : "border border-[#CDBF9F]"}`}>{LEVEL_NAME[x]}</button>)}
            </div>
            {lvStat ? (
              <div className="grid grid-cols-4 gap-2 text-center">
                {[["Đến hạn", lvStat.due, "#9E2F22"], ["Đã luyện", lvStat.seen, "#1C1A17"], ["Viên mãn", lvStat.vm, "#2F6E5A"], ["Cả cấp", lvStat.total, "#6B6253"]].map(([l, n, c]) => (
                  <div key={l} className="rounded-[8px] bg-white border border-[#E4DAC4] py-2"><b className="block text-[20px]" style={{ color: c }}>{n}</b><span className="text-xs">{l}</span></div>
                ))}
              </div>
            ) : <p className="text-sm text-[#6B6253]">Đang mở lò…</p>}
            <p className="text-sm text-[#4A4238] leading-relaxed">Mỗi lò 10 từ: từ <b>đến hạn ôn</b> trước, sau đó từ mới. Đúng thì từ lên hộp (ôn sau {BOX_DAYS.slice(1, 6).join(", ")} ngày); sai thì về hộp 1 và vào <Link href="/tam-ma" className="underline font-semibold">Tâm Ma Động</Link>.{weakMoc ? " Hệ Mộc là tâm ma của bạn — tu vi ở đây ×1,5." : ""}{boost ? " Trúc Cơ Đan đang có hiệu lực: ×2." : ""}</p>
            <button onClick={start} disabled={!lvStat || !cards.length} className="h-14 rounded-[8px] bg-[#9E2F22] hover:bg-[#7A2218] disabled:bg-[#8C7F68] text-white font-serif-vn text-[17px] font-extrabold">Khai lò luyện đan</button>
            {st && <p className="text-xs text-[#6B6253]">Toàn bộ: {st.total} từ đã vào lò · {st.learned} từ nhớ vững · {st.tamMa} tâm ma.</p>}
          </section>
        )}

        {run && cur && run.phase === "the" && (
          <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-3 items-center text-center" aria-label="Thẻ từ mới">
            <span className="text-xs font-bold tracking-[0.12em] text-[#6B6253]">DƯỢC LIỆU MỚI · LĨNH NGỘ</span>
            <button onClick={() => speakZh(cur.c[0])} className="text-[64px] leading-tight" style={{ fontFamily: '"Noto Serif SC",serif' }} lang="zh-CN" aria-label={`Nghe ${cur.c[0]}`}>{cur.c[0]}</button>
            <span className="text-[18px] text-[#7A2218] font-semibold">{cur.c[1]}</span>
            <span className="text-[17px] font-bold">{cur.c[2]}</span>
            {cur.c[3] && <span className="text-[16px] text-[#4A4238]" style={{ fontFamily: '"Noto Serif SC",serif' }} lang="zh-CN">{cur.c[3]}</span>}
            <div className="flex gap-2 w-full mt-2">
              <button onClick={() => speakZh(cur.c[3] || cur.c[0])} className="flex-1 h-12 rounded-[6px] border-[1.5px] border-[#1C1A17] font-bold">🔊 Nghe</button>
              <button onClick={toQuiz} className="flex-[2] h-12 rounded-[6px] bg-[#1C1A17] text-[#F3EEE2] font-bold">Đã nhớ — luyện</button>
            </div>
          </section>
        )}

        {run && cur && run.phase === "hoi" && run.q && (
          <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-3" aria-label="Luyện đan">
            <div className="flex justify-between text-xs text-[#6B6253]"><span>{LEVEL_NAME[lv]} · {cur.isNew ? "từ mới" : "ôn tập"}</span><span>{run.q.sub}</span></div>
            <div className="text-center py-2"><span className={run.q.mode === "han" ? "text-[22px] font-bold" : "text-[52px] leading-tight"} style={run.q.mode === "han" ? undefined : { fontFamily: '"Noto Serif SC",serif' }} lang={run.q.mode === "han" ? undefined : "zh-CN"}>{run.q.ask}</span></div>
            <div role="radiogroup" aria-label="Đáp án" className="grid sm:grid-cols-2 gap-2">
              {run.q.opts.map((o, k) => {
                const show = run.picked != null; const right = k === run.q.right; const mine = k === run.picked;
                return <button key={k} role="radio" aria-checked={mine} onClick={() => answer(k)} disabled={show}
                  className={`min-h-[52px] px-3 rounded-[6px] flex items-center gap-2 text-left border transition-colors ${show && right ? "border-2 border-[#2F6E5A] bg-[#DDEBE4]" : show && mine ? "border-2 border-[#9E2F22] bg-[#F6DCD6]" : "border-[#1C1A17]/60 bg-white hover:border-[#9E2F22]"}`}>
                  <span className="w-7 h-7 shrink-0 grid place-items-center rounded-[3px] bg-[#EFE7D6] font-brush text-[17px]" aria-hidden="true">{LABELS[k]}</span>
                  <span className="text-[16px]" style={/[一-鿿]/.test(o) ? { fontFamily: '"Noto Serif SC",serif' } : undefined}>{o}</span>
                </button>;
              })}
            </div>
            {run.picked != null && (
              <div className="flex items-center gap-3" role="status">
                <span className={`flex-1 text-sm font-semibold ${run.picked === run.q.right ? "text-[#2F6E5A]" : "text-[#9E2F22]"}`}>{run.picked === run.q.right ? "Thành đan một vị!" : `Hỏng một vị — ${run.q.zh} · ${run.q.py} · ${run.q.vn}`}</span>
                <button onClick={next} className="h-11 px-5 rounded-[6px] bg-[#1C1A17] text-[#F3EEE2] font-bold">{run.i + 1 < run.items.length ? "Tiếp" : "Kết lò"}</button>
              </div>
            )}
          </section>
        )}

        {done && (
          <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-3 items-center text-center" aria-label="Kết quả lò">
            <span className="font-brush text-[46px] leading-none text-[#9E2F22]">{done.dan ? done.dan.zh : "废丹"}</span>
            <h2 className="font-serif-vn text-[20px] font-extrabold">{done.dan ? `Thành ${done.dan.vn}!` : "Lò này chưa thành đan"}</h2>
            <p className="text-[15px]">Đúng <b>{done.correct}/{done.total}</b> · <b className="text-[#5C3D00]">+{done.tvGain} tu vi</b>{done.dan?.key === "trucCo" ? " · Trúc Cơ Đan vào túi (×2 tu vi 1 giờ)" : ""}</p>
            <div className="flex flex-wrap justify-center gap-1.5">{done.log.map((x, i) => <span key={i} className={`px-2 py-0.5 rounded text-[15px] ${x.ok ? "bg-[#DDEBE4]" : "bg-[#F6DCD6]"}`} style={{ fontFamily: '"Noto Serif SC",serif' }}>{x.zh}</span>)}</div>
            <div className="flex gap-2 w-full">
              <Link href="/tam-ma" className="flex-1 h-12 rounded-[6px] border-[1.5px] border-[#1C1A17] font-bold inline-flex items-center justify-center">Tâm Ma Động</Link>
              <button onClick={start} className="flex-[2] h-12 rounded-[6px] bg-[#9E2F22] text-white font-extrabold">Luyện lò nữa</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
