"use client";
// ============================================================
// TRẮC NGHIỆM LINH CĂN 测灵根 — Sơn Hải Thư Viện
// 20 câu · 5 hệ ngũ hành (Kim=Nghe · Mộc=Từ vựng · Thủy=Đọc · Hỏa=Phát âm · Thổ=Ngữ pháp)
// Mỗi hệ 4 câu, độ khó 1→4 = trọng số 1→4 (tổng 10) → điểm hệ 0–100
// Kết quả lưu ở users/{uid}.linhCan (Firestore) và localStorage "sh_linh_can"; 30 ngày được đo lại một lần
// ============================================================
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import GardenNav from "../GardenNav";
import { ELEMENTS, elementOf, judgeLinhCan, LinhCanStone, NguHanhChart, Seal, VText } from "../tuTien";

const RETEST_DAYS = 30;
const LABELS = ["甲", "乙", "丙", "丁"];

// a = đáp án đúng luôn ở vị trí 0 trong khai báo; khi hiển thị sẽ xoay vòng theo số câu
const QUESTIONS = [
  // 金 Kim · Nghe — đọc bằng giọng máy (zh-CN), chọn nghĩa đúng
  { el: "kim", d: 1, say: "你好，我叫王明。", q: "Nghe và chọn nghĩa đúng", o: ["Xin chào, tôi tên là Vương Minh.", "Tạm biệt, hẹn gặp lại.", "Bạn tên là gì?", "Tôi là giáo viên."] },
  { el: "kim", d: 2, say: "我明天下午去图书馆借书。", q: "Nghe và chọn nghĩa đúng", o: ["Chiều mai tôi đến thư viện mượn sách.", "Sáng mai tôi đi hiệu sách mua sách.", "Chiều nay tôi ở nhà đọc sách.", "Hôm qua tôi đến thư viện trả sách."] },
  { el: "kim", d: 3, say: "虽然外面下着大雨，他还是准时到了。", q: "Nghe và chọn nghĩa đúng", o: ["Dù ngoài trời mưa to, anh ấy vẫn đến đúng giờ.", "Vì trời mưa to nên anh ấy đến muộn.", "Trời mưa to nên anh ấy không đến.", "Anh ấy đến đúng giờ trước khi trời mưa."] },
  { el: "kim", d: 4, say: "与其在这里抱怨，不如想办法解决问题。", q: "Nghe và chọn nghĩa đúng", o: ["Thay vì ngồi đây than phiền, chi bằng nghĩ cách giải quyết vấn đề.", "Vừa than phiền vừa nghĩ cách giải quyết vấn đề.", "Vấn đề này không giải quyết được, chỉ biết than phiền.", "Anh ấy than phiền vì không ai giải quyết vấn đề."] },
  // 木 Mộc · Từ vựng
  { el: "moc", d: 1, zh: "朋友", q: "Từ này nghĩa là gì?", o: ["bạn bè", "gia đình", "giáo viên", "bệnh viện"] },
  { el: "moc", d: 2, zh: "准备", q: "Từ này nghĩa là gì?", o: ["chuẩn bị", "quyết định", "đồng ý", "lo lắng"] },
  { el: "moc", d: 3, zh: "坚持", q: "Từ này nghĩa là gì?", o: ["kiên trì", "nghi ngờ", "từ chối", "thất vọng"] },
  { el: "moc", d: 4, zh: "举足轻重", q: "Thành ngữ này nghĩa là gì?", o: ["có vai trò then chốt, ảnh hưởng lớn", "nhẹ như lông hồng", "đi đứng nhẹ nhàng, khoan thai", "do dự, không quyết được"] },
  // 水 Thủy · Đọc hiểu
  { el: "thuy", d: 1, zh: "我家有四口人：爸爸、妈妈、哥哥和我。", q: "Nhà người viết có mấy người?", o: ["4 người", "3 người", "5 người", "6 người"] },
  { el: "thuy", d: 2, zh: "这家饭馆的菜又便宜又好吃，所以每天中午人都很多。", q: "Vì sao buổi trưa quán này đông?", o: ["Đồ ăn vừa rẻ vừa ngon", "Quán ở gần trường học", "Quán mới khai trương", "Buổi trưa quán giảm giá"] },
  { el: "thuy", d: 3, zh: "小李本来打算周末去爬山，可是天气预报说会下雨，他只好在家看书了。", q: "Cuối tuần Tiểu Lý làm gì?", o: ["Ở nhà đọc sách", "Đi leo núi", "Đi xem dự báo thời tiết", "Đi chơi dưới mưa"] },
  { el: "thuy", d: 4, zh: "成功并非一蹴而就，它往往是无数次失败之后厚积薄发的结果。", q: "Ý chính của câu là gì?", o: ["Thành công cần tích lũy lâu dài qua nhiều lần thất bại", "Thành công đến rất nhanh nếu gặp may", "Thất bại nhiều lần thì nên bỏ cuộc", "Người thành công chưa từng thất bại"] },
  // 火 Hỏa · Phát âm (pinyin, thanh điệu, biến điệu)
  { el: "hoa", d: 1, zh: "谢谢", q: "Chọn phiên âm đúng", o: ["xièxie", "xiéxie", "xiěxie", "xīxi"] },
  { el: "hoa", d: 2, zh: "学习", q: "Chọn phiên âm đúng", o: ["xuéxí", "xuěxí", "xuèxì", "xuēxī"] },
  { el: "hoa", d: 3, zh: "一定", q: "Khi đọc thực tế (có biến điệu), từ này đọc là:", o: ["yídìng", "yīdìng", "yìdìng", "yǐdìng"] },
  { el: "hoa", d: 4, zh: "不得不", q: "Khi đọc thực tế (có biến điệu), cụm này đọc là:", o: ["bùdébù", "búdébù", "bùděibù", "búdèbú"] },
  // 土 Thổ · Viết · ngữ pháp
  { el: "tho", d: 1, zh: "我＿＿学生。", q: "Chọn từ điền vào chỗ trống", o: ["是", "在", "有", "很"] },
  { el: "tho", d: 2, zh: "", q: "Câu nào đúng ngữ pháp?", o: ["我把作业做完了。", "我把作业做。", "我做完作业把了。", "把我作业做完了。"] },
  { el: "tho", d: 3, zh: "他汉语说＿＿很流利。", q: "Chọn từ điền vào chỗ trống", o: ["得", "的", "地", "了"] },
  { el: "tho", d: 4, zh: "这么难的题，连老师都做不出来，＿＿是我们呢？", q: "Chọn từ điền vào chỗ trống", o: ["何况", "尽管", "因此", "甚至"] },
];
// Xoay vị trí đáp án theo số câu (cố định, không ngẫu nhiên → không lệch khi tải trang)
const SHIFT = [0, 2, 1, 3, 2, 0, 3, 1, 1, 3, 0, 2, 3, 1, 2, 0, 2, 3, 0, 1];
const VIEW = QUESTIONS.map((q, i) => {
  const k = SHIFT[i % SHIFT.length];
  const order = [0, 1, 2, 3].map((x) => (x + 4 - k) % 4); // order[pos] = chỉ số trong q.o
  return { ...q, opts: order.map((x) => q.o[x]), right: order.indexOf(0) };
});

function speakZh(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN"; u.rate = 0.85;
    const v = synth.getVoices().find((x) => /zh[-_]CN/i.test(x.lang)) || synth.getVoices().find((x) => /^zh/i.test(x.lang));
    if (v) u.voice = v;
    synth.speak(u);
    return true;
  } catch (_) { return false; }
}

const fmtDate = (ms) => new Date(ms).toLocaleDateString("vi-VN");

export default function LinhCanPage() {
  const { isSignedIn, userId } = useAuth();
  const [phase, setPhase] = useState("intro"); // intro | quiz | result
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]); // [index đã chọn]
  const [plays, setPlays] = useState(0);
  const [showText, setShowText] = useState(false);
  const [canSpeak, setCanSpeak] = useState(true);
  const [result, setResult] = useState(null); // {scores, atMs}
  const [saved, setSaved] = useState("");

  useEffect(() => { setCanSpeak(typeof window !== "undefined" && !!window.speechSynthesis); try { window.speechSynthesis?.getVoices(); } catch (_) {} }, []);

  // Kết quả cũ: Firestore (đã đăng nhập) hoặc máy này
  useEffect(() => {
    try { const x = JSON.parse(localStorage.getItem("sh_linh_can") || "null"); if (x?.scores) { setResult(x); setPhase("result"); } } catch (_) {}
  }, []);
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    getDoc(doc(db, "users", userId)).then((s) => {
      const lc = s.exists() ? s.data().linhCan : null;
      if (lc?.scores) { setResult({ scores: lc.scores, atMs: lc.atMs || lc.at?.toMillis?.() || Date.now() }); setPhase("result"); }
    }).catch(() => {});
  }, [isSignedIn, userId]);

  const q = VIEW[idx];
  const el = elementOf(q?.el);
  const elIndex = ELEMENTS.findIndex((e) => e.key === q?.el);

  const play = () => {
    if (!q?.say || plays >= 2) return;
    if (speakZh(q.say)) setPlays((n) => n + 1); else { setCanSpeak(false); setShowText(true); }
  };

  const submit = () => {
    if (picked == null) return;
    const next = [...answers, picked];
    setAnswers(next); setPicked(null); setPlays(0); setShowText(false);
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    if (idx + 1 < VIEW.length) { setIdx(idx + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    // Chấm điểm
    const sum = {}; const max = {};
    VIEW.forEach((v, i) => { max[v.el] = (max[v.el] || 0) + v.d; if (next[i] === v.right) sum[v.el] = (sum[v.el] || 0) + v.d; });
    const scores = Object.fromEntries(ELEMENTS.map((e) => [e.key, Math.round(((sum[e.key] || 0) / (max[e.key] || 1)) * 100)]));
    const r = { scores, atMs: Date.now() };
    setResult(r); setPhase("result"); window.scrollTo({ top: 0 });
    try { localStorage.setItem("sh_linh_can", JSON.stringify(r)); } catch (_) {}
    if (isSignedIn && userId) {
      setDoc(doc(db, "users", userId), { linhCan: { scores, atMs: r.atMs, at: serverTimestamp() } }, { merge: true })
        .then(() => setSaved("Đã lưu vào hồ sơ thư sinh.")).catch(() => setSaved("Chưa lưu được lên hồ sơ — kết quả vẫn được giữ trên máy này."));
    } else setSaved("Kết quả đang lưu trên máy này. Đăng nhập để giữ vào hồ sơ.");
  };

  const restart = () => { setAnswers([]); setIdx(0); setPicked(null); setPlays(0); setShowText(false); setSaved(""); setPhase("quiz"); };
  const nextTestMs = result ? result.atMs + RETEST_DAYS * 864e5 : 0;
  const canRetest = !result || Date.now() >= nextTestMs || !isSignedIn;

  const judged = useMemo(() => (result ? judgeLinhCan(result.scores) : null), [result]);

  const share = async () => {
    if (!judged) return;
    const text = `Linh căn của tôi ở Sơn Hải Thư Viện: ${judged.zh} — ${judged.vn} (${judged.grade.vn}). Đo linh căn của bạn tại ${location.origin}/linh-can`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setSaved("Đã chép lời khoe — dán gửi đồng song nhé!"); } } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Trắc nghiệm linh căn" />
      <main className="max-w-[560px] mx-auto px-4 pt-6 pb-28 md:pb-16 flex flex-col gap-5">

        {phase === "intro" && (
          <>
            <div className="flex flex-col items-center text-center gap-1">
              <div className="font-brush text-[44px] leading-none">测灵根</div>
              <div className="font-serif-vn text-sm font-bold tracking-[0.12em] text-[#4A4238]">TRẮC NGHIỆM LINH CĂN</div>
            </div>
            <div className="flex justify-center"><LinhCanStone active="kim" className="w-[240px] h-[240px]" /></div>
            <div className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-3 text-[15px] leading-relaxed">
              <p>Linh Căn Thạch sẽ cảm ứng năm hệ ngũ hành của thư sinh qua <b>20 câu</b>, khoảng <b>5 phút</b>:</p>
              <ul className="grid gap-1.5">
                {ELEMENTS.map((e) => (
                  <li key={e.key} className="flex items-center gap-3"><span className="font-brush text-[22px] w-7 text-center leading-none">{e.zh}</span><span><b>{e.vn}</b> · {e.skill}</span></li>
                ))}
              </ul>
              <p className="text-sm text-[#6B6253]">Câu nghe dùng giọng đọc của trình duyệt — nhớ bật loa. Câu khó hơn được tính nhiều điểm hơn. {isSignedIn ? `Đo xong được lưu vào hồ sơ; ${RETEST_DAYS} ngày đo lại một lần.` : "Đăng nhập để lưu kết quả vào hồ sơ."}</p>
            </div>
            <button onClick={restart} className="h-14 rounded-md bg-[#1C1A17] text-[#F3EEE2] font-serif-vn text-[17px] font-extrabold shadow-[4px_4px_0_#9E2F22] tt-shine">Bắt đầu cảm ứng</button>
          </>
        )}

        {phase === "quiz" && q && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-serif-vn text-xs font-bold tracking-[0.12em] text-[#6B6253]">HỆ {el.vn.toUpperCase()} · {el.skill.toUpperCase()}</span>
                <span className="font-brush text-[28px] leading-none">{el.zh}</span>
              </div>
              <span className="h-11 min-w-11 px-2 rounded-md bg-[#9E2F22] text-[#FBF3E4] inline-flex items-baseline justify-center pt-2.5 font-extrabold" aria-label={`Câu ${idx + 1} trên ${VIEW.length}`}>{idx + 1}<span className="text-[11px] font-semibold">/{VIEW.length}</span></span>
            </div>
            <div className="flex gap-1.5" aria-hidden="true">
              {ELEMENTS.map((e, i) => <div key={e.key} className={`flex-1 h-1.5 rounded-sm ${i < elIndex ? "bg-[#1C1A17]" : i === elIndex ? "bg-[#9E2F22]" : "bg-[#D8CBAE]"}`} />)}
            </div>
            <div className="flex justify-center -my-2"><LinhCanStone active={q.el} className="w-[200px] h-[200px]" /></div>

            <div className="flex flex-col">
              <div className="h-3 -mx-1.5 rounded-md bg-[#6E4B2E]" />
              <div className="bg-[#FAF5E8] border-x border-[#CDBF9F] p-4 flex flex-col gap-3">
                {q.say ? (
                  <div className="flex items-center gap-3">
                    <button onClick={play} disabled={plays >= 2 || !canSpeak} aria-label="Phát đoạn nghe"
                      className="w-12 h-12 rounded-full bg-[#9E2F22] disabled:bg-[#B9AD97] text-white grid place-items-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                    <div className="flex-1">
                      <div className="font-serif-vn font-bold">{q.q}</div>
                      <div className="text-sm text-[#6B6253]">{canSpeak ? `Nghe tối đa 2 lần · còn ${2 - plays} lần` : "Trình duyệt này không có giọng đọc tiếng Trung."}</div>
                    </div>
                  </div>
                ) : (
                  <div className="font-serif-vn font-bold">{q.q}</div>
                )}
                {q.say && !showText && (
                  <button onClick={() => setShowText(true)} className="self-start text-xs font-semibold text-[#7A2218] underline underline-offset-2">Không nghe được? Hiện chữ</button>
                )}
                {(q.zh || (q.say && showText)) && (
                  <div className="rounded-md bg-[#EFE7D6] px-3 py-3 text-center text-[24px] leading-snug" style={{ fontFamily: '"Noto Serif SC",serif' }} lang="zh-CN">{q.zh || q.say}</div>
                )}
                <div role="radiogroup" aria-label="Các đáp án" className="flex flex-col gap-2">
                  {q.opts.map((o, i) => {
                    const on = picked === i;
                    return (
                      <button key={i} role="radio" aria-checked={on} onClick={() => setPicked(i)}
                        className={`min-h-[48px] flex items-center gap-3 px-3 py-2 rounded-[4px] text-left transition-colors ${on ? "border-2 border-[#9E2F22] bg-[#F3E3D2]" : "border border-[#D8CBAE] bg-white hover:border-[#9E2F22]"}`}>
                        <span className={`w-7 h-7 rounded-[3px] grid place-items-center font-brush text-[18px] shrink-0 ${on ? "bg-[#9E2F22] text-[#FBF3E4]" : "bg-[#EFE7D6]"}`} aria-hidden="true">{LABELS[i]}</span>
                        <span className="text-[16px]" style={/[一-鿿]/.test(o) ? { fontFamily: '"Noto Serif SC",serif' } : undefined}>{o}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="h-3 -mx-1.5 rounded-md bg-[#6E4B2E]" />
            </div>

            <button onClick={submit} disabled={picked == null}
              className="h-14 rounded-md bg-[#1C1A17] disabled:bg-[#8C7F68] text-[#F3EEE2] font-serif-vn text-[17px] font-extrabold shadow-[4px_4px_0_#9E2F22]">
              {idx + 1 < VIEW.length ? "Truyền linh lực" : "Hoàn tất cảm ứng"}
            </button>
          </>
        )}

        {phase === "result" && result && judged && (
          <>
            <div className="flex flex-col items-center text-center gap-1">
              <div className="font-serif-vn text-xs font-bold tracking-[0.16em] text-[#4A4238]">THIÊN ĐẠO PHÁN ĐỊNH</div>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <div className="font-brush text-[46px] md:text-[54px] leading-tight tt-ink">{judged.zh}</div>
                <span className="tt-stamp inline-block"><Seal chars={judged.grade.zh + "天赋"} filled={false} rotate={0} className="w-12 h-12 text-[19px]" /></span>
              </div>
              <div className="font-serif-vn text-[19px] font-extrabold">{judged.vn}</div>
              <div className="text-sm text-[#4A4238]">Tư chất <b>{judged.grade.vn}</b> · đo ngày {fmtDate(result.atMs)}</div>
            </div>
            <div className="flex justify-center"><NguHanhChart scores={result.scores} weak={judged.weak} /></div>
            <div className="flex flex-col gap-2">
              {ELEMENTS.map((e) => {
                const v = result.scores[e.key] || 0; const weak = e.key === judged.weak;
                return (
                  <div key={e.key} className="grid grid-cols-[30px_150px_minmax(0,1fr)_34px] items-center gap-2.5">
                    <span className={`font-brush text-[24px] leading-none ${weak ? "text-[#9E2F22]" : ""}`} aria-hidden="true">{e.zh}</span>
                    <span className="text-[13px] font-semibold">{e.vn} · {e.skill}</span>
                    <span className="h-1.5 bg-[#DCD1BA] overflow-hidden rounded-[1px]"><span className={`block h-full tt-bar ${weak ? "bg-[#9E2F22]" : "bg-[#1C1A17]"}`} style={{ width: `${v}%` }} /></span>
                    <span className={`text-[13px] font-bold text-right ${weak ? "text-[#9E2F22]" : ""}`}>{v}</span>
                  </div>
                );
              })}
            </div>
            {(() => { const w = elementOf(judged.weak); return (
              <Link href={w.href} className="rounded-[4px] bg-[#1C1A17] text-[#F3EEE2] p-4 flex gap-3 shadow-[4px_4px_0_#9E2F22] hover:bg-[#2A2622]">
                <span aria-hidden="true" className="shrink-0"><VText lines="心魔" className="font-brush text-[22px] text-[#E6B656]" /></span>
                <span className="flex flex-col gap-1">
                  <b className="text-sm text-[#E6B656]">Tâm ma: hệ {w.vn} ({w.skill}) còn yếu</b>
                  <span className="text-[15px] leading-relaxed">Công pháp đề cử <span style={{ fontFamily: '"Noto Serif SC",serif' }}>{w.book}</span> — {w.tip}. Tu luyện hệ này được nhiều linh khí hơn.</span>
                </span>
              </Link>
            ); })()}
            {saved && <p className="text-sm text-[#4A4238] text-center" role="status">{saved}</p>}
            <div className="flex gap-3">
              <button onClick={share} className="flex-1 h-12 rounded-[4px] border-[1.5px] border-[#1C1A17] font-serif-vn font-bold">Khoe đồng song</button>
              <Link href="/" className="flex-[2] h-12 rounded-[4px] bg-[#9E2F22] hover:bg-[#7A2218] text-white font-serif-vn font-extrabold inline-flex items-center justify-center">Bước vào tiên đồ</Link>
            </div>
            <button onClick={restart} disabled={!canRetest} className="text-sm font-semibold text-[#7A2218] disabled:text-[#8C7F68] underline underline-offset-2 self-center">
              {canRetest ? "Đo lại linh căn" : `Được đo lại từ ngày ${fmtDate(nextTestMs)}`}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
