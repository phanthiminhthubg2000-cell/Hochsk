"use client";
// ============================================================
// TÂM MA ĐỘNG 心魔洞 — trảm những từ hay sai (v2 · giai đoạn C)
// Nguồn: lien_dan/{uid}.w có số lần sai > 0 (sai ở Luyện Đan Phòng, Ma Vương, Tâm Ma)
// Đúng: giảm một tầng tâm ma (về 0 là trảm xong) · Sai: tâm ma lớn thêm
// Tu vi +3 / câu đúng; linh căn yếu hệ Mộc ×1,5; Trúc Cơ Đan ×2
// ============================================================
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GardenNav from "../GardenNav";
import { judgeLinhCan } from "../tuTien";
import { useTuVi } from "../useTuVi";
import { loadCards, loadLD, saveLD, makeQ, speakZh, shuffle, LEVEL_NAME, today } from "../luyenDan";

const LABELS = ["甲", "乙", "丙", "丁"];
const ROUND = 12;

export default function TamMaPage() {
  const { u, userId, gain } = useTuVi();
  const [ld, setLd] = useState(null);
  const [pools, setPools] = useState({});
  const [run, setRun] = useState(null);
  const [done, setDone] = useState(null);
  useEffect(() => { loadLD(userId).then(setLd); }, [userId]);
  const demons = useMemo(() => Object.entries(ld?.w || {}).filter(([, v]) => (v[2] || 0) > 0).map(([k, v]) => { const [lv, zh] = k.split("|"); return { k, lv, zh, n: v[2] }; }).sort((a, b) => b.n - a.n), [ld]);
  useEffect(() => { [...new Set(demons.map((d) => d.lv))].forEach((lv) => { if (!pools[lv]) loadCards(lv).then((c) => setPools((p) => ({ ...p, [lv]: c }))).catch(() => {}); }); }, [demons]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = demons.length > 0 && demons.every((d) => pools[d.lv]);
  const weakMoc = u?.linhCan?.scores && judgeLinhCan(u.linhCan.scores).weak === "moc";
  const mult = (weakMoc ? 1.5 : 1) * ((u?.boostUntil || 0) > Date.now() ? 2 : 1);

  const qOf = (d) => { const pool = pools[d.lv]; const card = pool.find((c) => c[0] === d.zh) || [d.zh, "", "?"]; return { d, q: makeQ(card, pool, ["nghia", "han", "am"][Math.floor(Math.random() * 3)]) }; };
  const start = () => { const list = shuffle(demons.slice(0, 30)).slice(0, ROUND).map(qOf); setDone(null); setRun({ list, i: 0, picked: null, log: [] }); };
  const answer = (k) => {
    if (!run || run.picked != null) return;
    const { d, q } = run.list[run.i]; const ok = k === q.right; const v = ld.w[d.k];
    v[2] = Math.max(0, (v[2] || 0) + (ok ? -1 : 1)); if (!ok) { v[0] = 1; v[1] = today() + 1; speakZh(d.zh); }
    setRun({ ...run, picked: k, log: [...run.log, { zh: d.zh, ok, slain: ok && v[2] === 0 }] });
  };
  const next = async () => {
    if (run.i + 1 < run.list.length) { setRun({ ...run, i: run.i + 1, picked: null }); return; }
    const correct = run.log.filter((x) => x.ok).length; const slain = run.log.filter((x) => x.slain).length;
    const tvGain = Math.round(correct * 3 * mult);
    setDone({ correct, total: run.log.length, slain, tvGain }); setRun(null);
    await saveLD(userId, ld); setLd({ ...ld }); await gain(tvGain);
  };
  const cur = run?.list[run.i];
  return (
    <div className="min-h-screen bg-[#17141C] text-[#EDE6F5]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="practice" title="Tâm Ma Động" />
      <style>{`@keyframes tmPulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.8;transform:scale(1.08)}}@media (prefers-reduced-motion:reduce){.tm-a{animation:none!important}}`}</style>
      <main className="max-w-[680px] mx-auto px-4 pt-6 pb-28 md:pb-16 flex flex-col gap-4">
        <div className="relative rounded-[16px] overflow-hidden bg-[#221B2C] p-6 flex items-center gap-4 border border-[#3A2E4A]">
          <div aria-hidden="true" className="tm-a absolute -left-10 -top-10 w-56 h-56 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(122,90,166,.7), transparent)", animation: "tmPulse 3s ease-in-out infinite" }} />
          <span className="relative font-brush text-[56px] leading-none text-[#C9A8F0]">心魔</span>
          <div className="relative flex flex-col gap-1">
            <h1 className="font-serif-vn text-[22px] font-extrabold">Tâm Ma Động</h1>
            <p className="text-sm text-[#C5B8D6] leading-relaxed">Mỗi từ bạn từng sai là một tâm ma. Trả lời đúng để trảm bớt; sai thì tâm ma lớn thêm và từ quay về lò ôn.</p>
          </div>
        </div>

        {!run && !done && (
          <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-3">
            {ld == null ? <p className="text-sm">Đang dò tâm ma…</p> : demons.length === 0 ? (
              <>
                <p className="font-serif-vn font-bold text-[17px]">Tâm cảnh thanh tịnh — chưa có tâm ma nào.</p>
                <p className="text-sm text-[#4A4238]">Từ nào bạn trả lời sai ở Luyện Đan Phòng hay Ma Vương sẽ hiện ở đây.</p>
                <Link href="/luyen-dan" className="self-start h-11 px-5 rounded-[6px] bg-[#9E2F22] text-white font-bold inline-flex items-center">Vào Luyện Đan Phòng</Link>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between"><b className="font-serif-vn text-[17px]">{demons.length} tâm ma đang ẩn nấp</b><span className="text-xs text-[#6B6253]">{weakMoc ? "hệ Mộc yếu · tu vi ×1,5" : "+3 tu vi / câu đúng"}</span></div>
                <ul className="flex flex-wrap gap-1.5">
                  {demons.slice(0, 40).map((d) => <li key={d.k} className="px-2 py-1 rounded-[4px] bg-[#3A2350] text-[#F1E6FF] text-[15px]" title={`${LEVEL_NAME[d.lv]} · sai ${d.n} lần`}><span style={{ fontFamily: '"Noto Serif SC",serif' }}>{d.zh}</span> <sup className="text-[10px] text-[#C9A8F0]">{d.n}</sup></li>)}
                </ul>
                <button onClick={start} disabled={!ready} className="h-14 rounded-[8px] bg-[#3A2350] hover:bg-[#4A2E66] disabled:bg-[#8C7F68] text-white font-serif-vn text-[17px] font-extrabold">Vào động trảm tâm ma</button>
              </>
            )}
          </section>
        )}

        {run && cur && (
          <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-3" aria-label="Trảm tâm ma">
            <div className="flex justify-between text-xs text-[#6B6253]"><span>Tâm ma {run.i + 1}/{run.list.length} · {LEVEL_NAME[cur.d.lv]} · sai {cur.d.n} lần</span><span>{cur.q.sub}</span></div>
            <div className="text-center py-2"><span className={cur.q.mode === "han" ? "text-[22px] font-bold" : "text-[52px] leading-tight"} style={cur.q.mode === "han" ? undefined : { fontFamily: '"Noto Serif SC",serif' }}>{cur.q.ask}</span></div>
            <div role="radiogroup" aria-label="Đáp án" className="grid sm:grid-cols-2 gap-2">
              {cur.q.opts.map((o, k) => { const show = run.picked != null; const right = k === cur.q.right; const mine = k === run.picked; return (
                <button key={k} role="radio" aria-checked={mine} onClick={() => answer(k)} disabled={show}
                  className={`min-h-[52px] px-3 rounded-[6px] flex items-center gap-2 text-left border ${show && right ? "border-2 border-[#2F6E5A] bg-[#DDEBE4]" : show && mine ? "border-2 border-[#9E2F22] bg-[#F6DCD6]" : "border-[#1C1A17]/60 bg-white hover:border-[#7A5AA6]"}`}>
                  <span className="w-7 h-7 shrink-0 grid place-items-center rounded-[3px] bg-[#EFE7D6] font-brush text-[17px]" aria-hidden="true">{LABELS[k]}</span>
                  <span className="text-[16px]" style={/[一-鿿]/.test(o) ? { fontFamily: '"Noto Serif SC",serif' } : undefined}>{o}</span>
                </button>); })}
            </div>
            {run.picked != null && (
              <div className="flex items-center gap-3" role="status">
                <span className={`flex-1 text-sm font-semibold ${run.picked === cur.q.right ? "text-[#2F6E5A]" : "text-[#9E2F22]"}`}>{run.picked === cur.q.right ? (run.log[run.log.length - 1]?.slain ? "Trảm sạch tâm ma này!" : "Tâm ma yếu đi một tầng.") : `Tâm ma lớn thêm — ${cur.q.zh} · ${cur.q.py} · ${cur.q.vn}`}</span>
                <button onClick={next} className="h-11 px-5 rounded-[6px] bg-[#1C1A17] text-[#F3EEE2] font-bold">{run.i + 1 < run.list.length ? "Tiếp" : "Xong"}</button>
              </div>
            )}
          </section>
        )}

        {done && (
          <section className="rounded-[14px] bg-[#EFE7D6] text-[#1C1A17] p-5 flex flex-col gap-3 items-center text-center">
            <span className="font-brush text-[46px] leading-none text-[#3A2350]">{done.slain ? "斩魔" : "镇魔"}</span>
            <h2 className="font-serif-vn text-[20px] font-extrabold">{done.slain ? `Trảm sạch ${done.slain} tâm ma` : "Đã trấn áp tâm ma"}</h2>
            <p>Đúng <b>{done.correct}/{done.total}</b> · <b className="text-[#5C3D00]">+{done.tvGain} tu vi</b></p>
            <div className="flex gap-2 w-full">
              <Link href="/luyen-dan" className="flex-1 h-12 rounded-[6px] border-[1.5px] border-[#1C1A17] font-bold inline-flex items-center justify-center">Luyện Đan Phòng</Link>
              <button onClick={start} disabled={!demons.length} className="flex-[2] h-12 rounded-[6px] bg-[#3A2350] text-white font-extrabold disabled:bg-[#8C7F68]">Trảm tiếp</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
