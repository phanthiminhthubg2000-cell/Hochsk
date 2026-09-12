"use client";
import Link from "next/link";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { doc, setDoc, getDoc, collection, getDocs, query, limit, orderBy, where } from "firebase/firestore";

// TÍCH HỢP TỪ ĐIỂN LOCAL
import cardsData from "./cards.json";
import topicData from "./topics.json";

// MỐC LÊN CẤP CHO 11 GIAI ĐOẠN CỦA HOA SEN
const THRESHOLDS = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400];

// ============================================================
// CHUẨN HÓA DỮ LIỆU TỪ ĐIỂN TỪ LOCAL JSON
// ============================================================
const getLocalDictionary = () => {
  const dict = [];
  if (Array.isArray(cardsData)) {
    cardsData.forEach(item => {
      dict.push({
        hanzi: item.chinese || item.hanzi || item.front || item.word || "",
        pinyin: item.pinyin || "",
        meaning: item.vietnamese || item.meaning || item.back || "",
        type: item.type || "[Từ vựng]"
      });
    });
  }
  if (Array.isArray(topicData)) {
    topicData.forEach(topic => {
      if (Array.isArray(topic.words)) {
        topic.words.forEach(w => {
          dict.push({
            hanzi: w.chinese || w.hanzi || w.word || "",
            pinyin: w.pinyin || "",
            meaning: w.vietnamese || w.meaning || "",
            type: w.type || "[Chủ đề]"
          });
        });
      }
    });
  }
  const uniqueDict = Array.from(new Map(dict.map(item => [item.hanzi, item])).values());
  return uniqueDict.filter(item => item.hanzi);
};

const localDictionary = getLocalDictionary();

// ============================================================
// COMPONENT: BÔNG SEN TRÒN DÙNG 11 ẢNH + HIỆU ỨNG RUNG RINH SINH ĐỘNG
// ============================================================
const RealLotus = ({ plantGrowth, isWatering }) => {
  let currentFrame = 0;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (plantGrowth >= THRESHOLDS[i]) {
      currentFrame = i;
      break;
    }
  }

  // Đổi index từ 0 -> 10 thành định dạng chuỗi từ "01" -> "11"
  const stageNumber = String(currentFrame + 1).padStart(2, '0');
  const imagePath = `/lotus/lotus_stage_${stageNumber}.png`;

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Khung tròn bồng bềnh nhẹ nhàng với animate-[bounce_6s_ease-in-out_infinite] */}
      <div className={`relative z-10 w-44 h-44 md:w-56 md:h-56 rounded-full border-[6px] border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden bg-gradient-to-b from-[#E0F7FA]/40 to-[#8FD9A8]/30 backdrop-blur-sm flex items-center justify-center transition-transform duration-500 animate-[bounce_6s_ease-in-out_infinite] ${isWatering ? 'scale-105' : 'scale-100'}`}>
        
        {/* Hiệu ứng hạt mưa rơi khi tưới */}
        {isWatering && (
          <div className="absolute inset-0 z-30 pointer-events-none flex justify-center">
             <div className="w-2.5 h-5 bg-[#4FB6C7] rounded-full animate-bounce mt-6 shadow-sm"></div>
             <div className="w-2 h-4 bg-blue-300 rounded-full animate-bounce mt-10 ml-6 delay-100"></div>
             <div className="w-2 h-4 bg-[#4FB6C7] rounded-full animate-bounce mt-8 mr-6 delay-75"></div>
          </div>
        )}

        {/* Cây sen rung rinh, co giãn nhẹ và nghiêng khi rê chuột */}
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center p-3 animate-[pulse_4s_ease-in-out_infinite]">
          <img 
            src={imagePath} 
            alt={`Giai đoạn ${currentFrame + 1}`} 
            className="max-h-full max-w-full object-contain mix-blend-multiply transition-all duration-700 ease-in-out drop-shadow-md hover:rotate-1 hover:scale-105"
            onError={(e) => {
               e.target.style.display = 'none';
               e.target.parentElement.innerHTML = `<div class="text-center p-2 text-[10px] text-red-500 font-bold">Thiếu file: lotus_stage_${stageNumber}.png trong /public/lotus/</div>`;
            }}
          />
        </div>
      </div>

      <div className="absolute -bottom-4 w-32 h-6 bg-emerald-950/30 rounded-[100%] blur-md -z-10"></div>
    </div>
  );
};

// ============================================================
// COMPONENT PHỤ
// ============================================================
const TreeStageIcon = ({ progress, isCurrent }) => {
  let emoji = '🌱';
  if (progress === 100 && !isCurrent) emoji = '🌸';
  else if (isCurrent) emoji = '✨';
  else if (progress >= 60) emoji = '🌳';
  else if (progress >= 30) emoji = '🌿';

  return (
    <span className="text-2xl drop-shadow-sm flex items-center justify-center w-full h-full">
      {emoji}
    </span>
  );
};

const RadarChart = ({ data }) => {
  const size = 260;
  const center = size / 2;
  const radius = 90;
  const count = data.length;

  const getPoint = (index, value) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / 100) * radius;
    return { x: center + Math.cos(angle) * r, y: center + Math.sin(angle) * r };
  };

  const polygonPoints = data.map((item, index) => `${getPoint(index, item.value).x},${getPoint(index, item.value).y}`).join(" ");

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {[20, 40, 60, 80, 100].map((level) => (
          <polygon key={level} points={data.map((_, index) => `${getPoint(index, level).x},${getPoint(index, level).y}`).join(" ")} fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
        ))}
        {data.map((_, index) => (
          <line key={index} x1={center} y1={center} x2={getPoint(index, 100).x} y2={getPoint(index, 100).y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
        ))}
        <polygon points={polygonPoints} fill="#8FD9A8" fillOpacity="0.4" stroke="#2F8F6E" strokeWidth="2.5" strokeLinejoin="round" className="transition-all duration-1000 drop-shadow-sm" />
        {data.map((item, index) => <circle key={index} cx={getPoint(index, item.value).x} cy={getPoint(index, item.value).y} r="5" fill="#1B5E4B" className="drop-shadow-md" />)}
        {data.map((item, index) => (
          <text key={index} x={getPoint(index, 125).x} y={getPoint(index, 125).y} textAnchor="middle" dominantBaseline="middle" className="fill-[#1B5E4B] text-[10px] font-black uppercase tracking-widest">
            {item.label}
          </text>
        ))}
      </svg>
    </div>
  );
};

export default function HomePage() {
  const { isSignedIn, userId } = useAuth();
  const { user, isLoaded } = useUser();

  // --- USER STATES ---
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [hskXp, setHskXp] = useState(0);
  const [water, setWater] = useState(0);
  const [currentLevel, setCurrentLevel] = useState("HSK 1");
  
  const [todayVocabLearned, setTodayVocabLearned] = useState(0);
  const [todayListeningLearned, setTodayListeningLearned] = useState(0);
  const [todayGrammarLearned, setTodayGrammarLearned] = useState(0);
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isTeacher, setIsTeacher] = useState(false); 

  // --- TRỒNG CÂY TRANG CHỦ STATES ---
  const [isWatering, setIsWatering] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [lotusGrowth, setLotusGrowth] = useState(0);

  // --- THÔNG BÁO CHẤM THI ---
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null); 

  const [skillMap, setSkillMap] = useState({
    vocabulary: 0, grammar: 0, listening: 0, translation: 0, writing: 0, speaking: 0,
  });

  // --- SEARCH / AI STATES ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const searchResults = searchQuery.trim() === "" ? [] : localDictionary.filter(item => 
    item.hanzi.includes(searchQuery.trim()) || 
    item.pinyin.toLowerCase().includes(searchQuery.trim().toLowerCase()) || 
    item.meaning.toLowerCase().includes(searchQuery.trim().toLowerCase())
  ).slice(0, 10);

  const handleAskAI = async () => {
    if (!searchQuery.trim()) return;
    setIsAiLoading(true);
    setAiResponse(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Hãy giải thích chi tiết về từ vựng, đoạn văn hoặc ngữ pháp này trong tiếng Trung giúp tôi, format rõ ràng: ${searchQuery}` })
      });
      const data = await res.json();
      setAiResponse(data.reply || data.response || "Ếch xanh đang bị mệt, không thể kết nối AI lúc này.");
    } catch (error) {
      setAiResponse("Đã xảy ra lỗi khi gọi AI. Vui lòng thử lại sau.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const closeSearch = () => { 
    setIsSearchOpen(false); 
    setSearchQuery(""); 
    setAiResponse(null);
    setIsAiLoading(false);
  };

  const currentLvlNum = parseInt(currentLevel.replace(/\D/g, "")) || 1;
  const targetVocab = 20; 
  const currentLevelProgress = Math.min(100, Math.max(0, Math.round((todayVocabLearned / targetVocab) * 100)));

  // ============================================================
  // HÀNH ĐỘNG TƯỚI NƯỚC
  // ============================================================
  const handleWaterPlant = async () => {
    if (water <= 0) {
      alert("Bạn đã hết nước! Hãy làm bài test hoặc nhiệm vụ để lấy thêm 💧 nhé.");
      return;
    }

    const isMaxLevel = lotusGrowth >= THRESHOLDS[THRESHOLDS.length - 1];
    if (isMaxLevel) {
      alert("Sen đã hoàn thành chu kỳ! Hãy làm mới chậu để trồng tiếp.");
      return;
    }

    setIsWatering(true);
    
    setTimeout(async () => {
      const newWater = water - 1;
      const newGrowth = lotusGrowth + 1;
      
      setWater(newWater);
      setLotusGrowth(newGrowth);
      setIsWatering(false);

      if (userId) {
        await setDoc(doc(db, "users", userId), { water: newWater, lotus_growth: newGrowth }, { merge: true });
        await setDoc(doc(db, "user_progress", userId), { water: newWater, lotus_growth: newGrowth }, { merge: true });
      }

      if (newGrowth === THRESHOLDS[THRESHOLDS.length - 1]) {
        setShowReward(true);
        setTimeout(() => setShowReward(false), 4000);
        const newXp = hskXp + 500;
        setHskXp(newXp);
        if (userId) await setDoc(doc(db, "users", userId), { xp: newXp }, { merge: true });
      }
    }, 600);
  };

  const handleResetPlant = async () => {
    setLotusGrowth(0);
    if (userId) {
      await setDoc(doc(db, "users", userId), { lotus_growth: 0 }, { merge: true });
      await setDoc(doc(db, "user_progress", userId), { lotus_growth: 0 }, { merge: true });
    }
  };

  let currentLotusFrame = 0;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (lotusGrowth >= THRESHOLDS[i]) {
      currentLotusFrame = i;
      break;
    }
  }
  const isLotusMaxLevel = currentLotusFrame >= THRESHOLDS.length - 1;
  let lotusProgressPercent = 100;
  let lotusDropsNeeded = 0;

  if (!isLotusMaxLevel) {
    const currentLvlDrops = THRESHOLDS[currentLotusFrame];
    const nextLvlDrops = THRESHOLDS[currentLotusFrame + 1];
    const dropsInCurrentLvl = lotusGrowth - currentLvlDrops;
    const totalDropsForNextLvl = nextLvlDrops - currentLvlDrops;
    
    lotusProgressPercent = (dropsInCurrentLvl / totalDropsForNextLvl) * 100;
    lotusDropsNeeded = nextLvlDrops - lotusGrowth;
  }

  const hskLevels = [
    { level: "HSK 1", title: "Nhập môn", words: 500 },
    { level: "HSK 2", title: "Cơ bản", words: 772 },
    { level: "HSK 3", title: "Sơ trung cấp", words: 973 },
    { level: "HSK 4", title: "Trung cấp", words: 1000 },
    { level: "HSK 5", title: "Trung cao", words: 1071 },
    { level: "HSK 6", title: "Cao cấp", words: 1140 },
    { level: "HSK 7", title: "Thượng cấp", words: 1200 },
    { level: "HSK 8", title: "Chuyên sâu", words: 1200 },
    { level: "HSK 9", title: "Tinh thông", words: 3236 },
  ].map((item, index) => {
    const lvlNum = index + 1;
    let progress = 0;
    if (lvlNum < currentLvlNum) progress = 100;
    else if (lvlNum === currentLvlNum) progress = currentLevelProgress;
    return { ...item, progress };
  });

  const realSkillData = [
    { label: "TỪ VỰNG", value: Math.min(skillMap?.vocabulary || 0, 100), key: "vocabulary" },
    { label: "NGỮ PHÁP", value: Math.min(skillMap?.grammar || 0, 100), key: "grammar" },
    { label: "NGHE", value: Math.min(skillMap?.listening || 0, 100), key: "listening" },
    { label: "ĐỌC/DỊCH", value: Math.min(skillMap?.translation || 0, 100), key: "translation" },
    { label: "VIẾT", value: Math.min(skillMap?.writing || 0, 100), key: "writing" },
    { label: "NÓI", value: Math.min(skillMap?.speaking || 0, 100), key: "speaking" },
  ];

  const sortedSkills = [...realSkillData].sort((a, b) => b.value - a.value);
  const strongSkills = sortedSkills.slice(0, 2).filter(s => s.value > 0);
  const weakSkills = sortedSkills.slice(-2);

  const getCoachSuggestions = (weakest) => {
    const suggestions = [];
    weakest.forEach((s) => {
      if (s.key === "listening") suggestions.push(`Luyện 1 bài nghe ${currentLevel}`);
      else if (s.key === "speaking") suggestions.push("Diễn xuất tại Phim trường");
      else if (s.key === "grammar") suggestions.push("Ôn tập 10 câu sắp xếp ngữ pháp");
      else if (s.key === "translation") suggestions.push("Luyện dịch 5 câu phản xạ");
      else if (s.key === "writing") suggestions.push("Luyện chép chính tả chữ Hán");
      else suggestions.push(`Tưới nước thêm 10 từ mới ${currentLevel}`);
    });
    return suggestions;
  };

  const gardenAreas = [
    { name: "Cây Từ vựng", level: Math.floor((skillMap?.vocabulary || 0) / 10) + 1, icon: "🌱", link: "/vocab", bg: "bg-[#2F8F6E]", text: "text-white", bgImg: "/hskk/tuvung.jpg" },
    { name: "Đầm Chủ đề", level: Math.floor(((skillMap?.vocabulary || 0) + (skillMap?.translation || 0)) / 20) + 1, icon: "🪷", link: "/topic", bg: "bg-[#F2765B]", text: "text-white", bgImg: "/hskk/chude.jpg" },
    { name: "Hoa Ngữ pháp", level: Math.floor((skillMap?.grammar || 0) / 10) + 1, icon: "☀️", link: "/arrange", bg: "bg-[#FFD666]", text: "text-[#1B5E4B]", bgImg: "/hskk/sapxep.jpg" },
    { name: "Ao Nghe", level: Math.floor((skillMap?.listening || 0) / 10) + 1, icon: "💧", link: "/dictation", bg: "bg-[#4FB6C7]", text: "text-white", bgImg: "/hskk/nghechep.jpg" },
    { name: "Gió Dịch", level: Math.floor((skillMap?.translation || 0) / 10) + 1, icon: "🍃", link: "/translate", bg: "bg-[#8FD9A8]", text: "text-[#1B5E4B]", bgImg: "/hskk/dich.jpg" },
    { name: "Cuộc chiến khẩu ngữ", level: Math.floor((skillMap?.speaking || 0) / 10) + 1, icon: "🎤", link: "/hskk", bg: "bg-[#A97845]", text: "text-white", bgImg: "/hskk/thucchien.jpg" },
    { name: "Phim trường", level: Math.floor((skillMap?.speaking || 0) / 10) + 1, icon: "🎬", link: "/roleplay", bg: "bg-[#1B5E4B]", text: "text-white", bgImg: "/hskk/nen.jpg" },
  ];

  const dailyMissions = [
    { title: "Học từ mới", progress: Math.min(todayVocabLearned, 20), total: 20, xp: 20, icon: "🌱" },
    { title: "Luyện nghe", progress: Math.min(todayListeningLearned, 1), total: 1, xp: 15, icon: "💧" },
    { title: "Sắp xếp câu", progress: Math.min(todayGrammarLearned, 10), total: 10, xp: 20, icon: "☀️" },
  ];

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const loadCompleteUserData = async () => {
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const uData = userSnap.exists() ? userSnap.data() : {};

        if (user) {
            await setDoc(userRef, {
                fullName: user.fullName || user.firstName || "Người làm vườn",
                avatar: user.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
            }, { merge: true });
        }

        const upRef = doc(db, "user_progress", userId);
        const upSnap = await getDoc(upRef);
        const upData = upSnap.exists() ? upSnap.data() : {};

        const pRef = doc(db, "progress", userId);
        const pSnap = await getDoc(pRef);
        const pData = pSnap.exists() ? pSnap.data() : {};

        const mergedStreak = uData.streak ?? upData.profile?.streak_days ?? pData.streakCount ?? 0;
        const mergedHearts = uData.hearts ?? upData.profile?.hearts ?? 5;
        const mergedXp = uData.xp ?? upData.profile?.hsk_xp ?? pData.xp ?? 0;
        const mergedWater = uData.water ?? upData.water ?? Math.floor(mergedXp / 15);
        const mergedLevel = uData.currentLevel ?? upData.profile?.level ?? "HSK 1";
        
        const mergedTodayVocab = uData.todayVocabLearned ?? upData.todayVocabLearned ?? 0;
        const mergedTodayListening = uData.todayListeningLearned ?? upData.todayListeningLearned ?? 0;
        const mergedTodayGrammar = uData.todayGrammarLearned ?? upData.todayGrammarLearned ?? 0;
        const mergedLotusGrowth = uData.lotus_growth ?? upData.lotus_growth ?? 0;
        
        let teacherSkills = null;
        const notifs = [];

        try {
          const testQ = query(collection(db, "test_submissions"), where("userId", "==", userId), where("status", "==", "graded"));
          const testSnap = await getDocs(testQ);
          let latestTest = null;
          
          testSnap.forEach(doc => {
            const tData = doc.data();
            const timeVal = tData.submittedAt?.toMillis() || 0;
            notifs.push({
              id: doc.id, type: "test", title: "Kết quả bài Test Năng lực", score: tData.teacherScore, level: tData.evaluatedLevel, feedback: tData.teacherFeedback, recommendation: tData.recommendation, skills: tData.skillsEvaluation, time: timeVal
            });
            if (!latestTest || timeVal > (latestTest.submittedAt?.toMillis() || 0)) latestTest = tData;
          });

          const hskkQ = query(collection(db, "hskk_exams"), where("userId", "==", userId), where("status", "==", "graded"));
          const hskkSnap = await getDocs(hskkQ);
          hskkSnap.forEach(doc => {
            const data = doc.data();
            notifs.push({
              id: doc.id, type: "hskk", title: "Kết quả thi Khẩu Ngữ (HSKK)", score: data.teacherScore, level: data.level, feedback: data.teacherFeedback, time: data.submittedAt?.toMillis() || 0,
            });
          });

          notifs.sort((a, b) => b.time - a.time);
          setNotifications(notifs);

          if (latestTest && latestTest.skillsEvaluation) {
            const ev = latestTest.skillsEvaluation;
            teacherSkills = {
              listening: ev.listening?.score || 0, speaking: ev.speaking?.score || 0, translation: ev.reading?.score || 0, grammar: ev.reading?.score || 0, vocabulary: ev.reading?.score || 0, writing: ev.writing?.score || 0
            };
          }
        } catch (error) { console.error("Lỗi lấy thông báo:", error); }

        const baseSkillLevel = mergedXp > 0 ? Math.min(Math.floor(mergedXp / 30), 40) : 0; 
        const dbSkills = uData.skill_map || upData.skill_map || pData.skill_map || {};
        
        const mergedSkills = {
          vocabulary: teacherSkills ? teacherSkills.vocabulary : (dbSkills.vocabulary !== undefined ? dbSkills.vocabulary : (mergedXp === 0 && mergedTodayVocab === 0 ? 0 : baseSkillLevel + mergedTodayVocab * 2)),
          grammar: teacherSkills ? teacherSkills.grammar : (dbSkills.grammar !== undefined ? dbSkills.grammar : (mergedXp === 0 && mergedTodayGrammar === 0 ? 0 : baseSkillLevel + mergedTodayGrammar * 2)),
          listening: teacherSkills ? teacherSkills.listening : (dbSkills.listening !== undefined ? dbSkills.listening : (mergedXp === 0 && mergedTodayListening === 0 ? 0 : baseSkillLevel + mergedTodayListening * 5)),
          translation: teacherSkills ? teacherSkills.translation : (dbSkills.translation !== undefined ? dbSkills.translation : baseSkillLevel),
          writing: teacherSkills ? teacherSkills.writing : (dbSkills.writing !== undefined ? dbSkills.writing : baseSkillLevel),
          speaking: teacherSkills ? teacherSkills.speaking : (dbSkills.speaking !== undefined ? dbSkills.speaking : baseSkillLevel),
        };

        setStreak(mergedStreak); setHearts(mergedHearts); setHskXp(mergedXp);
        setWater(mergedWater); setCurrentLevel(mergedLevel);
        setTodayVocabLearned(mergedTodayVocab); setTodayListeningLearned(mergedTodayListening); setTodayGrammarLearned(mergedTodayGrammar);
        setLotusGrowth(mergedLotusGrowth);
        setSkillMap(mergedSkills);

        if (uData.role === "teacher" || uData.role === "admin" || user?.publicMetadata?.role === "teacher" || user?.publicMetadata?.role === "admin") {
          setIsTeacher(true);
        }
      } catch (err) { console.error("Lỗi đồng bộ dữ liệu:", err); }

      try {
        const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(10));
        const qSnap = await getDocs(q);
        let list = [];
        qSnap.forEach((d) => {
          const dData = d.data();
          if (dData.role !== "teacher" && dData.role !== "admin" && (dData.xp || 0) > 0) {
            list.push({ id: d.id, name: dData.fullName || dData.name || "Người làm vườn", streak: dData.streak || 0, xp: dData.xp || 0, avatar: dData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.id}` });
          }
        });
        setLeaderboard(list.slice(0, 5));
      } catch (err) {
        const fallbackQ = query(collection(db, "users"), limit(50));
        const fallbackSnap = await getDocs(fallbackQ);
        let fallbackList = [];
        fallbackSnap.forEach((d) => {
          const dData = d.data();
          if (dData.role !== "teacher" && dData.role !== "admin" && (dData.xp || 0) > 0) {
            fallbackList.push({ id: d.id, name: dData.fullName || dData.name || "Người làm vườn", streak: dData.streak || 0, xp: dData.xp || 0, avatar: dData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.id}` });
          }
        });
        fallbackList.sort((a, b) => b.xp - a.xp);
        setLeaderboard(fallbackList.slice(0, 5));
      }
    };

    loadCompleteUserData();
  }, [isSignedIn, userId, user]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setIsSearchOpen(true);
      }
      if (event.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleChangeLevel = async (newLevel) => {
    setCurrentLevel(newLevel);
    if (userId) {
      try {
        await setDoc(doc(db, "users", userId), { currentLevel: newLevel }, { merge: true });
        await setDoc(doc(db, "user_progress", userId), { "profile.level": newLevel }, { merge: true });
      } catch (error) {}
    }
  };

  return (
    <div className="min-h-screen font-sans text-[#1B5E4B] relative bg-[#EEF5E9] selection:bg-[#8FD9A8]/50">
      
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute inset-0 bg-[url('/hskk/nen.jpg')] bg-cover bg-center opacity-10"></div>
         <div className="absolute inset-0 bg-[#EEF5E9]/90 backdrop-blur-[2px]"></div>
      </div>

      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#8FD9A8]/30 bg-[#F7FAF3]/90 backdrop-blur-xl transition-all duration-300 md:flex ${isSidebarCollapsed ? "w-[76px]" : "w-[240px]"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center px-4 py-6 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#2F8F6E] text-xl text-white shadow-sm">🐸</div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-black text-[#1B5E4B] tracking-tight">HSK Garden</h2>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-[#2F8F6E]">Khu vườn học tập</p>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
            <div className="mb-2 px-3 text-[10px] font-black uppercase tracking-widest text-[#2F8F6E]/60">{!isSidebarCollapsed ? "🌿 KHU VƯỜN" : "•"}</div>
            <Link href="/" className="mb-6 flex items-center gap-3 rounded-2xl bg-[#8FD9A8]/30 px-3 py-3 text-sm font-bold text-[#1B5E4B] transition-all">
              <span className="w-6 text-center text-lg">🏡</span>{!isSidebarCollapsed && <span>Trang chủ</span>}
            </Link>

            <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-[#2F8F6E]/60">{!isSidebarCollapsed ? "🌱 KHU RÈN LUYỆN" : "•"}</div>
            <Link href="/vocab" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🌱</span>{!isSidebarCollapsed && <span>Từ vựng</span>}</Link>
            <Link href="/topic" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🪷</span>{!isSidebarCollapsed && <span>Chủ đề</span>}</Link>
            <Link href="/arrange" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">☀️</span>{!isSidebarCollapsed && <span>Ngữ pháp</span>}</Link>
            <Link href="/dictation" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">💧</span>{!isSidebarCollapsed && <span>Nghe chép</span>}</Link>
            <Link href="/translate" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🍃</span>{!isSidebarCollapsed && <span>Dịch câu</span>}</Link>
            <Link href="/hskk" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎤</span>{!isSidebarCollapsed && <span>Cuộc chiến khẩu ngữ</span>}</Link>
            <Link href="/roleplay" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎬</span>{!isSidebarCollapsed && <span>Phim trường</span>}</Link>
            
            <Link href="/test" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors">
              <span className="w-6 text-center text-lg opacity-80">📝</span>{!isSidebarCollapsed && <span>Thi Đánh Giá</span>}
            </Link>

            <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-[#2F8F6E]/60">{!isSidebarCollapsed ? "🏆 CỘNG ĐỒNG" : "•"}</div>
            <a href="#leaderboard" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🪷</span>{!isSidebarCollapsed && <span>Ao sen</span>}</a>

            {isTeacher && (
              <div className="mt-6 mb-2 border-t border-[#8FD9A8]/20 pt-4">
                <Link href="/teacher" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#1B5E4B] bg-[#FFD666]/20 hover:bg-[#FFD666]/40 transition-all shadow-sm">
                  <span className="w-6 text-center text-lg">🛡️</span>{!isSidebarCollapsed && <span>Trang Quản Lý</span>}
                </Link>
              </div>
            )}
          </nav>

          <div className="border-t border-[#8FD9A8]/20 p-4">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="mb-3 flex w-full items-center justify-center rounded-xl bg-white/50 py-2.5 text-xs font-bold text-slate-500 hover:bg-white transition-colors shadow-sm">
              {isSidebarCollapsed ? "→" : "← Thu gọn"}
            </button>
            {isSignedIn ? (
              <div className={`flex items-center rounded-2xl bg-white shadow-sm p-2.5 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
                <UserButton afterSignOutUrl="/" />
                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[#1B5E4B]">{user?.fullName || "Người làm vườn"}</p>
                    <p className="text-[9px] text-[#2F8F6E] font-medium mt-0.5">Tài khoản</p>
                  </div>
                )}
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B5E4B] py-3 text-xs font-bold text-white hover:bg-[#2F8F6E] shadow-md transition-all">
                  👤 {!isSidebarCollapsed && "Đăng nhập"}
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </aside>

      <main className={`min-h-screen transition-all duration-300 relative z-10 ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        
        {/* TOPBAR CHÍNH */}
        <header className="sticky top-0 z-30 h-[76px] border-b border-[#8FD9A8]/30 bg-[#EEF5E9]/80 px-5 backdrop-blur-xl md:px-8 flex items-center justify-between">
          
          <button onClick={() => setIsSearchOpen(true)} className="flex h-11 max-w-md flex-1 items-center gap-2 rounded-2xl bg-white/90 shadow-sm px-4 text-left text-sm font-medium text-slate-400 hover:shadow-md transition-all sm:flex group border border-transparent hover:border-[#8FD9A8]">
            <span className="text-lg opacity-60">🔍</span>
            <span className="group-hover:text-[#2F8F6E] transition-colors">Tìm kiếm từ vựng, ngữ pháp...</span>
            <span className="ml-auto rounded-lg bg-[#F4F7F6] px-2 py-1 text-[10px] font-bold text-slate-400 group-hover:text-[#2F8F6E]">Ctrl K</span>
          </button>

          <div className="ml-auto flex items-center gap-3">
            
            {/* THÔNG BÁO BELL ICON */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)} 
                className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 hover:border-[#8FD9A8] transition-all"
              >
                <span className="text-xl">🔔</span>
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F43F70] text-[9px] font-black text-white shadow-sm border-2 border-white">
                    {notifications.length}
                  </span>
                )}
              </button>
              
              {/* DROPDOWN THÔNG BÁO */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-[24px] shadow-2xl border border-[#E2E8F0] overflow-hidden z-50 animate-slide-up-fade">
                  <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <h3 className="font-black text-[#142033] text-sm flex items-center gap-2"><span>📫</span> Thông báo của bạn</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
                    {notifications.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-8 font-medium">Bạn không có thông báo nào mới.</p>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => { setSelectedResult(n); setIsNotifOpen(false); }} 
                          className="p-4 hover:bg-[#EEF5E9] rounded-2xl cursor-pointer transition-colors mb-1 border border-transparent hover:border-[#8FD9A8]/50"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-xs font-black text-[#1B5E4B]">{n.title}</h4>
                            <span className="text-[9px] font-bold text-[#10B981] bg-[#ECFDF5] px-1.5 py-0.5 rounded uppercase tracking-widest">{n.score} đ</span>
                          </div>
                          <p className="text-[11px] text-[#2F8F6E] font-medium mt-1 line-clamp-1">{n.feedback || "Giáo viên đã gửi một nhận xét cho bạn."}</p>
                          <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest">{new Date(n.time).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-white/90 backdrop-blur-md shadow-sm px-4 py-2.5 border border-slate-100"><span className="text-lg drop-shadow-sm">🔥</span><span className="text-xs font-black text-[#F2765B]">{streak} ngày</span></div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-[#4FB6C7]/10 backdrop-blur-md border border-[#4FB6C7]/30 shadow-sm px-4 py-2.5"><span className="text-lg drop-shadow-sm">💧</span><span className="text-xs font-black text-[#4FB6C7]">{water} giọt</span></div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFD666]/20 backdrop-blur-md border border-[#FFD666]/50 shadow-sm px-4 py-2.5"><span className="text-lg drop-shadow-sm">⭐</span><span className="text-xs font-black text-[#1B5E4B]">{hskXp.toLocaleString()} XP</span></div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 md:px-8 pb-20">
          
          {/* ============================================================ */}
          {/* BANNER: TRỒNG SEN THẬT Ở TRANG CHỦ */}
          {/* ============================================================ */}
          <section className="relative rounded-[32px] overflow-hidden shadow-lg bg-[#1B5E4B] p-8 md:p-12 text-white flex flex-col md:flex-row justify-between items-center min-h-[300px]">
            <div className="absolute inset-0 bg-[url('/hskk/backcover.jpg')] bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none"></div>
            <div className="absolute -left-20 -top-20 w-96 h-96 bg-[#2F8F6E] rounded-full blur-[80px] pointer-events-none opacity-60"></div>
            
            {/* THÔNG TIN & TƯỚI NƯỚC */}
            <div className="relative z-10 w-full md:w-1/2">
               <h2 className="text-[10px] font-black text-[#8FD9A8] uppercase tracking-widest mb-3 drop-shadow-sm">🌿 Hồ Sen Của Bạn</h2>
               <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 leading-[1.2] text-white drop-shadow-md">
                 Chào {user?.firstName || user?.fullName || "bạn"} 👋
               </h1>
               <p className="text-sm md:text-base text-white/90 font-medium max-w-md leading-relaxed mb-6 drop-shadow-sm">
                 {isLotusMaxLevel ? "🌸 Chúc mừng! Hoa sen đã hoàn thành trọn vẹn chu kỳ sinh trưởng!" : `Hãy tưới nước thường xuyên để chăm sóc cho mầm sen phát triển nhé. Tổng đã tưới: ${lotusGrowth} 💧`}
               </p>
               
               {/* THANH TIẾN ĐỘ THEO SỐ NƯỚC */}
               <div className="mb-8 w-full max-w-sm">
                 <div className="flex justify-between text-[11px] font-black text-white mb-2 uppercase tracking-widest drop-shadow-sm">
                   <span>Giai đoạn {currentLotusFrame + 1}/11</span>
                   <span className="text-[#FFD666]">{isLotusMaxLevel ? "Đã hoàn tất" : `Cần thêm ${lotusDropsNeeded} 💧`}</span>
                 </div>
                 <div className="h-2.5 bg-black/20 rounded-full overflow-hidden shadow-inner border border-white/10">
                   <div className="h-full bg-gradient-to-r from-[#FFD666] to-[#F59E0B] rounded-full transition-all duration-1000 shadow-sm relative" style={{ width: `${lotusProgressPercent}%` }}>
                     <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                   </div>
                 </div>
               </div>

               <div className="flex flex-wrap items-center gap-3">
                  <button 
                    onClick={handleWaterPlant}
                    disabled={isWatering || isLotusMaxLevel}
                    className={`px-7 py-3 rounded-[18px] text-sm font-black transition-all shadow-xl flex items-center gap-2 hover:-translate-y-1 ${
                      isLotusMaxLevel 
                        ? 'bg-[#E2E8F0] text-slate-500 cursor-not-allowed border border-transparent' 
                        : 'bg-white text-[#1B5E4B] hover:bg-[#8FD9A8] border border-transparent'
                    }`}
                  >
                    {isLotusMaxLevel ? "🌸 Đã hoàn thành" : "💧 Tưới Nước (-1)"}
                  </button>
                  
                  {isLotusMaxLevel && (
                    <button onClick={handleResetPlant} className="bg-black/20 backdrop-blur-md text-white border border-white/30 px-6 py-3 rounded-[18px] text-sm font-bold hover:bg-white/20 transition-all flex items-center gap-2 shadow-sm">
                      🔄 Trồng Cây Mới
                    </button>
                  )}
                  
                  <Link href="/test">
                    <button className="bg-[#FFD666] text-[#1B5E4B] px-7 py-3 rounded-[18px] text-sm font-black hover:bg-[#F59E0B] hover:text-white transition-all shadow-xl flex items-center gap-2 hover:-translate-y-1">
                      📝 Thi Đánh Giá
                    </button>
                  </Link>
               </div>
            </div>

            {/* HOA SEN TRÒN DÙNG 11 ẢNH RIÊNG BIỆT + HIỆU ỨNG RUNG RINH */}
            <div className="relative z-10 w-full md:w-1/2 flex justify-center mt-10 md:mt-0">
               <RealLotus plantGrowth={lotusGrowth} isWatering={isWatering} />
               
               {showReward && (
                 <div className="absolute top-0 text-3xl font-black text-[#F59E0B] animate-fade-in-up drop-shadow-xl z-50 whitespace-nowrap bg-white/80 px-4 py-2 rounded-full border-2 border-white">
                   +500 XP 🌸
                 </div>
               )}
            </div>
          </section>

          <section>
            <div className="mb-5 flex items-center gap-2">
              <span className="text-2xl">🏡</span>
              <h2 className="text-xl font-black text-[#1B5E4B]">Khu vườn của tôi</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gardenAreas.map((tool, index) => (
                <Link href={tool.link} key={index} className={`group relative rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 h-[150px] flex flex-col justify-end ${tool.bg} ${tool.text}`}>
                  <div 
                    className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.45] scale-[1.25] opacity-45 mix-blend-overlay bg-cover bg-center bg-no-repeat" 
                    style={{ backgroundImage: `url(${tool.bgImg})` }}
                  ></div>
                  <div className={`absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-white/20 backdrop-blur-md text-xl shadow-sm transition-transform group-hover:scale-110 z-10`}>
                    {tool.icon}
                  </div>
                  <div className="relative z-10 p-5">
                    <h3 className="text-base font-black tracking-wide drop-shadow-md leading-tight">{tool.name}</h3>
                    <p className="mt-1.5 text-[10px] font-bold opacity-100 border border-white/30 bg-white/10 px-2 py-0.5 rounded-md inline-block backdrop-blur-sm shadow-sm">Cấp {tool.level}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mb-8 w-full">
            <div className="rounded-[32px] bg-white p-6 shadow-sm border border-[#E2E8F0]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#1B5E4B] flex items-center gap-2"><span>🪷</span> Lộ trình sinh trưởng (HSK 1 - 9)</h2>
                  <p className="text-[11px] text-[#2F8F6E] mt-0.5 font-bold">Bấm vào bất kỳ mốc nào để chuyển mục tiêu học.</p>
                </div>
                <span className="rounded-xl bg-[#8FD9A8]/20 text-[10px] font-black text-[#2F8F6E] px-3 py-1.5 shadow-sm border border-[#8FD9A8]/40">
                  {currentLevel}
                </span>
              </div>

              <div className="overflow-x-auto custom-scrollbar pb-4 -mx-2 px-2">
                <div className="relative py-4 flex items-start gap-2 md:gap-4 w-max md:w-full md:justify-between before:absolute before:top-[34px] before:left-[30px] before:right-[30px] before:h-[2px] before:bg-[#8FD9A8]/50 before:rounded-full z-0">
                  {hskLevels.map((item) => {
                    const isCurrent = item.level === currentLevel;
                    const isCompleted = item.progress === 100;
                    return (
                      <button key={item.level} onClick={() => handleChangeLevel(item.level)} className="w-[110px] flex-1 min-w-[100px] shrink-0 text-center relative z-10 flex flex-col items-center gap-2 group cursor-pointer">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center shadow-sm text-sm transition-all ${isCompleted && !isCurrent ? "bg-[#1B5E4B] text-white" : isCurrent ? "bg-[#2F8F6E] text-white scale-110 shadow-[0_0_0_4px_rgba(47,143,110,0.2)]" : "bg-[#EEF5E9] text-slate-400 group-hover:bg-[#8FD9A8] group-hover:text-white"}`} style={{ borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%' }}>
                          <TreeStageIcon progress={item.progress} isCurrent={isCurrent} />
                        </div>
                        <div className={`w-full rounded-[16px] p-2.5 transition-all ${isCurrent ? "bg-[#FDFBF7] shadow-sm border border-[#FFD666]/40 -translate-y-1" : "bg-transparent group-hover:bg-slate-50 group-hover:shadow-sm border border-transparent group-hover:border-[#E2E8F0]"}`}>
                          <div className="mb-2">
                            <h3 className={`text-xs font-black transition-colors mb-0.5 ${isCurrent ? 'text-[#1B5E4B]' : isCompleted ? 'text-[#2F8F6E]' : 'text-slate-400 group-hover:text-[#2F8F6E]'}`}>{item.level}</h3>
                            <p className="text-[8px] font-bold text-[#2F8F6E]/70 leading-tight">{item.title}<br/>{item.words.toLocaleString("en-US")} từ</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#E2E8F0]/60 shadow-inner">
                              <div className={`h-full rounded-full transition-all duration-700 ${isCompleted ? "bg-[#1B5E4B]" : "bg-[#2F8F6E]"}`} style={{ width: `${item.progress}%` }} />
                            </div>
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded shadow-sm ${isCurrent ? 'bg-[#FFD666] text-[#1B5E4B]' : 'bg-[#F1F5F9] text-slate-400 border border-[#E2E8F0]'}`}>{item.progress}%</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1.5fr_1fr] items-stretch" id="dashboard-bottom">
            
            <div className="rounded-[32px] bg-white p-6 md:p-8 shadow-sm flex flex-col border border-[#E2E8F0] h-full">
              <div className="mb-6 flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <h2 className="text-lg font-black text-[#1B5E4B] flex items-center gap-2"><span>🪷</span> Ao sen danh vọng</h2>
                <div className="flex gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#2F8F6E] bg-[#EEF5E9] px-2.5 py-1 rounded-lg border border-[#8FD9A8]">Top Server</span>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                {leaderboard.length === 0 ? (
                  <p className="text-center text-xs font-bold text-slate-400 py-6">Đang tải ao sen...</p>
                ) : (
                  <>
                    {leaderboard.map((person, index) => {
                      const isMe = person.id === userId;
                      const displayName = isMe ? (user?.fullName || user?.firstName || person.name) : person.name;
                      const displayAvatar = isMe ? (user?.imageUrl || person.avatar) : person.avatar;
                      return (
                        <div key={index} className={`flex items-center justify-between rounded-xl p-2.5 shadow-sm hover:shadow-md transition-all border ${isMe ? 'bg-[#EEF5E9] border-[#8FD9A8]' : 'bg-white border-[#E2E8F0] hover:border-[#8FD9A8]/40'}`}>
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-center text-base font-black text-[#FFD666] drop-shadow-sm">
                              {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : <span className="text-xs text-slate-400">#{index + 1}</span>}
                            </span>
                            <img src={displayAvatar} alt={displayName} className="h-8 w-8 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] border-2 border-[#8FD9A8] shadow-sm bg-white object-cover" />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className={`text-xs font-bold ${isMe ? 'text-[#2F8F6E] font-black' : 'text-[#1B5E4B]'} line-clamp-1 max-w-[90px]`}>{displayName}</h4>
                                {isMe && <span className="bg-[#8FD9A8]/30 text-[#2F8F6E] text-[8px] px-1.5 py-0.5 rounded font-black shrink-0">BẠN</span>}
                              </div>
                              <p className="text-[9px] font-bold text-[#F2765B] mt-0.5">🔥 {person.streak} ngày streak</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-[#1B5E4B] bg-[#EEF5E9] px-2 py-1 rounded-md shrink-0">{person.xp.toLocaleString()} XP</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[32px] bg-white p-6 md:p-8 shadow-sm flex flex-col border border-[#E2E8F0] h-full">
               <div className="mb-6"><h2 className="text-lg font-black text-[#1B5E4B] flex items-center gap-2"><span>🐸</span> Bản Đồ Kỹ Năng & AI Coach</h2></div>
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-center flex-1">
                 <div className="flex justify-center scale-75 lg:scale-90 origin-center">
                   <RadarChart data={realSkillData} />
                 </div>
                 <div className="flex flex-col gap-3 justify-center">
                    {strongSkills.length > 0 && (
                      <div className="bg-[#EEF5E9] p-3 rounded-2xl border border-[#8FD9A8]/50 shadow-sm">
                         <h4 className="font-black text-[#2F8F6E] text-[9px] mb-1 uppercase tracking-widest">Điểm mạnh nhất</h4>
                         <p className="text-xs font-black text-[#1B5E4B]">{strongSkills.map(s => s.label).join(", ")}</p>
                      </div>
                    )}
                    <div className="bg-[#F2765B]/10 p-3 rounded-2xl border border-[#F2765B]/30 shadow-sm">
                       <h4 className="font-black text-[#F2765B] text-[9px] mb-1 uppercase tracking-widest">Cần tưới thêm nước</h4>
                       <p className="text-xs font-black text-[#F2765B]">{weakSkills.map(s => s.label).join(", ")}</p>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] shadow-sm mt-auto">
                       <h4 className="font-black text-slate-500 text-[9px] mb-2 uppercase tracking-widest">👉 Ếch Canh Đề Xuất Hôm Nay:</h4>
                       <ul className="text-[11px] font-bold text-[#1B5E4B] space-y-1">
                          {getCoachSuggestions(weakSkills).map((sug, i) => (
                            <li key={i}>• {sug}</li>
                          ))}
                       </ul>
                    </div>
                 </div>
               </div>
            </div>

            <div className="rounded-[32px] bg-white p-6 md:p-8 shadow-sm flex flex-col gap-3 border border-[#E2E8F0] h-full">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-black text-[#1B5E4B] flex items-center gap-2"><span>🌞</span> Chăm vườn hôm nay</h2>
                <div className="w-8 h-8 rounded-full border-2 border-[#8FD9A8] text-[#2F8F6E] flex items-center justify-center text-[10px] font-black bg-white shadow-sm shrink-0">
                  {dailyMissions.filter(m => m.progress === m.total).length}/{dailyMissions.length}
                </div>
              </div>
              <div className="flex flex-col gap-3 flex-1 justify-center">
                {dailyMissions.map((mission, index) => {
                  const isDone = mission.progress === mission.total;
                  return (
                    <div key={index} className={`rounded-2xl border p-3 flex flex-col gap-2 transition-all cursor-pointer group ${isDone ? 'bg-[#EEF5E9]/80 border-[#8FD9A8]/50 shadow-sm' : 'bg-white border-[#E2E8F0] hover:border-[#8FD9A8] hover:shadow-sm'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition-colors shadow-sm shrink-0 ${isDone ? 'bg-[#2F8F6E] text-white shadow-inner' : 'bg-[#F4F7F6] text-[#2F8F6E]'}`}>
                          {isDone ? '✅' : mission.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-bold text-[12px] ${isDone ? 'text-[#2F8F6E]' : 'text-[#1B5E4B]'}`}>{mission.title}</h4>
                          <span className="text-[9px] font-black text-[#F2765B] inline-block">+{mission.xp} XP</span>
                        </div>
                        {!isDone && (
                          <span className="text-[9px] font-bold bg-[#F4F7F6] text-slate-500 px-2 py-0.5 rounded-md border border-[#E2E8F0] shrink-0">
                            {mission.progress}/{mission.total}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-2 border-t border-[#E2E8F0] shrink-0">
                <div className="bg-gradient-to-r from-[#FFD666] to-[#F59E0B] rounded-2xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden group">
                  <div className="w-10 h-10 bg-white/30 backdrop-blur-sm rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-xl shadow-inner text-[#4FB6C7] group-hover:scale-110 transition-transform shrink-0">💧</div>
                  <div className="relative z-10 text-white">
                    <h4 className="font-black text-sm drop-shadow-sm">Nước tưới: {water} giọt</h4>
                    <p className="text-[11px] font-bold opacity-90 leading-tight mt-0.5">Làm nhiệm vụ để nhận tài nguyên.</p>
                  </div>
                </div>
              </div>
            </div>

          </section>

        </div>
      </main>

      {/* SEARCH / AI MODAL */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh]">
          <div className="absolute inset-0 bg-[#1B5E4B]/80 backdrop-blur-sm transition-opacity" onClick={closeSearch} />
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
            
            {/* Thanh Search Input */}
            <div className="flex flex-col border-b border-[#E2E8F0] p-5 bg-white relative z-10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✨</span>
                <input 
                  autoFocus 
                  type="text" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  placeholder="Tìm kiếm từ vựng, ngữ pháp..." 
                  className="flex-1 bg-transparent text-xl font-bold text-[#1B5E4B] outline-none placeholder:text-slate-300" 
                />
                <button 
                  onClick={handleAskAI}
                  disabled={isAiLoading || !searchQuery.trim()}
                  className="bg-[#1B5E4B] text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-[#2F8F6E] disabled:opacity-50 transition-all shadow-sm shrink-0"
                >
                  Hỏi AI
                </button>
                <button onClick={closeSearch} className="rounded-xl bg-[#FFF1F2] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#BE123C] hover:bg-[#FECDD3] transition-colors shrink-0">ĐÓNG</button>
              </div>
            </div>

            {/* Vùng hiển thị kết quả */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-white relative z-0">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-60">
                  <div className="w-10 h-10 border-4 border-[#8FD9A8] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-bold text-[#2F8F6E] animate-pulse">Ếch xanh đang suy nghĩ...</p>
                </div>
              ) : aiResponse ? (
                <div className="bg-[#EEF5E9] p-6 rounded-3xl border border-[#8FD9A8]/40 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🐸</span>
                    <h3 className="font-black text-[#1B5E4B] text-lg">Ếch Canh giải đáp:</h3>
                  </div>
                  <div className="text-[#142033] font-medium leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                    {aiResponse}
                  </div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3 animate-fade-in">
                  <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-4">Kết quả từ điển</h3>
                  {searchResults.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] hover:border-[#8FD9A8] transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-[#1B5E4B]">{item.hanzi}</span>
                        <div>
                          <p className="text-sm font-bold text-[#F2765B]">{item.pinyin}</p>
                          <p className="text-xs font-medium text-[#64748B]">{item.meaning}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black bg-white px-2 py-1 rounded-md text-slate-400 border border-[#E2E8F0]">{item.type}</span>
                    </div>
                  ))}
                  
                  <div className="mt-6 text-center border-t border-[#E2E8F0] pt-6">
                     <p className="text-xs text-slate-400 font-medium mb-3">Chưa hiểu rõ? Hãy nhờ AI giải thích sâu hơn.</p>
                     <button onClick={handleAskAI} className="bg-[#1B5E4B] text-white px-6 py-2.5 rounded-xl text-xs font-black hover:bg-[#2F8F6E] transition-all shadow-sm">
                       Hỏi AI thêm về "{searchQuery}"
                     </button>
                  </div>
                </div>
              ) : searchQuery.trim() !== "" ? (
                 <div className="text-center py-10 animate-fade-in">
                   <p className="text-slate-400 font-medium mb-4">Không tìm thấy "{searchQuery}" trong từ điển cục bộ.</p>
                   <button onClick={handleAskAI} className="bg-[#1B5E4B] text-white px-6 py-3 rounded-xl text-sm font-black hover:bg-[#2F8F6E] transition-all shadow-sm">
                     Nhờ AI giải thích chi tiết
                   </button>
                 </div>
              ) : (
                <div className="py-16 text-center opacity-40">
                   <span className="text-6xl mb-4 block">🔍</span>
                   <p className="text-lg font-bold text-[#1B5E4B]">Bạn muốn tra cứu điều gì?</p>
                   <p className="text-xs font-medium text-[#2F8F6E] mt-2">Gõ từ vựng tiếng Trung, pinyin hoặc ngữ pháp để AI giải đáp.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT KẾT QUẢ THI */}
      {selectedResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-[#1B5E4B]/60 backdrop-blur-sm" onClick={() => setSelectedResult(null)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden animate-slide-up-fade">
            <div className="bg-[#1B5E4B] p-6 text-white text-center">
              <div className="text-5xl mb-3">🎓</div>
              <h2 className="text-2xl font-black">{selectedResult.title}</h2>
              {selectedResult.level && <p className="text-sm text-[#8FD9A8] font-bold mt-1">Cấp độ đánh giá: {selectedResult.level}</p>}
            </div>
            
            <div className="p-6 md:p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Điểm số của bạn</span>
                <div className="text-5xl font-black text-[#F59E0B] mt-1">{selectedResult.score || 0} <span className="text-xl text-slate-300">điểm</span></div>
              </div>

              {selectedResult.type === 'test' && selectedResult.skills && (
                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0]">
                  <h4 className="text-xs font-black text-[#142033] mb-3 uppercase tracking-widest">Chi tiết 4 Kỹ năng</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Nghe</p>
                      <p className="text-lg font-black text-[#10B981]">{selectedResult.skills.listening?.score || 0}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Nói</p>
                      <p className="text-lg font-black text-[#10B981]">{selectedResult.skills.speaking?.score || 0}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Đọc/Dịch</p>
                      <p className="text-lg font-black text-[#10B981]">{selectedResult.skills.reading?.score || 0}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Viết</p>
                      <p className="text-lg font-black text-[#10B981]">{selectedResult.skills.writing?.score || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-black text-[#1B5E4B] mb-2 uppercase tracking-widest">Giáo viên nhận xét</h4>
                <div className="bg-[#EEF5E9] p-4 rounded-2xl text-sm font-medium text-[#1B5E4B] leading-relaxed border border-[#8FD9A8]/40 whitespace-pre-wrap">
                  {selectedResult.feedback || "Chưa có nhận xét."}
                </div>
              </div>

              {selectedResult.recommendation && (
                <div>
                  <h4 className="text-xs font-black text-[#F2765B] mb-2 uppercase tracking-widest">Lộ trình khuyến nghị</h4>
                  <div className="bg-[#FFF1F2] p-4 rounded-2xl text-sm font-medium text-[#BE123C] leading-relaxed border border-[#FECDD3] whitespace-pre-wrap">
                    {selectedResult.recommendation}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#E2E8F0] text-center bg-[#F8FAFC]">
              <button onClick={() => setSelectedResult(null)} className="bg-[#1B5E4B] text-white px-8 py-3 rounded-xl font-black text-sm hover:bg-[#2F8F6E] transition-all shadow-md">Đã Hiểu</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}