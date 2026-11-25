"use client";
// Một bài học: bài giảng · từ vựng · mẫu câu · đọc hiểu · cổ văn · trắc nghiệm · luyện dịch
import { useMemo, useState } from "react";
import Link from "next/link";
import { LESSONS, lessonById, unlockedSet, isDone, PASS } from "../../../../lib/hh";
import { Shell, Panel, H2, Lock, Check, Speak, speak, usePy, useProg, seeded, C } from "../../ui";

const TOOL = { wx: "阴阳五行", gz: "干支生肖", yj: "易经八卦", bz: "八字排盘", fs: "风水命卦", hl: "黄历", tv: "紫微斗数排盘" };

function Toggle({ on, set, children }) {
  return <button onClick={() => set(!on)} className="h-8 px-3 rounded-full border text-[12px] font-bold" style={on ? { background: C.goldSoft, borderColor: C.gold, color: C.gold } : { borderColor: C.line, color: C.mute }} aria-pressed={on}>{children}</button>;
}

function Reading({ read }) {
  const p = usePy();
  const [py, setPy] = useState(true); const [vi, setVi] = useState(false); const [shown, setShown] = useState({});
  return (
    <Panel>
      <H2 zh="阅读" right="bấm một câu để xem nghĩa">Đọc hiểu{read.title ? <span className="font-zh font-normal"> · {read.title}</span> : null}</H2>
      <div className="flex flex-wrap gap-2 mb-3">
        <Toggle on={py} set={setPy}>Pinyin</Toggle><Toggle on={vi} set={setVi}>Bản dịch</Toggle>
        <button onClick={() => speak(read.s.map((x) => x[0]).join(""), 0.8)} className="h-8 px-3 rounded-full border text-[12px] font-bold" style={{ borderColor: C.line, color: C.gold }}>▶ Nghe cả đoạn</button>
      </div>
      <div className="rounded-[8px] border p-3 md:p-4 grid gap-3" style={{ background: C.card, borderColor: C.line }}>
        {read.s.map(([zh, v], i) => (
          <div key={i} className="flex gap-2 items-start cursor-pointer" onClick={() => setShown({ ...shown, [i]: !shown[i] })}>
            <div className="flex-1">
              {py && <div className="text-[13px]" style={{ color: C.goldDim }}>{p(zh)}</div>}
              <div className="font-zh text-[19px] md:text-[20px] leading-relaxed">{zh}</div>
              {(vi || shown[i]) && <div className="text-[14px] mt-0.5" style={{ color: C.mute }}>{v}</div>}
            </div>
            <Speak t={zh} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Classic({ gu }) {
  const p = usePy();
  const [open, setOpen] = useState({}); const [py, setPy] = useState(false);
  return (
    <Panel>
      <H2 zh="古文" right="nguyên văn có chú thích">Đọc cổ văn</H2>
      <div className="mb-3"><Toggle on={py} set={setPy}>Pinyin</Toggle></div>
      <div className="grid gap-3">
        {gu.map((g, i) => (
          <div key={i} className="rounded-[8px] border p-3 md:p-4" style={{ background: "linear-gradient(160deg,#2B2619,#22252B)", borderColor: C.goldDim }}>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                {py && <div className="text-[13px]" style={{ color: C.goldDim }}>{p(g.zh)}</div>}
                <div className="font-zh text-[20px] md:text-[22px] leading-relaxed" style={{ color: "#F3E7C8" }}>{g.zh}</div>
                <div className="text-[12px] mt-1 font-zh" style={{ color: C.gold }}>—— {g.src}</div>
              </div>
              <Speak t={g.zh} />
            </div>
            {g.notes?.length > 0 && (
              <div className="mt-3">
                <div className="text-[12px] font-bold mb-1" style={{ color: C.mute }}>注释 Chú thích</div>
                <div className="flex flex-wrap gap-1.5">{g.notes.map(([w, n]) => <span key={w} className="rounded-[6px] border px-2 py-1 text-[13px]" style={{ borderColor: C.line, background: C.panel }}><b className="font-zh" style={{ color: C.gold }}>{w}</b> {n}</span>)}</div>
              </div>
            )}
            <button onClick={() => setOpen({ ...open, [i]: !open[i] })} className="mt-3 text-[13px] font-bold underline" style={{ color: C.gold }}>{open[i] ? "Ẩn bản dịch" : "Tự dịch thử rồi bấm xem bản dịch"}</button>
            {open[i] && <div className="text-[14px] mt-1.5">{g.vi}</div>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function buildQuiz(l, attempt) {
  const qs = l.quiz.map((q, i) => ({ ...q, key: "q" + i }));
  // thêm 3 câu từ vựng tự sinh: Hán tự → nghĩa
  const vs = seeded(l.vocab, l.id + "v" + attempt).slice(0, 3);
  vs.forEach(([zh, py, vi], i) => {
    const wrong = seeded(l.vocab.filter((x) => x[0] !== zh), zh + attempt).slice(0, 3).map((x) => x[2]);
    qs.push({ key: "v" + i, q: `“${zh}” (${py}) nghĩa là gì?`, o: [vi, ...wrong], a: 0 });
  });
  return qs.map((q) => {
    const order = seeded(q.o.map((_, i) => i), l.id + q.key + attempt);
    return { ...q, o: order.map((i) => q.o[i]), a: order.indexOf(q.a) };
  });
}

function Quiz({ l, onDone, prev }) {
  const [attempt, setAttempt] = useState(0);
  const qs = useMemo(() => buildQuiz(l, attempt), [l, attempt]);
  const [ans, setAns] = useState({}); const [sub, setSub] = useState(null);
  const submit = () => {
    const right = qs.filter((q, i) => ans[i] === q.a).length; const s = Math.round((right / qs.length) * 100);
    const xp = onDone(s); setSub({ right, s, xp });
    setTimeout(() => document.getElementById("kq")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  const again = () => { setAttempt(attempt + 1); setAns({}); setSub(null); };
  return (
    <Panel>
      <H2 zh="试炼" right={prev != null ? `điểm cao nhất ${prev}%` : `cần ${PASS}% để mở bài sau`}>Trắc nghiệm</H2>
      <div className="grid gap-4">
        {qs.map((q, i) => (
          <div key={q.key + attempt}>
            <div className="text-[15px] font-semibold mb-1.5"><span style={{ color: C.gold }}>{i + 1}.</span> {q.q}</div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {q.o.map((o, j) => {
                const pick = ans[i] === j; const good = sub && j === q.a; const bad = sub && pick && j !== q.a;
                return (
                  <button key={j} disabled={!!sub} onClick={() => setAns({ ...ans, [i]: j })} className="text-left rounded-[8px] border px-3 py-2 text-[15px] flex items-center gap-2"
                    style={{ background: good ? C.greenSoft : bad ? C.redSoft : pick ? C.goldSoft : C.card, borderColor: good ? C.green : bad ? C.red : pick ? C.gold : C.line }}>
                    <span className="w-5 text-[12px] font-bold" style={{ color: C.mute }}>{"ABCD"[j]}</span><span className="flex-1">{o}</span>{good && <Check className="w-4 h-4 text-[#7CC48A]" />}
                  </button>
                );
              })}
            </div>
            {sub && q.ex && <div className="text-[13px] mt-1" style={{ color: C.mute }}>💡 {q.ex}</div>}
          </div>
        ))}
      </div>
      {!sub ? (
        <button onClick={submit} disabled={Object.keys(ans).length < qs.length} className="mt-5 w-full h-11 rounded-[8px] font-bold disabled:opacity-40" style={{ background: C.gold, color: "#16181C" }}>{Object.keys(ans).length < qs.length ? `Đã làm ${Object.keys(ans).length}/${qs.length} câu` : "Nộp bài"}</button>
      ) : (
        <div id="kq" className="mt-5 rounded-[10px] border p-4 text-center" style={{ background: sub.s >= PASS ? C.greenSoft : C.redSoft, borderColor: sub.s >= PASS ? C.green : C.red }}>
          <div className="text-[34px] font-extrabold">{sub.s}%</div>
          <div className="text-[14px]">Đúng {sub.right}/{qs.length} câu{sub.xp ? ` · +${sub.xp} tu vi` : ""}</div>
          <div className="text-[14px] mt-1 font-bold" style={{ color: sub.s >= PASS ? C.green : C.red }}>{sub.s >= PASS ? "Vượt thử thách — bài kế tiếp đã mở." : `Chưa đạt ${PASS}%. Ôn lại rồi thử lần nữa nhé.`}</div>
          <button onClick={again} className="mt-3 h-10 px-4 rounded-[8px] border font-bold" style={{ borderColor: C.line }}>Làm lại (đổi thứ tự)</button>
        </div>
      )}
    </Panel>
  );
}

function Dich({ items }) {
  const [txt, setTxt] = useState({}); const [show, setShow] = useState({});
  return (
    <Panel>
      <H2 zh="翻译" right="tự chấm theo bản tham khảo">Luyện dịch Trung → Việt</H2>
      <div className="grid gap-3">
        {items.map(([zh, vi], i) => (
          <div key={i} className="rounded-[8px] border p-3" style={{ background: C.card, borderColor: C.line }}>
            <div className="flex items-center gap-2"><div className="font-zh text-[19px] flex-1">{zh}</div><Speak t={zh} /></div>
            <textarea rows={2} value={txt[i] || ""} onChange={(e) => setTxt({ ...txt, [i]: e.target.value })} placeholder="Viết bản dịch của bạn…" className="w-full mt-2 rounded-[6px] border px-3 py-2 text-[15px] focus:outline-none" style={{ background: C.panel, borderColor: C.line, color: C.text }} aria-label={"Dịch câu " + (i + 1)} />
            <button onClick={() => setShow({ ...show, [i]: true })} className="mt-1 text-[13px] font-bold underline" style={{ color: C.gold }}>Xem bản tham khảo</button>
            {show[i] && <div className="text-[14px] mt-1" style={{ color: C.green }}>{vi}</div>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function Lesson({ id }) {
  const l = lessonById(id);
  const P = useProg();
  const open = useMemo(() => unlockedSet(P.prog, P.all), [P.prog, P.all]);
  if (!l) return <Shell><Panel>Không tìm thấy bài. <Link href="/huyen-hoc?tab=course" className="underline">Về danh sách bài</Link></Panel></Shell>;
  const idx = LESSONS.findIndex((x) => x.id === id); const prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
  const L = l.level;
  if (!open.has(id)) {
    return (
      <Shell title={L.realm.zh}>
        <Panel className="text-center py-10">
          <div className="w-14 h-14 mx-auto rounded-full grid place-items-center mb-3" style={{ background: C.line, color: C.mute }}><Lock className="w-6 h-6" /></div>
          <div className="font-zh text-[22px] font-bold" style={{ color: C.gold }}>{l.zh}</div>
          <p className="text-[15px] mt-2">Bài này chưa mở. Hoàn thành trắc nghiệm bài <b>{prev?.id} · <span className="font-zh">{prev?.zh}</span></b> từ {PASS}% trở lên để vào.</p>
          <div className="flex justify-center gap-2 mt-4">
            {prev && open.has(prev.id) && <Link href={`/huyen-hoc/bai/${prev.id}`} className="h-10 px-4 rounded-[8px] font-bold grid place-items-center" style={{ background: C.gold, color: "#16181C" }}>Đến bài {prev.id}</Link>}
            <Link href="/huyen-hoc?tab=course" className="h-10 px-4 rounded-[8px] border font-bold grid place-items-center" style={{ borderColor: C.line }}>Lộ trình</Link>
          </div>
        </Panel>
      </Shell>
    );
  }
  const done = isDone(P.prog, id);
  return (
    <Shell title={`${L.realm.zh} · Bài ${id}`}>
      <div className="flex items-center gap-2 text-[13px] mb-3" style={{ color: C.mute }}>
        <Link href="/huyen-hoc?tab=course" className="hover:underline">‹ 修习课程</Link><span>/</span><span className="font-zh">{L.realm.zh}</span>
        {done && <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold" style={{ background: C.greenSoft, color: C.green }}><Check className="w-3 h-3" /> Đã qua · {P.prog[id].s}%</span>}
      </div>
      <header className="mb-5">
        <div className="font-zh text-[14px]" style={{ color: C.gold }}>第{String(L.n).padStart(2, "0")}级 · {L.zh} · {L.realm.zh}</div>
        <div className="text-[12px]" style={{ color: C.mute }}>Bài {id}</div>
        <h1 className="font-zh text-[30px] md:text-[38px] font-bold leading-tight mt-1">{l.zh}</h1>
        <div className="text-[17px] font-serif-vn" style={{ color: C.mute }}>{l.vi}</div>
        <ul className="mt-3 grid gap-1 text-[14px]">{l.goal.map((g) => <li key={g} className="flex gap-2"><span style={{ color: C.gold }}>◆</span>{g}</li>)}</ul>
      </header>
      <div className="flex flex-col gap-4">
        <Panel>
          <H2 zh="讲解">Bài giảng</H2>
          {l.intro.map((t, i) => <p key={i} className="text-[15px] leading-relaxed mb-2.5 last:mb-0">{t}</p>)}
          {l.tool && <Link href={l.tool === "tv" ? "/huyen-hoc/tu-vi" : `/huyen-hoc/cong-cu#${l.tool}`} className="mt-3 inline-flex items-center gap-2 rounded-[8px] border px-3 py-2 text-[14px] font-bold" style={{ borderColor: C.goldDim, color: C.gold }}>器 Thực hành với công cụ <span className="font-zh">{TOOL[l.tool]}</span> ›</Link>}
        </Panel>
        <Panel>
          <H2 zh="词汇" right={`${l.vocab.length} từ`}>Từ vựng cần nhớ</H2>
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="text-left text-[12px]" style={{ color: C.mute }}><th className="py-1.5 pr-2 font-semibold">Hán tự</th><th className="py-1.5 pr-2 font-semibold">Pinyin</th><th className="py-1.5 pr-2 font-semibold">Nghĩa</th><th /></tr></thead>
              <tbody>{l.vocab.map(([zh, py, vi]) => (
                <tr key={zh} className="border-t" style={{ borderColor: C.line }}>
                  <td className="py-2 pr-2 font-zh text-[19px] font-bold whitespace-nowrap">{zh}</td>
                  <td className="py-2 pr-2 whitespace-nowrap" style={{ color: C.gold }}>{py}</td>
                  <td className="py-2 pr-2">{vi}</td>
                  <td className="py-1 w-8"><Speak t={zh} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
        {l.gram?.length > 0 && (
          <Panel>
            <H2 zh="句型">Mẫu câu</H2>
            <div className="grid md:grid-cols-2 gap-2">
              {l.gram.map(([pat, m, ex, exv]) => (
                <div key={pat} className="rounded-[8px] border p-3" style={{ background: C.card, borderColor: C.line }}>
                  <div className="font-zh text-[18px] font-bold" style={{ color: C.gold }}>{pat}</div>
                  <div className="text-[13px]" style={{ color: C.mute }}>{m}</div>
                  <div className="flex items-center gap-1 mt-1.5"><span className="font-zh text-[17px] flex-1">{ex}</span><Speak t={ex} /></div>
                  <div className="text-[14px]">{exv}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}
        <Reading read={l.read} />
        {l.gu?.length > 0 && <Classic gu={l.gu} />}
        <Quiz l={l} prev={P.prog[id]?.s} onDone={(s) => P.save(id, s)} />
        {l.dich?.length > 0 && <Dich items={l.dich} />}
        <div className="grid grid-cols-2 gap-2">
          {prev ? <Link href={`/huyen-hoc/bai/${prev.id}`} className="rounded-[8px] border p-3" style={{ background: C.panel, borderColor: C.line }}><div className="text-[12px]" style={{ color: C.mute }}>‹ Bài trước · {prev.id}</div><div className="font-zh font-bold truncate">{prev.zh}</div></Link> : <span />}
          {next && (open.has(next.id)
            ? <Link href={`/huyen-hoc/bai/${next.id}`} className="rounded-[8px] border p-3 text-right" style={{ background: C.goldSoft, borderColor: C.gold }}><div className="text-[12px]" style={{ color: C.mute }}>Bài sau · {next.id} ›</div><div className="font-zh font-bold truncate" style={{ color: C.gold }}>{next.zh}</div></Link>
            : <div className="rounded-[8px] border p-3 text-right opacity-60" style={{ background: C.panel, borderColor: C.line }}><div className="text-[12px] inline-flex items-center gap-1" style={{ color: C.mute }}><Lock className="w-3 h-3" /> Bài sau · {next.id}</div><div className="font-zh font-bold truncate">{next.zh}</div></div>)}
        </div>
      </div>
    </Shell>
  );
}
