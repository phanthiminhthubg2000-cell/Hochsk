"use client";
import Link from "next/link";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { db } from "../firebase"; 
import { doc, setDoc, getDoc, collection, getDocs, query, limit, serverTimestamp } from "firebase/firestore";

// Component hỗ trợ vẽ biểu đồ hình tròn (SVG Circle Progress)
const CircleProgress = ({ percent, colorClass, size = 120, strokeWidth = 10, children }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Vòng tròn nền (Background Circle) */}
        <circle
          className="text-slate-200/60"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Vòng tròn tiến độ (Progress Circle) */}
        <circle
          className={`transition-all duration-1000 ease-in-out ${colorClass}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {/* Nội dung ở giữa biểu đồ */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
};

export default function Home() {
  const { isSignedIn } = useAuth(); 
  const { user, isLoaded } = useUser(); 
  
  const [streak, setStreak] = useState(0);
  const [userData, setUserData] = useState(null);
  const [activeToolTab, setActiveToolTab] = useState("all");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isStudyHovered, setIsStudyHovered] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [hallOfFameTab, setHallOfFameTab] = useState("hskk");

  useEffect(() => {
    async function syncUserAndFetchData() {
      if (user) {
        try {
          const studentRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(studentRef);
          
          let initialData = {};
          if (docSnap.exists()) {
            initialData = docSnap.data();
            setUserData(initialData);
          } else {
            initialData = {
              passedHSK1: false,
              passedHSK2: false,
              passedHSK3: false,
              passedHSK4: false,
              passedHSK5: false,
              passedHSK6: false,
              learnedVocab: [],
              hskkScore: null
            };
            setUserData(initialData);
          }
          
          const todayObj = new Date();
          const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
          
          let currentStreak = 1;
          if (docSnap.exists()) {
            const lastStreakDate = initialData.lastStreakDate;
            const savedStreak = initialData.streakCount || 0;

            if (lastStreakDate === todayStr) {
              currentStreak = savedStreak;
            } else {
              const yesterdayObj = new Date();
              yesterdayObj.setDate(yesterdayObj.getDate() - 1);
              const yesterdayStr = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayObj.getDate()).padStart(2, '0')}`;

              if (lastStreakDate === yesterdayStr) {
                currentStreak = savedStreak + 1;
              } else {
                currentStreak = 1;
              }
            }
          }

          setStreak(currentStreak);

          await setDoc(studentRef, {
            email: user.primaryEmailAddress?.emailAddress || "Không rõ email",
            name: user.fullName || "Học viên",
            lastLogin: serverTimestamp(),
            lastStreakDate: todayStr,
            streakCount: currentStreak,
          }, { merge: true });

        } catch (error) {
          console.error("Lỗi đồng bộ tài khoản:", error);
        }
      }

      try {
        const q = query(collection(db, "progress"), limit(20));
        const querySnapshot = await getDocs(q);
        const usersList = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const vocabLen = Array.isArray(data.learnedVocab) ? data.learnedVocab.length : 0;
          const userStreak = data.streakCount || 1;
          
          const realHskkScore = (data.hskkScore !== undefined && data.hskkScore !== null) ? data.hskkScore : null;

          usersList.push({
            id: docSnap.id,
            name: data.name || "Học viên",
            streak: userStreak,
            vocabCount: vocabLen,
            score: realHskkScore,
            avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${docSnap.id}`
          });
        });

        setLeaderboard(usersList);
      } catch (err) {
        console.error("Lỗi tải bảng vinh danh:", err);
      }
    }

    if (isLoaded) syncUserAndFetchData();
  }, [user, isLoaded]);

  const handleResetData = async () => {
    if (!user) return;
    if (!window.confirm("⚠️ CẢNH BÁO: Xóa toàn bộ dữ liệu học tập và thiết lập lại từ đầu?")) return;

    try {
      localStorage.removeItem("hskk_word_progress");
      const studentRef = doc(db, "progress", user.id);
      await setDoc(studentRef, { learnedVocab: [], passedHSK1: false, passedHSK2: false, passedHSK3: false, hskkScore: null }, { merge: true });
      window.location.reload();
    } catch (error) {
      console.error("Lỗi reset:", error);
    }
  };

  const getActiveHskLevelNum = () => {
    if (!userData) return 1;
    if (userData.passedHSK6) return 6;
    if (userData.passedHSK5) return 6;
    if (userData.passedHSK4) return 5;
    if (userData.passedHSK3) return 4;
    if (userData.passedHSK2) return 3;
    if (userData.passedHSK1) return 2;
    return 1; 
  };

  const currentLevelNum = getActiveHskLevelNum();
  const currentLevel = `HSK ${currentLevelNum}`;
  const roadmapPercent = Math.round((currentLevelNum / 6) * 100);

  const learnedVocabArray = Array.isArray(userData?.learnedVocab) ? userData.learnedVocab : [];
  const learnedCount = learnedVocabArray.length;
  
  const dailyVocabTarget = 30;
  const todayVocabLearned = Math.min(learnedCount, dailyVocabTarget); 
  const vocabPercent = Math.round((todayVocabLearned / dailyVocabTarget) * 100);
  const overallPercent = Math.min(vocabPercent, 100);

  // Tính toán phần trăm thành tích (dựa trên mốc streak và từ vựng)
  let unlockedAchievements = 0;
  const totalAchievements = 5;
  if (true) unlockedAchievements++; // Badge "Bắt đầu" luôn mở
  if (streak > 0) unlockedAchievements++;
  if (learnedCount > 0) unlockedAchievements++;
  if (learnedCount >= 500) unlockedAchievements++;
  if (userData?.passedHSK4) unlockedAchievements++;
  const achievementPercent = Math.round((unlockedAchievements / totalAchievements) * 100);

  const studyTabs = [
    { name: "HSK Từ vựng", link: "/vocab", icon: "📚" },
    { name: "Chủ đề", link: "#", icon: "📁" },
    { name: "Chép chính tả", link: "/dictation", icon: "🎧" },
    { name: "Dịch câu", link: "/translate", icon: "✍️" },
    { name: "Sắp xếp câu", link: "/arrange", icon: "🧩" },
    { name: "Thực chiến AI", link: "/roleplay", icon: "💬" },
    { name: "Thi HSKK", link: "/hskk", icon: "🎤" },
  ];

  const tools = [
    { id: "vocab", bgImage: "url('/hskk/tuvung.jpg')", name: "HSK Từ Vựng", category: "vocab", icon: "📚", color: "text-emerald-600", bg: "bg-emerald-50", link: "/vocab", desc: "Học qua Flashcard 3D", progress: `${learnedCount} / 1,800 từ`, percent: Math.min(Math.round((learnedCount / 1800) * 100), 100), active: true },
    { id: "topic", bgImage: "url('/hskk/topic.jpg')", name: "Chủ Đề", category: "vocab", icon: "📁", color: "text-slate-500", bg: "bg-slate-100", link: "#", desc: "Học theo chủ đề thực tế đời sống", progress: "🔒 Đang update", percent: 0, active: false },
    { id: "dictation", bgImage: "url('/hskk/nghechep.jpg')", name: "Chép Chính Tả", category: "skill", icon: "🎧", color: "text-blue-600", bg: "bg-blue-50", link: "/dictation", desc: "Luyện nghe chép file HSK", progress: `Đã học • 🔥 Chuỗi ${streak} ngày`, percent: learnedCount > 0 ? 50 : 0, active: true },
    { id: "translate", bgImage: "url('/hskk/dich.jpg')", name: "Dịch Câu", category: "skill", icon: "✍️", color: "text-rose-600", bg: "bg-rose-50", link: "/translate", desc: "Luyện dịch câu thực chiến", progress: "Bài tập ngữ pháp", percent: 0, active: true },
    { id: "arrange", bgImage: "url('/hskk/sapxep.jpg')", name: "Sắp Xếp", category: "skill", icon: "🧩", color: "text-indigo-600", bg: "bg-indigo-50", link: "/arrange", desc: "Sắp xếp từ thành câu đúng", progress: "Lắp ráp câu chuẩn", percent: 0, active: true },
    { id: "roleplay", bgImage: "url('/hskk/thucchien.jpg')", name: "Thực Chiến AI", category: "skill", icon: "💬", color: "text-teal-600", bg: "bg-teal-50", link: "/roleplay", desc: "Chat cùng người bản xứ AI", progress: "Hội thoại • Phản xạ", percent: 0, active: true },
    { id: "hskk", bgImage: "url('/hskk/hskk.jpg')", name: "Thi HSKK", category: "skill", icon: "🎤", color: "text-purple-600", bg: "bg-purple-50", link: "/hskk", desc: "Thi khẩu ngữ", progress: "Lịch sử bài thi", percent: 40, active: true },
  ];

  const filteredTools = activeToolTab === "all" 
    ? tools 
    : activeToolTab === "vocab" 
      ? tools.filter(t => t.category === "vocab")
      : activeToolTab === "skill"
        ? tools.filter(t => t.category === "skill")
        : tools.filter(t => t.category === "test");

  const getSortedList = () => {
    let list = [...leaderboard];
    if (hallOfFameTab === "hskk") {
      list = list.filter(u => u.score !== null).sort((a, b) => b.score - a.score);
    } else if (hallOfFameTab === "streak") {
      list.sort((a, b) => b.streak - a.streak);
    } else if (hallOfFameTab === "vocab") {
      list.sort((a, b) => b.vocabCount - a.vocabCount);
    }
    return list.slice(0, 3);
  };

  const currentLeaderboard = getSortedList();

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans text-slate-800">
      
      {/* SIDEBAR TRÁI */}
      <aside className={`bg-white border-r border-slate-200 hidden md:flex flex-col justify-between sticky top-0 h-screen p-4 transition-all duration-300 shadow-2xs z-30 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div>
          <div className="flex items-center justify-between mb-8 px-1">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 min-w-[40px] bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-md">🐸</div>
              {!isSidebarCollapsed && (
                <div>
                  <h2 className="font-black text-slate-900 text-base leading-tight whitespace-nowrap">Xiaoqingwa HSK</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Chinh phục tiếng Trung</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition cursor-pointer"
              title={isSidebarCollapsed ? "Mở rộng" : "Thu nhỏ"}
            >
              {isSidebarCollapsed ? "→" : "←"}
            </button>
          </div>

          <nav className="space-y-1.5">
            <Link href="/" className="flex items-center gap-3 px-3.5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-sm transition">
              <span className="text-lg">🏠</span> {!isSidebarCollapsed && <span>Trang chủ</span>}
            </Link>

            <Link href="/test" className="flex items-center gap-3 px-3.5 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl font-medium text-sm transition">
              <span className="text-lg">🎯</span> {!isSidebarCollapsed && <span>Kiểm tra trình độ</span>}
            </Link>

            <div 
              className="relative"
              onMouseEnter={() => setIsStudyHovered(true)}
              onMouseLeave={() => setIsStudyHovered(false)}
            >
              <div className="flex items-center justify-between px-3.5 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl font-medium text-sm transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📚</span> {!isSidebarCollapsed && <span>Học tập</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-xs text-slate-400">▶</span>}
              </div>

              {isStudyHovered && (
                <div className="absolute left-full top-0 ml-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fade-in space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Danh mục học tập</div>
                  {studyTabs.map((tab, idx) => (
                    <Link key={idx} href={tab.link} className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition">
                      <span>{tab.icon}</span>
                      <span>{tab.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="#" className="flex items-center gap-3 px-3.5 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl font-medium text-sm transition">
              <span className="text-lg">📊</span> {!isSidebarCollapsed && <span>Thống kê</span>}
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3.5 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl font-medium text-sm transition">
              <span className="text-lg">🏆</span> {!isSidebarCollapsed && <span>Thành tích</span>}
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3.5 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl font-medium text-sm transition">
              <span className="text-lg">⚙️</span> {!isSidebarCollapsed && <span>Cài đặt</span>}
            </Link>
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
          {isSignedIn ? (
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} bg-slate-50 p-2.5 rounded-2xl border border-slate-200/60`}>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <UserButton afterSignOutUrl="/" />
                {!isSidebarCollapsed && (
                  <div className="truncate text-left">
                    <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">Tài khoản</p>
                    <p className="text-xs font-black text-slate-800 truncate mt-0.5">{user?.fullName || "Học viên"}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <SignInButton mode="modal">
              <button className={`w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-md hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-2 ${isSidebarCollapsed ? 'px-0' : 'px-4'}`}>
                <span>👤</span> {!isSidebarCollapsed && <span>Đăng nhập</span>}
              </button>
            </SignInButton>
          )}

          {!isSidebarCollapsed && (
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 text-center">
              <p className="font-black text-[11px] text-emerald-900">🐼 加油！</p>
              <p className="text-[9px] text-emerald-700 font-medium mt-0.5">Mỗi ngày một chút tiến bộ!</p>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT PHẢI */}
      <main className="flex-1 flex flex-col min-w-0">
        
        <header className="h-20 bg-white border-b border-slate-200 px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="w-full max-w-md relative hidden sm:block">
            <input 
              type="text" 
              placeholder="🔍 Tìm từ vựng, ngữ pháp, chủ đề..." 
              className="w-full bg-slate-100 border-none rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-medium"
            />
            <span className="absolute right-3 top-2.5 bg-white text-slate-400 text-xs font-bold px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">Ctrl K</span>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {isSignedIn && (
              <button 
                onClick={handleResetData}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition text-xs cursor-pointer"
                title="Reset dữ liệu"
              >
                🔄 Reset
              </button>
            )}

            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3.5 py-1.5 rounded-2xl shadow-2xs">
              <span className="text-base">🔥</span>
              <div className="text-left">
                <p className="text-xs font-black text-amber-800 leading-none">{streak} ngày liên tiếp</p>
                <p className="text-[9px] text-amber-600 font-medium mt-0.5">Tuyệt vời, giữ vững phong độ!</p>
              </div>
            </div>

            <button className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition relative">
              🔔
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
          
          {/* BỐ CỤC CHÍNH: TRÁI (BẢNG VÀNG + BANNER) | PHẢI (ĐÁNH GIÁ TRÌNH ĐỘ) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* CỘT TRÁI (Span 2): BẢNG VÀNG & BANNER */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* 1. BẢNG VÀNG HALL OF FAME (Top 3 - Dark Luxury) */}
              <section className="flex-1 relative p-6 md:p-8 overflow-hidden rounded-[28px] text-white shadow-xl bg-gradient-to-br from-[#0b1022] via-[#141932] to-[#24163b] border border-amber-500/30 flex flex-col justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,210,100,0.15),transparent_40%)] pointer-events-none"></div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 relative z-10 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 text-white">♛</div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-[#ffe89a] to-[#d7a72d] text-[#3b2500] mb-1">
                        👑 HSKK HALL OF FAME
                      </span>
                      <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-white via-[#ffe6a0] to-white bg-clip-text text-transparent">
                        Bảng Vàng Vinh Danh Tháng 9/2026
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl backdrop-blur-md border border-white/10">
                    <button 
                      onClick={() => setHallOfFameTab("hskk")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${hallOfFameTab === "hskk" ? 'bg-amber-400 text-amber-950 shadow-md' : 'text-slate-300 hover:bg-white/10'}`}
                    >
                      <span>🎤</span> Điểm HSKK
                    </button>
                    <button 
                      onClick={() => setHallOfFameTab("streak")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${hallOfFameTab === "streak" ? 'bg-amber-400 text-amber-950 shadow-md' : 'text-slate-300 hover:bg-white/10'}`}
                    >
                      <span>🔥</span> Chuỗi Streak
                    </button>
                    <button 
                      onClick={() => setHallOfFameTab("vocab")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${hallOfFameTab === "vocab" ? 'bg-amber-400 text-amber-950 shadow-md' : 'text-slate-300 hover:bg-white/10'}`}
                    >
                      <span>📖</span> Số Từ Vựng
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 relative z-10 w-full mx-auto">
                  {currentLeaderboard.length > 0 ? (
                    currentLeaderboard.map((item, index) => {
                      const rank = index + 1;
                      const widthStyle = rank === 1 ? "w-full" : rank === 2 ? "w-[92%]" : "w-[84%]";
                      
                      const rowBg = rank === 1 
                        ? "bg-gradient-to-r from-[rgba(255,196,40,0.3)] to-[rgba(255,225,120,0.1)] border-amber-400/60 shadow-[0_0_20px_rgba(255,190,40,0.15)]" 
                        : rank === 2 
                          ? "bg-gradient-to-r from-[rgba(210,220,240,0.2)] to-[rgba(255,255,255,0.05)] border-slate-300/40" 
                          : "bg-gradient-to-r from-[rgba(190,120,60,0.2)] to-[rgba(255,180,100,0.06)] border-amber-700/40";

                      const rightValue = hallOfFameTab === "hskk" ? `${item.score}` : hallOfFameTab === "streak" ? `${item.streak}` : `${item.vocabCount}`;
                      const rightUnit = hallOfFameTab === "hskk" ? "ĐIỂM" : hallOfFameTab === "streak" ? "NGÀY" : "TỪ";

                      return (
                        <div 
                          key={item.id} 
                          className={`${widthStyle} relative flex items-center justify-between min-h-[68px] px-5 rounded-xl border backdrop-blur-md transition-all duration-300 hover:scale-[1.01] ${rowBg}`}
                          style={{ clipPath: "polygon(1.5% 0, 98.5% 0, 100% 50%, 98.5% 100%, 1.5% 100%, 0 50%)" }}
                        >
                          <div className="w-8 text-center font-black text-lg text-amber-300/80">#{rank}</div>
                          
                          <div className="flex items-center gap-3.5 flex-1 ml-3">
                            <div className="relative w-10 h-10">
                              {rank === 1 && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl filter drop-shadow-[0_2px_4px_rgba(255,200,50,0.8)] z-10">👑</div>
                              )}
                              <img src={item.avatar} alt={item.name} className="w-full h-full rounded-full object-cover border-2 border-amber-400 shadow-md bg-slate-800" />
                            </div>
                            <div>
                              <h3 className="font-extrabold text-sm text-white">{item.name}</h3>
                              <p className="text-[10px] text-amber-200/70 font-medium">🔥 {item.streak} ngày liên tiếp • 📖 {item.vocabCount} từ</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-center justify-center min-w-[65px] h-[46px] rounded-xl bg-white/10 border border-white/15 px-2">
                            <strong className="text-lg font-black text-[#ffe08a] leading-none">{rightValue}</strong>
                            <small className="text-[8px] opacity-75 uppercase tracking-wider mt-0.5">{rightUnit}</small>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-sm text-slate-400">
                      {hallOfFameTab === "hskk" ? "Chưa có dữ liệu bài thi HSKK thực tế." : "Chưa có dữ liệu thành tích."}
                    </div>
                  )}
                </div>
              </section>

              {/* 2. BANNER GIỚI THIỆU CHÍNH */}
              <section 
                className="flex-1 rounded-[28px] p-6 md:p-8 border border-emerald-200/60 shadow-sm relative overflow-hidden flex flex-col justify-center bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/hskk/backcover.jpg')" }} 
              >
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] pointer-events-none z-0"></div>

                <div className="max-w-md z-10 relative">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wider block mb-1">Cá nhân hóa lộ trình</span>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-snug mb-2">
                    Làm chủ <span className="underline decoration-amber-400 decoration-wavy underline-offset-4">tiếng Trung</span> thực chiến.
                  </h1>
                  <p className="text-slate-800 text-xs md:text-sm font-bold mb-6">
                    Kiên trì mỗi ngày, thành công tương lai. Học chuẩn New HSK ngay hôm nay 🌿
                  </p>

                  <Link href="/vocab">
                    <button className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer flex items-center gap-2">
                      <span>Bắt đầu học ngay</span>
                      <span>→</span>
                    </button>
                  </Link>
                </div>
              </section>

            </div>

            {/* CỘT PHẢI (Span 1): ĐÁNH GIÁ TRÌNH ĐỘ (Đã cập nhật theo UI thiết kế) */}
            <div className="lg:col-span-1">
              <div 
                className="relative h-full bg-white rounded-[28px] p-6 md:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between overflow-hidden bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/hskk/kiemtra.jpg')" }} /* LINK ẢNH NỀN CHO KHỐI NÀY (NẾU CẦN) */
              >
                {/* Lớp phủ trắng */}
                <div className="absolute inset-0 bg-white/95 backdrop-blur-[2px] pointer-events-none z-0"></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 text-fuchsia-500 flex items-center justify-center text-2xl shadow-sm">
                      🎯
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Đánh Giá Trình Độ</h3>
                  </div>
                  
                  <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                    Xác định chính xác năng lực HSK hiện tại của bạn trong 5 phút để tối ưu lộ trình học tập cá nhân hóa.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 min-w-[20px] rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-[10px] mt-0.5 shrink-0">✓</div>
                      <p className="text-sm text-slate-600 leading-relaxed">Đề thi bám sát chuẩn cấu trúc New HSK 3.0 mới nhất.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 min-w-[20px] rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-[10px] mt-0.5 shrink-0">✓</div>
                      <p className="text-sm text-slate-600 leading-relaxed">Phân tích chuyên sâu điểm mạnh & điểm yếu kỹ năng.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 min-w-[20px] rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-[10px] mt-0.5 shrink-0">✓</div>
                      <p className="text-sm text-slate-600 leading-relaxed">Mở khóa lộ trình học tập từ vựng & ngữ pháp phù hợp.</p>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-auto">
                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl mb-4 text-center">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Thời gian dự kiến</p>
                    <p className="text-xl font-black text-slate-900">5 - 10 Phút</p>
                  </div>

                  <Link href="/test">
                    <button className="w-full py-4 bg-[#0F172A] hover:bg-[#1E293B] text-white font-black text-sm rounded-2xl shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex items-center justify-center gap-2 group">
                      <span>Kiểm Tra Đầu Vào Ngay</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                  </Link>
                </div>
              </div>
            </div>

          </div>

          {/* 3 BIỂU ĐỒ HÌNH TRÒN CÓ NỀN ẢNH TÙY CHỈNH */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
            
            {/* 1. Biểu đồ Roadmap HSK */}
            <div 
              className="relative bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center justify-between overflow-hidden bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/hskk/anh1.jpg')" }} 
            >
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] pointer-events-none z-0"></div>

              <div className="relative z-10 w-full flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span>🗺️</span> Roadmap HSK
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">HSK 6 mốc</span>
              </div>
              
              <div className="relative z-10 flex-1 flex items-center justify-center w-full">
                <CircleProgress percent={roadmapPercent} colorClass="text-emerald-500" size={130} strokeWidth={12}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">HIỆN TẠI</p>
                  <p className="text-2xl font-black text-emerald-600">{currentLevel}</p>
                </CircleProgress>
              </div>

              <div className="relative z-10 w-full mt-6 text-center">
                <p className="text-[11px] text-slate-500 font-medium">Hoàn thành {currentLevelNum}/6 cấp độ HSK.</p>
              </div>
            </div>

            {/* 2. Biểu đồ Thành tích Huy hiệu */}
            <div 
              className="relative bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center justify-between overflow-hidden bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/hskk/anh2.jpg')" }} 
            >
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] pointer-events-none z-0"></div>

              <div className="relative z-10 w-full flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span>🏆</span> Thành tích ({streak} ngày)
                </h3>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">5 Huy hiệu</span>
              </div>
              
              <div className="relative z-10 flex-1 flex items-center justify-center w-full">
                <CircleProgress percent={achievementPercent} colorClass="text-amber-400" size={130} strokeWidth={12}>
                  <span className="text-2xl mb-1">🏆</span>
                  <p className="text-2xl font-black text-amber-500">{achievementPercent}%</p>
                </CircleProgress>
              </div>

              <div className="relative z-10 w-full mt-6 text-center">
                <p className="text-[11px] text-slate-500 font-medium">Mở khóa {unlockedAchievements}/{totalAchievements} thành tích.</p>
              </div>
            </div>

            {/* 3. Biểu đồ Mục tiêu Học Từ vựng */}
            <div 
              className="relative bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center justify-between overflow-hidden bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/hskk/anh3.jpg')" }} 
            >
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] pointer-events-none z-0"></div>

              <div className="relative z-10 w-full flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span>🎯</span> Mục tiêu từ vựng
                </h3>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Hôm nay</span>
              </div>
              
              <div className="relative z-10 flex-1 flex items-center justify-center w-full">
                <CircleProgress percent={overallPercent} colorClass="text-blue-500" size={130} strokeWidth={12}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ĐÃ HỌC</p>
                  <p className="text-2xl font-black text-blue-600">{todayVocabLearned}<span className="text-sm text-slate-400">/{dailyVocabTarget}</span></p>
                </CircleProgress>
              </div>

              <div className="relative z-10 w-full mt-6 flex justify-center">
                <Link href="/vocab">
                  <button className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5">
                    Học tiếp ngay →
                  </button>
                </Link>
              </div>
            </div>

          </div>

          {/* HỆ THỐNG CÔNG CỤ HỌC TẬP */}
          <div className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900">Công cụ học tập</h2>

              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                <button 
                  onClick={() => setActiveToolTab("all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeToolTab === "all" ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Tất cả
                </button>
                <button 
                  onClick={() => setActiveToolTab("vocab")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeToolTab === "vocab" ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Học hôm nay
                </button>
                <button 
                  onClick={() => setActiveToolTab("skill")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeToolTab === "skill" ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Luyện kỹ năng
                </button>
                <button 
                  onClick={() => setActiveToolTab("test")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeToolTab === "test" ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Đánh giá
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredTools.map((tool) => (
                tool.active ? (
                  <Link href={tool.link} key={tool.id}>
                    <div 
                      className="relative p-5 rounded-3xl shadow-sm border border-slate-200/80 hover:border-emerald-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between group h-full overflow-hidden bg-cover bg-center bg-no-repeat"
                      style={{ backgroundImage: tool.bgImage }}
                    >
                      {/* Lớp phủ (overlay) giúp chữ nổi lên trên nền ảnh */}
                      <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px] pointer-events-none z-0 group-hover:bg-white/75 transition-all"></div>
                      
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${tool.bg}`}>
                              {tool.icon}
                            </div>
                          </div>
                          <h3 className={`font-black text-base mb-0.5 group-hover:text-emerald-700 transition ${tool.color}`}>{tool.name}</h3>
                          <p className="text-slate-600 text-xs font-medium">{tool.desc}</p>
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-slate-200/50">
                          <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 mb-1.5">
                            <span>{tool.progress}</span>
                            {tool.percent > 0 && <span>{tool.percent}%</span>}
                          </div>
                          {tool.percent > 0 && (
                            <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden mb-3">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${tool.percent}%` }}></div>
                            </div>
                          )}
                          <div className="text-xs font-extrabold text-emerald-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            <span>Học ngay</span>
                            <span>→</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div 
                    key={tool.id} 
                    className="relative p-5 rounded-3xl border border-slate-200/80 opacity-80 overflow-hidden flex flex-col justify-between h-full select-none cursor-not-allowed bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: tool.bgImage }}
                  >
                    <div className="absolute inset-0 bg-slate-100/90 backdrop-blur-[2px] pointer-events-none z-0"></div>

                    <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase shadow-2xs z-10">
                      🔒 Đang update
                    </div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${tool.bg}`}>
                            {tool.icon}
                          </div>
                        </div>
                        <h3 className={`font-black text-base mb-0.5 ${tool.color}`}>{tool.name}</h3>
                        <p className="text-slate-500 text-xs font-medium">{tool.desc}</p>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-slate-200/50">
                        <div className="text-[11px] font-bold text-slate-500 mb-3">
                          <span>{tool.progress}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-400">
                          Sắp ra mắt
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}