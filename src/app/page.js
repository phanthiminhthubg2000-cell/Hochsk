"use client";
import Link from "next/link";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { doc, setDoc, getDoc, collection, getDocs, query, limit, orderBy } from "firebase/firestore";

// ============================================================
// BẢNG MÀU KHU VỰC VƯỜN (HSK Garden Palette)
// ============================================================

// --- COMPONENT: Ếch xanh Tương Tác ---
const MascotImage = ({ streak }) => {
  const [imgError, setImgError] = useState(false);
  let data = { img: '/garden/frog-sleep.png', emoji: '😴' };
  if (streak >= 15) data = { img: '/garden/frog-king.png', emoji: '👑' };
  else if (streak >= 7) data = { img: '/garden/frog-cool.png', emoji: '😎' };
  else if (streak >= 3) data = { img: '/garden/frog-normal.png', emoji: '🐸' };

  if (imgError) return <span className="text-[130px] drop-shadow-[0_20px_40px_rgba(0,0,0,0.3)] animate-[float_4s_ease-in-out_infinite] cursor-pointer hover:scale-105 transition-transform">{data.emoji}</span>;
  return <img src={data.img} alt={data.emoji} onError={() => setImgError(true)} className="w-44 h-44 object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.3)] animate-[float_4s_ease-in-out_infinite] cursor-pointer hover:scale-105 transition-transform" />;
};

// --- COMPONENT: Trạng thái sinh trưởng của cây ---
const TreeStageIcon = ({ progress, isCurrent }) => {
  const [imgError, setImgError] = useState(false);
  let stage = { img: '/garden/seed.png', emoji: '🌱' };
  if (progress === 100 && !isCurrent) stage = { img: '/garden/full-bloom.png', emoji: '🌸' };
  else if (isCurrent) stage = { img: '/garden/growing.png', emoji: '✨' };
  else if (progress >= 60) stage = { img: '/garden/tree.png', emoji: '🌳' };
  else if (progress >= 30) stage = { img: '/garden/young-tree.png', emoji: '🌿' };

  if (imgError) return <span className="text-xl drop-shadow-sm">{stage.emoji}</span>;
  return <img src={stage.img} alt={stage.emoji} onError={() => setImgError(true)} className="w-8 h-8 object-contain drop-shadow-sm" />;
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

  const [skillMap, setSkillMap] = useState({
    vocabulary: 5, grammar: 5, listening: 5, translation: 5, writing: 5, speaking: 5,
  });

  // --- SEARCH / AI STATES ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showHandwriting, setShowHandwriting] = useState(false);

  const searchResults = searchQuery.trim() === "" ? [] : [
    { hanzi: "学习", pinyin: "xuéxí", meaning: "học tập", type: "[Động]" },
    { hanzi: "学校", pinyin: "xuéxiào", meaning: "trường học", type: "[Danh]" },
    { hanzi: "朋友", pinyin: "péngyou", meaning: "bạn bè", type: "[Danh]" },
  ].filter(item => item.hanzi.includes(searchQuery.trim()) || item.pinyin.toLowerCase().includes(searchQuery.trim().toLowerCase()) || item.meaning.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  // ============================================================
  // ĐỒNG BỘ 9 CẤP ĐỘ HSK (3.0 MỚI)
  // ============================================================
  const currentLvlNum = parseInt(currentLevel.replace(/\D/g, "")) || 1;
  const currentLevelProgress = Math.min(99, Math.max(0, Math.round((todayVocabLearned / 20) * 100)));

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
    { label: "TỪ VỰNG", value: Math.min(skillMap?.vocabulary || 5, 100), key: "vocabulary" },
    { label: "NGỮ PHÁP", value: Math.min(skillMap?.grammar || 5, 100), key: "grammar" },
    { label: "NGHE", value: Math.min(skillMap?.listening || 5, 100), key: "listening" },
    { label: "ĐỌC/DỊCH", value: Math.min(skillMap?.translation || 5, 100), key: "translation" },
    { label: "VIẾT", value: Math.min(skillMap?.writing || 5, 100), key: "writing" },
    { label: "NÓI", value: Math.min(skillMap?.speaking || 5, 100), key: "speaking" },
  ];

  const sortedSkills = [...realSkillData].sort((a, b) => b.value - a.value);
  const strongSkills = sortedSkills.slice(0, 2);
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
    { title: "Học từ mới", progress: Math.min(todayVocabLearned, 10), total: 10, xp: 20, icon: "🌱" },
    { title: "Luyện nghe", progress: Math.min(todayListeningLearned, 1), total: 1, xp: 15, icon: "💧" },
    { title: "Sắp xếp câu", progress: Math.min(todayGrammarLearned, 10), total: 10, xp: 20, icon: "☀️" },
  ];

  // ============================================================
  // ĐỒNG BỘ TOÀN DIỆN DỮ LIỆU USER & CLERK SANG FIREBASE
  // ============================================================
  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const loadCompleteUserData = async () => {
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const uData = userSnap.exists() ? userSnap.data() : {};

        // ĐỒNG BỘ THÔNG TIN CLERK VÀO FIREBASE (TÊN VÀ AVATAR)
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
        
        // AUTO-CALCULATE DYNAMIC SKILL MAP DỰA TRÊN XP NẾU CHƯA CÓ
        const baseSkillLevel = Math.min(Math.floor(mergedXp / 20), 40); // Base stats grow with XP
        const dynamicDefaults = {
          vocabulary: baseSkillLevel + (mergedTodayVocab * 2) + 5,
          grammar: baseSkillLevel + (mergedTodayGrammar * 2) + 5,
          listening: baseSkillLevel + (mergedTodayListening * 5) + 5,
          translation: baseSkillLevel + 5,
          writing: baseSkillLevel + 5,
          speaking: baseSkillLevel + 5
        };

        const dbSkills = uData.skill_map || upData.skill_map || pData.skill_map || {};
        
        const mergedSkills = {
          vocabulary: dbSkills.vocabulary || dynamicDefaults.vocabulary,
          grammar: dbSkills.grammar || dynamicDefaults.grammar,
          listening: dbSkills.listening || dynamicDefaults.listening,
          translation: dbSkills.translation || dynamicDefaults.translation,
          writing: dbSkills.writing || dynamicDefaults.writing,
          speaking: dbSkills.speaking || dynamicDefaults.speaking,
        };

        setStreak(mergedStreak);
        setHearts(mergedHearts);
        setHskXp(mergedXp);
        setWater(mergedWater);
        setCurrentLevel(mergedLevel);
        
        setTodayVocabLearned(mergedTodayVocab);
        setTodayListeningLearned(mergedTodayListening);
        setTodayGrammarLearned(mergedTodayGrammar);
        
        setSkillMap(mergedSkills);

        if (uData.role === "teacher" || uData.role === "admin" || user?.publicMetadata?.role === "teacher" || user?.publicMetadata?.role === "admin") {
          setIsTeacher(true);
        }
      } catch (err) {
        console.error("Lỗi đồng bộ dữ liệu người dùng:", err);
      }

      // Tải bảng xếp hạng Ao Sen (CHÍNH XÁC TOP SERVER)
      try {
        const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(10));
        const qSnap = await getDocs(q);
        let list = [];
        qSnap.forEach((d) => {
          const dData = d.data();
          if (dData.role !== "teacher" && dData.role !== "admin" && (dData.xp || 0) > 0) {
            list.push({
              id: d.id,
              name: dData.fullName || dData.name || "Người làm vườn",
              streak: dData.streak || 0,
              xp: dData.xp || 0,
              avatar: dData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.id}`,
            });
          }
        });

        // Chỉ lấy top 5 người xuất sắc nhất
        setLeaderboard(list.slice(0, 5));
      } catch (err) {
        console.warn("Chưa tạo Index Firebase, Fallback dùng local sort...");
        // Fallback nếu Firebase chưa có Index orderBy 'xp'
        const fallbackQ = query(collection(db, "users"), limit(50));
        const fallbackSnap = await getDocs(fallbackQ);
        let fallbackList = [];
        fallbackSnap.forEach((d) => {
          const dData = d.data();
          if (dData.role !== "teacher" && dData.role !== "admin" && (dData.xp || 0) > 0) {
            fallbackList.push({
              id: d.id,
              name: dData.fullName || dData.name || "Người làm vườn",
              streak: dData.streak || 0,
              xp: dData.xp || 0,
              avatar: dData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.id}`,
            });
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
        event.preventDefault();
        setIsSearchOpen(true);
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

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setAiResponse(null);
    setIsAiLoading(false);
    setShowHandwriting(false);
  };

  return (
    <div className="min-h-screen font-sans text-[#1B5E4B] relative bg-[#EEF5E9] selection:bg-[#8FD9A8]/50">
      
      {/* LỚP NỀN GLOBAL */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute inset-0 bg-[url('/hskk/nen.jpg')] bg-cover bg-center opacity-10"></div>
         <div className="absolute inset-0 bg-[#EEF5E9]/90 backdrop-blur-[2px]"></div>
      </div>

      {/* SIDEBAR */}
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

          <nav className="flex-1 overflow-y-auto px-3 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
            <Link href="/roleplay" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎬</span>{!isSidebarCollapsed && <span>Phim trường</span>}</Link>

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

      {/* MAIN CONTENT */}
      <main className={`min-h-screen transition-all duration-300 relative z-10 ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 h-[76px] border-b border-[#8FD9A8]/30 bg-[#EEF5E9]/80 px-5 backdrop-blur-xl md:px-8 flex items-center justify-between">
          <button onClick={() => setIsSearchOpen(true)} className="flex h-11 max-w-md flex-1 items-center gap-2 rounded-2xl bg-white/90 shadow-sm px-4 text-left text-sm font-medium text-slate-400 hover:shadow-md transition-all sm:flex group border border-transparent hover:border-[#8FD9A8]">
            <span className="text-lg opacity-60">🔍</span>
            <span className="group-hover:text-[#2F8F6E] transition-colors">Tìm kiếm từ vựng, ngữ pháp...</span>
            <span className="ml-auto rounded-lg bg-[#F4F7F6] px-2 py-1 text-[10px] font-bold text-slate-400 group-hover:text-[#2F8F6E]">Ctrl K</span>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-2xl bg-white/90 backdrop-blur-md shadow-sm px-4 py-2.5 border border-slate-100">
              <span className="text-lg drop-shadow-sm">🔥</span><span className="text-xs font-black text-[#F2765B]">{streak} ngày</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#4FB6C7]/10 backdrop-blur-md border border-[#4FB6C7]/30 shadow-sm px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">💧</span><span className="text-xs font-black text-[#4FB6C7]">{water} giọt</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFD666]/20 backdrop-blur-md border border-[#FFD666]/50 shadow-sm px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">⭐</span><span className="text-xs font-black text-[#1B5E4B]">{hskXp.toLocaleString()} XP</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 md:px-8 pb-20">
          
          <section className="relative rounded-[32px] overflow-hidden shadow-lg bg-[#1B5E4B] p-8 md:p-12 text-white flex flex-col md:flex-row justify-between items-center min-h-[260px]">
            <div className="absolute inset-0 bg-[url('/hskk/backcover.jpg')] bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none"></div>
            <div className="absolute -left-20 -top-20 w-96 h-96 bg-[#2F8F6E] rounded-full blur-[80px] pointer-events-none opacity-60"></div>
            
            <div className="relative z-10 w-full md:w-2/3">
               <h2 className="text-[10px] font-black text-[#8FD9A8] uppercase tracking-widest mb-3 drop-shadow-sm">🌿 Hôm nay trong khu vườn</h2>
               <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 leading-[1.2] text-white drop-shadow-md">
                  Chào {user?.firstName || user?.fullName || "bạn"} 👋
               </h1>
               <p className="text-sm md:text-base text-white/90 font-medium max-w-md leading-relaxed mb-6 drop-shadow-sm">
                 {todayVocabLearned >= 10 ? "🌸 Hôm nay bạn đã tưới xong mầm cây xuất sắc!" : `Bạn chỉ còn ${Math.max(0, 10 - todayVocabLearned)} từ nữa để hoàn thành mục tiêu hôm nay.`}
               </p>
               
               <div className="mb-8 w-full max-w-sm">
                 <div className="flex justify-between text-[11px] font-black text-white mb-2 uppercase tracking-widest drop-shadow-sm">
                   <span>Tiến độ {currentLevel}</span>
                   <span className="text-[#FFD666]">{currentLevelProgress}%</span>
                 </div>
                 <div className="h-2.5 bg-black/20 rounded-full overflow-hidden shadow-inner border border-white/10">
                   <div className="h-full bg-gradient-to-r from-[#FFD666] to-[#F59E0B] rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${currentLevelProgress}%` }}></div>
                 </div>
               </div>

               <div className="flex flex-wrap items-center gap-3">
                  <Link href="/vocab">
                    <button className="bg-white text-[#1B5E4B] px-7 py-3 rounded-[18px] text-sm font-black hover:bg-[#8FD9A8] hover:text-[#1B5E4B] transition-all shadow-xl flex items-center gap-2 hover:-translate-y-1">
                      🌱 Học tiếp
                    </button>
                  </Link>
                  <a href="#dashboard-bottom">
                    <button className="bg-black/20 backdrop-blur-md text-white border border-white/30 px-6 py-3 rounded-[18px] text-sm font-bold hover:bg-white/20 transition-all flex items-center gap-2 shadow-sm">
                      🎯 Xem nhiệm vụ
                    </button>
                  </a>
               </div>
            </div>

            <div className="hidden md:flex relative z-10">
               <MascotImage streak={streak} />
               <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-24 h-5 bg-black/30 blur-md rounded-full"></div>
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

          {/* LỘ TRÌNH FULL WIDTH HORIZONTAL */}
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

          {/* 3 CỘT BOTTOM: AO SEN, RADAR, NHIỆM VỤ */}
          <section className="grid gap-6 lg:grid-cols-[1fr_1.5fr_1fr] items-stretch" id="dashboard-bottom">
            
            {/* Cột 1: Bảng Vàng -> Ao Sen */}
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

                    {[...Array(Math.max(0, 5 - leaderboard.length))].map((_, i) => (
                      <div key={`empty-${i}`} className="flex items-center justify-between rounded-xl p-2.5 border border-dashed border-[#8FD9A8]/40 bg-[#F4F7F6]/50 opacity-70 animate-pulse">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center text-xs font-black text-slate-300">-</span>
                          <div className="h-8 w-8 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] border-2 border-dashed border-[#8FD9A8]/50 bg-white flex items-center justify-center text-lg grayscale opacity-50">🐸</div>
                          <div className="flex flex-col gap-1.5">
                            <div className="h-2.5 w-20 bg-slate-200/60 rounded-full"></div>
                            <div className="h-1.5 w-12 bg-slate-200/60 rounded-full"></div>
                          </div>
                        </div>
                        <div className="h-4 w-10 bg-slate-200/50 rounded-md"></div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Cột 2: Radar -> AI Coach */}
            <div className="rounded-[32px] bg-white p-6 md:p-8 shadow-sm border border-[#E2E8F0] h-full flex flex-col">
               <div className="mb-6"><h2 className="text-lg font-black text-[#1B5E4B] flex items-center gap-2"><span>🐸</span> Bản Đồ Kỹ Năng & AI Coach</h2></div>
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-center flex-1">
                 <div className="flex justify-center scale-75 lg:scale-90 origin-center">
                   <RadarChart data={realSkillData} />
                 </div>
                 <div className="flex flex-col gap-3 justify-center">
                    <div className="bg-[#EEF5E9] p-3 rounded-2xl border border-[#8FD9A8]/50 shadow-sm">
                       <h4 className="font-black text-[#2F8F6E] text-[9px] mb-1 uppercase tracking-widest">Điểm mạnh nhất</h4>
                       <p className="text-xs font-black text-[#1B5E4B]">
                         {strongSkills.map(s => s.label).join(", ")}
                       </p>
                    </div>
                    <div className="bg-[#F2765B]/10 p-3 rounded-2xl border border-[#F2765B]/30 shadow-sm">
                       <h4 className="font-black text-[#F2765B] text-[9px] mb-1 uppercase tracking-widest">Cần tưới thêm nước</h4>
                       <p className="text-xs font-black text-[#F2765B]">
                         {weakSkills.map(s => s.label).join(", ")}
                       </p>
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

            {/* Cột 3: Nhiệm vụ hôm nay */}
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
            <div className="flex flex-col border-b border-[#E2E8F0] p-5">
              <div className="flex items-center">
                <span className="mr-4 text-2xl opacity-50">✨</span>
                <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm kiếm từ vựng, ngữ pháp..." className="flex-1 bg-transparent text-xl font-bold text-[#1B5E4B] outline-none placeholder:text-slate-300" />
                <button onClick={closeSearch} className="rounded-xl bg-[#F2765B]/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#F2765B] hover:bg-[#F2765B] hover:text-white transition-colors">ĐÓNG</button>
              </div>
            </div>
            <div className="p-10 text-center opacity-50">
               <span className="text-6xl mb-4 block">🔍</span>
               <p className="text-lg font-bold text-[#2F8F6E]">Bạn muốn tra cứu điều gì?</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}