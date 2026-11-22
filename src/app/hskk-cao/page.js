"use client";
// LUYỆN HSKK CAO CẤP — tách riêng 3 phần: 听后复述 (nghe kể lại) · 回答问题 (trả lời câu hỏi) · 朗读 (đọc to)
// Dữ liệu: /public/hskk-cao/{retell,qa,read}.json · audio gốc cắt từ đề thi thật · chấm: /api/hskk-cao
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, SignInButton } from "@clerk/nextjs";
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";

const C = { bg: "#EFE7D6", card: "#FBF8F1", line: "#D8CBAE", ink: "#1C1A17", mute: "#6B6253", red: "#9E2F22", green: "#2F6E5A", gold: "#E6B656" };
const TOPIC = { xh: "Xã hội", cn: "Công nghệ", gd: "Giáo dục · học tập", cv: "Công việc", bt: "Bản thân", ql: "Quan hệ", vh: "Văn hoá · du lịch", sh: "Cuộc sống · tiêu dùng" };
const TYPE = { qd: "Nêu quan điểm", ab: "Chọn A hay B", kn: "Kể trải nghiệm", gt: "Giới thiệu · miêu tả", gd: "Giả định “nếu…”" };
const TABS = [
  { k: "retell", zh: "听后复述", vn: "Nghe kể lại" },
  { k: "qa", zh: "回答问题", vn: "Trả lời câu hỏi" },
  { k: "read", zh: "朗读", vn: "Đọc to" },
];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------- lịch sử luyện (trên máy này) ----------
const HKEY = "hskkcao_hist_v1";
function loadHist() { try { return JSON.parse(localStorage.getItem(HKEY) || "{}"); } catch { return {}; } }
function saveHist(h) { try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch {} }

// ---------- pinyin ----------
function usePinyin() {
  const [fn, setFn] = useState(null);
  useEffect(() => { import("pinyin-pro").then((m) => setFn(() => m.pinyin)).catch(() => {}); }, []);
  return fn;
}
function Ruby({ text, py, className = "" }) {
  const parts = useMemo(() => {
    if (!py) return null;
    try { return py(text, { type: "all" }); } catch { return null; }
  }, [text, py]);
  if (!parts) return <span className={className}>{text}</span>;
  return <span className={className}>{parts.map((p, i) => (p.isZh ? <ruby key={i}>{p.origin}<rt style={{ fontSize: "0.58em", color: C.mute }}>{p.pinyin}</rt></ruby> : <span key={i}>{p.origin}</span>))}</span>;
}
function ZhText({ text, showPy, py, size = 19 }) {
  return (
    <div lang="zh-CN" style={{ fontFamily: '"Noto Serif SC",serif', fontSize: size, lineHeight: showPy ? 2.2 : 1.8 }}>
      {String(text).split("\n").map((p, i) => <p key={i} className="mb-2">{showPy ? <Ruby text={p} py={py} /> : p}</p>)}
    </div>
  );
}

// ---------- ghi âm ----------
function useRecorder() {
  const [rec, setRec] = useState(false);
  const [sec, setSec] = useState(0);
  const [blob, setBlob] = useState(null);
  const [err, setErr] = useState("");
  const mr = useRef(null), chunks = useRef([]), timer = useRef(null), limitRef = useRef(0), stream = useRef(null);
  const stop = () => { try { mr.current?.state === "recording" && mr.current.stop(); } catch {} };
  const start = async (limit) => {
    setErr(""); setBlob(null); setSec(0); limitRef.current = limit;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch { setErr("Không mở được micro. Hãy cho phép trình duyệt dùng micro rồi thử lại."); return false; }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      clearInterval(timer.current); setRec(false);
      stream.current?.getTracks().forEach((t) => t.stop());
      setBlob(new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" }));
    };
    mr.current = r; r.start(1000); setRec(true);
    const t0 = Date.now();
    timer.current = setInterval(() => { const s = (Date.now() - t0) / 1000; setSec(s); if (s >= limitRef.current) stop(); }, 250);
    return true;
  };
  useEffect(() => () => { clearInterval(timer.current); stop(); stream.current?.getTracks().forEach((t) => t.stop()); }, []);
  return { rec, sec, blob, err, start, stop, reset: () => { setBlob(null); setSec(0); } };
}
const toB64 = (blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.25, ac.currentTime); o.start(); o.stop(ac.currentTime + 0.35);
  } catch {}
}

// ---------- khối giao diện nhỏ ----------
const Card = ({ children, className = "" }) => <div className={`rounded-[12px] border p-4 md:p-5 ${className}`} style={{ background: C.card, borderColor: C.line }}>{children}</div>;
const Btn = ({ children, onClick, kind = "dark", disabled, className = "" }) => {
  const st = kind === "dark" ? { background: C.ink, color: "#fff", borderColor: C.ink } : kind === "red" ? { background: C.red, color: "#fff", borderColor: C.red } : kind === "green" ? { background: C.green, color: "#fff", borderColor: C.green } : { background: "#fff", color: C.ink, borderColor: C.line };
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-full text-sm font-bold border disabled:opacity-40 ${className}`} style={st}>{children}</button>;
};
const Chip = ({ on, children, onClick }) => <button onClick={onClick} className="px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap" style={on ? { background: C.ink, color: "#fff", borderColor: C.ink } : { background: C.card, borderColor: C.line }}>{children}</button>;
const Bar = ({ v, max, color = C.red }) => <div className="h-2 rounded-full overflow-hidden" style={{ background: "#E6DCC6" }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: color }} /></div>;
const scoreColor = (s) => (s >= 80 ? C.green : s >= 60 ? "#B07D1A" : C.red);

function ScoreBox({ score, labels }) {
  if (!score) return null;
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="w-20 h-20 rounded-full grid place-items-center text-white font-extrabold text-2xl shrink-0" style={{ background: scoreColor(score.total) }}>{score.total}</div>
      <div className="flex-1 min-w-[180px] grid gap-1.5">
        {Object.entries(labels).map(([k, l]) => (
          <div key={k} className="grid grid-cols-[110px_1fr_32px] items-center gap-2 text-sm"><span style={{ color: C.mute }}>{l}</span><Bar v={score[k] || 0} max={100} color={scoreColor(score[k] || 0)} /><b className="text-right">{score[k] ?? "–"}</b></div>
        ))}
      </div>
    </div>
  );
}

function Feedback({ fb, mode }) {
  if (!fb) return null;
  if (fb.error) return <Card><p style={{ color: C.red }}>{fb.error}</p></Card>;
  const labels = mode === "retell" ? { content: "Giữ ý", language: "Ngôn ngữ", fluency: "Trôi chảy" } : mode === "answer" ? { content: "Nội dung", structure: "Bố cục", language: "Ngôn ngữ", fluency: "Trôi chảy" } : { accuracy: "Đọc đúng chữ", tone: "Thanh điệu", fluency: "Ngắt nghỉ · trôi chảy" };
  const n = (fb.transcript || "").replace(/[^一-鿿]/g, "").length;
  return (
    <Card className="flex flex-col gap-4">
      <div className="font-bold text-sm tracking-wide" style={{ color: C.mute }}>KẾT QUẢ CHẤM</div>
      <ScoreBox score={fb.score} labels={labels} />
      {fb.comment && <p className="text-[15px]">{fb.comment}</p>}
      <div>
        <div className="text-xs font-bold mb-1" style={{ color: C.mute }}>BẠN ĐÃ NÓI ({n} chữ)</div>
        <p lang="zh-CN" className="text-[16px] leading-relaxed rounded-[8px] p-3" style={{ background: "#F3EDE0", fontFamily: '"Noto Serif SC",serif' }}>{fb.transcript || "(không nghe rõ)"}</p>
      </div>
      {fb.strengths?.length > 0 && <List title="Điểm tốt" items={fb.strengths} color={C.green} />}
      {fb.missing?.length > 0 && <List title="Ý bị bỏ sót / kể sai" items={fb.missing} color={C.red} />}
      {fb.errors?.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-1" style={{ color: C.mute }}>SỬA LỖI</div>
          <div className="grid gap-2">{fb.errors.map((e, i) => <div key={i} className="text-sm rounded-[8px] p-2.5 border" style={{ borderColor: C.line }}><span lang="zh-CN" style={{ color: C.red, textDecoration: "line-through" }}>{e.wrong}</span> → <b lang="zh-CN" style={{ color: C.green }}>{e.right}</b>{e.why && <div style={{ color: C.mute }}>{e.why}</div>}</div>)}</div>
        </div>
      )}
      {fb.wrong?.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-1" style={{ color: C.mute }}>CHỮ ĐỌC CHƯA ĐÚNG</div>
          <div className="grid gap-2 sm:grid-cols-2">{fb.wrong.map((e, i) => <div key={i} className="text-sm rounded-[8px] p-2.5 border" style={{ borderColor: C.line }}><b lang="zh-CN">{e.text}</b> · <span style={{ color: C.red }}>{e.heard}</span> → <b style={{ color: C.green }}>{e.right}</b>{e.note && <div style={{ color: C.mute }}>{e.note}</div>}</div>)}</div>
        </div>
      )}
      {fb.upgrades?.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-1" style={{ color: C.mute }}>NÂNG CẤP CÂU NÓI</div>
          <div className="grid gap-2">{fb.upgrades.map((e, i) => <div key={i} lang="zh-CN" className="text-sm rounded-[8px] p-2.5 border" style={{ borderColor: C.line }}><div style={{ color: C.mute }}>{e.orig}</div><div className="font-bold" style={{ color: C.green }}>↗ {e.better}</div></div>)}</div>
        </div>
      )}
      {fb.tips?.length > 0 && <List title="Lần sau hãy thử" items={fb.tips} color={C.ink} />}
    </Card>
  );
}
const List = ({ title, items, color }) => (
  <div><div className="text-xs font-bold mb-1" style={{ color: C.mute }}>{title.toUpperCase()}</div>
    <ul className="grid gap-1 text-[15px]">{items.map((t, i) => <li key={i} className="flex gap-2"><span style={{ color }}>•</span><span>{t}</span></li>)}</ul></div>
);

// ---------- phần ghi âm + chấm dùng chung ----------
function RecordAndGrade({ limit, mode, payload, onGraded, label = "Bắt đầu nói", autoStart = 0, disabledText }) {
  const { isSignedIn } = useAuth();
  const r = useRecorder();
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState(null);
  const [url, setUrl] = useState("");
  const started = useRef(0);
  useEffect(() => { if (autoStart && autoStart !== started.current) { started.current = autoStart; beep(); setTimeout(() => go(), 400); } }, [autoStart]); // eslint-disable-line
  useEffect(() => { if (r.blob) { const u = URL.createObjectURL(r.blob); setUrl(u); return () => URL.revokeObjectURL(u); } }, [r.blob]);
  const go = async () => { setFb(null); await r.start(limit); };
  const grade = async () => {
    if (!r.blob) return;
    setBusy(true); setFb(null);
    try {
      const audio = await toB64(r.blob);
      const res = await fetch("/api/hskk-cao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, audio, mime: r.blob.type, ...payload }) });
      const d = await res.json().catch(() => ({ error: "Máy chủ trả lời không hợp lệ." }));
      setFb(res.ok ? d : { error: d.error || "Chấm bài không thành công." });
      if (res.ok && d.score) onGraded?.(d);
    } catch { setFb({ error: "Mất kết nối, bạn thử lại nhé." }); }
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3">
        {r.rec ? (
          <>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: C.red }} />
              <b className="text-lg tabular-nums">{fmt(r.sec)}</b><span style={{ color: C.mute }}>/ {fmt(limit)}</span>
              <span className="ml-auto"><Btn kind="red" onClick={r.stop}>Dừng</Btn></span>
            </div>
            <Bar v={r.sec} max={limit} />
            {mode === "answer" && <p className="text-xs" style={{ color: C.mute }}>Mốc gợi ý: 0:20 nêu quan điểm · 1:50 bắt đầu kết bài. Cố gắng nói hết 2 phút 30 giây.</p>}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {disabledText ? <span className="text-sm" style={{ color: C.mute }}>{disabledText}</span> : <Btn kind="red" onClick={() => { beep(); setTimeout(go, 400); }}>🎙 {r.blob ? "Ghi âm lại" : label}</Btn>}
            {r.blob && <audio src={url} controls className="h-10 max-w-full" />}
            {r.blob && (isSignedIn ? <Btn kind="green" onClick={grade} disabled={busy}>{busy ? "AI đang chấm…" : "Chấm bài bằng AI"}</Btn> : <SignInButton mode="modal"><button className="px-4 py-2 rounded-full text-sm font-bold border" style={{ borderColor: C.line }}>Đăng nhập để chấm</button></SignInButton>)}
          </div>
        )}
        {r.err && <p className="text-sm" style={{ color: C.red }}>{r.err}</p>}
        {busy && <p className="text-sm" style={{ color: C.mute }}>AI đang nghe bài nói của bạn, khoảng 15–30 giây…</p>}
      </Card>
      <Feedback fb={fb} mode={mode} />
    </div>
  );
}

// =====================================================================
// 1) 听后复述
// =====================================================================
function Retell({ data, hist, mark, py }) {
  const [cur, setCur] = useState(null);
  const groups = useMemo(() => { const g = {}; data.forEach((x) => (g[x.code] ||= []).push(x)); return Object.entries(g); }, [data]);
  if (cur) return <RetellPractice item={cur} back={() => setCur(null)} mark={mark} py={py} />;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-[15px]">Mỗi đoạn được cắt riêng từ <b>file nghe gốc của đề thi thật</b>. Nghe xong, sau tiếng bíp bạn có <b>2 phút</b> để kể lại. Có 3 mức luyện:</p>
        <ol className="mt-2 grid gap-1 text-sm list-decimal pl-5" style={{ color: C.mute }}>
          <li><b style={{ color: C.ink }}>Có gợi ý</b>: nghe 2 lần, xem từ khoá và khung kể, có ô ghi chú nhanh.</li>
          <li><b style={{ color: C.ink }}>Như thi thật</b>: nghe 1 lần, không gợi ý.</li>
          <li><b style={{ color: C.ink }}>Nói theo</b>: xem bài gốc kèm pinyin, nghe và đọc theo để luyện ngữ điệu.</li>
        </ol>
      </Card>
      {groups.map(([code, xs]) => (
        <div key={code}>
          <div className="text-xs font-bold tracking-[0.14em] mb-2" style={{ color: C.mute }}>ĐỀ {code}{code === "H90000" ? " · 样卷" : ""}</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {xs.map((x) => { const h = hist[`retell:${x.id}`]; return (
              <button key={x.id} onClick={() => setCur(x)} className="text-left rounded-[10px] border px-3 py-3 hover:border-[#1C1A17]" style={{ background: C.card, borderColor: C.line }}>
                <div className="flex items-center gap-2"><b>Câu {x.n}</b><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EFE7D6" }}>{x.kind === "故事" ? "Kể chuyện" : "Nghị luận"}</span>{h && <span className="ml-auto text-xs font-bold" style={{ color: scoreColor(h.best) }}>{h.best}đ</span>}</div>
                <div className="text-sm mt-1 truncate" style={{ color: C.mute }}>{x.vn}</div>
              </button>
            ); })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RetellPractice({ item, back, mark, py }) {
  const [lv, setLv] = useState(1); // 1 gợi ý · 2 thi thật · 3 nói theo
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [showPy, setShowPy] = useState(true);
  const [note, setNote] = useState("");
  const [go, setGo] = useState(0);
  const [hit, setHit] = useState(null);
  const au = useRef(null);
  const maxPlays = lv === 1 ? 2 : lv === 2 ? 1 : 99;
  useEffect(() => { setPlays(0); setDone(false); setReveal(lv === 3); setNote(""); setHit(null); au.current?.pause(); }, [lv, item.id]);
  const play = () => {
    if (plays >= maxPlays && lv !== 3) return;
    const a = au.current; a.currentTime = 0; a.play(); setPlaying(true); setPlays((p) => p + 1);
  };
  const ended = () => { setPlaying(false); if (lv !== 3 && plays >= maxPlays) { setDone(true); setGo(Date.now()); } };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Btn kind="light" onClick={back}>← Danh sách</Btn>
        <b className="text-lg">Đề {item.code} · Câu {item.n}</b>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Chip on={lv === 1} onClick={() => setLv(1)}>① Có gợi ý</Chip>
        <Chip on={lv === 2} onClick={() => setLv(2)}>② Như thi thật</Chip>
        <Chip on={lv === 3} onClick={() => setLv(3)}>③ Nói theo</Chip>
      </div>
      <audio ref={au} src={item.audio} preload="auto" onEnded={ended} onPause={() => setPlaying(false)} controls={lv === 3} className={lv === 3 ? "w-full" : "hidden"} />
      {lv !== 3 && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Btn kind="dark" onClick={play} disabled={playing || plays >= maxPlays}>{playing ? "🔊 Đang phát…" : plays === 0 ? "▶ Nghe đoạn văn" : plays < maxPlays ? "▶ Nghe lần 2" : "Đã hết lượt nghe"}</Btn>
            <span className="text-sm" style={{ color: C.mute }}>Lượt nghe: {plays}/{maxPlays}</span>
            {!done && plays >= 1 && !playing && plays < maxPlays && <button className="text-sm underline" onClick={() => { setDone(true); setGo(Date.now()); }}>Bỏ qua, nói luôn</button>}
          </div>
          {lv === 1 && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-bold mb-1" style={{ color: C.mute }}>TỪ KHOÁ NÊN GIỮ</div>
                <div className="flex flex-wrap gap-1.5">{item.keys.map((k, i) => <span key={i} className="text-sm px-2 py-1 rounded-[6px] border" style={{ borderColor: C.line, background: "#fff" }}><b lang="zh-CN">{k.zh}</b> <span style={{ color: C.mute }}>{k.py} · {k.vn}</span></span>)}</div>
                <div className="text-xs font-bold mt-3 mb-1" style={{ color: C.mute }}>KHUNG KỂ LẠI</div>
                <p lang="zh-CN" className="text-[15px]" style={{ fontFamily: '"Noto Serif SC",serif' }}>{item.frame}</p>
              </div>
              <div>
                <div className="text-xs font-bold mb-1" style={{ color: C.mute }}>GHI CHÚ NHANH (谁 · 什么事 · 结果 · 道理)</div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} className="w-full rounded-[8px] border p-2 text-[15px]" style={{ borderColor: C.line }} placeholder="Ghi tắt nhân vật, sự việc, kết quả, ý nghĩa…" />
              </div>
            </div>
          )}
        </Card>
      )}
      {lv === 3 ? (
        <>
          <Card><div className="flex justify-end mb-1"><Chip on={showPy} onClick={() => setShowPy(!showPy)}>Pinyin</Chip></div><ZhText text={item.text} showPy={showPy} py={py} /><p className="mt-2 text-[15px]" style={{ color: C.mute }}>{item.vn}</p></Card>
          <RecordAndGrade limit={150} mode="read" payload={{ ref: item.text }} label="Ghi âm đọc theo" onGraded={(d) => mark(`retell:${item.id}`, d.score.total, 3)} />
        </>
      ) : (
        <RecordAndGrade limit={120} mode="retell" autoStart={go} disabledText={!done && plays < 1 ? "Nghe đoạn văn trước, sau tiếng bíp sẽ tự ghi âm 2 phút." : ""} payload={{ ref: item.text, points: item.points.map((p) => p.zh) }} onGraded={(d) => { mark(`retell:${item.id}`, d.score.total, 5); setHit(Array.isArray(d.hit) ? d.hit : null); setReveal(true); }} />
      )}
      {lv !== 3 && (
        <Card>
          <div className="flex items-center gap-2 flex-wrap">
            <b>Bài gốc</b>
            <span className="ml-auto flex gap-2">{reveal && <Chip on={showPy} onClick={() => setShowPy(!showPy)}>Pinyin</Chip>}<Btn kind="light" onClick={() => setReveal(!reveal)}>{reveal ? "Ẩn" : "Xem bài gốc"}</Btn></span>
          </div>
          {reveal && (
            <div className="mt-3 flex flex-col gap-3">
              <ZhText text={item.text} showPy={showPy} py={py} />
              <p className="text-[15px]" style={{ color: C.mute }}>{item.vn}</p>
              <div>
                <div className="text-xs font-bold mb-1" style={{ color: C.mute }}>Ý CHÍNH</div>
                <ol className="grid gap-1 list-decimal pl-5 text-[15px]">{item.points.map((p, i) => <li key={i}>{hit && <b style={{ color: hit[i] ? C.green : C.red }}>{hit[i] ? "✓ " : "✗ "}</b>}<span lang="zh-CN">{p.zh}</span> <span style={{ color: C.mute }}>— {p.vn}</span></li>)}</ol>
                {hit && <p className="text-xs mt-1" style={{ color: C.mute }}>✓ bạn đã kể được · ✗ còn thiếu (theo AI chấm lần gần nhất)</p>}
              </div>
              <audio src={item.audio} controls className="w-full" />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// =====================================================================
// 2) 回答问题
// =====================================================================
function QA({ data, hist, mark, py }) {
  const [cur, setCur] = useState(null);
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("");
  const [real, setReal] = useState(false);
  const [q, setQ] = useState("");
  const list = data.filter((x) => (!topic || x.topic === topic) && (!type || x.type === type) && (!real || x.real) && (!q || (x.zh + x.vn).toLowerCase().includes(q.toLowerCase())));
  if (cur) return <QAPractice item={cur} back={() => setCur(null)} mark={mark} py={py} next={() => setCur(data[Math.floor(Math.random() * data.length)])} />;
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3">
        <p className="text-[15px]">{data.length} câu hỏi gom từ các kỳ thi HSKK cao cấp (2020–2026). Mỗi câu có <b>dàn ý</b>, <b>cụm từ hay</b> và <b>bài mẫu</b> viết riêng cho trang này. Thi thật: nói <b>2 phút 30 giây</b> mỗi câu.</p>
        <div className="flex gap-2 flex-wrap items-center">
          <Btn kind="red" onClick={() => setCur(list[Math.floor(Math.random() * list.length)] || data[0])}>🎲 Rút thăm 1 câu</Btn>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm câu hỏi…" className="flex-1 min-w-[160px] rounded-full border px-3 py-2 text-sm" style={{ borderColor: C.line }} />
          <Chip on={real} onClick={() => setReal(!real)}>Chỉ đề thi thật có mã đề</Chip>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1"><Chip on={!topic} onClick={() => setTopic("")}>Mọi chủ đề</Chip>{Object.entries(TOPIC).map(([k, v]) => <Chip key={k} on={topic === k} onClick={() => setTopic(k)}>{v}</Chip>)}</div>
        <div className="flex gap-1.5 overflow-x-auto pb-1"><Chip on={!type} onClick={() => setType("")}>Mọi dạng</Chip>{Object.entries(TYPE).map(([k, v]) => <Chip key={k} on={type === k} onClick={() => setType(k)}>{v}</Chip>)}</div>
      </Card>
      <div className="text-sm" style={{ color: C.mute }}>{list.length} câu</div>
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((x) => { const h = hist[`qa:${x.id}`]; return (
          <button key={x.id} onClick={() => setCur(x)} className="text-left rounded-[10px] border px-3 py-3 hover:border-[#1C1A17]" style={{ background: C.card, borderColor: C.line }}>
            <div lang="zh-CN" className="font-bold text-[16px]" style={{ fontFamily: '"Noto Serif SC",serif' }}>{x.zh}</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>{x.vn}</div>
            <div className="flex gap-1.5 mt-2 flex-wrap text-[11px] items-center">
              <span className="px-2 py-0.5 rounded-full" style={{ background: "#EFE7D6" }}>{TYPE[x.type]}</span>
              <span className="px-2 py-0.5 rounded-full" style={{ background: "#EFE7D6" }}>{TOPIC[x.topic]}</span>
              <span style={{ color: C.mute }}>{x.src}</span>
              {h && <b className="ml-auto" style={{ color: scoreColor(h.best) }}>{h.best}đ</b>}
            </div>
          </button>
        ); })}
      </div>
    </div>
  );
}

function QAPractice({ item, back, next, mark, py }) {
  const [prep, setPrep] = useState(0); // giây chuẩn bị còn lại
  const [prepOn, setPrepOn] = useState(false);
  const [go, setGo] = useState(0);
  const [showO, setShowO] = useState(false);
  const [showK, setShowK] = useState(false);
  const [showS, setShowS] = useState(false);
  const [showPy, setShowPy] = useState(false);
  const [showVn, setShowVn] = useState(false);
  useEffect(() => { setPrep(0); setPrepOn(false); setShowO(false); setShowK(false); setShowS(false); }, [item.id]);
  useEffect(() => {
    if (!prepOn) return;
    if (prep <= 0) { setPrepOn(false); setGo(Date.now()); return; }
    const t = setTimeout(() => setPrep((p) => p - 1), 1000); return () => clearTimeout(t);
  }, [prepOn, prep]);
  const sample = item.sample.replace(/[【】]/g, "");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap"><Btn kind="light" onClick={back}>← Danh sách</Btn><Btn kind="light" onClick={next}>🎲 Câu khác</Btn></div>
      <Card>
        <div className="flex gap-1.5 flex-wrap text-[11px] mb-2"><span className="px-2 py-0.5 rounded-full" style={{ background: "#EFE7D6" }}>{TYPE[item.type]}</span><span className="px-2 py-0.5 rounded-full" style={{ background: "#EFE7D6" }}>{TOPIC[item.topic]}</span><span style={{ color: C.mute }}>Đề thi: {item.src}</span></div>
        <div lang="zh-CN" className="text-[22px] font-bold leading-snug" style={{ fontFamily: '"Noto Serif SC",serif' }}><Ruby text={item.zh} py={showPy ? py : null} /></div>
        <p className="mt-1 text-[15px]" style={{ color: C.mute }}>{item.vn}</p>
        <div className="flex gap-2 flex-wrap mt-3">
          <Chip on={showPy} onClick={() => setShowPy(!showPy)}>Pinyin</Chip>
          <Chip on={showO} onClick={() => setShowO(!showO)}>Gợi ý dàn ý</Chip>
          <Chip on={showK} onClick={() => setShowK(!showK)}>Cụm từ hay</Chip>
        </div>
        {showO && <ol className="mt-3 grid gap-1 list-decimal pl-5 text-[15px]">{item.outline.map((o, i) => <li key={i}><span lang="zh-CN">{o}</span><div className="text-sm" style={{ color: C.mute }}>{item.outline_vn?.[i]}</div></li>)}</ol>}
        {showK && <div className="mt-3 flex flex-wrap gap-1.5">{item.keys.map((k, i) => <span key={i} className="text-sm px-2 py-1 rounded-[6px] border" style={{ borderColor: C.line, background: "#fff" }}><b lang="zh-CN">{k.zh}</b> <span style={{ color: C.mute }}>{k.py} · {k.vn}</span></span>)}</div>}
      </Card>
      <Card className="flex flex-wrap items-center gap-2">
        {prepOn ? (
          <><b className="tabular-nums text-lg">Chuẩn bị: {fmt(prep)}</b><Btn kind="dark" onClick={() => setPrep(0)}>Nói ngay</Btn></>
        ) : (
          <><span className="text-sm" style={{ color: C.mute }}>Thời gian chuẩn bị:</span>{[30, 60, 180].map((s) => <Chip key={s} onClick={() => { setPrep(s); setPrepOn(true); }}>{s < 60 ? `${s} giây` : `${s / 60} phút`}</Chip>)}<span className="text-xs" style={{ color: C.mute }}>hết giờ sẽ tự ghi âm</span></>
        )}
      </Card>
      <RecordAndGrade limit={150} mode="answer" autoStart={go} payload={{ question: item.zh }} onGraded={(d) => { mark(`qa:${item.id}`, d.score.total, 6); }} />
      <Card>
        <div className="flex items-center gap-2 flex-wrap">
          <b>Bài mẫu</b><span className="text-xs" style={{ color: C.mute }}>~{sample.replace(/[^一-鿿]/g, "").length} chữ · nói khoảng 2 phút, thêm ví dụ của bạn để đủ 2 phút 30</span>
          <span className="ml-auto flex gap-2">{showS && <><Chip on={showPy} onClick={() => setShowPy(!showPy)}>Pinyin</Chip><Chip on={showVn} onClick={() => setShowVn(!showVn)}>Tiếng Việt</Chip></>}<Btn kind="light" onClick={() => setShowS(!showS)}>{showS ? "Ẩn" : "Xem bài mẫu"}</Btn></span>
        </div>
        {showS && (
          <div className="mt-3 flex flex-col gap-3">
            <div lang="zh-CN" style={{ fontFamily: '"Noto Serif SC",serif', fontSize: 18, lineHeight: showPy ? 2.2 : 1.85 }}>
              {item.sample.split("\n").map((para, i) => (
                <p key={i} className="mb-2">{para.split(/(【.+?】)/).map((seg, j) => seg.startsWith("【") ? <mark key={j} style={{ background: "#F6E3B4", padding: "0 2px", borderRadius: 3 }}><Ruby text={seg.slice(1, -1)} py={showPy ? py : null} /></mark> : <Ruby key={j} text={seg} py={showPy ? py : null} />)}</p>
              ))}
            </div>
            {showVn && <div className="text-[15px]" style={{ color: C.mute }}>{item.sample_vn.split("\n").map((p, i) => <p key={i} className="mb-2">{p}</p>)}</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// 3) 朗读
// =====================================================================
function Read({ data, hist, mark, py }) {
  const [cur, setCur] = useState(null);
  const [showPy, setShowPy] = useState(false);
  if (cur) return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap"><Btn kind="light" onClick={() => setCur(null)}>← Danh sách</Btn><b className="text-lg">Đề {cur.code} · 朗读</b><span className="ml-auto"><Chip on={showPy} onClick={() => setShowPy(!showPy)}>Pinyin</Chip></span></div>
      <Card><ZhText text={cur.text} showPy={showPy} py={py} size={20} /><p className="text-xs mt-1" style={{ color: C.mute }}>{cur.text.replace(/[^一-鿿]/g, "").length} chữ · thi thật: đọc trong 2 phút, khoảng 140–160 chữ/phút.</p></Card>
      <RecordAndGrade limit={120} mode="read" payload={{ ref: cur.text }} label="Bắt đầu đọc" onGraded={(d) => mark(`read:${cur.id}`, d.score.total, 4)} />
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <Card><p className="text-[15px]">Đoạn 朗读 của {data.length} đề thi thật. Đọc to trong <b>2 phút</b>; AI nghe và chỉ ra chữ đọc sai, lỗi thanh điệu, chỗ ngắt nghỉ chưa đúng.</p></Card>
      <div className="grid gap-2 md:grid-cols-2">
        {data.map((x) => { const h = hist[`read:${x.id}`]; return (
          <button key={x.id} onClick={() => setCur(x)} className="text-left rounded-[10px] border px-3 py-3 hover:border-[#1C1A17]" style={{ background: C.card, borderColor: C.line }}>
            <div className="flex items-center"><b>Đề {x.code}</b>{h && <b className="ml-auto text-xs" style={{ color: scoreColor(h.best) }}>{h.best}đ</b>}</div>
            <div lang="zh-CN" className="text-sm mt-1 line-clamp-2" style={{ color: C.mute }}>{x.text}</div>
          </button>
        ); })}
      </div>
    </div>
  );
}

// =====================================================================
export default function HskkCaoCap() {
  const [tab, setTab] = useState("retell");
  const [data, setData] = useState({});
  const [hist, setHist] = useState({});
  const py = usePinyin();
  const { gain } = useTuVi();
  useEffect(() => {
    setHist(loadHist());
    try { const t = new URLSearchParams(location.search).get("tab"); if (TABS.some((x) => x.k === t)) setTab(t); } catch {}
  }, []);
  useEffect(() => {
    if (data[tab]) return;
    fetch(`/hskk-cao/${tab}.json`).then((r) => r.json()).then((d) => setData((o) => ({ ...o, [tab]: d }))).catch(() => setData((o) => ({ ...o, [tab]: [] })));
  }, [tab]); // eslint-disable-line
  const mark = (key, score, xp) => {
    setHist((h) => { const o = h[key] || { n: 0, best: 0 }; const n = { ...h, [key]: { n: o.n + 1, best: Math.max(o.best, score), last: score, t: Date.now() } }; saveHist(n); return n; });
    if (score >= 40) gain(xp).catch?.(() => {});
  };
  const d = data[tab];
  const doneN = Object.keys(hist).filter((k) => k.startsWith(tab + ":")).length;
  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink, fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="practice" title="Luyện HSKK Cao cấp" />
      <main className="max-w-[960px] mx-auto px-4 md:px-8 pt-6 pb-28 md:pb-16 flex flex-col gap-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-brush text-[40px] leading-none" style={{ color: C.red }}>高级口语</h1>
          <span className="font-serif-vn text-[22px] font-extrabold">Luyện HSKK Cao cấp</span>
        </div>
        <a href="/?tab=exam&lv=hskk&src=cao" className="rounded-[10px] border px-4 py-3 flex items-center gap-3" style={{ background: "#1E4A3C", borderColor: "#C9A24E", color: "#F3EEE2" }}>
          <span className="font-brush text-[28px] leading-none" style={{ color: "#E6B656" }} aria-hidden="true">劫</span>
          <span className="flex-1 min-w-0"><b className="block">Thi thử đề thật HSKK Cao cấp ở Độ Kiếp Đài</b><span className="text-xs opacity-80">9 đề Hanban (H90000–H91416) · chạy theo file nghe gốc · ghi âm và nộp cho giáo viên chấm</span></span>
          <span aria-hidden="true">›</span>
        </a>
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className="rounded-[10px] border px-2 py-2.5 text-center" style={tab === t.k ? { background: C.ink, color: "#fff", borderColor: C.ink } : { background: C.card, borderColor: C.line }}>
              <div lang="zh-CN" className="font-bold text-[17px]" style={{ fontFamily: '"Noto Serif SC",serif' }}>{t.zh}</div>
              <div className="text-xs opacity-80">{t.vn}</div>
            </button>
          ))}
        </div>
        {d && d.length > 0 && <div className="text-xs" style={{ color: C.mute }}>Đã luyện {doneN}/{d.length} bài ở phần này (lưu trên máy này)</div>}
        {!d ? <p style={{ color: C.mute }}>Đang tải…</p> : tab === "retell" ? <Retell data={d} hist={hist} mark={mark} py={py} /> : tab === "qa" ? <QA data={d} hist={hist} mark={mark} py={py} /> : <Read data={d} hist={hist} mark={mark} py={py} />}
      </main>
    </div>
  );
}
