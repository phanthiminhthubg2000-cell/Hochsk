"use client";
// ============================================================
// HSK GARDEN — GIAO DIỆN "KHU VƯỜN" (v6)
// 5 khu: Vườn (trang chủ) · Học · Luyện · Thi · Chơi
// Một loại điểm duy nhất: "lá" (dùng trường xp sẵn có trong Firestore)
// Ao sen tự nở: mỗi bài giảng được đánh dấu "Đã học xong" = 1 bông sen
// ============================================================
import Link from "next/link";
import { STATIC_LECTURES } from "./staticLectures";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { db } from "../firebase";
import { usePhoneticsResultSaver } from "../phoneticsResultSaver";
import { useHskkResultSaver } from "../hskkResultSaver";
import { doc, setDoc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";

// TỪ ĐIỂN LOCAL (dùng cho ô tìm kiếm trong khu Học)
import cardsData from "./cards.json";
import topicData from "./topics.json";

// 6 CẤP ĐỘ HSK 3.0 (kho đề thi)
const HSK3_LEVELS = [
  "HSK 3.0 - Cấp độ 1",
  "HSK 3.0 - Cấp độ 2",
  "HSK 3.0 - Cấp độ 3",
  "HSK 3.0 - Cấp độ 4",
  "HSK 3.0 - Cấp độ 5",
  "HSK 3.0 - Cấp độ 6"
];

// Giáo trình (kho bài giảng) — chỉ hiện những giáo trình đã có bài
const LEVEL_OPTIONS = [
  "Msutong HSK1", "Msutong HSK2", "Msutong HSK3.1", "Msutong HSK3.2",
  "HSK4.1 2.0", "HSK4.2 2.0", "HSK5.1 2.0", "HSK5.2 2.0",
  "HSK1 3.0", "HSK2 3.0", "HSK3 3.0", "HSK4.1 3.0", "HSK4.2 3.0", "HSK5.1 3.0", "HSK5.2 3.0"
];

// Đề HSKK dự phòng khi không đọc được /public/hskk-exam/exams.json
const HSKK_EXAMS_FALLBACK = [
  { level: 3, title: "HSK（三级）口语 · 样卷", label: "HSKK 3 · Đề 01", file: "/hskk-exam/HSK3_KHAU_NGU.html", questions: 15, minutes: 15, parts: "Nghe nhắc lại 8 câu · Nhìn tranh 5 câu · Trả lời 2 câu" },
  { level: 3, title: "HSK（三级）口语 · 模拟题 02", label: "HSKK 3 · Đề 02", file: "/hskk-exam/HSK3_KHAU_NGU_DE02.html", questions: 15, minutes: 15, parts: "Nghe nhắc lại 8 câu · Nhìn tranh 5 câu · Trả lời 2 câu" },
  { level: 4, title: "HSK（四级）口语", label: "HSKK 4", file: "/hskk-exam/HSK4_KHAU_NGU.html", questions: 5, minutes: 20, parts: "Nghe thuật lại 2 câu · Kể chuyện theo tranh · Trả lời 2 câu" },
  { level: 5, title: "HSK（五级）口语", label: "HSKK 5", file: "/hskk-exam/HSK5_KHAU_NGU.html", questions: 5, minutes: 23, parts: "Nghe thuật lại 2 câu · Kể chuyện theo tranh · Trả lời 2 câu" },
  { level: 6, title: "HSK（六级）口语", label: "HSKK 6", file: "/hskk-exam/HSK6_KHAU_NGU.html", questions: 5, minutes: 23, parts: "Nghe thuật lại 2 câu · Kể chuyện theo tranh · Trả lời 2 câu" },
];

const LEAF_PER_LESSON = 30;
const LOTUS_STAGES = 11; // /public/lotus/lotus_stage_01..11.webp

// Hiển thị tệp .html (đề thi / bài giảng) trong iframe.
function htmlFrameProps(item) {
  if (!item) return {};
  if (item.htmlContent) return { srcDoc: item.htmlContent };
  const url = item.fileUrl || "";
  if (/^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com|[^/]+\.firebasestorage\.app)\//.test(url)) {
    return { src: `/api/exam-html?u=${encodeURIComponent(url)}` };
  }
  return { src: url };
}

// Thu bài làm từ iframe đề thi (đề không tự gửi kết quả): đọc các lựa chọn / ô viết + nội dung trang
function captureExamFrame() {
  try {
    const f = document.querySelector("iframe[data-hsk3-frame]");
    const doc = f && (f.contentDocument || f.contentWindow?.document);
    if (!doc || !doc.body) return null;
    const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
    const labelOf = (el) => {
      if (el.id) { const l = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return txt(l); }
      const l = el.closest("label"); if (l) return txt(l);
      return txt(el.parentElement).slice(0, 60);
    };
    const choices = [];
    doc.querySelectorAll("input[type=radio]:checked, input[type=checkbox]:checked").forEach((el) => {
      choices.push(`${el.name || el.id || "?"}: ${el.value && el.value !== "on" ? el.value : ""} ${labelOf(el)}`.replace(/\s+/g, " ").trim().slice(0, 120));
    });
    doc.querySelectorAll("select").forEach((el) => { if (el.value) choices.push(`${el.name || el.id || "?"}: ${el.value}`); });
    const texts = [];
    doc.querySelectorAll("textarea, input[type=text], input:not([type]), [contenteditable=true]").forEach((el) => {
      const v = (el.value ?? el.innerText ?? "").trim();
      if (v) texts.push(`[${el.name || el.id || el.placeholder || "ô viết"}]\n${v}`);
    });
    return {
      capturedChoices: choices.join("\n").slice(0, 30000),
      capturedTexts: texts.join("\n\n").slice(0, 40000),
      capturedPageText: (doc.body.innerText || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000),
    };
  } catch (e) { return { captureError: String(e && e.message || e) }; }
}

// ============================================================
// TỪ ĐIỂN
// ============================================================
const getLocalDictionary = () => {
  const dict = [];
  if (Array.isArray(cardsData)) {
    cardsData.forEach(item => dict.push({
      hanzi: item.chinese || item.hanzi || item.front || item.word || "",
      pinyin: item.pinyin || "",
      meaning: item.vietnamese || item.meaning || item.back || "",
    }));
  }
  if (Array.isArray(topicData)) {
    topicData.forEach(topic => (topic.words || []).forEach(w => dict.push({
      hanzi: w.chinese || w.hanzi || w.word || "",
      pinyin: w.pinyin || "",
      meaning: w.vietnamese || w.meaning || "",
    })));
  }
  return Array.from(new Map(dict.map(i => [i.hanzi, i])).values()).filter(i => i.hanzi);
};
const localDictionary = getLocalDictionary();

// ============================================================
// BIỂU TƯỢNG (SVG nét, không dùng emoji)
// ============================================================
const Icon = ({ name, className = "w-6 h-6", strokeWidth = 2 }) => {
  const p = {
    leaf: <><path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" /><path d="M5 19l7-7" /></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0z" /><path d="M12 12v4" /><path d="M8 20h8" /><path d="M16 5h3a3 3 0 0 1-3 3" /><path d="M8 5H5a3 3 0 0 0 3 3" /></>,
    flame: <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-8z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
    sprout: <><path d="M12 21V11" /><path d="M12 11C12 7 9 4 5 4c0 4 3 7 7 7z" /><path d="M12 13c0-3 3-6 7-6 0 3-3 6-7 6z" /></>,
    blocks: <><rect x="3" y="4" width="7" height="6" rx="1.5" /><rect x="14" y="4" width="7" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /></>,
    headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>,
    translate: <><path d="M4 6h8" /><path d="M8 4v2c0 4-2 7-4 8" /><path d="M6 10c1 2 3 4 6 4" /><path d="M13 20l4-9 4 9" /><path d="M14.5 17h5" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chevron: <path d="M9 6l6 6-6 6" />,
    back: <path d="M15 6l-6 6 6 6" />,
    gamepad: <><path d="M7 8h10a5 5 0 0 1 4.6 7l-.7 1.6a2.5 2.5 0 0 1-4.3.4L15 15H9l-1.6 2a2.5 2.5 0 0 1-4.3-.4L2.4 15A5 5 0 0 1 7 8z" /><path d="M7 11v3" /><path d="M5.5 12.5h3" /><circle cx="16" cy="11.5" r=".6" /><circle cx="18" cy="13.5" r=".6" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    check: <path d="M5 12l5 5 9-10" />,
    send: <><path d="M4 12l16-8-6 16-3-7z" /></>,
    shield: <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />,
    clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9 12h6" /><path d="M9 16h4" /></>,
    sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
    play: <path d="M8 5l11 7-11 7z" fill="currentColor" />,
  }[name];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{p}</svg>
  );
};

// Ếch Xanh — linh vật (4 biểu cảm: happy · cheer · think · sleepy)
const Frog = ({ mood = "happy", className = "w-12 h-10" }) => (
  <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
    <ellipse cx="60" cy="66" rx="50" ry="32" fill="#3DB46D" />
    <ellipse cx="60" cy="74" rx="32" ry="18" fill="#A6E3B4" />
    <circle cx="34" cy="34" r="20" fill="#3DB46D" />
    <circle cx="86" cy="34" r="20" fill="#3DB46D" />
    {mood === "cheer" ? (
      <>
        <path d="M24 36 Q34 26 44 36" stroke="#13261C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M76 36 Q86 26 96 36" stroke="#13261C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M42 58 Q60 82 78 58 Z" fill="#13261C" />
        <path d="M50 66 Q60 74 70 66" fill="#F27BA0" />
      </>
    ) : mood === "sleepy" ? (
      <>
        <path d="M24 34 Q34 42 44 34" stroke="#13261C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M76 34 Q86 42 96 34" stroke="#13261C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="60" cy="66" rx="5" ry="4" fill="#13261C" />
      </>
    ) : (
      <>
        <circle cx="34" cy="34" r="13" fill="#FFFFFF" />
        <circle cx="86" cy="34" r="13" fill="#FFFFFF" />
        {mood === "think" ? (
          <>
            <circle cx="38" cy="30" r="6" fill="#13261C" /><circle cx="90" cy="30" r="6" fill="#13261C" />
            <path d="M50 66 L70 64" stroke="#13261C" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="37" cy="36" r="6" fill="#13261C" /><circle cx="83" cy="36" r="6" fill="#13261C" />
            <path d="M44 62 Q60 74 76 62" stroke="#13261C" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        )}
      </>
    )}
    <circle cx="26" cy="60" r="6" fill="#F59BB4" opacity="0.7" />
    <circle cx="94" cy="60" r="6" fill="#F59BB4" opacity="0.7" />
  </svg>
);

const LotusMark = ({ className = "w-7 h-7" }) => (
  <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
    <path d="M22 6 C28 16 30 24 22 34 C14 24 16 16 22 6z" fill="#F59BB4" />
    <path d="M22 34 C10 30 6 22 8 14 C16 18 20 26 22 34z" fill="#F27BA0" />
    <path d="M22 34 C34 30 38 22 36 14 C28 18 24 26 22 34z" fill="#F27BA0" />
  </svg>
);

const Bar = ({ value, color = "bg-[#2E9D5B]", track = "bg-[#E3EADB]", h = "h-2" }) => (
  <div className={`${h} rounded-full ${track} overflow-hidden`}>
    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

const TABS = [
  { key: "home", label: "Vườn", icon: "leaf" },
  { key: "learn", label: "Học", icon: "book" },
  { key: "practice", label: "Luyện", icon: "target" },
  { key: "exam", label: "Thi", icon: "trophy" },
  { key: "play", label: "Chơi", icon: "gamepad" },
];

// KHU CHƠI — mỗi trò là một tệp .html trong /public
// ---------- Bìa minh hoạ riêng cho từng trò chơi ----------
const GAME_STYLE = {
  "nghieng-dau": { ink: "#5B33B0", soft: "#EEE7FB", badge: "📷 Camera", meta: "1 máy chiếu · cả lớp" },
  "trieu-phu": { ink: "#1D47B8", soft: "#E6EDFC", badge: "🏆 10 câu", meta: "1 máy chiếu · cả lớp" },
  "bom": { ink: "#C2410C", soft: "#FDEBDD", badge: "📱 Nhiều máy", meta: "Mỗi HS 1 điện thoại" },
};

function GameCover({ g }) {
  const st = GAME_STYLE[g.key] || {};
  return (
    <div className={`h-44 bg-gradient-to-br ${g.bg} relative overflow-hidden`}>
      {/* hoạ tiết chữ Hán mờ */}
      <div aria-hidden="true" className="zh absolute inset-0 text-white/[.05] font-bold text-[44px] leading-[1.15] tracking-[.3em] select-none -rotate-12 scale-125 whitespace-pre">
        {"汉字游戏学习\n中文快乐课堂\n汉语水平考试\n汉字游戏学习"}
      </div>
      <span className="absolute top-3 left-3 z-10 text-[11px] font-extrabold tracking-wide text-white bg-black/25 backdrop-blur px-2.5 py-1 rounded-full">{st.badge}</span>
      <div className="absolute inset-0 grid place-items-center">
        {g.key === "nghieng-dau" && <CoverTilt />}
        {g.key === "trieu-phu" && <CoverMillion />}
        {g.key === "bom" && <CoverBomb />}
        {!["nghieng-dau", "trieu-phu", "bom"].includes(g.key) && (
          <div className="flex gap-3 zh text-3xl font-bold">{g.face.map((f) => <span key={f} className="w-16 h-[70px] rounded-2xl bg-white grid place-items-center">{f}</span>)}</div>
        )}
      </div>
    </div>
  );
}

// Nghiêng đầu: khuôn mặt lắc trái/phải giữa 2 thẻ 左 右
function CoverTilt() {
  return (
    <div className="flex items-center gap-5">
      <span className="zh w-14 h-16 rounded-2xl bg-[#C9F2DF] text-[#1B1530] text-3xl font-bold grid place-items-center -rotate-12 shadow-lg transition-transform group-hover:-translate-x-1">左</span>
      <svg viewBox="0 0 100 110" className="w-24 h-24 gc-tilt drop-shadow-lg" aria-hidden="true">
        <rect x="18" y="98" width="64" height="12" rx="6" fill="#2A1650" opacity=".35" />
        <circle cx="50" cy="52" r="38" fill="#FFD9A8" />
        <path d="M14 46 q8 -36 36 -36 q28 0 36 36 q-14 -16 -36 -16 q-22 0 -36 16z" fill="#2A1650" />
        <circle cx="37" cy="56" r="5" fill="#2A1650" /><circle cx="63" cy="56" r="5" fill="#2A1650" />
        <circle cx="29" cy="68" r="5" fill="#FF9DB5" opacity=".7" /><circle cx="71" cy="68" r="5" fill="#FF9DB5" opacity=".7" />
        <path d="M40 72 q10 9 20 0" stroke="#2A1650" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
      <span className="zh w-14 h-16 rounded-2xl bg-[#F8D3EA] text-[#1B1530] text-3xl font-bold grid place-items-center rotate-12 shadow-lg transition-transform group-hover:translate-x-1">右</span>
    </div>
  );
}

// Triệu phú: đèn sân khấu + bảng đáp án + giải thưởng
function CoverMillion() {
  return (
    <div className="relative w-full h-full">
      <div aria-hidden="true" className="gc-glow absolute left-1/2 -translate-x-1/2 -top-10 w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,214,90,.45), transparent 62%)" }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
        <div className="gc-float text-[#FFD25A] font-extrabold text-3xl tracking-wide drop-shadow">💰 1.000.000</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 w-[230px]">
          {[["A", "学习"], ["B", "工作"], ["C", "朋友"], ["D", "老师"]].map(([k, w]) => (
            <span key={k} className={`zh h-8 rounded-full border-2 text-sm font-bold flex items-center gap-2 px-3 ${k === "C" ? "bg-[#FFB627] border-[#FFE29A] text-[#1B1530]" : "bg-[#0B1A5C]/80 border-[#6E8EF0] text-white"}`}>
              <b className={k === "C" ? "text-[#1B1530]" : "text-[#FFD25A]"}>{k}</b>{w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Bom: quả bom ngòi cháy + điện thoại quét QR
function CoverBomb() {
  return (
    <div className="flex items-end gap-4">
      <svg viewBox="0 0 120 120" className="w-32 h-32 gc-shake drop-shadow-xl" aria-hidden="true">
        <circle cx="56" cy="72" r="38" fill="#1F2A24" />
        <circle cx="44" cy="58" r="10" fill="#47564D" />
        <rect x="70" y="26" width="18" height="15" rx="4" transform="rotate(40 79 33)" fill="#47564D" />
        <path d="M86 26 q8 -12 20 -14" stroke="#E2B77A" strokeWidth="4" fill="none" strokeLinecap="round" />
        <g transform="translate(106 12)"><g className="gc-spark"><circle r="9" fill="#FFB627" /><circle r="4.5" fill="#FFF3C4" /></g></g>
        <text x="56" y="82" textAnchor="middle" fontSize="26" fontWeight="800" fill="#FFB627" fontFamily="Noto Sans SC, sans-serif">炸</text>
      </svg>
      <div className="gc-float w-[62px] h-[104px] rounded-[14px] bg-[#1B1530] border-[3px] border-white/80 p-1.5 flex flex-col items-center gap-1 shadow-xl -rotate-6">
        <div className="w-full flex-1 rounded-md bg-white grid grid-cols-5 grid-rows-5 gap-[2px] p-1">
          {[1,1,1,0,1, 1,0,1,1,0, 1,1,0,1,1, 0,1,1,0,1, 1,0,1,1,1].map((v, i) => <span key={i} className={v ? "bg-[#1B1530] rounded-[1px]" : ""} />)}
        </div>
        <span className="text-[9px] font-extrabold text-white tracking-wider">QUÉT QR</span>
      </div>
    </div>
  );
}

const GAMES = [
  {
    key: "nghieng-dau",
    title: "Quiz Nghiêng Đầu",
    zh: "汉字大挑战",
    desc: "Nghiêng đầu trái / phải để chọn đáp án. Mỗi lượt là toàn bộ từ vựng của bài đã chọn (HSK 1 · 2 · 3 · 5).",
    tags: ["Camera", "Cả bài / lượt", "Cả lớp"],
    href: "/game-nghieng-dau.html",
    bg: "from-[#2A1650] to-[#4B2A8A]",
    face: ["左", "右"],
  },
  {
    key: "trieu-phu",
    title: "Ai là triệu phú",
    zh: "百万富翁",
    desc: "10 câu hỏi khó dần, 4 đáp án, 3 quyền trợ giúp (50:50 · hỏi cả lớp · đổi câu) và 2 mốc an toàn.",
    tags: ["4 đáp án", "Khó dần", "Ôn tập cuối chương"],
    href: "/game-trieu-phu.html",
    bg: "from-[#050B2E] to-[#1D47B8]",
    face: ["百", "万"],
  },
  {
    key: "bom",
    title: "Bom nổ chậm",
    zh: "传炸弹",
    desc: "Học sinh quét QR, chơi trên điện thoại. Bom rơi vào tay ai thì người đó trả lời — đúng thì chuyền bom, ngòi nổ ngẫu nhiên. Màn hình giáo viên phát trực tiếp.",
    tags: ["Quét QR", "Điện thoại", "Cả lớp"],
    href: "/bom/host",
    bg: "from-[#3A1206] to-[#C2410C]",
    face: ["炸", "弹"],
  },
];

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

// ============================================================
// TRANG HỌC VIÊN
// ============================================================
export default function HomePage() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  usePhoneticsResultSaver({ role: "student", userId, userName: user?.fullName || "" });
  useHskkResultSaver({ userId, userName: user?.fullName || "", userEmail: user?.primaryEmailAddress?.emailAddress || "" });

  const [activeTab, setActiveTab] = useState("home");
  const [examTab, setExamTab] = useState("hsk3"); // hsk3 | hskk | test

  // --- NGƯỜI HỌC ---
  const [streak, setStreak] = useState(0);
  const [leaves, setLeaves] = useState(0); // = xp
  const [todayVocabLearned, setTodayVocabLearned] = useState(0);
  const [todayListeningLearned, setTodayListeningLearned] = useState(0);
  const [todayGrammarLearned, setTodayGrammarLearned] = useState(0);
  const [isTeacher, setIsTeacher] = useState(false);
  const [skillMap, setSkillMap] = useState({ vocabulary: 0, grammar: 0, listening: 0, translation: 0, writing: 0, speaking: 0 });
  const [results, setResults] = useState([]); // kết quả đã chấm (test + hskk)
  const [selectedResult, setSelectedResult] = useState(null);

  // --- BÀI GIẢNG ---
  const [lecturesBankList, setLecturesBankList] = useState([]);
  const [selectedLectureLevel, setSelectedLectureLevel] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [lastLecture, setLastLecture] = useState(null); // {id, level, name}
  const [lessonsDone, setLessonsDone] = useState([]);   // [lectureId]
  const [bloomFx, setBloomFx] = useState(false);
  const [learnQuery, setLearnQuery] = useState("");

  // --- ĐỀ THI ---
  const [hsk3ExamsList, setHsk3ExamsList] = useState([]);
  const [activeHskExamView, setActiveHskExamView] = useState(null);
  const [activeHskkExam, setActiveHskkExam] = useState(null);
  const [hskkExams, setHskkExams] = useState(HSKK_EXAMS_FALLBACK);

  // --- HỎI ẾCH (AI) ---
  const [aiResponse, setAiResponse] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // ---------- Đề HSK 3.0 gửi kết quả qua postMessage ----------
  const hsk3SavedRef = useRef(null);
  useEffect(() => { hsk3SavedRef.current = null; }, [activeHskExamView]);
  useEffect(() => {
    const onMsg = async (e) => {
      const d = e.data;
      if (!d || d.source !== "hsk-garden-hsk3") return;
      const frame = Array.from(document.querySelectorAll("iframe")).find((f) => f.contentWindow === e.source);
      if (!frame) return;
      const reply = (m) => { try { e.source.postMessage({ source: "hsk-garden-dashboard", ...m }, "*"); } catch (_) {} };
      if (d.type === "HSK3_READY") {
        reply({ type: "HSK3_INIT", name: user?.fullName || "", email: user?.primaryEmailAddress?.emailAddress || "" });
        return;
      }
      if (d.type !== "HSK3_SUBMIT" || !activeHskExamView) return;
      if (hsk3SavedRef.current) { reply({ type: "HSK3_SAVED" }); return; }
      try {
        const brief = (det) => (Array.isArray(det) ? det.map((x) => `${x.n}:${x.your || "-"}${x.ok ? "✓" : "✗" + x.ans}`).join(" ") : "");
        const ref = await addDoc(collection(db, "hsk3_submissions"), {
          userId: userId || "guest",
          userName: user?.fullName || d.name || "Học viên ẩn danh",
          userEmail: user?.primaryEmailAddress?.emailAddress || d.email || "Không có",
          studentTypedName: d.name || "",
          examId: activeHskExamView.id,
          examName: activeHskExamView.examName,
          level: activeHskExamView.level,
          status: "pending_teacher",
          autoResult: true,
          listeningScore: d.listening?.score ?? null,
          listeningCorrect: d.listening?.correct ?? null,
          listeningTotal: d.listening?.total ?? null,
          readingScore: d.reading?.score ?? null,
          readingCorrect: d.reading?.correct ?? null,
          readingTotal: d.reading?.total ?? null,
          listeningDetail: brief(d.listening?.detail),
          readingDetail: brief(d.reading?.detail),
          writing71: String(d.writing?.q71 || "").slice(0, 20000),
          writing72: String(d.writing?.q72 || "").slice(0, 20000),
          writing71Count: d.writing?.c71 ?? 0,
          writing72Count: d.writing?.c72 ?? 0,
          durationMin: d.durationMin ?? null,
          submittedAt: serverTimestamp()
        });
        hsk3SavedRef.current = ref.id;
        reply({ type: "HSK3_SAVED" });
      } catch (err) {
        reply({ type: "HSK3_ERROR", message: err.message });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [activeHskExamView, user, userId]);

  // ---------- Tải danh sách đề / bài ----------
  useEffect(() => {
    fetch("/hskk-exam/exams.json", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(list => { if (Array.isArray(list) && list.length) setHskkExams(list.filter(e => e && e.file && !e.hidden)); })
      .catch(err => console.warn("Không đọc được /hskk-exam/exams.json, dùng danh sách dự phòng:", err));
  }, []);

  const fetchHsk3Exams = useCallback(async () => {
    // Đề tĩnh trong /public/hsk3-exam/exams.json (không cần tải lên Firestore)
    let statics = [];
    try {
      const r = await fetch("/hsk3-exam/exams.json", { cache: "no-store" });
      if (r.ok) statics = (await r.json()).filter(e => e && e.fileUrl && !e.hidden).map(e => ({ ...e, createdAt: e.addedAt ? { toMillis: () => Date.parse(e.addedAt) } : null }));
    } catch (err) { console.warn("Không đọc được /hsk3-exam/exams.json:", err); }
    if (statics.length) setHsk3ExamsList(prev => (prev.length ? prev : statics));
    const list = [];
    try {
      const snapshot = await getDocs(collection(db, "hsk3_exams_bank"));
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    } catch (err) { console.error("Lỗi tải kho đề thi HSK 3.0:", err); }
    const names = new Set(list.map(e => e.examName));
    setHsk3ExamsList([...list, ...statics.filter(e => !names.has(e.examName))]);
  }, []);

  const fetchLectures = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "lectures_bank"));
      const list = [...STATIC_LECTURES];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.lectureName || "").localeCompare(b.lectureName || "", undefined, { numeric: true, sensitivity: "base" }));
      setLecturesBankList(list);
    } catch (err) { console.error("Lỗi tải bài giảng:", err); setLecturesBankList([...STATIC_LECTURES]); }
  }, []);

  useEffect(() => { fetchHsk3Exams(); fetchLectures(); }, [fetchHsk3Exams, fetchLectures]);

  // Bài học dở lần trước (lưu trên máy để mở nhanh khi chưa tải xong Firestore)
  useEffect(() => {
    try { const s = localStorage.getItem("hg_last_lecture"); if (s) setLastLecture(JSON.parse(s)); } catch (_) {}
  }, []);

  // ---------- Dữ liệu người học ----------
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    const load = async () => {
      try {
        const userRef = doc(db, "users", userId);
        const uSnap = await getDoc(userRef);
        const uData = uSnap.exists() ? uSnap.data() : {};
        if (user) {
          await setDoc(userRef, {
            fullName: user.fullName || user.firstName || "Người làm vườn",
            avatar: user.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
          }, { merge: true });
        }
        const upSnap = await getDoc(doc(db, "user_progress", userId));
        const upData = upSnap.exists() ? upSnap.data() : {};
        const pSnap = await getDoc(doc(db, "progress", userId));
        const pData = pSnap.exists() ? pSnap.data() : {};

        const tv = uData.todayVocabLearned ?? upData.todayVocabLearned ?? 0;
        const tl = uData.todayListeningLearned ?? upData.todayListeningLearned ?? 0;
        const tg = uData.todayGrammarLearned ?? upData.todayGrammarLearned ?? 0;

        let teacherSkills = null;
        const list = [];
        try {
          const testSnap = await getDocs(query(collection(db, "test_submissions"), where("userId", "==", userId), where("status", "==", "graded")));
          let latest = null;
          testSnap.forEach(d => {
            const t = d.data();
            const time = t.submittedAt?.toMillis?.() || 0;
            list.push({ id: d.id, type: "test", title: "Thi đánh giá năng lực", score: t.teacherScore, level: t.evaluatedLevel, feedback: t.teacherFeedback, recommendation: t.recommendation, skills: t.skillsEvaluation, time });
            if (!latest || time > (latest.submittedAt?.toMillis?.() || 0)) latest = t;
          });
          const hskkSnap = await getDocs(query(collection(db, "hskk_exams"), where("userId", "==", userId), where("status", "==", "graded")));
          hskkSnap.forEach(d => {
            const h = d.data();
            list.push({ id: d.id, type: "hskk", title: "Thi khẩu ngữ HSKK", score: h.teacherScore, level: h.level, feedback: h.teacherFeedback, time: h.submittedAt?.toMillis?.() || 0 });
          });
          list.sort((a, b) => b.time - a.time);
          setResults(list);
          if (latest?.skillsEvaluation) {
            const ev = latest.skillsEvaluation;
            teacherSkills = { listening: ev.listening?.score || 0, speaking: ev.speaking?.score || 0, translation: ev.reading?.score || 0, grammar: ev.reading?.score || 0, vocabulary: ev.reading?.score || 0, writing: ev.writing?.score || 0 };
          }
        } catch (error) { console.error("Lỗi lấy kết quả:", error); }

        const s = uData.skill_map || upData.skill_map || pData.skill_map || {};
        const pick = (k, fb) => (teacherSkills?.[k] !== undefined ? teacherSkills[k] : (s[k] ?? fb));
        setSkillMap({
          vocabulary: pick("vocabulary", Math.min(tv * 5, 100)),
          grammar: pick("grammar", Math.min(tg * 10, 100)),
          listening: pick("listening", Math.min(tl * 20, 100)),
          translation: pick("translation", Math.min((s.vocabulary || 0) * 0.8, 100)),
          writing: pick("writing", Math.min((s.grammar || 0) * 0.8, 100)),
          speaking: pick("speaking", 0),
        });

        setStreak(uData.streak ?? upData.profile?.streak_days ?? pData.streakCount ?? 0);
        setLeaves(uData.xp ?? upData.profile?.hsk_xp ?? pData.xp ?? 0);
        setTodayVocabLearned(tv); setTodayListeningLearned(tl); setTodayGrammarLearned(tg);
        if (Array.isArray(uData.lessonsDone)) setLessonsDone(uData.lessonsDone);
        if (uData.lastLecture?.id) setLastLecture(uData.lastLecture);
        if (uData.lectureLevel) setSelectedLectureLevel(l => l || uData.lectureLevel);

        if (["teacher", "admin"].includes(uData.role) || ["teacher", "admin"].includes(user?.publicMetadata?.role)) setIsTeacher(true);
      } catch (err) { console.error("Lỗi đồng bộ dữ liệu:", err); }
    };
    load();
  }, [isSignedIn, userId, user]);

  // ---------- Suy ra trạng thái khu vườn ----------
  const levelsWithLessons = useMemo(
    () => LEVEL_OPTIONS.filter(l => lecturesBankList.some(x => x.level === l)),
    [lecturesBankList]
  );
  const currentCourse = selectedLectureLevel || lastLecture?.level || levelsWithLessons[0] || null;
  const courseLessons = useMemo(() => lecturesBankList.filter(l => l.level === currentCourse), [lecturesBankList, currentCourse]);
  const courseDone = courseLessons.filter(l => lessonsDone.includes(l.id)).length;
  const coursePct = courseLessons.length ? Math.round((courseDone / courseLessons.length) * 100) : 0;
  const lotusStage = String(Math.min(LOTUS_STAGES, 1 + Math.round((coursePct / 100) * (LOTUS_STAGES - 1)))).padStart(2, "0");

  // Bài nên học tiếp: bài mở gần nhất nếu chưa xong, nếu không thì bài đầu tiên chưa xong trong giáo trình
  const nextLesson = useMemo(() => {
    const last = lastLecture && lecturesBankList.find(l => l.id === lastLecture.id);
    if (last && !lessonsDone.includes(last.id)) return last;
    return courseLessons.find(l => !lessonsDone.includes(l.id)) || last || courseLessons[0] || null;
  }, [lastLecture, lecturesBankList, lessonsDone, courseLessons]);
  const nextIndex = nextLesson ? courseLessons.findIndex(l => l.id === nextLesson.id) + 1 : 0;

  const skills = [
    { key: "vocabulary", label: "Từ vựng", sub: "Thẻ từ · theo chủ đề", href: "/vocab", extra: { href: "/topic", label: "Chủ đề" }, icon: "sprout", tone: "bg-[#E7F5EC] text-[#1E7A45]" },
    { key: "grammar", label: "Ngữ pháp", sub: "Sắp xếp câu", href: "/arrange", icon: "blocks", tone: "bg-[#FFF4DE] text-[#B36B00]" },
    { key: "listening", label: "Nghe chép", sub: "Nghe và viết lại", href: "/dictation", icon: "headphones", tone: "bg-[#E3F3F7] text-[#1F7A8C]" },
    { key: "translation", label: "Dịch câu", sub: "Việt ⇄ Trung", href: "/translate", icon: "translate", tone: "bg-[#EDEBFA] text-[#5747B5]" },
    { key: "speaking", label: "Nói", sub: "Phim trường · đóng vai theo tình huống", href: "/roleplay", icon: "mic", tone: "bg-[#FFE9D2] text-[#B35400]" },
  ].map(s => ({ ...s, value: Math.round(Math.min(skillMap[s.key] || 0, 100)) }));
  const weakest = [...skills].sort((a, b) => a.value - b.value)[0];

  const missions = [
    { label: "Ôn 20 từ vựng", done: todayVocabLearned >= 20, sub: `${Math.min(todayVocabLearned, 20)}/20`, href: "/vocab", leaf: 20 },
    { label: nextLesson ? `Học tiếp ${nextLesson.lectureName}` : "Học 1 bài mới", done: false, sub: `+${LEAF_PER_LESSON}`, lesson: nextLesson, leaf: LEAF_PER_LESSON },
    { label: "Nghe chép 1 bài", done: todayListeningLearned >= 1, sub: `${Math.min(todayListeningLearned, 1)}/1`, href: "/dictation", leaf: 15 },
    { label: "Sắp xếp 10 câu", done: todayGrammarLearned >= 10, sub: `${Math.min(todayGrammarLearned, 10)}/10`, href: "/arrange", leaf: 20 },
  ];
  const missionsDone = missions.filter(m => m.done).length;

  // ---------- Hành động ----------
  const goTab = (key) => { setActiveTab(key); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const openLecture = async (lec) => {
    if (!lec) return;
    setSelectedLecture(lec);
    const info = { id: lec.id, level: lec.level, name: lec.lectureName };
    setLastLecture(info);
    try { localStorage.setItem("hg_last_lecture", JSON.stringify(info)); } catch (_) {}
    if (userId) { try { await setDoc(doc(db, "users", userId), { lastLecture: info }, { merge: true }); } catch (_) {} }
  };

  const pickCourse = async (lvl) => {
    setSelectedLectureLevel(lvl);
    if (userId) { try { await setDoc(doc(db, "users", userId), { lectureLevel: lvl }, { merge: true }); } catch (_) {} }
  };

  const markLessonDone = async () => {
    if (!selectedLecture || lessonsDone.includes(selectedLecture.id)) return;
    const next = [...lessonsDone, selectedLecture.id];
    const newLeaves = leaves + LEAF_PER_LESSON;
    setLessonsDone(next);
    setLeaves(newLeaves);
    setBloomFx(true);
    setTimeout(() => setBloomFx(false), 2600);
    if (userId) {
      try { await setDoc(doc(db, "users", userId), { lessonsDone: next, xp: newLeaves }, { merge: true }); }
      catch (err) { console.error("Lỗi lưu tiến độ:", err); }
    }
  };

  const handleAskFrog = async () => {
    if (!learnQuery.trim()) return;
    setIsAiLoading(true); setAiResponse(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Hãy giải thích chi tiết về từ vựng, đoạn văn hoặc ngữ pháp này trong tiếng Trung giúp tôi, format rõ ràng: ${learnQuery}` })
      });
      const data = await res.json();
      setAiResponse(data.reply || data.response || "Ếch xanh đang bận, thử lại sau nhé.");
    } catch (_) {
      setAiResponse("Không kết nối được. Vui lòng thử lại sau.");
    } finally { setIsAiLoading(false); }
  };

  const q = learnQuery.trim().toLowerCase();
  const lessonHits = q ? lecturesBankList.filter(l => (l.lectureName || "").toLowerCase().includes(q)).slice(0, 8) : [];
  const dictHits = q ? localDictionary.filter(i => i.hanzi.includes(learnQuery.trim()) || i.pinyin.toLowerCase().includes(q) || i.meaning.toLowerCase().includes(q)).slice(0, 8) : [];

  const hour = new Date().getHours();
  const greet = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const firstName = user?.firstName || (user?.fullName || "").split(" ").pop() || "bạn";
  const inFullscreen = selectedLecture || activeHskExamView || activeHskkExam;
  const newestExam = useMemo(() => {
    const t = (e) => e.createdAt?.toMillis?.() || 0;
    const arr = hsk3ExamsList.filter(e => t(e) > Date.now() - 21 * 86400000).sort((a, b) => t(b) - t(a));
    return arr[0] || null; // chỉ hiện "Đề mới" cho đề giáo viên tải lên trong 3 tuần gần đây
  }, [hsk3ExamsList]);

  // ============================================================
  // KHỐI GIAO DIỆN DÙNG CHUNG
  // ============================================================
  const card = "bg-white border border-[#DDE6D3] rounded-[22px]";
  const eyebrow = "text-xs font-semibold uppercase tracking-[0.08em] text-[#5B7262]";

  const ContinueCard = () => (
    <section className={`${card} p-6 md:p-8 flex flex-col gap-5 relative overflow-hidden`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className={eyebrow}>Học tiếp</div>
          {nextLesson ? (
            <>
              <h2 className="mt-1 text-2xl md:text-[32px] font-extrabold tracking-tight leading-tight">{nextLesson.lectureName}</h2>
              <p className="mt-1 text-[15px] text-[#3F5546]">{nextLesson.level}{nextIndex > 0 && ` · Bài ${nextIndex}/${courseLessons.length}`}</p>
            </>
          ) : (
            <h2 className="mt-1 text-2xl md:text-[32px] font-extrabold tracking-tight leading-tight">Chọn giáo trình để bắt đầu</h2>
          )}
        </div>
        <div className="hidden sm:flex items-end gap-2 shrink-0">
          <div className="relative max-w-[220px] rounded-2xl rounded-br-sm bg-[#E7F5EC] border border-[#BFE3CB] px-4 py-3 text-sm text-[#1E3D2A] leading-snug">
            {nextLesson ? (lessonsDone.includes(nextLesson.id) ? "Bài này xong rồi, ôn lại một chút nhé!" : "Học xong bài này là ao nở thêm một bông sen!") : "Vào khu Học và chọn giáo trình của bạn nhé."}
          </div>
          <Frog className="w-16 h-14" />
        </div>
      </div>
      {courseLessons.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1"><Bar value={coursePct} h="h-2.5" /></div>
          <span className="text-sm font-bold text-[#1E7A45] tabular-nums">{coursePct}%</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => (nextLesson ? openLecture(nextLesson) : goTab("learn"))}
          className="h-12 px-6 rounded-[14px] bg-[#2E9D5B] hover:bg-[#1E7A45] text-white font-bold text-base inline-flex items-center justify-center gap-2 transition-colors"
        >
          <Icon name="play" className="w-4 h-4" /> {nextLesson ? "Học tiếp" : "Chọn bài"}
        </button>
        <button onClick={() => goTab("learn")} className="h-12 px-6 rounded-[14px] border border-[#C9D6BE] bg-white hover:bg-[#F1F7EC] text-[#13261C] font-semibold text-base transition-colors">
          Chọn bài khác
        </button>
      </div>
    </section>
  );

  const PondCard = () => (
    <section className="rounded-[22px] bg-[#1E5C38] text-white p-6 flex flex-col gap-4 overflow-hidden relative">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#BFE3CB]">Ao sen</div>
          <h3 className="mt-1 text-lg font-bold">{currentCourse || "Chưa chọn giáo trình"}</h3>
        </div>
        <LotusMark className="w-8 h-8" />
      </div>
      <div className="relative h-44 rounded-2xl bg-[#2B7A4B] overflow-hidden grid place-items-center">
        <div className="absolute -left-6 -right-6 -bottom-16 h-28 rounded-[50%] bg-[#7CC8D6]/70" />
        <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-white/70 bg-[#E7F5EC] shadow-xl">
          <img
            src={`/lotus/lotus_stage_${lotusStage}.webp`}
            alt={`Ao sen ${coursePct}%`}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </div>
        <Frog className="absolute right-3 bottom-2 w-12 h-10" />
      </div>
      <Bar value={coursePct} color="bg-[#FFB547]" track="bg-white/15" />
      <p className="text-sm text-[#D4EFDC]">{courseDone} / {courseLessons.length || 0} bài đã nở sen</p>
    </section>
  );

  const MissionsCard = () => (
    <section className={`${card} p-5 flex flex-col gap-3`}>
      <div className="flex items-baseline justify-between"><h3 className="text-[17px] font-bold">Việc hôm nay</h3><span className="text-sm text-[#5B7262]">{missionsDone} / {missions.length}</span></div>
      {missions.map((m, i) => {
        const inner = (
          <>
            <span className={`w-6 h-6 rounded-md border-2 grid place-items-center shrink-0 ${m.done ? "bg-[#2E9D5B] border-[#2E9D5B] text-white" : "border-[#C9D6BE]"}`}>{m.done && <Icon name="check" className="w-4 h-4" strokeWidth={3} />}</span>
            <span className={`flex-1 min-w-0 truncate text-[15px] ${m.done ? "line-through text-[#5B7262]" : ""}`}>{m.label}</span>
            <span className="text-xs font-bold text-[#1E7A45] shrink-0">{m.done ? `+${m.leaf}` : m.sub}</span>
          </>
        );
        const cls = `flex items-center gap-3 p-3 rounded-xl text-left min-h-[48px] transition-colors ${m.done ? "bg-[#F1F7EC]" : "border border-[#E3EADB] hover:border-[#2E9D5B]"}`;
        return m.href
          ? <Link key={i} href={m.href} className={cls}>{inner}</Link>
          : <button key={i} onClick={() => (m.lesson ? openLecture(m.lesson) : goTab("learn"))} className={cls}>{inner}</button>;
      })}
    </section>
  );

  const StreakCard = () => {
    const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    const today = (new Date().getDay() + 6) % 7;
    return (
      <section className={`${card} p-5 flex flex-col gap-4`}>
        <div className="flex items-baseline justify-between"><h3 className="text-[17px] font-bold">Chuỗi ngày học</h3><span className="text-sm font-bold text-[#B36B00]">{streak} ngày</span></div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const back = (today - i + 7) % 7;
            const lit = i <= today && back < streak;
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span className={`w-9 h-9 rounded-full grid place-items-center ${lit ? "bg-[#FFB547] text-[#13261C]" : i === today ? "border-2 border-dashed border-[#F0C66E] text-[#B36B00]" : "bg-[#EEF2E8] text-[#9AAB9E]"}`}>
                  <Icon name="flame" className="w-4 h-4" />
                </span>
                <span className={`text-[11px] font-semibold ${i === today ? "text-[#13261C]" : "text-[#5B7262]"}`}>{d}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-[#FFF8EA] p-3">
          <Frog mood={streak > 0 ? "happy" : "sleepy"} className="w-10 h-8 shrink-0" />
          <p className="text-sm text-[#5C3D00]">{streak > 0 ? "Học hôm nay để giữ chuỗi nhé!" : "Ếch đang ngủ gật… học một bài để đánh thức nhé."}</p>
        </div>
      </section>
    );
  };

  const ResultsCard = ({ limit = 3 }) => (
    <section className={`${card} p-5 flex flex-col gap-2`}>
      <div className="flex items-baseline justify-between"><h3 className="text-[17px] font-bold">Kết quả của tôi</h3>{results.length > 0 && <span className="text-sm text-[#5B7262]">{results.length}</span>}</div>
      {results.length === 0 ? (
        <p className="text-sm text-[#5B7262] py-3">Chưa có bài nào được giáo viên chấm.</p>
      ) : results.slice(0, limit).map(r => (
        <button key={r.id} onClick={() => setSelectedResult(r)} className="flex items-center gap-3 py-2.5 border-b border-[#EEF2E8] last:border-0 text-left hover:bg-[#F7FAF4] rounded-lg px-1 transition-colors">
          <span className="w-12 h-12 rounded-xl bg-[#E7F5EC] grid place-items-center font-extrabold text-[#1E5C38] tabular-nums shrink-0">{r.score ?? "—"}</span>
          <span className="flex-1 min-w-0"><span className="block font-semibold text-sm truncate">{r.title}</span><span className="block text-xs text-[#5B7262] truncate">{r.level ? `${r.level} · ` : ""}{r.time ? new Date(r.time).toLocaleDateString("vi-VN") : "Đã chấm"}</span></span>
          <Icon name="chevron" className="w-4 h-4 text-[#5B7262]" />
        </button>
      ))}
    </section>
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="hg-garden min-h-screen bg-[#F4F7EF] text-[#13261C]">
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap");
.hg-garden{font-family:"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.hg-garden .zh{font-family:"Noto Sans SC","Be Vietnam Pro",sans-serif}
.hg-garden button:focus-visible,.hg-garden a:focus-visible,.hg-garden input:focus-visible{outline:3px solid #2E9D5B;outline-offset:2px}
.hg-scroll::-webkit-scrollbar{display:none}.hg-scroll{scrollbar-width:none}
@keyframes hgPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}`}</style>

      {/* ---------- THANH TRÊN (máy tính) ---------- */}
      {!inFullscreen && (
        <header className="sticky top-0 z-30 bg-[#F4F7EF]/90 backdrop-blur border-b border-[#DDE6D3]">
          <div className="max-w-[1200px] mx-auto h-16 md:h-[72px] px-4 md:px-8 flex items-center gap-4">
            <button onClick={() => goTab("home")} className="flex items-center gap-2.5 shrink-0" aria-label="HSK Garden — về Vườn">
              <Frog className="w-10 h-8" />
              <span className="font-extrabold text-lg tracking-tight hidden sm:inline">HSK Garden</span>
            </button>

            <nav aria-label="Khu chính" className="hidden md:flex items-center gap-1 ml-6 p-1 rounded-2xl bg-[#E3EADB]">
              {TABS.map(t => (
                <button key={t.key} onClick={() => goTab(t.key)} aria-current={activeTab === t.key ? "page" : undefined}
                  className={`h-10 px-5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold transition-colors ${activeTab === t.key ? "bg-white text-[#1E5C38] shadow-sm" : "text-[#3F5546] hover:text-[#13261C]"}`}>
                  <Icon name={t.icon} className="w-5 h-5" />{t.label}
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#FFF4DE] border border-[#F6D99A] text-sm font-bold text-[#7A4A00]" title="Chuỗi ngày học">
                <Icon name="flame" className="w-4 h-4 text-[#C97A00]" />{streak}<span className="hidden lg:inline font-semibold"> ngày</span>
              </span>
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#E7F5EC] border border-[#BFE3CB] text-sm font-bold text-[#1E5C38]" title="Lá — điểm khu vườn">
                <Icon name="leaf" className="w-4 h-4 text-[#1E7A45]" />{fmt(leaves)}<span className="hidden lg:inline font-semibold"> lá</span>
              </span>
              {isTeacher && (
                <Link href="/teacher" className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[#C9D6BE] bg-white text-sm font-semibold hover:bg-[#F1F7EC]">
                  <Icon name="shield" className="w-4 h-4" />Quản lý
                </Link>
              )}
              {isSignedIn ? (
                <div className="ml-1"><UserButton afterSignOutUrl="/" /></div>
              ) : (
                <SignInButton mode="modal">
                  <button className="h-10 px-4 rounded-xl bg-[#2E9D5B] hover:bg-[#1E7A45] text-white text-sm font-bold">Đăng nhập</button>
                </SignInButton>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ---------- NỘI DUNG ---------- */}
      {!inFullscreen && (
        <main className="max-w-[1200px] mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-28 md:pb-16">

          {/* ===== VƯỜN ===== */}
          {activeTab === "home" && (
            <div className="flex flex-col gap-5 md:gap-6">
              <div>
                <p className="text-sm text-[#5B7262]">{greet}</p>
                <h1 className="text-2xl md:text-[28px] font-extrabold tracking-tight">{isSignedIn ? firstName : "Người làm vườn"}</h1>
              </div>
              <div className="grid gap-5 md:gap-6 lg:grid-cols-[1.6fr_1fr]">
                <ContinueCard />
                <PondCard />
              </div>
              <div className="grid gap-5 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
                <MissionsCard />
                <StreakCard />
                <ResultsCard />
              </div>
            </div>
          )}

          {/* ===== HỌC ===== */}
          {activeTab === "learn" && (
            <div className="flex flex-col gap-5">
              <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight">Học</h1>

              <label className="flex items-center gap-3 h-12 px-4 rounded-[14px] bg-white border border-[#DDE6D3] focus-within:border-[#2E9D5B]">
                <Icon name="search" className="w-5 h-5 text-[#5B7262]" />
                <input
                  type="search" value={learnQuery}
                  onChange={(e) => { setLearnQuery(e.target.value); setAiResponse(null); }}
                  placeholder="Tìm bài, từ vựng, ngữ pháp…" aria-label="Tìm bài, từ vựng, ngữ pháp"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-[#8A9B8E]"
                />
              </label>

              {q ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <section className={`${card} p-5 flex flex-col gap-2`}>
                    <h2 className="text-[17px] font-bold">Bài học</h2>
                    {lessonHits.length === 0 ? <p className="text-sm text-[#5B7262]">Không có bài nào khớp.</p> : lessonHits.map(l => (
                      <button key={l.id} onClick={() => openLecture(l)} className="flex items-center gap-3 p-3 rounded-xl border border-[#E3EADB] hover:border-[#2E9D5B] text-left">
                        <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{l.lectureName}</span><span className="block text-xs text-[#5B7262]">{l.level}</span></span>
                        <Icon name="chevron" className="w-4 h-4 text-[#5B7262]" />
                      </button>
                    ))}
                  </section>
                  <section className={`${card} p-5 flex flex-col gap-2`}>
                    <h2 className="text-[17px] font-bold">Từ điển</h2>
                    {dictHits.length === 0 ? <p className="text-sm text-[#5B7262]">Không có từ nào khớp.</p> : dictHits.map((w, i) => (
                      <div key={i} className="flex items-baseline gap-3 py-2 border-b border-[#EEF2E8] last:border-0">
                        <span className="zh text-xl font-bold text-[#1E5C38]">{w.hanzi}</span>
                        <span className="text-sm text-[#5B7262]">{w.pinyin}</span>
                        <span className="text-sm flex-1 min-w-0 truncate">{w.meaning}</span>
                      </div>
                    ))}
                    <div className="mt-2 rounded-xl bg-[#E7F5EC] border border-[#BFE3CB] p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <Frog mood={isAiLoading ? "think" : "happy"} className="w-10 h-8 shrink-0" />
                        <p className="flex-1 text-sm text-[#1E3D2A]">Muốn Ếch giải thích kỹ “{learnQuery.trim()}”?</p>
                        <button onClick={handleAskFrog} disabled={isAiLoading} className="h-10 px-4 rounded-xl bg-[#2E9D5B] hover:bg-[#1E7A45] disabled:opacity-60 text-white text-sm font-bold shrink-0">{isAiLoading ? "Đang nghĩ…" : "Hỏi Ếch"}</button>
                      </div>
                      {aiResponse && <div className="text-sm leading-relaxed whitespace-pre-wrap bg-white rounded-lg p-3 border border-[#DDE6D3] max-h-[50vh] overflow-y-auto">{aiResponse}</div>}
                    </div>
                  </section>
                </div>
              ) : (
                <>
                  <div role="tablist" aria-label="Giáo trình" className="hg-scroll flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                    {(levelsWithLessons.length ? levelsWithLessons : LEVEL_OPTIONS).map(lvl => {
                      const on = lvl === currentCourse;
                      return (
                        <button key={lvl} role="tab" aria-selected={on} onClick={() => pickCourse(lvl)}
                          className={`shrink-0 h-11 px-4 rounded-full border text-sm font-semibold transition-colors ${on ? "bg-[#13261C] border-[#13261C] text-white" : "bg-white border-[#C9D6BE] text-[#3F5546] hover:border-[#2E9D5B]"}`}>
                          {lvl}
                        </button>
                      );
                    })}
                  </div>

                  {courseLessons.length > 0 && (
                    <div className="flex items-center gap-3 text-sm text-[#3F5546]">
                      <LotusMark className="w-5 h-5" /><span><b>{courseDone}</b> / {courseLessons.length} bài đã nở sen</span>
                      <div className="flex-1 max-w-[240px]"><Bar value={coursePct} /></div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {courseLessons.length === 0 ? (
                      <div className={`${card} col-span-full p-10 text-center flex flex-col items-center gap-3`}>
                        <Frog mood="sleepy" className="w-16 h-14" />
                        <p className="text-[#5B7262]">Giáo viên chưa cập nhật bài cho giáo trình này.</p>
                      </div>
                    ) : courseLessons.map((lec, i) => {
                      const done = lessonsDone.includes(lec.id);
                      const current = nextLesson?.id === lec.id;
                      const review = /ôn tập|on tap|review/i.test(lec.lectureName || "");
                      return (
                        <button key={lec.id} onClick={() => openLecture(lec)}
                          className={`flex items-center gap-4 p-4 rounded-[18px] text-left transition-colors ${current ? "bg-white border-2 border-[#2E9D5B]" : review ? "bg-[#FFFBEF] border border-dashed border-[#F0C66E] hover:border-[#B36B00]" : "bg-white border border-[#DDE6D3] hover:border-[#2E9D5B]"}`}>
                          <span className={`w-12 h-12 rounded-[14px] grid place-items-center shrink-0 font-extrabold ${done ? "bg-[#FDE3EC]" : current ? "bg-[#E7F5EC] text-[#1E7A45]" : review ? "bg-[#FFF0CC] text-[#B36B00]" : "bg-[#EEF2E8] text-[#7A8C7E]"}`}>
                            {done ? <LotusMark className="w-7 h-7" /> : i + 1}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-xs font-semibold ${current ? "text-[#1E7A45]" : review ? "text-[#8A5A00]" : "text-[#5B7262]"}`}>{done ? "Đã nở sen" : current ? "Học tiếp" : review ? "Ôn tập" : "Chưa học"}</span>
                            <span className="block font-bold text-[15px] leading-snug line-clamp-2">{lec.lectureName}</span>
                          </span>
                          <Icon name="chevron" className="w-5 h-5 text-[#9AAB9E] shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== LUYỆN ===== */}
          {activeTab === "practice" && (
            <div className="flex flex-col gap-5">
              <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight">Luyện</h1>
              {weakest && (
                <div className="flex items-center gap-3 p-4 rounded-[18px] bg-[#E7F5EC] border border-[#BFE3CB]">
                  <Frog className="w-14 h-12 shrink-0" />
                  <p className="flex-1 text-[15px] leading-snug text-[#1E3D2A]"><b>Ếch gợi ý:</b> kỹ năng <b>{weakest.label}</b> của bạn đang thấp nhất. Luyện 5 phút nhé!</p>
                  <Link href={weakest.href} className="hidden sm:inline-flex h-11 px-5 items-center rounded-xl bg-[#2E9D5B] hover:bg-[#1E7A45] text-white font-bold text-sm shrink-0">Luyện ngay</Link>
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                {skills.map(s => {
                  const hot = s.key === weakest?.key;
                  return (
                    <div key={s.key} className={`relative rounded-[18px] bg-white p-4 md:p-5 flex flex-col gap-3 ${hot ? "border-2 border-[#F0A43A]" : "border border-[#DDE6D3]"} ${s.key === "speaking" ? "col-span-2 lg:col-span-1" : ""}`}>
                      <Link href={s.href} className="absolute inset-0 rounded-[18px]" aria-label={`Luyện ${s.label}`} />
                      <div className="flex items-center justify-between">
                        <span className={`w-11 h-11 rounded-xl grid place-items-center ${s.tone}`}><Icon name={s.icon} className="w-[22px] h-[22px]" /></span>
                        {hot && <span className="text-xs font-bold text-[#B35400] bg-[#FFF1E0] px-2.5 py-1 rounded-full">Nên luyện</span>}
                      </div>
                      <div>
                        <div className="font-bold text-base">{s.label}</div>
                        <div className="text-xs text-[#5B7262]">{s.sub}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-auto">
                        <div className="flex-1"><Bar value={s.value} h="h-1.5" color={hot ? "bg-[#F0A43A]" : "bg-[#2E9D5B]"} /></div>
                        <span className="text-xs font-bold text-[#3F5546] tabular-nums">{s.value}</span>
                      </div>
                      {s.extra && <Link href={s.extra.href} className="relative z-10 self-start text-xs font-semibold text-[#1E7A45] underline underline-offset-2">{s.extra.label}</Link>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== CHƠI ===== */}
          {activeTab === "play" && (
            <div className="flex flex-col gap-5">
              <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight">Chơi</h1>
              <div className="flex items-center gap-3 p-4 rounded-[18px] bg-[#E7F5EC] border border-[#BFE3CB]">
                <Frog className="w-14 h-12 shrink-0" />
                <p className="flex-1 text-[15px] leading-snug text-[#1E3D2A]"><b>Vừa chơi vừa học:</b> chọn một trò, chọn bài đã học rồi thử thách cả lớp nhé!</p>
              </div>
              <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {GAMES.map(g => (
                  <a key={g.key} href={g.href} target="_blank" rel="noopener"
                    className="group rounded-[22px] overflow-hidden bg-white border border-[#DDE6D3] hover:-translate-y-1 hover:shadow-[0_14px_30px_-12px_rgba(19,38,28,.35)] transition-all duration-300 flex flex-col">
                    <GameCover g={g} />
                    <div className="p-5 flex flex-col gap-2 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="font-extrabold text-lg">{g.title}</h3>
                        <span className="zh text-sm text-[#5B7262]">{g.zh}</span>
                      </div>
                      <p className="text-sm text-[#3F5546] leading-snug">{g.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {g.tags.map(t => <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: GAME_STYLE[g.key]?.ink, background: GAME_STYLE[g.key]?.soft }}>{t}</span>)}
                      </div>
                      <div className="mt-auto pt-4 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-bold text-white transition-transform group-hover:scale-105" style={{ background: GAME_STYLE[g.key]?.ink }}>
                          <Icon name="play" className="w-4 h-4" />Vào chơi
                        </span>
                        <span className="text-xs font-semibold text-[#5B7262]">{GAME_STYLE[g.key]?.meta}</span>
                      </div>
                    </div>
                  </a>
                ))}
                <div className="rounded-[22px] border-2 border-dashed border-[#C9D6BE] p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[220px] text-[#5B7262]">
                  <Icon name="sprout" className="w-8 h-8 text-[#2E9D5B]" />
                  <div className="font-bold text-[#3F5546]">Trò chơi mới đang được ươm…</div>
                  <div className="text-sm">Sắp có thêm trò để cả lớp cùng chơi.</div>
                </div>
              </div>
            </div>
          )}

          {/* ===== THI ===== */}
          {activeTab === "exam" && (
            <div className="flex flex-col gap-5">
              <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight">Thi</h1>
              <div role="tablist" aria-label="Loại đề" className="grid grid-cols-3 gap-1 p-1 rounded-[14px] bg-[#E3EADB] md:max-w-md">
                {[["hsk3", "HSK 3.0"], ["hskk", "HSKK"], ["test", "Đánh giá"]].map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={examTab === k} onClick={() => setExamTab(k)}
                    className={`h-10 rounded-[10px] text-sm transition-colors ${examTab === k ? "bg-white font-bold text-[#13261C] shadow-sm" : "font-semibold text-[#3F5546]"}`}>{l}</button>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start">
                <div className="flex flex-col gap-5 min-w-0">
                  {examTab === "hsk3" && (
                    <>
                      {newestExam && (
                        <section className="rounded-[22px] bg-[#1E5C38] text-white p-5 md:p-6 flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0"><div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#BFE3CB]">Đề mới của giáo viên</div><div className="font-extrabold text-xl mt-0.5 truncate">{newestExam.examName}</div></div>
                            <span className="text-xs font-bold text-[#13261C] bg-[#FFB547] px-2.5 py-1 rounded-full shrink-0">Mới</span>
                          </div>
                          <div className="text-sm text-[#D4EFDC]">{newestExam.level}</div>
                          <button onClick={() => setActiveHskExamView(newestExam)} className="h-12 rounded-[14px] bg-white text-[#1E5C38] font-bold hover:bg-[#E7F5EC] transition-colors">Bắt đầu làm bài</button>
                        </section>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {HSK3_LEVELS.map((lvl, i) => {
                          const exams = hsk3ExamsList.filter(e => e.level === lvl).sort((a, b) => (a.examName || "").localeCompare(b.examName || "", undefined, { numeric: true }));
                          return (
                            <section key={lvl} className={`rounded-[18px] p-4 flex flex-col gap-2 ${exams.length ? "bg-white border border-[#DDE6D3]" : "border border-dashed border-[#C9D6BE]"}`}>
                              <div className="flex items-baseline justify-between"><h3 className="font-extrabold text-lg">HSK {i + 1}</h3><span className="text-xs text-[#5B7262]">{exams.length ? `${exams.length} đề` : "Sắp có"}</span></div>
                              {exams.map(ex => (
                                <button key={ex.id} onClick={() => setActiveHskExamView(ex)} className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl bg-[#F4F7EF] hover:bg-[#E7F5EC] text-left">
                                  <span className="flex-1 min-w-0 truncate text-sm font-semibold">{ex.examName}</span>
                                  <span className="text-xs font-bold text-[#1E7A45] shrink-0">Vào thi</span>
                                </button>
                              ))}
                            </section>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {examTab === "hskk" && (
                    <>
                      <div className="rounded-[18px] bg-[#FFF8EA] border border-[#F6D99A] p-4 text-sm leading-relaxed text-[#5C3D00]">
                        <b>Trước khi vào thi:</b> đeo tai nghe, ngồi nơi yên tĩnh và cho phép trình duyệt dùng micro. Làm xong, nghe lại rồi bấm <b>Nộp bài cho giáo viên</b> — thoát giữa chừng sẽ mất bản ghi âm.
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[...new Set(hskkExams.map(e => Number(e.level)))].sort((a, b) => a - b).map(lv => {
                          const exams = hskkExams.filter(e => Number(e.level) === lv);
                          const first = exams[0] || {};
                          return (
                            <section key={lv} className="rounded-[18px] bg-white border border-[#DDE6D3] p-4 flex flex-col gap-2">
                              <div className="flex items-baseline justify-between"><h3 className="font-extrabold text-lg">HSKK {lv}</h3><span className="text-xs text-[#5B7262] inline-flex items-center gap-1"><Icon name="clock" className="w-3.5 h-3.5" />{first.minutes} phút</span></div>
                              <p className="text-xs text-[#5B7262]">{first.parts}</p>
                              {exams.map(ex => (
                                <button key={ex.file} onClick={() => setActiveHskkExam(ex)} className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl bg-[#F4F7EF] hover:bg-[#E7F5EC] text-left">
                                  <span className="flex-1 min-w-0 truncate text-sm font-semibold">{ex.name || ex.label}</span>
                                  {ex.isNew && <span className="text-[10px] font-bold text-[#13261C] bg-[#FFB547] px-1.5 py-0.5 rounded">Mới</span>}
                                  <span className="text-xs font-bold text-[#1E7A45] shrink-0">Vào thi</span>
                                </button>
                              ))}
                            </section>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {examTab === "test" && (
                    <section className={`${card} p-6 flex flex-col sm:flex-row sm:items-center gap-5`}>
                      <Frog mood="think" className="w-20 h-16 shrink-0" />
                      <div className="flex-1">
                        <h2 className="text-xl font-extrabold">Thi đánh giá năng lực</h2>
                        <p className="text-sm text-[#3F5546] mt-1">Làm một bài kiểm tra tổng hợp Nghe · Nói · Đọc · Viết. Giáo viên chấm và gợi ý cấp độ phù hợp cho bạn.</p>
                      </div>
                      <Link href="/test" className="h-12 px-6 inline-flex items-center justify-center rounded-[14px] bg-[#2E9D5B] hover:bg-[#1E7A45] text-white font-bold shrink-0">Bắt đầu</Link>
                    </section>
                  )}
                </div>
                <ResultsCard limit={6} />
              </div>
            </div>
          )}
        </main>
      )}

      {/* ---------- THANH DƯỚI (điện thoại) ---------- */}
      {!inFullscreen && (
        <nav aria-label="Khu chính" className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 bg-white border-t border-[#DDE6D3] pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">
          {TABS.map(t => (
            <button key={t.key} onClick={() => goTab(t.key)} aria-current={activeTab === t.key ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-1.5 text-xs ${activeTab === t.key ? "text-[#1E7A45] font-bold" : "text-[#5B7262] font-semibold"}`}>
              <Icon name={t.icon} className="w-6 h-6" />{t.label}
            </button>
          ))}
        </nav>
      )}

      {/* ---------- MÀN HÌNH BÀI HỌC ---------- */}
      {selectedLecture && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="h-14 md:h-16 px-3 md:px-6 bg-[#1E5C38] text-white flex items-center gap-3 shrink-0">
            <button onClick={() => setSelectedLecture(null)} className="h-10 px-3 rounded-xl hover:bg-white/10 inline-flex items-center gap-1 text-sm font-semibold shrink-0" aria-label="Quay lại">
              <Icon name="back" className="w-5 h-5" /><span className="hidden sm:inline">Quay lại</span>
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[15px] truncate">{selectedLecture.lectureName}</h3>
              <p className="text-xs text-[#BFE3CB] truncate">{selectedLecture.level}</p>
            </div>
            {lessonsDone.includes(selectedLecture.id) ? (
              <span className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-white/10 text-sm font-semibold shrink-0"><LotusMark className="w-5 h-5" /><span className="hidden sm:inline">Đã nở sen</span></span>
            ) : (
              <button onClick={markLessonDone} className="h-10 px-4 rounded-xl bg-[#FFB547] hover:bg-[#FFC56E] text-[#13261C] text-sm font-bold inline-flex items-center gap-1.5 shrink-0">
                <Icon name="check" className="w-4 h-4" strokeWidth={3} /><span className="hidden sm:inline">Đã học xong</span><span className="sm:hidden">Xong</span>
              </button>
            )}
          </div>
          <div className="flex-1 bg-[#F4F7EF] relative overflow-hidden">
            <iframe
              {...htmlFrameProps(selectedLecture)}
              title={selectedLecture.lectureName}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              allow="microphone; autoplay; fullscreen; clipboard-write"
            />
            {bloomFx && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#13261C]/30">
                <div className="bg-white rounded-3xl px-8 py-6 flex flex-col items-center gap-2 shadow-2xl" style={{ animation: "hgPop .5s ease-out" }}>
                  <div className="flex items-end gap-1"><Frog mood="cheer" className="w-20 h-16" /><LotusMark className="w-12 h-12" /></div>
                  <p className="font-extrabold text-lg">Ao nở thêm một bông sen!</p>
                  <p className="text-sm font-bold text-[#1E7A45]">+{LEAF_PER_LESSON} lá</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- PHÒNG THI HSK 3.0 ---------- */}
      {activeHskExamView && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="h-14 md:h-16 px-3 md:px-6 bg-[#13261C] text-white flex items-center gap-3 shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[15px] truncate">{activeHskExamView.examName}</h3>
              <p className="text-xs text-[#BFE3CB] truncate">Thí sinh: {user?.fullName || "Học viên"} · {activeHskExamView.level}</p>
            </div>
            <button
              onClick={async () => {
                if (hsk3SavedRef.current) {
                  alert("Bài làm (kể cả phần Viết) đã được gửi tự động cho giáo viên.");
                  setActiveHskExamView(null);
                  return;
                }
                if (window.confirm("Bạn có chắc chắn muốn nộp bài thi này không?")) {
                  try {
                    const cap = captureExamFrame() || {};
                    await addDoc(collection(db, "hsk3_submissions"), {
                      userId: userId || "guest",
                      userName: user?.fullName || "Học viên ẩn danh",
                      userEmail: user?.primaryEmailAddress?.emailAddress || "Không có",
                      examId: activeHskExamView.id,
                      examName: activeHskExamView.examName,
                      level: activeHskExamView.level,
                      status: "pending_teacher",
                      manualSubmit: true,
                      ...cap,
                      submittedAt: serverTimestamp()
                    });
                    alert("Nộp bài thành công! Kết quả đã được gửi về cho giáo viên.");
                    setActiveHskExamView(null);
                  } catch (err) {
                    alert("Lỗi khi nộp bài: " + err.message);
                  }
                }
              }}
              className="h-10 px-4 rounded-xl bg-[#2E9D5B] hover:bg-[#3DB46D] text-white text-sm font-bold inline-flex items-center gap-1.5 shrink-0"
            >
              <Icon name="send" className="w-4 h-4" /><span className="hidden sm:inline">Nộp bài & thoát</span><span className="sm:hidden">Nộp</span>
            </button>
            <button
              onClick={() => { if (window.confirm("Nếu thoát bây giờ, bài làm của bạn sẽ không được lưu. Bạn có muốn thoát không?")) setActiveHskExamView(null); }}
              className="h-10 w-10 rounded-xl bg-white/10 hover:bg-[#C2413B] grid place-items-center shrink-0" aria-label="Thoát phòng thi"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 bg-[#F4F7EF] relative overflow-hidden">
            <iframe
              {...htmlFrameProps(activeHskExamView)}
              data-hsk3-frame=""
              title={activeHskExamView.examName}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              allow="microphone; autoplay; fullscreen; clipboard-write"
            />
          </div>
        </div>
      )}

      {/* ---------- PHÒNG THI HSKK ---------- */}
      {activeHskkExam && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="h-14 md:h-16 px-3 md:px-6 bg-[#13261C] text-white flex items-center gap-3 shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[15px] truncate">{activeHskkExam.title}</h3>
              <p className="text-xs text-[#BFE3CB] truncate">Thí sinh: {user?.fullName || "Học viên"} · {activeHskkExam.label}</p>
            </div>
            <button
              onClick={() => { if (window.confirm("Thoát phòng thi? Nếu chưa bấm Nộp bài, các bản ghi âm sẽ mất.")) setActiveHskkExam(null); }}
              className="h-10 w-10 rounded-xl bg-white/10 hover:bg-[#C2413B] grid place-items-center shrink-0" aria-label="Thoát phòng thi"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 bg-[#F4F7EF] relative overflow-hidden">
            <iframe
              src={`${activeHskkExam.file}?embed=1&name=${encodeURIComponent(user?.fullName || "")}`}
              title={activeHskkExam.title}
              className="w-full h-full border-0"
              allow="microphone; autoplay; fullscreen"
            />
          </div>
        </div>
      )}

      {/* ---------- CHI TIẾT KẾT QUẢ ---------- */}
      {selectedResult && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={selectedResult.title}>
          <div className="absolute inset-0 bg-[#13261C]/50" onClick={() => setSelectedResult(null)} />
          <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl">
            <div className="p-6 flex items-center gap-4 border-b border-[#EEF2E8]">
              <Frog mood={(selectedResult.score ?? 0) > 0 ? "cheer" : "think"} className="w-16 h-14 shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-extrabold">{selectedResult.title}</h2>
                {selectedResult.level && <p className="text-sm text-[#5B7262]">Cấp độ: {selectedResult.level}</p>}
              </div>
              <div className="text-right shrink-0"><div className="text-4xl font-extrabold text-[#1E5C38] tabular-nums">{selectedResult.score ?? 0}</div><div className="text-xs text-[#5B7262]">điểm</div></div>
            </div>
            <div className="p-6 flex flex-col gap-5">
              {selectedResult.type === "test" && selectedResult.skills && (
                <div className="grid grid-cols-4 gap-2">
                  {[["Nghe", "listening"], ["Nói", "speaking"], ["Đọc", "reading"], ["Viết", "writing"]].map(([l, k]) => (
                    <div key={k} className="rounded-xl bg-[#F4F7EF] p-3 text-center"><div className="text-xs text-[#5B7262]">{l}</div><div className="text-lg font-extrabold text-[#1E7A45]">{selectedResult.skills[k]?.score || 0}</div></div>
                  ))}
                </div>
              )}
              <div>
                <h4 className={eyebrow}>Giáo viên nhận xét</h4>
                <div className="mt-2 rounded-xl bg-[#F4F7EF] p-4 text-sm leading-relaxed whitespace-pre-wrap">{selectedResult.feedback || "Chưa có nhận xét."}</div>
              </div>
              {selectedResult.recommendation && (
                <div>
                  <h4 className={eyebrow}>Lộ trình gợi ý</h4>
                  <div className="mt-2 rounded-xl bg-[#FFF8EA] border border-[#F6D99A] p-4 text-sm leading-relaxed whitespace-pre-wrap">{selectedResult.recommendation}</div>
                </div>
              )}
              <button onClick={() => setSelectedResult(null)} className="h-12 rounded-[14px] bg-[#2E9D5B] hover:bg-[#1E7A45] text-white font-bold">Đã hiểu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
