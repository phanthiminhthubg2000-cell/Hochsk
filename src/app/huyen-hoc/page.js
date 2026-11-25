"use client";
// 玄门学宫 — trang chủ học cung: bảy cảnh giới, khoá học, từ vựng, tiến độ
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LEVELS, LESSONS, ALL_VOCAB, unlockedSet, isDone, PASS } from "../../lib/hh";
import { Shell, Panel, H2, Bar, Lock, Check, Speak, speak, useProg, C } from "./ui";

function Hero() {
  return (
    <div className="relative rounded-[12px] overflow-hidden border mb-5" style={{ borderColor: C.line }}>
      <img src="/huyen-hoc/hero.jpg" alt="Học cung huyền môn lơ lửng giữa núi mây lúc hoàng hôn" className="w-full h-[310px] md:h-[360px] object-cover" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(22,24,28,.15) 0%,rgba(22,24,28,.25) 45%,rgba(22,24,28,.96) 100%)" }} />
      <div className="absolute left-4 top-3 md:left-6 md:top-5">
        <div className="font-brush text-[34px] md:text-[48px] leading-none" style={{ color: C.gold, textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>玄门学宫</div>
        <div className="tracking-[.32em] text-[10px] md:text-[12px] mt-1" style={{ color: "#F3E7C8", textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>HUYỀN MÔN HỌC CUNG</div>
      </div>
      <span className="absolute right-3 top-3 md:right-5 md:top-5 rounded-full px-2.5 py-1 text-[11px] font-bold font-zh" style={{ background: C.greenSoft, color: C.green, border: `1px solid ${C.green}55` }}>修行之路 · BETA</span>
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-center">
        <div className="font-zh text-[21px] md:text-[30px] font-bold" style={{ color: "#F3E7C8", textShadow: "0 2px 10px rgba(0,0,0,.7)" }}>问道于心 · 探玄求真</div>
        <div className="text-[12px] md:text-[14px]" style={{ color: C.mute }}>Tầm đạo nơi tâm · Khám phá huyền cơ</div>
        <div className="font-zh text-[14px] md:text-[16px] mt-1.5">以经典为师，以思辨为径，以汉字为桥。</div>
        <div className="text-[11px] md:text-[13px]" style={{ color: C.mute }}>Lấy kinh điển làm thầy, tư duy làm đường, Hán tự làm cầu nối.</div>
      </div>
    </div>
  );
}

function useState2() {
  const P = useProg();
  const open = useMemo(() => unlockedSet(P.prog, P.all), [P.prog, P.all]);
  const done = LESSONS.filter((l) => isDone(P.prog, l.id));
  const next = LESSONS.find((l) => open.has(l.id) && !isDone(P.prog, l.id)) || null;
  const cur = next ? next.level : LEVELS[LEVELS.length - 1];
  return { ...P, open, done, next, cur };
}

function RealmCard({ L, S }) {
  const n = L.lessons.filter((l) => isDone(S.prog, l.id)).length, tot = L.lessons.length;
  const locked = !S.open.has(L.lessons[0].id);
  const cur = S.cur.n === L.n && n < tot;
  return (
    <Link href={`/huyen-hoc?tab=course#lv${L.n}`} className="rounded-[8px] border p-3 md:p-4 flex flex-col gap-1 transition-colors"
      style={cur ? { background: "linear-gradient(160deg,#4A3D25,#2A2620)", borderColor: C.gold } : { background: C.card, borderColor: C.line, opacity: locked ? 0.6 : 1 }}>
      <div className="flex items-start justify-between">
        <span className="font-brush text-[28px] leading-none" style={{ color: cur ? C.gold : "#CFC3A8" }}>{L.realm.num}</span>
        <span className="w-6 h-6 rounded-full grid place-items-center" style={{ background: n === tot ? C.green : locked ? C.line : C.goldDim, color: "#16181C" }}>
          {n === tot ? <Check className="w-3.5 h-3.5" /> : locked ? <Lock className="w-3 h-3" /> : <span className="text-[10px] font-bold">{n}</span>}
        </span>
      </div>
      <div className="font-zh text-[19px] md:text-[21px] font-bold mt-1">{L.realm.zh}</div>
      <div className="text-[13px]" style={{ color: C.mute }}>{L.vi}</div>
      <div className="text-[12px] font-zh" style={{ color: C.goldDim }}>{L.zh} · {L.key}</div>
      <div className="mt-2"><Bar v={(n / tot) * 100} color={n === tot ? C.green : C.gold} /></div>
      <div className="text-[11px]" style={{ color: C.mute }}>{n}/{tot} bài</div>
    </Link>
  );
}

function Home({ S }) {
  const L = S.cur; const n = L.lessons.filter((l) => isDone(S.prog, l.id)).length;
  return (
    <div className="flex flex-col gap-5">
      <Hero />
      <div className="flex items-center gap-2"><h2 className="text-[17px] md:text-[19px] font-extrabold"><span className="font-zh">入门修行</span> · Hành trình nhập môn</h2><span className="ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: C.greenSoft, color: C.green }}>7 đại cảnh giới</span></div>
      <Panel>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[12px]" style={{ color: C.mute }}><span className="font-zh">当前境界</span> · Cảnh giới hiện tại</div>
            <div className="font-zh text-[34px] md:text-[42px] font-bold leading-tight" style={{ color: C.gold }}>{L.realm.zh}</div>
            <div className="text-[14px]">{L.realm.hv} — {L.vi}</div>
          </div>
          <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-full grid place-items-center border-2 font-brush text-[34px] md:text-[42px]" style={{ borderColor: C.gold, color: C.gold, background: "radial-gradient(circle,#3A3222,#1E2126)" }} aria-hidden="true">{L.realm.num}</div>
        </div>
        <div className="mt-3"><Bar v={(S.done.length / LESSONS.length) * 100} /></div>
        <div className="text-[12px] mt-1" style={{ color: C.mute }}>{S.done.length}/{LESSONS.length} bài đã hoàn thành · cảnh giới này {n}/{L.lessons.length}{S.all && " · chế độ giáo viên: mở khoá tất cả"}</div>
      </Panel>
      <div>
        <h2 className="text-[17px] md:text-[19px] font-extrabold"><span className="font-zh">七重境界</span> · Bảy cảnh giới tu học</h2>
        <p className="text-[13px] mb-3" style={{ color: C.mute }}>Hoàn thành trắc nghiệm mỗi bài từ {PASS}% trở lên để mở bài kế tiếp. Xong một cảnh giới thì cảnh giới sau mở ra.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">{LEVELS.map((x) => <RealmCard key={x.n} L={x} S={S} />)}</div>
      </div>
      {S.next ? (
        <Panel>
          <H2 zh="今日修习">Bài học hôm nay</H2>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 shrink-0 rounded-[8px] grid place-items-center font-brush text-[30px]" style={{ background: C.goldSoft, color: C.gold }} aria-hidden="true">{S.next.zh[0]}</div>
            <div className="min-w-0">
              <div className="text-[12px]" style={{ color: C.mute }}>第{String(S.next.level.n).padStart(2, "0")}级 · {S.next.level.realm.zh} · Bài {S.next.id}</div>
              <div className="font-zh text-[19px] font-bold" style={{ color: C.gold }}>{S.next.zh}</div>
              <div className="text-[13px]">{S.next.vi}</div>
              <div className="text-[12px]" style={{ color: C.mute }}>Từ vựng · Ngữ pháp · Đọc hiểu · Cổ văn · Trắc nghiệm</div>
            </div>
          </div>
          <Link href={`/huyen-hoc/bai/${S.next.id}`} className="mt-4 h-11 rounded-[8px] grid place-items-center font-bold text-[15px]" style={{ background: C.gold, color: "#16181C" }}>{S.done.length ? "Tiếp tục tu học" : "Bắt đầu tu học"}</Link>
        </Panel>
      ) : (
        <Panel><H2 zh="大道已成">Đã hoàn thành toàn bộ lộ trình</H2><p className="text-[14px]">Bạn đã đi hết 7 cảnh giới. Có thể ôn lại từ vựng ở tab 词汇典籍 hoặc dùng các công cụ ở 法器.</p></Panel>
      )}
      <Link href="/huyen-hoc/tu-vi" className="rounded-[10px] border p-4 flex items-center gap-3" style={{ background: "linear-gradient(160deg,#2B2619,#1E2126)", borderColor: C.goldDim }}>
        <span className="w-11 h-11 rounded-[6px] grid place-items-center font-brush text-[24px]" style={{ background: C.goldSoft, color: C.gold }} aria-hidden="true">紫</span>
        <span className="flex-1"><b className="block"><span className="font-zh">紫微斗数</span> · Lập lá số Tử vi</b><span className="text-[13px]" style={{ color: C.mute }}>An sao 12 cung · luận giải từng cung · luận giải chi tiết bằng AI</span></span>
        <span style={{ color: C.mute }}>›</span>
      </Link>
      <Link href="/huyen-hoc/bat-tu" className="rounded-[10px] border p-4 flex items-center gap-3" style={{ background: "linear-gradient(160deg,#1F2A22,#1E2126)", borderColor: C.goldDim }}>
        <span className="w-11 h-11 rounded-[6px] grid place-items-center font-brush text-[24px]" style={{ background: C.goldSoft, color: C.gold }} aria-hidden="true">八</span>
        <span className="flex-1"><b className="block"><span className="font-zh">八字</span> · Bát tự – Tứ trụ</b><span className="text-[13px]" style={{ color: C.mute }}>Mệnh gì · ngũ hành vượng, khuyết · dụng thần · nên bổ sung hành gì, nên làm và tránh gì · đại vận</span></span>
        <span style={{ color: C.mute }}>›</span>
      </Link>
      <Link href="/huyen-hoc/tarot" className="rounded-[10px] border p-4 flex items-center gap-3" style={{ background: "linear-gradient(160deg,#241F2E,#1E2126)", borderColor: C.goldDim }}>
        <span className="w-11 h-11 rounded-[6px] grid place-items-center font-brush text-[24px]" style={{ background: C.goldSoft, color: C.gold }} aria-hidden="true">塔</span>
        <span className="flex-1"><b className="block"><span className="font-zh">塔罗牌</span> · Bói bài Tarot</b><span className="text-[13px]" style={{ color: C.mute }}>Tự tay rút lá · 5 kiểu trải bài · ý nghĩa 78 lá song ngữ · giải bài bằng AI</span></span>
        <span style={{ color: C.mute }}>›</span>
      </Link>
      <Link href="/huyen-hoc/cong-cu" className="rounded-[10px] border p-4 flex items-center gap-3" style={{ background: C.panel, borderColor: C.line }}>
        <span className="w-11 h-11 rounded-[6px] grid place-items-center font-brush text-[24px]" style={{ background: C.goldSoft, color: C.gold }} aria-hidden="true">器</span>
        <span className="flex-1"><b className="block"><span className="font-zh">法器</span> · Công cụ tra cứu</b><span className="text-[13px]" style={{ color: C.mute }}>Can chi năm sinh · gieo quẻ · lập Bát tự · mệnh quái · Hoàng lịch hôm nay</span></span>
        <span style={{ color: C.mute }}>›</span>
      </Link>
      <p className="text-[12px] text-center" style={{ color: C.mute }}>玄门学宫 · 以学入道 — Học để hiểu, hiểu để suy ngẫm. Nội dung mang tính văn hoá – học thuật, không thay cho lời khuyên chuyên môn.</p>
    </div>
  );
}

function Course({ S }) {
  return (
    <div className="flex flex-col gap-4">
      {LEVELS.map((L) => {
        const n = L.lessons.filter((l) => isDone(S.prog, l.id)).length;
        return (
          <Panel key={L.n} className="scroll-mt-24">
            <div id={`lv${L.n}`} className="flex items-start gap-3 mb-3">
              <span className="font-brush text-[34px] leading-none" style={{ color: C.gold }}>{L.realm.num}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px]" style={{ color: C.mute }}>第{String(L.n).padStart(2, "0")}级 · {L.realm.hv}</div>
                <div className="text-[18px] font-extrabold"><span className="font-zh" style={{ color: C.gold }}>{L.realm.zh}</span> · {L.vi} <span className="font-zh text-[15px] font-normal" style={{ color: C.mute }}>{L.zh}</span></div>
                <div className="text-[13px]" style={{ color: C.mute }}>{L.desc}</div>
                <div className="text-[12px] mt-0.5">Trọng tâm: <span className="font-zh" style={{ color: C.gold }}>{L.key}</span></div>
              </div>
              <span className="text-[12px] shrink-0" style={{ color: C.mute }}>{n}/{L.lessons.length}</span>
            </div>
            <div className="grid gap-1.5">
              {L.lessons.map((l) => {
                const open = S.open.has(l.id), done = isDone(S.prog, l.id), sc = S.prog[l.id]?.s;
                const body = (
                  <>
                    <span className="w-7 h-7 shrink-0 rounded-full grid place-items-center text-[11px] font-bold" style={done ? { background: C.green, color: "#16181C" } : open ? { background: C.goldSoft, color: C.gold, border: `1px solid ${C.gold}` } : { background: C.line, color: C.mute }}>
                      {done ? <Check className="w-3.5 h-3.5" /> : open ? l.id : <Lock className="w-3 h-3" />}
                    </span>
                    <span className="flex-1 min-w-0"><span className="font-zh font-bold text-[16px]">{l.zh}</span><span className="block text-[13px]" style={{ color: C.mute }}>{l.vi}</span></span>
                    {sc != null && <span className="text-[12px] font-bold" style={{ color: sc >= PASS ? C.green : C.red }}>{sc}%</span>}
                  </>
                );
                return open
                  ? <Link key={l.id} href={`/huyen-hoc/bai/${l.id}`} className="flex items-center gap-3 rounded-[8px] border px-3 py-2.5 hover:border-[#D4AF5F]" style={{ background: C.card, borderColor: C.line }}>{body}</Link>
                  : <div key={l.id} className="flex items-center gap-3 rounded-[8px] border px-3 py-2.5 opacity-55" style={{ background: C.card, borderColor: C.line }} title="Hoàn thành bài trước để mở">{body}</div>;
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function Vocab({ S }) {
  const [q, setQ] = useState(""); const [lv, setLv] = useState(0); const [card, setCard] = useState(null); const [flip, setFlip] = useState(false);
  const learned = new Set(LESSONS.filter((l) => isDone(S.prog, l.id)).map((l) => l.id));
  const list = ALL_VOCAB.filter((v) => (!lv || v.lv === lv) && (!q || v.zh.includes(q) || v.vi.toLowerCase().includes(q.toLowerCase()) || v.py.replace(/\s/g, "").includes(q.replace(/\s/g, ""))));
  const pool = ALL_VOCAB.filter((v) => learned.has(v.id));
  const draw = () => { const p = pool.length ? pool : ALL_VOCAB.filter((v) => v.lv === 1); setCard(p[Math.floor(Math.random() * p.length)]); setFlip(false); };
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <H2 zh="温故知新" right={pool.length ? `${pool.length} từ đã học` : "chưa học bài nào — ôn từ cấp 01"}>Thẻ ôn tập</H2>
        {card ? (
          <button onClick={() => setFlip(!flip)} className="w-full rounded-[10px] border py-6 text-center" style={{ background: C.card, borderColor: C.gold }}>
            <div className="font-zh text-[44px] font-bold" style={{ color: C.gold }}>{card.zh}</div>
            {flip ? <><div className="text-[18px]">{card.py}</div><div className="text-[15px]" style={{ color: C.mute }}>{card.vi} · bài {card.id}</div></> : <div className="text-[13px]" style={{ color: C.mute }}>Bấm để lật thẻ</div>}
          </button>
        ) : <p className="text-[14px]" style={{ color: C.mute }}>Rút ngẫu nhiên một từ trong các bài bạn đã hoàn thành, tự nhớ pinyin và nghĩa rồi lật thẻ kiểm tra.</p>}
        <div className="flex gap-2 mt-3">
          <button onClick={draw} className="h-10 px-4 rounded-[8px] font-bold" style={{ background: C.gold, color: "#16181C" }}>{card ? "Thẻ khác" : "Rút thẻ"}</button>
          {card && <button onClick={() => speak(card.zh)} className="h-10 px-4 rounded-[8px] border font-bold" style={{ borderColor: C.line }}>Nghe</button>}
        </div>
      </Panel>
      <Panel>
        <H2 zh="词汇典籍" right={`${list.length}/${ALL_VOCAB.length} từ`}>Từ điển toàn khoá</H2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm chữ Hán, pinyin hoặc nghĩa…" className="w-full h-10 px-3 rounded-[8px] border text-[15px] mb-2 focus:outline-none" style={{ background: C.card, borderColor: C.line, color: C.text }} aria-label="Tìm từ" />
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
          {[0, ...LEVELS.map((L) => L.n)].map((n) => <button key={n} onClick={() => setLv(n)} className="shrink-0 rounded-full px-3 py-1 text-[12px] font-bold border" style={lv === n ? { background: C.goldSoft, borderColor: C.gold, color: C.gold } : { borderColor: C.line, color: C.mute }}>{n ? `${String(n).padStart(2, "0")} ${LEVELS[n - 1].realm.zh}` : "Tất cả"}</button>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-1.5">
          {list.map((v) => (
            <div key={v.zh} className="flex items-center gap-2 rounded-[8px] border px-3 py-2" style={{ background: C.card, borderColor: learned.has(v.id) ? C.goldDim : C.line }}>
              <div className="flex-1 min-w-0"><span className="font-zh text-[18px] font-bold">{v.zh}</span> <span className="text-[13px]" style={{ color: C.gold }}>{v.py}</span><div className="text-[13px]" style={{ color: C.mute }}>{v.vi} · <Link href={`/huyen-hoc/bai/${v.id}`} className="underline">bài {v.id}</Link></div></div>
              <Speak t={v.zh} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Prog({ S }) {
  const scores = S.done.map((l) => S.prog[l.id].s);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const words = ALL_VOCAB.filter((v) => isDone(S.prog, v.id)).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[["已修课程", "Bài đã xong", `${S.done.length}/${LESSONS.length}`], ["平均成绩", "Điểm TB", scores.length ? avg + "%" : "—"], ["已识词汇", "Từ đã học", `${words}/${ALL_VOCAB.length}`], ["当前境界", "Cảnh giới", S.cur.realm.zh]].map(([zh, vi, v]) => (
          <Panel key={zh} className="!p-3 text-center"><div className="font-zh text-[13px]" style={{ color: C.gold }}>{zh}</div><div className="text-[22px] font-extrabold font-zh">{v}</div><div className="text-[12px]" style={{ color: C.mute }}>{vi}</div></Panel>
        ))}
      </div>
      <Panel>
        <H2 zh="修为">Tiến độ từng cảnh giới</H2>
        <div className="grid gap-3">
          {LEVELS.map((L) => { const n = L.lessons.filter((l) => isDone(S.prog, l.id)).length; return (
            <div key={L.n}><div className="flex text-[14px] mb-1"><span className="font-zh font-bold w-20" style={{ color: C.gold }}>{L.realm.zh}</span><span className="flex-1">{L.vi}</span><span style={{ color: C.mute }}>{n}/{L.lessons.length}</span></div><Bar v={(n / L.lessons.length) * 100} color={n === L.lessons.length ? C.green : C.gold} /></div>
          ); })}
        </div>
      </Panel>
      <Panel>
        <H2 zh="记录">Kết quả gần đây</H2>
        {S.done.length === 0 ? <p className="text-[14px]" style={{ color: C.mute }}>Chưa có bài nào hoàn thành.</p> : (
          <div className="grid gap-1">
            {[...S.done].sort((a, b) => (S.prog[b.id].t || 0) - (S.prog[a.id].t || 0)).slice(0, 10).map((l) => (
              <Link key={l.id} href={`/huyen-hoc/bai/${l.id}`} className="flex items-center gap-3 text-[14px] py-1.5 border-b" style={{ borderColor: C.line }}><span className="w-10" style={{ color: C.mute }}>{l.id}</span><span className="font-zh flex-1">{l.zh}</span><b style={{ color: C.green }}>{S.prog[l.id].s}%</b></Link>
            ))}
          </div>
        )}
        <p className="text-[12px] mt-3" style={{ color: C.mute }}>{S.isSignedIn ? "Tiến độ được lưu vào tài khoản của bạn và đồng bộ giữa các thiết bị. Mỗi bài hoàn thành lần đầu được +30 tu vi." : "Bạn chưa đăng nhập: tiến độ chỉ lưu trên trình duyệt này. Đăng nhập để đồng bộ và nhận tu vi."}</p>
      </Panel>
    </div>
  );
}

function Inner() {
  const sp = useSearchParams();
  const tab = ["course", "vocab", "prog"].includes(sp.get("tab")) ? sp.get("tab") : "home";
  const S = useState2();
  // liên kết cũ /huyen-hoc#hl … → trang công cụ
  useEffect(() => { const h = window.location.hash.slice(1); if (["wx", "gz", "yj", "bz", "fs", "hl"].includes(h)) window.location.replace("/huyen-hoc/cong-cu#" + h); }, []);
  return (
    <Shell tab={tab}>
      {tab === "home" && <Home S={S} />}
      {tab === "course" && <Course S={S} />}
      {tab === "vocab" && <Vocab S={S} />}
      {tab === "prog" && <Prog S={S} />}
    </Shell>
  );
}
export default function Page() { return <Suspense fallback={<div className="min-h-screen" style={{ background: "#16181C" }} />}><Inner /></Suspense>; }
