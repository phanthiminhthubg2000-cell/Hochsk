"use client";
// 塔罗牌 — Bói bài Tarot song ngữ: chọn trải bài, xáo, tự tay rút lá, xem ý nghĩa từng lá + giải bài bằng AI; từ điển 78 lá
import { useMemo, useState } from "react";
import Link from "next/link";
import { Shell, Panel, H2, usePy, Speak, C } from "../ui";
import { DECK, SUITS, SPREADS, TOPICS, TAROT_VOCAB } from "../../../lib/tarot-data";

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function SuitIcon({ s, className = "w-5 h-5" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...p}>
      {s === "wands" && <><path d="M12 3v18" /><path d="M12 7l-3-2M12 10l3-2M12 13l-3-1.5" /></>}
      {s === "cups" && <><path d="M6 4h12c0 5-2.5 8-6 8s-6-3-6-8z" /><path d="M12 12v6M8 20h8" /></>}
      {s === "swords" && <><path d="M12 2l1.5 3v11h-3V5z" /><path d="M7 16h10M12 16v5" /></>}
      {s === "pentacles" && <><circle cx="12" cy="12" r="9" /><path d="M12 5 L16.1 17.7 L5.3 9.8 L18.7 9.8 L7.9 17.7Z" /></>}
    </svg>
  );
}

// mặt lá bài (tự vẽ, không dùng tranh có bản quyền)
function Face({ c, rev, w = 110 }) {
  const S = c.suit && SUITS[c.suit];
  const col = S ? S.c : C.gold;
  return (
    <div className="relative rounded-[8px] overflow-hidden select-none transition-transform duration-500" style={{ width: w, height: w * 1.65, transform: rev ? "rotate(180deg)" : "none", background: "linear-gradient(170deg,#2B2619,#1A1C20 70%)", border: `1.5px solid ${C.gold}`, boxShadow: "0 6px 18px rgba(0,0,0,.45)" }}>
      <div className="absolute inset-[5px] rounded-[5px] border" style={{ borderColor: C.goldDim }} />
      <div className="absolute top-2 inset-x-0 text-center font-serif text-[11px] tracking-widest" style={{ color: C.gold }}>{c.major ? ROMAN[c.n] : S.zh}</div>
      <div className="absolute inset-x-0 top-[22%] bottom-[30%] grid place-items-center" style={{ color: col }}>
        {c.major ? <span style={{ fontSize: w * 0.42, lineHeight: 1, fontFamily: "'Segoe UI Symbol','Noto Sans Symbols 2','Noto Sans Symbols','Apple Symbols',serif", fontVariantEmoji: "text" }}>{c.g + "\uFE0E"}</span>
          : c.rank < 10 ? <div className="flex flex-wrap justify-center content-center gap-0.5 px-3" style={{ maxWidth: w }}>{Array.from({ length: c.rank + 1 }).map((_, i) => <SuitIcon key={i} s={c.suit} className={c.rank === 0 ? "w-12 h-12" : c.rank < 4 ? "w-7 h-7" : "w-5 h-5"} />)}</div>
          : <div className="grid place-items-center gap-1"><SuitIcon s={c.suit} className="w-9 h-9" /><span className="font-zh font-bold" style={{ fontSize: w * 0.15, color: C.text }}>{c.zh.slice(2)}</span></div>}
      </div>
      <div className="absolute bottom-2 inset-x-1 text-center leading-tight">
        <div className="font-zh font-bold" style={{ fontSize: Math.max(11, w * 0.13), color: C.text }}>{c.zh}</div>
        <div className="text-[10px] truncate" style={{ color: C.mute }}>{c.vi}</div>
      </div>
    </div>
  );
}
function Back({ w = 46, picked, onClick, i }) {
  return (
    <button type="button" onClick={onClick} disabled={picked} aria-label={`Lá úp số ${i + 1}`}
      className="rounded-[5px] transition-all duration-200 hover:-translate-y-1.5 disabled:opacity-0 focus:outline-none focus-visible:ring-2"
      style={{ width: w, height: w * 1.65, border: `1px solid ${C.goldDim}`, background: `radial-gradient(circle at 50% 50%, ${C.goldSoft} 0 18%, transparent 19%), repeating-linear-gradient(45deg,#22252B 0 6px,#1A1C20 6px 12px)` }} />
  );
}

function Detail({ c, rev, pos, py }) {
  const S = c.suit && SUITS[c.suit];
  return (
    <div className="grid gap-2 text-[14px] leading-6">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="font-zh text-[20px]" style={{ color: C.gold }}>{c.zh}</b><Speak t={c.zh} />
        <span style={{ color: C.mute }}>{py(c.zh)}</span>
        <span>· {c.vi} <span style={{ color: C.mute }}>({c.en})</span></span>
        {pos && <span className="ml-auto text-[12px] px-2 py-0.5 rounded" style={{ background: C.goldSoft, color: C.gold }}>{pos}</span>}
      </div>
      <div className="text-[12px]" style={{ color: C.mute }}>{c.major ? "Bộ Ẩn chính 大阿尔卡那" : `Bộ ${S.vi} ${S.zh} · ${S.el} · ${S.area}`}</div>
      {rev != null && <span className="w-fit text-[12px] font-bold px-2 py-0.5 rounded" style={rev ? { background: C.redSoft, color: C.red } : { background: C.greenSoft, color: C.green }}>{rev ? "Lá ngược 逆位" : "Lá xuôi 正位"}</span>}
      {(rev == null || !rev) && <p><b style={{ color: C.green }}>Xuôi:</b> <i style={{ color: C.mute }}>{c.kw.join(" · ")}</i><br />{c.up}</p>}
      {(rev == null || rev) && <p><b style={{ color: C.red }}>Ngược:</b> <i style={{ color: C.mute }}>{c.rk.join(" · ")}</i><br />{c.rev}</p>}
    </div>
  );
}

export default function Tarot() {
  const py = usePy();
  const [tab, setTab] = useState("read");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [q, setQ] = useState("");
  const [sp, setSp] = useState(SPREADS[1]);
  const [useRev, setUseRev] = useState(true);
  const [stage, setStage] = useState("setup"); // setup | pick | done
  const [deck, setDeck] = useState([]);
  const [picked, setPicked] = useState([]); // [{c, rev}]
  const [sel, setSel] = useState(0);
  const [ai, setAi] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [flt, setFlt] = useState("major"); const [look, setLook] = useState(null);

  const start = () => { setDeck(shuffle(DECK)); setPicked([]); setAi(null); setErr(""); setSel(0); setStage("pick"); };
  const pick = (c) => {
    if (picked.length >= sp.pos.length || picked.some((x) => x.c.id === c.id)) return;
    const n = [...picked, { c, rev: useRev && rnd(2) === 1 }]; setPicked(n);
    if (n.length === sp.pos.length) setTimeout(() => setStage("done"), 450);
  };
  const auto = () => { const rest = deck.filter((c) => !picked.some((x) => x.c.id === c.id)); const n = [...picked]; for (const c of rest.slice(0, sp.pos.length - picked.length)) n.push({ c, rev: useRev && rnd(2) === 1 }); setPicked(n); setTimeout(() => setStage("done"), 300); };
  const read = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/tarot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: `${topic[1]} ${topic[0]}`, question: q.trim(), spread: `${sp.vi} (${sp.zh})`, cards: picked.map((x, i) => ({ pos: `${sp.pos[i][1]} ${sp.pos[i][0]}`, name: x.c.name, en: x.c.en, rev: x.rev })) }) });
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || "Lỗi " + r.status); setAi(d);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const list = useMemo(() => DECK.filter((c) => (flt === "major" ? c.major : c.suit === flt)), [flt]);
  const chip = (on) => (on ? { background: C.goldSoft, borderColor: C.gold, color: C.gold } : { background: C.card, borderColor: C.line, color: C.mute });

  return (
    <Shell title="塔罗牌 · Tarot">
      <div className="flex items-center gap-2 mb-4 text-[13px]" style={{ color: C.mute }}>
        <Link href="/huyen-hoc" className="hover:underline">玄门学宫</Link><span>›</span><span style={{ color: C.gold }}>塔罗牌 Tarot</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-4 max-w-md">
        {[["read", "塔罗占卜", "Rút bài"], ["dict", "牌义大全", "Từ điển 78 lá"]].map(([k, zh, vi]) => (
          <button key={k} onClick={() => setTab(k)} className="rounded-[6px] border py-2" style={chip(tab === k)}><span className="block font-zh font-bold">{zh}</span><span className="block text-[11px]">{vi}</span></button>
        ))}
      </div>

      {tab === "read" && stage === "setup" && (
        <div className="grid gap-4">
          <Panel>
            <H2 zh="心中所问">Bạn muốn hỏi điều gì</H2>
            <div className="flex flex-wrap gap-1.5 mb-3">{TOPICS.map((t) => <button key={t[0]} onClick={() => setTopic(t)} className="rounded-full border px-3 py-1 text-[13px]" style={chip(topic === t)}><span className="font-zh">{t[0]}</span> {t[1]}</button>)}</div>
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} maxLength={300} placeholder="Vd: Mình có nên đổi việc trong năm nay không? (có thể để trống)" className="w-full rounded-[8px] border p-3 text-[15px] focus:outline-none" style={{ background: C.card, borderColor: C.line, color: C.text }} />
            <p className="text-[12px] mt-1" style={{ color: C.mute }}>Câu hỏi mở (&quot;điều gì giúp mình…&quot;, &quot;nên lưu ý gì…&quot;) thường cho lời giải hữu ích hơn câu hỏi có/không.</p>
          </Panel>
          <Panel>
            <H2 zh="选择牌阵">Chọn trải bài</H2>
            <div className="grid sm:grid-cols-2 gap-2">
              {SPREADS.map((s) => (
                <button key={s.id} onClick={() => setSp(s)} className="text-left rounded-[8px] border p-3" style={chip(sp.id === s.id)}>
                  <b className="font-zh">{s.zh}</b> <span style={{ color: C.text }}>· {s.vi}</span> <span className="text-[12px]">({s.pos.length} lá)</span>
                  <span className="block text-[12px] mt-0.5" style={{ color: C.mute }}>{s.note}</span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 mt-3 text-[14px]"><input type="checkbox" checked={useRev} onChange={(e) => setUseRev(e.target.checked)} /> Dùng lá ngược <span className="font-zh" style={{ color: C.mute }}>逆位</span></label>
            <button onClick={start} className="mt-4 h-11 px-6 rounded-[8px] font-bold" style={{ background: C.gold, color: C.bg }}>洗牌 · Xáo bài</button>
          </Panel>
          <Panel>
            <H2 zh="塔罗词汇">Từ vựng Tarot</H2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">{TAROT_VOCAB.map(([zh, vi]) => <div key={zh} className="flex items-center gap-2 text-[14px] border-b py-1" style={{ borderColor: C.line }}><Speak t={zh} /><b className="font-zh" style={{ color: C.gold }}>{zh}</b><span className="text-[12px]" style={{ color: C.mute }}>{py(zh)}</span><span className="ml-auto text-right">{vi}</span></div>)}</div>
          </Panel>
        </div>
      )}

      {tab === "read" && stage === "pick" && (
        <Panel>
          <H2 zh="抽牌" right={`${picked.length}/${sp.pos.length}`}>Tập trung vào câu hỏi và chọn {sp.pos.length} lá</H2>
          <p className="text-[13px] mb-3" style={{ color: C.mute }}>Lá tiếp theo: <b style={{ color: C.gold }}>{sp.pos[picked.length]?.[1]} <span className="font-zh">{sp.pos[picked.length]?.[0]}</span></b></p>
          <div className="flex flex-wrap gap-1 justify-center">{deck.map((c, i) => <Back key={c.id} i={i} picked={picked.some((x) => x.c.id === c.id)} onClick={() => pick(c)} />)}</div>
          <div className="flex gap-3 mt-4 justify-center text-[13px]">
            <button onClick={auto} className="underline" style={{ color: C.mute }}>Rút ngẫu nhiên giúp mình</button>
            <button onClick={() => setStage("setup")} className="underline" style={{ color: C.mute }}>Quay lại</button>
          </div>
        </Panel>
      )}

      {tab === "read" && stage === "done" && (
        <div className="grid gap-4">
          <Panel>
            <H2 zh={sp.zh} right={`${topic[1]}${q ? " · " + q : ""}`}>{sp.vi}</H2>
            <div className="flex flex-wrap gap-3 justify-center">
              {picked.map((x, i) => (
                <button key={x.c.id} onClick={() => setSel(i)} className="grid justify-items-center gap-1.5 rounded-[10px] p-1.5" style={sel === i ? { background: C.goldSoft } : {}}>
                  <span className="text-[11px]" style={{ color: C.mute }}>{i + 1}. {sp.pos[i][1]}</span>
                  <Face c={x.c} rev={x.rev} w={sp.pos.length > 5 ? 84 : 110} />
                </button>
              ))}
            </div>
          </Panel>
          {picked[sel] && <Panel><Detail c={picked[sel].c} rev={picked[sel].rev} pos={`${sel + 1}. ${sp.pos[sel][1]} ${sp.pos[sel][0]}`} py={py} /></Panel>}
          <Panel>
            <H2 zh="解牌">Giải bài</H2>
            {!ai && <button onClick={read} disabled={busy} className="h-11 px-5 rounded-[8px] font-bold disabled:opacity-60" style={{ background: C.gold, color: C.bg }}>{busy ? "Đang giải bài… (khoảng 20–30 giây)" : "Giải bài chi tiết bằng AI"}</button>}
            {err && <p className="mt-2 text-[14px]" style={{ color: C.red }}>{err}</p>}
            {ai && (
              <div className="grid gap-3 text-[15px] leading-7">
                <p className="rounded-[8px] p-3" style={{ background: C.goldSoft }}>{ai.tong_quan}</p>
                {(ai.la || []).map((l, i) => <p key={i}><b style={{ color: C.gold }}>{i + 1}. {l.vi_tri}</b> — {picked[i]?.c.name}{picked[i]?.rev ? " (ngược)" : ""}<br />{l.giai}</p>)}
                {ai.cau_chuyen && <p><b style={{ color: C.gold }}>Tổng hợp:</b> {ai.cau_chuyen}</p>}
                {ai.loi_khuyen?.length > 0 && <div><b style={{ color: C.gold }}>Lời khuyên</b><ul className="list-disc pl-5">{ai.loi_khuyen.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                {ai.tu_vung?.length > 0 && <div><b style={{ color: C.gold }}>Từ vựng</b><div className="grid sm:grid-cols-2 gap-x-6">{ai.tu_vung.map((v, i) => <div key={i} className="flex items-center gap-2 text-[14px] border-b py-1" style={{ borderColor: C.line }}><Speak t={v.zh} /><b className="font-zh">{v.zh}</b><span className="text-[12px]" style={{ color: C.mute }}>{v.py}</span><span className="ml-auto text-right">{v.vi}</span></div>)}</div></div>}
              </div>
            )}
            <p className="text-[12px] mt-3" style={{ color: C.mute }}>Tarot là công cụ để tự suy ngẫm và học văn hoá, không thay cho lời khuyên chuyên môn.</p>
          </Panel>
          <div className="flex gap-2">
            <button onClick={start} className="h-10 px-4 rounded-[8px] border font-bold" style={{ borderColor: C.gold, color: C.gold }}>Rút lại</button>
            <button onClick={() => setStage("setup")} className="h-10 px-4 rounded-[8px] border" style={{ borderColor: C.line, color: C.mute }}>Đổi câu hỏi / trải bài</button>
          </div>
        </div>
      )}

      {tab === "dict" && (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-1.5">
            {[["major", "大阿尔卡那", "Ẩn chính"], ...Object.entries(SUITS).map(([k, s]) => [k, s.zh, s.vi])].map(([k, zh, vi]) => <button key={k} onClick={() => { setFlt(k); setLook(null); }} className="rounded-full border px-3 py-1 text-[13px]" style={chip(flt === k)}><span className="font-zh">{zh}</span> {vi}</button>)}
          </div>
          {flt !== "major" && <p className="text-[13px]" style={{ color: C.mute }}>Bộ {SUITS[flt].vi} <span className="font-zh">{SUITS[flt].zh}</span> — nguyên tố {SUITS[flt].el}: {SUITS[flt].area}.</p>}
          {look && <Panel><Detail c={look} py={py} /></Panel>}
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3 justify-items-center">
            {list.map((c) => <button key={c.id} onClick={() => setLook(c)} className="rounded-[10px] p-1" style={look?.id === c.id ? { background: C.goldSoft } : {}}><Face c={c} w={96} /></button>)}
          </div>
        </div>
      )}
    </Shell>
  );
}
