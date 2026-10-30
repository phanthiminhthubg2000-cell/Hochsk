"use client";
// ============================================================
// KÉO CO 拔河 — MÀN HÌNH GIÁO VIÊN
// Cả lớp chia 2 đội Đỏ / Xanh. Mỗi bạn tự trả lời liên tục trên điện thoại;
// mỗi câu đúng kéo dây về phía đội mình (đã cân theo số người mỗi đội).
// Hết giờ, dây nghiêng về đội nào thì đội đó thắng; kéo chạm vạch là thắng sớm.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { db } from "../../../firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { ROOMS, useDeck, useTone, useHostRoom, HostShell, SetupScreen, LobbyQR, QrModal, Label, Choice, EndButtons, useAnswerFeed, LiveFeed, MissedWords, ResultSaver } from "../shared";

const TEAMS = {
  red: { name: "Đội Đỏ", zh: "红队", c: "#D64545", soft: "#FDE8E8", ring: "#F2B8B8" },
  blue: { name: "Đội Xanh", zh: "蓝队", c: "#2F6FD6", soft: "#E8F0FF", ring: "#B9CDF4" },
};
const DURS = [[60, "60 giây"], [90, "90 giây"], [120, "2 phút"], [180, "3 phút"]];

export default function TugHost() {
  const deck = useDeck();
  const tone = useTone();
  const R = useHostRoom();
  const [dur, setDur] = useState(90);
  const [phase, setPhase] = useState("setup");
  const [err, setErr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [left, setLeft] = useState(0);
  const [rope, setRope] = useState(0); // -1 (đỏ thắng) … +1 (xanh thắng)
  const [winner, setWinner] = useState(null);
  const G = useRef({ endAt: 0, W: 10, ended: false, lastR: 0, lastB: 0 });
  const F = useAnswerFeed(R.players, phase === "play");

  // tự xếp đội cho bạn mới vào: vào đội ít người hơn
  function autoTeam(list, c) {
    let r = list.filter((p) => p.team === "red").length, b = list.filter((p) => p.team === "blue").length;
    list.filter((p) => !p.team).forEach((p) => {
      const t = r <= b ? "red" : "blue"; t === "red" ? r++ : b++;
      setDoc(doc(db, ROOMS, c, "players", p.id), { team: t }, { merge: true }).catch(() => {});
    });
  }

  async function createRoom() {
    setErr("");
    if (deck.pool.length < 4) { setErr("Hãy chọn bài có ít nhất 4 từ."); return; }
    try {
      await R.create({ game: "tug", cfg: { ...deck.cfg(), dur } }, autoTeam);
      setPhase("lobby");
    } catch (e) { setErr("Không tạo được phòng (" + (e.code || e.message) + ")."); }
  }

  const switchTeam = (p) => setDoc(doc(db, ROOMS, R.code, "players", p.id), { team: p.team === "red" ? "blue" : "red" }, { merge: true }).catch(() => {});
  function shuffleTeams() {
    const list = R.players.slice().sort(() => Math.random() - 0.5);
    list.forEach((p, i) => setDoc(doc(db, ROOMS, R.code, "players", p.id), { team: i % 2 ? "blue" : "red" }, { merge: true }).catch(() => {}));
  }

  // ---------- tính lực kéo ----------
  function strength(list) {
    const red = list.filter((p) => p.team === "red"), blue = list.filter((p) => p.team === "blue");
    const sum = (a) => a.reduce((s, p) => s + (p.correct || 0), 0);
    const n = Math.max(2, red.length + blue.length), half = n / 2;
    const r = red.length ? (sum(red) / red.length) * half : 0;
    const b = blue.length ? (sum(blue) / blue.length) * half : 0;
    return { r, b, red, blue, diff: b - r };
  }

  async function start() {
    const g = G.current;
    if (!R.players.length) { setErr("Chưa có học sinh nào vào phòng."); return; }
    await R.resetPlayers({ correct: 0, wrong: 0, score: 0, last: null });
    F.start();
    g.W = Math.round(6 + R.players.length * 0.8);
    g.endAt = Date.now() + dur * 1000; g.ended = false;
    setRope(0); setWinner(null); setPhase("play");
    await updateDoc(doc(db, ROOMS, R.code), { status: "play", endAt: g.endAt, dur: dur * 1000, W: g.W, winner: null });
    tone.tone(523, 0, 0.15, "triangle"); tone.tone(784, 0.12, 0.25, "triangle");
  }

  async function finish(w) {
    const g = G.current;
    if (g.ended) return; g.ended = true;
    setWinner(w); setPhase("end"); tone.fanfare();
    await updateDoc(doc(db, ROOMS, R.code), { status: "end", winner: w }).catch(() => {});
  }

  // vòng lặp: cập nhật dây + đồng hồ
  useEffect(() => {
    if (phase !== "play") return;
    const iv = setInterval(() => {
      const g = G.current;
      const s = strength(R.playersRef.current);
      const x = Math.max(-1, Math.min(1, s.diff / g.W));
      setRope(x);
      // tiếng "hò dô" khi có câu đúng mới
      if (s.r > g.lastR + 0.01) tone.tone(392, 0, 0.06, "square", 0.05);
      if (s.b > g.lastB + 0.01) tone.tone(587, 0, 0.06, "square", 0.05);
      g.lastR = s.r; g.lastB = s.b;
      const l = Math.max(0, g.endAt - Date.now());
      setLeft(l);
      if (x <= -1) finish("red");
      else if (x >= 1) finish("blue");
      else if (l <= 0) finish(s.diff > 0 ? "blue" : s.diff < 0 ? "red" : "draw");
    }, 200);
    return () => clearInterval(iv);
  }, [phase]); // eslint-disable-line

  const s = strength(R.players);

  return (
    <HostShell icon="🪢" title="Kéo co" zh="拔河" code={R.code} onQr={phase === "play" || phase === "end" ? () => setShowQr(true) : null} tone={tone} err={err || deck.err}>
      {phase === "setup" && (
        <SetupScreen emoji="🪢" title="Kéo co" zh="拔河比赛" deck={deck} onCreate={createRoom}
          rules={["📱 Học sinh quét QR, nhập tên — tự chia thành Đội Đỏ và Đội Xanh.",
            "⚡ Mỗi bạn trả lời liên tục trên điện thoại của mình, không cần chờ lượt.",
            "✅ Mỗi câu đúng kéo dây về phía đội mình · ❌ Sai thì bị khoá 2 giây.",
            "⚖️ Lực kéo được cân theo số người, đội ít người không bị thiệt.",
            "🏁 Kéo dây chạm vạch là thắng ngay; hết giờ dây nghiêng về đội nào, đội đó thắng."]}>
          <div>
            <Label>Thời gian mỗi trận</Label>
            <Choice items={DURS} value={dur} onChange={setDur} />
          </div>
        </SetupScreen>
      )}

      {phase === "lobby" && (
        <main className="max-w-[1300px] mx-auto px-4 md:px-8 py-8 grid gap-8 lg:grid-cols-[auto_1fr] items-start">
          <LobbyQR qr={R.qr} code={R.code} joinUrl={R.joinUrl} />
          <section className="flex flex-col gap-5">
            <div className="rounded-[22px] bg-[#1E5C38] text-white p-6">
              <div className="text-sm font-bold opacity-80">{R.room?.cfg?.level} · {R.room?.cfg?.lessons} · {R.room?.cfg?.mode} · {dur} giây</div>
              <div className="text-3xl font-extrabold mt-1">Đã có {R.players.length} bạn vào phòng</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {["red", "blue"].map((t) => (
                <div key={t} className="rounded-[20px] border-2 p-4 min-h-[160px]" style={{ background: TEAMS[t].soft, borderColor: TEAMS[t].ring }}>
                  <div className="font-extrabold text-xl" style={{ color: TEAMS[t].c }}>{TEAMS[t].name} <span className="zh">{TEAMS[t].zh}</span> · {(t === "red" ? s.red : s.blue).length}</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(t === "red" ? s.red : s.blue).map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full bg-white font-bold" style={{ animation: "pop .3s" }}>
                        {p.name}
                        <button onClick={() => switchTeam(p)} title="Chuyển đội" className="w-7 h-7 rounded-full hover:bg-black/5">⇄</button>
                        <button onClick={() => R.kick(p.id)} aria-label={`Mời ${p.name} ra khỏi phòng`} className="w-7 h-7 rounded-full hover:bg-[#FDE8E8] text-[#9AAB9E] hover:text-[#C0392B]">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={shuffleTeams} className="h-12 px-5 rounded-xl border border-[#C9D6BE] bg-white font-bold">🔀 Chia lại đội ngẫu nhiên</button>
            </div>
            <button disabled={R.players.length < 2} onClick={start} className="h-16 rounded-2xl bg-[#E8590C] hover:bg-[#C94A08] disabled:opacity-40 text-white text-xl font-extrabold">🪢 Bắt đầu kéo!</button>
            <p className="text-sm text-[#5B7262]">Bấm ⇄ để chuyển một bạn sang đội kia. Bạn vào muộn sẽ được xếp vào đội ít người hơn và vẫn chơi được ngay.</p>
          </section>
        </main>
      )}

      {(phase === "play" || phase === "end") && (
        <main className="max-w-[1500px] mx-auto px-4 md:px-8 py-6 grid gap-6 xl:grid-cols-[1fr_320px] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-[#5B7262]">{R.room?.cfg?.level} · {R.room?.cfg?.lessons}</span>
            <span className="ml-auto" />
            {phase === "play" && <span className={`text-4xl font-extrabold tabular-nums ${left < 10000 ? "text-[#C0392B]" : ""}`}>⏱ {Math.ceil(left / 1000)}s</span>}
            {phase === "play" && <button onClick={() => finish(s.diff > 0 ? "blue" : s.diff < 0 ? "red" : "draw")} className="h-10 px-4 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">Kết thúc</button>}
          </div>

          <Rope x={rope} winner={winner} />

          <div className="grid md:grid-cols-2 gap-5">
            {["red", "blue"].map((t) => {
              const list = (t === "red" ? s.red : s.blue).slice().sort((a, b) => (b.correct || 0) - (a.correct || 0));
              const total = list.reduce((x, p) => x + (p.correct || 0), 0);
              return (
                <div key={t} className="rounded-[20px] border-2 p-4" style={{ background: TEAMS[t].soft, borderColor: winner === t ? TEAMS[t].c : TEAMS[t].ring }}>
                  <div className="flex items-baseline gap-2">
                    <div className="font-extrabold text-2xl" style={{ color: TEAMS[t].c }}>{winner === t ? "🏆 " : ""}{TEAMS[t].name}</div>
                    <div className="ml-auto font-extrabold text-xl tabular-nums">{total} câu đúng</div>
                  </div>
                  <ol className="mt-3 grid grid-cols-2 gap-1.5 max-h-[34vh] overflow-auto">
                    {list.map((p, i) => (
                      <li key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white">
                        <span className="w-5 text-center font-extrabold text-[#5B7262]">{i === 0 && (p.correct || 0) > 0 ? "⭐" : i + 1}</span>
                        <span className="flex-1 font-bold truncate">{p.name}</span>
                        <span className="font-extrabold tabular-nums">{p.correct || 0}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>

          {phase === "end" && (
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-extrabold" style={{ color: winner && TEAMS[winner] ? TEAMS[winner].c : "#13261C", animation: "flashIn .5s" }}>
                {winner === "draw" ? "🤝 Hoà!" : `🏆 ${TEAMS[winner]?.name} thắng!`}
              </div>
              <div className="flex gap-3 justify-center mt-6 flex-wrap">
                <button onClick={start} className="h-12 px-6 rounded-xl bg-[#E8590C] text-white font-extrabold">🔁 Đấu lại (giữ đội)</button>
                <button onClick={async () => { setPhase("lobby"); await updateDoc(doc(db, ROOMS, R.code), { status: "lobby", winner: null }); }} className="h-12 px-6 rounded-xl border border-[#C9D6BE] bg-white font-bold">Chia lại đội</button>
              </div>
              <MissedWords missed={F.missed} />
              <ResultSaver game="tug" cfg={{ ...(R.room?.cfg || {}), winner }} players={R.players} metric={(p) => p.correct || 0} missed={F.missed} />
              <EndButtons />
            </div>
          )}
        </div>
          <LiveFeed feed={F.feed} color={(f) => (TEAMS[f.team] ? TEAMS[f.team].c : "#13261C")} />
        </main>
      )}

      {showQr && <QrModal qr={R.qr} code={R.code} onClose={() => setShowQr(false)} />}
    </HostShell>
  );
}

// ---------- sợi dây kéo co ----------
function Rope({ x, winner }) {
  const shift = x * 300; // px trong hệ toạ độ 1000
  const pull = (side) => (side === "red" ? x < -0.05 : x > 0.05);
  const people = (side) => [0, 1, 2].map((i) => {
    const base = side === "red" ? 330 - i * 70 : 670 + i * 70;
    const lean = side === "red" ? -12 : 12;
    return (
      <g key={side + i} transform={`translate(${base + shift} 190)`}>
        <g transform={`rotate(${pull(side) ? lean : lean / 3})`} style={{ transition: "transform .3s" }}>
          <rect x="-13" y="-62" width="26" height="44" rx="10" fill={side === "red" ? "#D64545" : "#2F6FD6"} />
          <circle cx="0" cy="-78" r="15" fill="#F6D1B1" />
          <path d="M-15 -82 q0 -16 15 -16 q15 0 15 16 q-8 -6 -15 -6 q-7 0 -15 6z" fill="#3a2a22" />
          <circle cx={side === "red" ? 5 : -5} cy="-78" r="2" fill="#3b2f2f" />
          <path d={side === "red" ? "M-6 -18 L-18 18 M6 -18 L10 18" : "M6 -18 L18 18 M-6 -18 L-10 18"} stroke="#3d4a66" strokeWidth="8" strokeLinecap="round" />
          <path d={side === "red" ? "M0 -50 L22 -30" : "M0 -50 L-22 -30"} stroke={side === "red" ? "#D64545" : "#2F6FD6"} strokeWidth="7" strokeLinecap="round" />
        </g>
      </g>
    );
  });
  return (
    <div className="rounded-[26px] bg-white border border-[#DDE6D3] p-3 overflow-hidden">
      <svg viewBox="0 0 1000 250" className="w-full h-auto" role="img" aria-label="Sợi dây kéo co">
        <rect x="0" y="0" width="500" height="250" fill="#FDF1F1" />
        <rect x="500" y="0" width="500" height="250" fill="#EEF3FD" />
        <rect x="0" y="200" width="1000" height="50" fill="#CFE6B8" />
        {/* vạch thắng */}
        <line x1="200" y1="40" x2="200" y2="215" stroke="#D64545" strokeWidth="5" strokeDasharray="10 8" />
        <line x1="800" y1="40" x2="800" y2="215" stroke="#2F6FD6" strokeWidth="5" strokeDasharray="10 8" />
        <text x="200" y="30" textAnchor="middle" fontSize="20" fontWeight="800" fill="#D64545">Vạch thắng Đỏ</text>
        <text x="800" y="30" textAnchor="middle" fontSize="20" fontWeight="800" fill="#2F6FD6">Vạch thắng Xanh</text>
        <line x1="500" y1="60" x2="500" y2="215" stroke="#9AAB9E" strokeWidth="2" />
        {/* dây */}
        <g style={{ transition: "transform .35s ease-out" }} transform={`translate(${shift} 0)`}>
          <path d="M60 160 Q500 172 940 160" stroke="#B98A4E" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M60 160 Q500 172 940 160" stroke="#8B6A3E" strokeWidth="9" fill="none" strokeDasharray="4 14" />
          <rect x="492" y="140" width="16" height="44" rx="4" fill={winner === "red" ? "#D64545" : winner === "blue" ? "#2F6FD6" : "#F2B705"} />
        </g>
        {people("red")}
        {people("blue")}
      </svg>
    </div>
  );
}
