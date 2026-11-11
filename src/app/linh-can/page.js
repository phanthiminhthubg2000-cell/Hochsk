"use client";
// ============================================================
// TRẮC NGHIỆM LINH CĂN 测灵根 — Sơn Hải Thư Viện
// 20 câu · 5 hệ ngũ hành (Kim=Nghe · Mộc=Từ vựng · Thủy=Đọc · Hỏa=Phát âm · Thổ=Ngữ pháp)
// Mỗi hệ 4 câu, độ khó 1→4 = trọng số 1→4 (tổng 10) → điểm hệ 0–100
// Phần 2 · Định cảnh giới: thích ứng — bắt đầu ở cấp người học tự chọn, qua thì lên, trượt thì xuống.
//   Mỗi cấp 6 câu lấy ngẫu nhiên từ kho thẻ của cấp đó (điền chỗ trống, nghĩa, thanh điệu), 25 giây/câu, đúng ≥5 là qua.
//   Cảnh giới khởi đầu = cấp cao nhất đã qua + 1. Chỉ xếp lên, không hạ.
// Kết quả lưu ở users/{uid}.linhCan + users/{uid}.tuVi (Firestore) và localStorage; 30 ngày được đo lại một lần
// ============================================================
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import GardenNav from "../GardenNav";
import { ELEMENTS, elementOf, judgeLinhCan, LinhCanStone, NguHanhChart, Seal, VText } from "../tuTien";
import { REALMS8 } from "../tuVi";
import { loadCards } from "../luyenDan";
import { speakZh, preloadAudio, stopSpeak } from "../amThanh";

const RETEST_DAYS = 30;
const LABELS = ["甲", "乙", "丙", "丁"];

// a = đáp án đúng luôn ở vị trí 0 trong khai báo; khi hiển thị sẽ xoay vòng theo số câu
const QUESTIONS = [
  // 金 Kim · Nghe — nghe rồi trả lời câu hỏi về chi tiết
  { el: "kim", d: 1, say: "我昨天本来想去看电影，但是朋友临时有事，我们就改成明天了。", q: "Họ đi xem phim khi nào?", o: ["Ngày mai", "Hôm qua", "Hôm nay", "Không đi nữa"] },
  { el: "kim", d: 2, say: "这件衣服打八折以后是两百块。如果买两件，一共再便宜二十块。", q: "Mua hai cái thì tổng cộng bao nhiêu tiền?", o: ["380 tệ", "400 tệ", "360 tệ", "320 tệ"] },
  { el: "kim", d: 3, say: "老王说他不是不想帮忙，而是这几天实在抽不出时间。", q: "Lão Vương muốn nói gì?", o: ["Muốn giúp nhưng mấy hôm nay quá bận", "Không muốn giúp", "Đã giúp xong rồi", "Hôm nay sẽ giúp ngay"] },
  { el: "kim", d: 4, say: "与其说他是运气好，倒不如说他早就为这个机会做足了准备。", q: "Theo người nói, anh ấy thành công nhờ đâu?", o: ["Đã chuẩn bị kỹ từ trước", "Gặp may", "Được người khác giúp", "Cơ hội tự tìm đến"] },
  // 木 Mộc · Từ vựng — kết hợp từ, thành ngữ
  { el: "moc", d: 1, zh: "我每天早上七点＿＿床。", q: "Chọn từ điền vào chỗ trống", o: ["起", "上", "开", "站"] },
  { el: "moc", d: 2, zh: "这个问题很难，我得好好＿＿一下。", q: "Chọn từ điền vào chỗ trống", o: ["考虑", "考试", "关心", "打算"] },
  { el: "moc", d: 3, zh: "为了＿＿环境，我们应该少用塑料袋。", q: "Chọn từ điền vào chỗ trống", o: ["保护", "保持", "保存", "保证"] },
  { el: "moc", d: 4, zh: "杯弓蛇影", q: "Thành ngữ này nghĩa là gì?", o: ["Đa nghi, tự mình sợ hãi vô cớ", "Vẽ rắn thêm chân, làm điều thừa", "Cung tên sắc bén, sẵn sàng chiến đấu", "Rắn mất đầu, rối loạn vì không người dẫn"] },
  // 水 Thủy · Đọc hiểu — phải suy luận, không chỉ dịch
  { el: "thuy", d: 1, zh: "我比哥哥小三岁，哥哥今年二十岁。", q: "Người viết năm nay bao nhiêu tuổi?", o: ["17 tuổi", "23 tuổi", "20 tuổi", "3 tuổi"] },
  { el: "thuy", d: 2, zh: "小王平时坐地铁上班，今天地铁出了故障，他只好打车去公司。", q: "Hôm nay Tiểu Vương đi làm bằng gì?", o: ["Taxi", "Tàu điện ngầm", "Xe buýt", "Đi bộ"] },
  { el: "thuy", d: 3, zh: "这家公司几乎不做广告，靠的是过硬的产品质量和顾客之间的口口相传。", q: "Công ty này phát triển nhờ đâu?", o: ["Chất lượng tốt và khách truyền miệng", "Quảng cáo rầm rộ", "Giá rẻ nhất thị trường", "Được nhà nước hỗ trợ"] },
  { el: "thuy", d: 4, zh: "所谓“慢生活”，并不是让人做事拖拉，而是在快节奏中给自己留出时间，去感受生活本身的意义。", q: "Theo đoạn văn, “慢生活” là gì?", o: ["Giữa nhịp sống nhanh, dành thời gian cảm nhận ý nghĩa cuộc sống", "Làm việc chậm chạp, lề mề", "Rời thành phố về nông thôn sống", "Bỏ việc để nghỉ ngơi"] },
  // 火 Hỏa · Phát âm — biến điệu và chữ đa âm
  { el: "hoa", d: 1, zh: "你好", q: "Khi nói thực tế (có biến điệu), từ này đọc là:", o: ["níhǎo", "nǐhǎo", "nìhǎo", "níhāo"] },
  { el: "hoa", d: 2, zh: "一起", q: "Khi nói thực tế (có biến điệu), từ này đọc là:", o: ["yìqǐ", "yīqǐ", "yíqǐ", "yìqí"] },
  { el: "hoa", d: 3, zh: "他还没还我书。", q: "Hai chữ 还 trong câu lần lượt đọc là:", o: ["hái … huán", "huán … hái", "hái … hái", "huán … huán"] },
  { el: "hoa", d: 4, zh: "展览馆", q: "Ba thanh 3 liền nhau — khi nói thực tế thường đọc là:", o: ["zhánlánguǎn", "zhǎnlánguǎn", "zhánlǎnguǎn", "zhǎnlǎnguán"] },
  // 土 Thổ · Ngữ pháp
  { el: "tho", d: 1, zh: "我＿＿北京来的。", q: "Chọn từ điền vào chỗ trống", o: ["是从", "从是", "在从", "是在"] },
  { el: "tho", d: 2, zh: "", q: "Câu nào đúng ngữ pháp?", o: ["他汉语说得很流利。", "他说汉语得很流利。", "他汉语说很流利得。", "他说得汉语很流利。"] },
  { el: "tho", d: 3, zh: "这么多菜，我一个人吃＿＿。", q: "Chọn từ điền vào chỗ trống", o: ["不完", "没完", "完不", "不到完"] },
  { el: "tho", d: 4, zh: "这么难的题，连老师都做不出来，＿＿是我们呢？", q: "Chọn từ điền vào chỗ trống", o: ["何况", "尽管", "况且", "甚至"] },
];
// Xoay vị trí đáp án theo số câu (cố định, không ngẫu nhiên → không lệch khi tải trang)
const SHIFT = [0, 2, 1, 3, 2, 0, 3, 1, 1, 3, 0, 2, 3, 1, 2, 0, 2, 3, 0, 1];
const VIEW = QUESTIONS.map((q, i) => {
  const k = SHIFT[i % SHIFT.length];
  const order = [0, 1, 2, 3].map((x) => (x + 4 - k) % 4); // order[pos] = chỉ số trong q.o
  return { ...q, opts: order.map((x) => q.o[x]), right: order.indexOf(0) };
});


const fmtDate = (ms) => new Date(ms).toLocaleDateString("vi-VN");

// ---------- Định cảnh giới ----------
const PL_LEVELS = [
  { key: "hsk1", n: 1, vn: "HSK 1" }, { key: "hsk2", n: 2, vn: "HSK 2" }, { key: "hsk3", n: 3, vn: "HSK 3" },
  { key: "hsk4", n: 4, vn: "HSK 4" }, { key: "hsk5", n: 5, vn: "HSK 5" }, { key: "hsk6", n: 6, vn: "HSK 6" }, { key: "hsk7-9", n: 7, vn: "HSK 7–9" },
];
const PL_PER = 6, PL_PASS = 5, PL_TIME = 25;
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const shares = (a, b) => [...a].some((c) => b.includes(c));
// Thanh điệu: đổi dấu của một/hai nguyên âm để tạo phương án sai
const TONE = { a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", "ü": "ǖǘǚǜ" };
const MARK = {}; Object.entries(TONE).forEach(([v, t]) => [...t].forEach((c, k) => { MARK[c] = [v, k]; }));
function toneVariants(py) {
  const ch = [...py]; const at = ch.map((c, i) => (MARK[c] ? i : -1)).filter((i) => i >= 0);
  if (!at.length) return [];
  const out = new Set();
  const swap = (arr, i) => { const [v, k] = MARK[arr[i]]; const t = shuffle([0, 1, 2, 3].filter((x) => x !== k))[0]; arr[i] = TONE[v][t]; };
  for (let n = 0; n < 40 && out.size < 3; n++) {
    const c = [...ch]; const pick = shuffle(at).slice(0, at.length > 1 && Math.random() < 0.4 ? 2 : 1);
    pick.forEach((i) => swap(c, i)); const v = c.join(""); if (v !== py) out.add(v);
  }
  return [...out];
}
const pick3 = (near, far) => { const a = shuffle(near).slice(0, 2); return [...a, ...shuffle(far.filter((x) => !a.includes(x)))].slice(0, 3); };
// 6 câu/cấp từ kho thẻ thật: 2 điền chỗ trống trong câu ví dụ, 2 chọn nghĩa (nhiễu là từ cùng chữ), 2 thanh điệu
function makeLevelQs(cards) {
  const pool = cards.filter((c) => c[0] && c[2]);
  const used = new Set(); const qs = [];
  const take = (ok) => { const c = shuffle(pool).find((x) => !used.has(x[0]) && ok(x)); if (c) used.add(c[0]); return c; };
  const mk = (type, sub, ask, right, wrong, extra) => { const opts = shuffle([right, ...wrong]); return { type, sub, ask, opts, right: opts.indexOf(right), ...extra }; };
  for (let i = 0; i < 2; i++) {
    const c = take((x) => x[3] && x[3].split(x[0]).length === 2 && x[3].length >= x[0].length + 4);
    if (!c) continue;
    // Có gợi ý nghĩa để chỉ một đáp án đúng; nhiễu là từ cùng độ dài (ưu tiên cùng chữ) mang nghĩa khác
    const same = pool.filter((x) => x[0] !== c[0] && x[2] !== c[2] && x[0].length === c[0].length && !c[3].includes(x[0]));
    qs.push(mk("fill", `Điền từ mang nghĩa “${c[2].split(";")[0].trim()}”`, c[3].replace(c[0], "＿＿"), c[0], pick3(same.filter((x) => shares(x[0], c[0])).map((x) => x[0]), same.map((x) => x[0])), { zh: c[0] }));
  }
  for (let i = 0; i < 2; i++) {
    const c = take(() => true); if (!c) continue;
    const other = pool.filter((x) => x[0] !== c[0] && x[2] !== c[2]);
    const wrong = pick3(other.filter((x) => shares(x[0], c[0])).map((x) => x[2]), other.filter((x) => x[0].length === c[0].length).map((x) => x[2]));
    qs.push(mk("nghia", "Từ này nghĩa là gì?", c[0], c[2], [...new Set(wrong)].slice(0, 3), { zh: c[0] }));
  }
  for (let i = 0; i < 2; i++) {
    const c = take((x) => toneVariants(x[1]).length >= 3 && (x[0].length >= 2 || i === 0));
    if (!c) continue;
    qs.push(mk("am", "Chọn phiên âm đúng (theo từ điển)", c[0], c[1], toneVariants(c[1]).slice(0, 3), { zh: c[0] }));
  }
  return shuffle(qs);
}
// levels = [{n, ok, of}] → cảnh giới khởi đầu = cấp cao nhất đã qua + 1
const passOf = (l) => l.ok >= (l.of ? PL_PASS : 3);
function realmFromPlacement(levels) {
  if (!levels.length) return 0;
  const top = Math.max(0, ...levels.filter(passOf).map((l) => l.n));
  if (top > 0) return Math.min(7, top + 1);
  const h1 = levels.find((l) => l.n === 1);
  return h1 && h1.ok >= Math.ceil((h1.of || 4) / 2) ? 1 : 0; // chưa vững HSK1: biết khoảng nửa → Luyện Khí, chưa biết → Phàm Nhân
}

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
  // Định cảnh giới
  const [pl, setPl] = useState(null); // { li, qi, qs, ok, levels: [{n, ok}] }
  const [plPicked, setPlPicked] = useState(null);
  const [plStart, setPlStart] = useState(0);
  const [plLoading, setPlLoading] = useState(false);
  const [plLeft, setPlLeft] = useState(PL_TIME);
  const [scoresDraft, setScoresDraft] = useState(null);

  useEffect(() => { preloadAudio(); try { window.speechSynthesis?.getVoices(); } catch (_) {} }, []);

  // Kết quả cũ: Firestore (đã đăng nhập) hoặc máy này
  useEffect(() => {
    try { const x = JSON.parse(localStorage.getItem("sh_linh_can") || "null"); if (x?.scores) { setResult(x); setPhase("result"); } } catch (_) {}
  }, []);
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    getDoc(doc(db, "users", userId)).then((s) => {
      const lc = s.exists() ? s.data().linhCan : null;
      if (lc?.scores) { setResult({ scores: lc.scores, atMs: lc.atMs || lc.at?.toMillis?.() || Date.now(), placement: lc.placement || null }); setPhase("result"); }
    }).catch(() => {});
  }, [isSignedIn, userId]);

  const q = VIEW[idx];
  const el = elementOf(q?.el);
  const elIndex = ELEMENTS.findIndex((e) => e.key === q?.el);

  const play = () => {
    if (!q?.say || plays >= 2) return;
    setPlays((n) => n + 1);
    speakZh(q.say).then((ok) => { if (!ok) { setPlays((n) => Math.max(0, n - 1)); setCanSpeak(false); setShowText(true); } });
  };

  const submit = () => {
    if (picked == null) return;
    const next = [...answers, picked];
    setAnswers(next); setPicked(null); setPlays(0); setShowText(false);
    stopSpeak();
    if (idx + 1 < VIEW.length) { setIdx(idx + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    // Chấm điểm
    const sum = {}; const max = {};
    VIEW.forEach((v, i) => { max[v.el] = (max[v.el] || 0) + v.d; if (next[i] === v.right) sum[v.el] = (sum[v.el] || 0) + v.d; });
    const scores = Object.fromEntries(ELEMENTS.map((e) => [e.key, Math.round(((sum[e.key] || 0) / (max[e.key] || 1)) * 100)]));
    setScoresDraft(scores); setPhase("dinh"); window.scrollTo({ top: 0 });
  };

  const goLevel = async (li, base) => {
    setPlLoading(true); setPlPicked(null);
    try {
      const qs = makeLevelQs(await loadCards(PL_LEVELS[li].key));
      setPl({ ...base, li, qi: 0, ok: 0, qs }); setPhase("pl"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_) { setSaved("Không tải được đề định cảnh giới — kiểm tra mạng rồi thử lại."); }
    setPlLoading(false);
  };
  const startPlacement = () => goLevel(plStart, { start: plStart, dir: "up", levels: [] });
  // Thích ứng: đi lên khi qua; trượt ngay cấp khởi đầu thì đi xuống tới khi qua được một cấp
  const endLevel = (ok) => {
    const levels = [...pl.levels, { n: PL_LEVELS[pl.li].n, ok, of: PL_PER }];
    const pass = ok >= PL_PASS; const base = { ...pl, levels };
    if (pass && pl.dir === "up" && pl.li + 1 < PL_LEVELS.length) return goLevel(pl.li + 1, base);
    if (!pass && pl.li > 0 && (pl.dir === "down" || pl.li === pl.start)) return goLevel(pl.li - 1, { ...base, dir: "down" });
    finish(levels);
  };
  const plAnswer = (choice) => {
    if (!pl || plLoading) return;
    const ok = pl.ok + (choice === pl.qs[pl.qi].right ? 1 : 0);
    setPlPicked(null);
    if (pl.qi + 1 < pl.qs.length) { setPl({ ...pl, qi: pl.qi + 1, ok }); return; }
    endLevel(ok);
  };
  const plSubmit = () => { if (plPicked != null) plAnswer(plPicked); };
  // Đồng hồ 25 giây mỗi câu; hết giờ tính là sai
  useEffect(() => {
    if (phase !== "pl" || !pl || plLoading) return;
    setPlLeft(PL_TIME);
    const t = setInterval(() => setPlLeft((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [phase, pl?.li, pl?.qi, pl?.qs, plLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (plLeft <= 0 && phase === "pl" && pl && !plLoading) plAnswer(-1); }, [plLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lưu linh căn + cảnh giới khởi đầu
  const finish = async (levels) => {
    const scores = scoresDraft || {};
    const realm = realmFromPlacement(levels);
    const placement = { realm, levels, atMs: Date.now() };
    const r = { scores, atMs: placement.atMs, placement };
    setResult(r); setPhase("result"); window.scrollTo({ top: 0 });
    try { localStorage.setItem("sh_linh_can", JSON.stringify(r)); } catch (_) {}
    if (!(isSignedIn && userId)) { setSaved("Kết quả đang lưu trên máy này. Đăng nhập để giữ vào hồ sơ và bắt đầu tích tu vi."); return; }
    try {
      const snap = await getDoc(doc(db, "users", userId));
      const u = snap.exists() ? snap.data() : {};
      const cur = u.tuVi && Number.isFinite(u.tuVi.realm) ? u.tuVi.realm : -1;
      const upd = { linhCan: { scores, atMs: r.atMs, at: serverTimestamp(), placement } };
      // Chỉ xếp lên: cảnh giới mới cao hơn hiện tại thì vào tầng 1 của cảnh giới mới
      if (realm > cur) upd.tuVi = { realm, base: u.xp || 0, src: "trac-linh", at: Date.now(), placed: true };
      await setDoc(doc(db, "users", userId), upd, { merge: true });
      setSaved(realm > cur ? "Đã ghi danh cảnh giới vào hồ sơ thư sinh." : `Đã lưu linh căn. Cảnh giới hiện tại (${REALMS8[cur].vn}) đã cao hơn kết quả định cảnh nên được giữ nguyên.`);
    } catch (_) { setSaved("Chưa lưu được lên hồ sơ — kết quả vẫn được giữ trên máy này."); }
  };

  const restart = () => { setAnswers([]); setIdx(0); setPicked(null); setPlays(0); setShowText(false); setSaved(""); setPl(null); setScoresDraft(null); setPhase("quiz"); };
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
      <GardenNav active="home" title="Trắc Linh Đài" />
      <main className="max-w-[560px] mx-auto px-4 pt-6 pb-28 md:pb-16 flex flex-col gap-5">

        {phase === "intro" && (
          <>
            <div className="flex flex-col items-center text-center gap-1">
              <div className="font-brush text-[44px] leading-none">测灵根</div>
              <div className="font-serif-vn text-sm font-bold tracking-[0.12em] text-[#4A4238]">TRẮC NGHIỆM LINH CĂN</div>
            </div>
            <div className="flex justify-center"><LinhCanStone active="kim" className="w-[240px] h-[240px]" /></div>
            <div className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-3 text-[15px] leading-relaxed">
              <p>Trắc Linh Đài có hai phần, khoảng <b>12 phút</b>:</p>
              <p><b>1 · Cảm ứng linh căn</b> — 20 câu đo năm hệ ngũ hành:</p>
              <ul className="grid gap-1.5">
                {ELEMENTS.map((e) => (
                  <li key={e.key} className="flex items-center gap-3"><span className="font-brush text-[22px] w-7 text-center leading-none">{e.zh}</span><span><b>{e.vn}</b> · {e.skill}</span></li>
                ))}
              </ul>
              <p><b>2 · Định cảnh giới</b> — đề rút ngẫu nhiên từ kho từ thật của từng cấp HSK: điền từ vào câu, chọn nghĩa, chọn thanh điệu. Mỗi cấp 6 câu, 25 giây một câu, đúng 5/6 mới qua. Qua thì lên cấp, trượt thì xuống — dừng ở đâu, đó là cảnh giới khởi đầu.</p>
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

        {phase === "dinh" && (
          <>
            <div className="flex flex-col items-center text-center gap-1">
              <div className="font-brush text-[44px] leading-none">定境界</div>
              <div className="font-serif-vn text-sm font-bold tracking-[0.12em] text-[#4A4238]">PHẦN 2 · ĐỊNH CẢNH GIỚI</div>
            </div>
            <div className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-3 text-[15px] leading-relaxed">
              <p>Linh căn đã cảm ứng xong. Giờ Linh Căn Thạch thử độ sâu tu vi: mỗi ải <b>6 câu</b> rút ngẫu nhiên từ kho từ của cấp đó, <b>25 giây</b> một câu, đúng <b>5/6</b> mới qua. Qua thì lên ải trên, trượt thì xuống ải dưới.</p>
              <div className="flex flex-col gap-2">
                <div className="font-serif-vn font-bold">Bạn đang học tới khoảng cấp nào?</div>
                <div role="radiogroup" aria-label="Cấp bắt đầu" className="grid grid-cols-4 gap-1.5">
                  {PL_LEVELS.map((L, i) => { const R = REALMS8[L.n]; const on = plStart === i; return (
                    <button key={L.key} role="radio" aria-checked={on} onClick={() => setPlStart(i)}
                      className={`rounded-[4px] px-1 py-1.5 text-center text-[12px] ${on ? "border-2 border-[#9E2F22] bg-[#F3E3D2]" : "border border-[#D8CBAE] bg-white hover:border-[#9E2F22]"}`}>
                      <span className="block font-extrabold text-[13px]">{L.vn}</span><span className="block text-[#6B6253]">{R.vn}</span>
                    </button>
                  ); })}
                </div>
                <p className="text-sm text-[#6B6253]">Đây chỉ là ải xuất phát. Chọn cao quá cũng không sao — trượt thì Linh Căn Thạch tự hạ xuống.</p>
              </div>
              <p className="text-sm text-[#6B6253]">Không biết thì đừng đoán bừa — xếp quá cao sẽ khó tích tu vi. Cảnh giới chỉ được xếp lên, không bao giờ bị hạ.</p>
            </div>
            {saved && <p className="text-sm font-semibold text-[#7A2218] text-center">{saved}</p>}
            <button onClick={startPlacement} disabled={plLoading} className="h-14 disabled:opacity-60 rounded-md bg-[#1C1A17] text-[#F3EEE2] font-serif-vn text-[17px] font-extrabold shadow-[4px_4px_0_#9E2F22]">{plLoading ? "Đang rút đề…" : `Thử độ sâu tu vi · bắt đầu ${PL_LEVELS[plStart].vn}`}</button>
            <button onClick={() => finish([])} className="text-sm font-semibold text-[#7A2218] underline underline-offset-2 self-center">Tôi mới bắt đầu học — vào Phàm Nhân Giới</button>
          </>
        )}

        {phase === "pl" && pl && (() => {
          const L = PL_LEVELS[pl.li]; const R = REALMS8[Math.min(7, L.n)]; const cq = pl.qs[pl.qi];
          return (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-serif-vn text-xs font-bold tracking-[0.12em] text-[#6B6253]">ĐỊNH CẢNH GIỚI · {L.vn}</span>
                  <span className="font-serif-vn text-[18px] font-extrabold">Ải {R.vn} <span className="font-brush font-normal text-[22px]">{R.zh}</span></span>
                </div>
                <span className="h-11 min-w-11 px-2 rounded-md bg-[#9E2F22] text-[#FBF3E4] inline-flex items-baseline justify-center pt-2.5 font-extrabold" aria-label={`Câu ${pl.qi + 1} trên ${pl.qs.length}`}>{pl.qi + 1}<span className="text-[11px] font-semibold">/{pl.qs.length}</span></span>
              </div>
              <div className="flex gap-1" aria-hidden="true">
                {PL_LEVELS.map((x, i) => <div key={x.key} className={`flex-1 h-1.5 rounded-sm ${i < pl.li ? "bg-[#2F6E5A]" : i === pl.li ? "bg-[#9E2F22]" : "bg-[#D8CBAE]"}`} />)}
              </div>
              <div className="flex items-center gap-2" role="timer" aria-label={`Còn ${Math.max(0, plLeft)} giây`}>
                <div className="flex-1 h-2 rounded-sm bg-[#D8CBAE] overflow-hidden"><div className={`h-full transition-[width] duration-1000 ease-linear ${plLeft <= 8 ? "bg-[#9E2F22]" : "bg-[#1C1A17]"}`} style={{ width: `${Math.max(0, plLeft) / PL_TIME * 100}%` }} /></div>
                <span className={`w-9 text-right text-sm font-extrabold tabular-nums ${plLeft <= 8 ? "text-[#9E2F22]" : ""}`}>{Math.max(0, plLeft)}s</span>
              </div>
              <div className="rounded-[14px] bg-[#FAF5E8] border border-[#CDBF9F] p-4 flex flex-col gap-3">
                <div className="font-serif-vn font-bold">{cq.sub}</div>
                <div className={`rounded-md bg-[#EFE7D6] px-3 text-center ${cq.type === "fill" ? "py-4 text-[22px] leading-snug" : "py-5 text-[40px] leading-none"}`} style={{ fontFamily: '"Noto Serif SC",serif' }} lang="zh-CN">{cq.ask}</div>
                <div role="radiogroup" aria-label="Các đáp án" className="flex flex-col gap-2">
                  {cq.opts.map((o, i) => {
                    const on = plPicked === i;
                    return (
                      <button key={i} role="radio" aria-checked={on} onClick={() => setPlPicked(i)}
                        className={`min-h-[48px] flex items-center gap-3 px-3 py-2 rounded-[4px] text-left transition-colors ${on ? "border-2 border-[#9E2F22] bg-[#F3E3D2]" : "border border-[#D8CBAE] bg-white hover:border-[#9E2F22]"}`}>
                        <span className={`w-7 h-7 rounded-[3px] grid place-items-center font-brush text-[18px] shrink-0 ${on ? "bg-[#9E2F22] text-[#FBF3E4]" : "bg-[#EFE7D6]"}`} aria-hidden="true">{LABELS[i]}</span>
                        <span className="text-[16px]" style={cq.type === "fill" ? { fontFamily: '"Noto Serif SC",serif' } : undefined} lang={cq.type === "fill" ? "zh-CN" : undefined}>{o}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={plSubmit} disabled={plPicked == null || plLoading}
                className="h-14 rounded-md bg-[#1C1A17] disabled:bg-[#8C7F68] text-[#F3EEE2] font-serif-vn text-[17px] font-extrabold shadow-[4px_4px_0_#9E2F22]">
                {plLoading ? "Đang rút đề…" : pl.qi + 1 < pl.qs.length ? "Tiếp" : "Xong ải này"}
              </button>
              <button onClick={() => endLevel(0)} disabled={plLoading} className="text-sm font-semibold text-[#7A2218] underline underline-offset-2 self-center">Cấp này tôi chưa học — bỏ qua ải này</button>
            </>
          );
        })()}

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
            {result.placement && (() => { const R = REALMS8[result.placement.realm] || REALMS8[0]; return (
              <section className="rounded-[14px] bg-[#1C1A17] text-[#F3EEE2] p-5 flex items-center gap-4 shadow-[4px_4px_0_#9E2F22]" aria-label="Cảnh giới khởi đầu">
                <VText lines={R.zh} className="font-brush text-[44px] text-[#E6B656] shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="font-serif-vn text-xs font-bold tracking-[0.14em] text-[#CFC3A8]">CẢNH GIỚI KHỞI ĐẦU</span>
                  <span className="font-serif-vn text-[22px] font-extrabold leading-tight">{R.vn} · Tầng 1</span>
                  <span className="text-sm text-[#E6B656] font-bold">{R.hsk} · {R.region}</span>
                  <span className="flex flex-wrap gap-1 mt-1">
                    {[...result.placement.levels].sort((x, y) => x.n - y.n).map((l) => <span key={l.n} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-[3px] ${passOf(l) ? "bg-[#2F6E5A] text-white" : "bg-[#5E5446] text-[#E9DFC8]"}`}>{PL_LEVELS.find((x) => x.n === l.n)?.vn} {l.ok}/{l.of || 4}</span>)}
                  </span>
                </div>
              </section>
            ); })()}
            {!result.placement && (
              <button onClick={() => { setScoresDraft(result.scores); setPhase("dinh"); window.scrollTo({ top: 0 }); }}
                className="rounded-[14px] border-2 border-[#1C1A17] bg-[#FBF8F1] p-4 flex items-center gap-3 text-left shadow-[4px_4px_0_#9E2F22]">
                <span className="font-brush text-[32px] leading-none text-[#9E2F22] shrink-0" aria-hidden="true">定境</span>
                <span className="flex-1"><b className="block font-serif-vn">Chưa định cảnh giới</b><span className="block text-sm text-[#4A4238]">Làm phần 2 (vài phút) để được xếp đúng cảnh giới theo trình độ thật.</span></span>
              </button>
            )}
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
                  <span className="text-[15px] leading-relaxed">Công pháp đề cử <span style={{ fontFamily: '"Noto Serif SC",serif' }}>{w.book}</span> — {w.tip}. Luyện hệ yếu trước để ngũ hành cân bằng, độ kiếp dễ qua hơn.</span>
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
