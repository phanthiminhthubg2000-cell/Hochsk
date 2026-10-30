"use client";
// ============================================================
// ĐUA VỀ ĐÍCH 赛跑 — MÀN HÌNH GIÁO VIÊN
// Mỗi bạn có một "con vật" trên đường đua. Trả lời đúng trên điện thoại → tiến 1 bước.
// Sai → lùi 1 bước (không lùi quá vạch xuất phát) và bị khoá 2 giây.
// Ba bạn về đích đầu tiên giành huy chương; giáo viên có thể kết thúc bất cứ lúc nào.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { db } from "../../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ROOMS, RACERS, useDeck, useTone, useHostRoom, HostShell, SetupScreen, LobbyQR, QrModal, Label, Choice, Podium, EndButtons, useAnswerFeed, LiveFeed, MissedWords } from "../shared";

const TARGETS = [[10, "10 bước", "≈ 3 phút"], [15, "15 bước", "≈ 5 phút"], [20, "20 bước", "≈ 7 phút"], [30, "30 bước", "dài"]];
const ENDS = [[3, "Khi có 3 bạn về đích"], [99, "Khi tất cả về đích"]];

export default function RaceHost() {
  const deck = useDeck();
  const tone = useTone();
  const R = useHostRoom();
  const [target, setTarget] = useState(15);
  const [endWhen, setEndWhen] = useState(3);
  const [back, setBack] = useState(true);
  const [phase, setPhase] = useState("setup");
  const [err, setErr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const G = useRef({ finish: [], ended: false, prev: {} });
  const [finish, setFinish] = useState([]);
  const F = useAnswerFeed(R.players, phase === "play");

  async function createRoom() {
    setErr("");
    if (deck.pool.length < 4) { setErr("Hãy chọn bài có ít nhất 4 từ."); return; }
    try {
      await R.create({ game: "race", cfg: { ...deck.cfg(), target, back }, target, finish: [] });
      setPhase("lobby");
    } catch (e) { setErr("Không tạo được phòng (" + (e.code || e.message) + ")."); }
  }

  async function start() {
    if (!R.players.length) { setErr("Chưa có học sinh nào vào phòng."); return; }
    await R.resetPlayers({ pos: 0, correct: 0, wrong: 0, score: 0, doneAt: null, last: null });
    F.start();
    G.current = { finish: [], ended: false, prev: {} };
    setFinish([]); setPhase("play");
    await updateDoc(doc(db, ROOMS, R.code), { status: "play", target, finish: [], startAt: Date.now() });
    tone.tone(523, 0, 0.15, "triangle"); tone.tone(523, 0.4, 0.15, "triangle"); tone.tone(1046, 0.8, 0.35, "triangle");
  }

  async function end() {
    const g = G.current;
    if (g.ended) return; g.ended = true;
    setPhase("end"); tone.fanfare();
    await updateDoc(doc(db, ROOMS, R.code), { status: "end" }).catch(() => {});
  }

  // theo dõi ai về đích
  useEffect(() => {
    if (phase !== "play") return;
    const g = G.current;
    R.players.forEach((p) => {
      const was = g.prev[p.id] || 0, now = p.pos || 0;
      if (now > was) tone.tone(660 + Math.min(now, 30) * 12, 0, 0.06, "triangle", 0.06);
      g.prev[p.id] = now;
      if (now >= target && !g.finish.includes(p.id)) {
        g.finish.push(p.id);
        setFinish(g.finish.slice());
        updateDoc(doc(db, ROOMS, R.code), { finish: g.finish.slice() }).catch(() => {});
        tone.fanfare();
      }
    });
    const need = Math.min(endWhen, R.players.length);
    if (need > 0 && g.finish.length >= need) setTimeout(end, 1500);
  }, [R.players, phase]); // eslint-disable-line

  const order = R.players; // giữ làn cố định theo thứ tự vào phòng
  const rank = (pid) => finish.indexOf(pid);
  const lane = order.length > 24 ? 30 : order.length > 14 ? 38 : 50;
  const ranked = R.players.slice().sort((a, b) => {
    const ra = rank(a.id), rb = rank(b.id);
    if (ra >= 0 || rb >= 0) return (ra < 0 ? 999 : ra) - (rb < 0 ? 999 : rb);
    return (b.pos || 0) - (a.pos || 0) || (b.correct || 0) - (a.correct || 0);
  });

  return (
    <HostShell icon="🏁" title="Đua về đích" zh="赛跑" code={R.code} onQr={phase === "play" || phase === "end" ? () => setShowQr(true) : null} tone={tone} err={err || deck.err}>
      {phase === "setup" && (
        <SetupScreen emoji="🏁" title="Đua về đích" zh="汉字赛跑" deck={deck} onCreate={createRoom}
          rules={["📱 Học sinh quét QR, nhập tên — mỗi bạn được một con vật trên đường đua.",
            "⚡ Ai cũng trả lời liên tục trên điện thoại của mình.",
            "✅ Đúng → tiến 1 bước · ❌ Sai → lùi 1 bước và khoá 2 giây.",
            "🥇 Ba bạn về đích đầu tiên giành huy chương.",
            "📺 Màn hình này cho cả lớp xem cuộc đua trực tiếp."]}>
          <div className="grid sm:grid-cols-2 gap-5">
            <div><Label>Độ dài đường đua</Label><Choice items={TARGETS} value={target} onChange={setTarget} /></div>
            <div><Label>Kết thúc</Label><Choice items={ENDS} value={endWhen} onChange={setEndWhen} /></div>
          </div>
          <label className="flex items-center gap-2 font-bold text-sm">
            <input type="checkbox" checked={back} onChange={(e) => setBack(e.target.checked)} className="w-5 h-5 accent-[#2E9D5B]" />
            Trả lời sai thì lùi 1 bước
          </label>
        </SetupScreen>
      )}

      {phase === "lobby" && (
        <main className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 grid gap-8 lg:grid-cols-[auto_1fr] items-start">
          <LobbyQR qr={R.qr} code={R.code} joinUrl={R.joinUrl} />
          <section className="flex flex-col gap-5">
            <div className="rounded-[22px] bg-[#1E5C38] text-white p-6">
              <div className="text-sm font-bold opacity-80">{R.room?.cfg?.level} · {R.room?.cfg?.lessons} · {R.room?.cfg?.mode} · {target} bước</div>
              <div className="text-3xl font-extrabold mt-1">Đã có {R.players.length} bạn vào phòng</div>
            </div>
            <div className="flex flex-wrap gap-2.5 min-h-[120px] content-start">
              {R.players.length === 0 && <div className="text-[#5B7262]">Đang chờ học sinh quét mã…</div>}
              {R.players.map((p, i) => (
                <span key={p.id} className="inline-flex items-center gap-2 pl-2 pr-2 py-2 rounded-full bg-white border border-[#C9D6BE] font-bold text-lg" style={{ animation: "pop .3s" }}>
                  <span className="text-2xl">{RACERS[i % RACERS.length]}</span>{p.name}
                  <button onClick={() => R.kick(p.id)} aria-label={`Mời ${p.name} ra khỏi phòng`} className="w-7 h-7 rounded-full hover:bg-[#FDE8E8] text-[#9AAB9E] hover:text-[#C0392B]">×</button>
                </span>
              ))}
            </div>
            <button disabled={R.players.length < 1} onClick={start} className="h-16 rounded-2xl bg-[#E8590C] hover:bg-[#C94A08] disabled:opacity-40 text-white text-xl font-extrabold">🏁 Xuất phát!</button>
          </section>
        </main>
      )}

      {(phase === "play" || phase === "end") && (
        <main className="max-w-[1700px] mx-auto px-4 md:px-8 py-6 grid gap-6 xl:grid-cols-[1fr_280px_300px]">
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-extrabold bg-white border border-[#DDE6D3] rounded-full px-4 py-2">Đích: {target} bước</span>
              <span className="text-sm font-bold text-[#5B7262]">{finish.length} bạn đã về đích</span>
              <span className="ml-auto" />
              {phase === "play" && <button onClick={end} className="h-10 px-4 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">Kết thúc</button>}
            </div>
            <div className="rounded-[22px] bg-[#7FB069] p-2 md:p-3 overflow-hidden">
              {order.map((p, i) => {
                const pct = Math.min(1, (p.pos || 0) / target);
                const rk = rank(p.id);
                return (
                  <div key={p.id} className="grid grid-cols-[120px_1fr] items-stretch" style={{ height: lane }}>
                    <span className="self-center pr-2 text-right text-[15px] font-extrabold text-white drop-shadow truncate">{p.name}</span>
                    <div className={`relative bg-[#C8915A] border-b border-dashed border-white/40 ${i === 0 ? "rounded-t-[12px]" : ""} ${i === order.length - 1 ? "rounded-b-[12px] border-b-0" : ""}`}
                      style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent 0 calc(100%/${target} - 2px), rgba(255,255,255,.22) calc(100%/${target} - 2px) calc(100%/${target}))` }}>
                      <div className="absolute top-0 bottom-0 right-0 w-4" style={{ background: "repeating-conic-gradient(#111 0 25%, #fff 0 50%) 0 0/12px 12px" }} />
                      <div className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all duration-500 ease-out" style={{ left: `calc(${pct * 100}% - ${pct * (lane + 30)}px + 2px)` }}>
                        <span className="leading-none" style={{ fontSize: lane * 0.72, transform: "scaleX(-1)", display: "inline-block", animation: phase === "play" && rk < 0 ? "bob .5s infinite" : "none" }}>{RACERS[i % RACERS.length]}</span>
                        {rk >= 0 && <span className="text-xl">{["🥇", "🥈", "🥉"][rk] || "🏁"}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <aside className="rounded-[22px] bg-white border border-[#DDE6D3] p-4 self-start">
            <div className="font-extrabold text-lg mb-3">Bảng xếp hạng</div>
            <ol className="flex flex-col gap-1.5 max-h-[72vh] overflow-auto">
              {ranked.map((p, i) => (
                <li key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rank(p.id) >= 0 ? "bg-[#FFF4DE]" : "bg-[#F6F9F2]"}`}>
                  <span className="w-6 text-center font-extrabold text-[#5B7262]">{rank(p.id) >= 0 ? ["🥇", "🥈", "🥉"][rank(p.id)] || "🏁" : i + 1}</span>
                  <span className="text-xl">{RACERS[order.indexOf(p) % RACERS.length]}</span>
                  <span className="flex-1 font-bold truncate">{p.name}</span>
                  <span className="font-extrabold tabular-nums">{Math.min(p.pos || 0, target)}/{target}</span>
                </li>
              ))}
            </ol>
          </aside>
          <LiveFeed feed={F.feed} />
          {phase === "end" && (
            <div className="xl:col-span-3 text-center">
              <h2 className="text-4xl font-extrabold">🏆 Kết quả cuộc đua</h2>
              <Podium list={ranked} valueOf={(p) => `${Math.min(p.pos || 0, target)}/${target}`} unit="bước" />
              <div className="flex gap-3 justify-center mt-6"><button onClick={start} className="h-12 px-6 rounded-xl bg-[#E8590C] text-white font-extrabold">🔁 Đua lại</button></div>
              <MissedWords missed={F.missed} />
              <EndButtons />
            </div>
          )}
        </main>
      )}

      {showQr && <QrModal qr={R.qr} code={R.code} onClose={() => setShowQr(false)} />}
    </HostShell>
  );
}
