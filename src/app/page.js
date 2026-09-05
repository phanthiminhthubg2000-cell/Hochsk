"use client";
import Link from "next/link";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState, useRef } from "react";
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
        <circle
          className="text-slate-200/60"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
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

  // ==========================================
  // STATE: TÌM KIẾM, HỎI AI & VIẾT TAY
  // ==========================================
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  const [showHandwriting, setShowHandwriting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [handwritingResult, setHandwritingResult] = useState([]);
  const canvasRef = useRef(null);
  
  // Dùng useRef để lưu tọa độ viết tay (đảm bảo Real-time, không bị trễ như useState)
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef([[], [], []]); 

  // Bắt sự kiện phím tắt Ctrl+K để mở tìm kiếm
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // Logic lọc từ điển nhanh
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const mockData = [
      { hanzi: "喜欢", pinyin: "xǐhuan", meaning: "thích", type: "Từ vựng" },
      { hanzi: "爱", pinyin: "ài", meaning: "yêu", type: "Từ vựng" },
      { hanzi: "因为...所以...", pinyin: "yīnwèi...suǒyǐ...", meaning: "bởi vì... nên...", type: "Ngữ pháp" },
      { hanzi: "学习", pinyin: "xuéxí", meaning: "học tập", type: "Từ vựng" },
    ];
    const results = mockData.filter(item => 
      item.hanzi.includes(searchQuery) ||
      item.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 4);
    setSearchResults(results);
  }, [searchQuery]);

  // Hàm gọi API Hỏi AI
  const handleAskAI = async () => {
    if (!searchQuery.trim()) return;
    setIsAiLoading(true);
    setAiResponse(null);

    try {
      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: searchQuery }),
        cache: 'no-store'
      });

      if (!response.ok) throw new Error("Lỗi API AI");
      const data = await response.json();
      setAiResponse(data.answer || data.response || data.message || "AI đã nhận câu hỏi nhưng không có nội dung trả về.");
    } catch (error) {
      console.error("AI Error:", error);
      setAiResponse("⚠️ Xin lỗi, Giáo viên AI đang bận hoặc bạn chưa thiết lập API backend tại '/api/ask-ai'. Vui lòng kiểm tra lại server để kết nối với Gemini/OpenAI nhé!");
    } finally {
      setIsAiLoading(false);
    }
  };

  // ==========================================
  // HÀM NHẬN DIỆN CHỮ VIẾT TAY ĐÃ SỬA LỖI
  // ==========================================
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#172033";
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    
    // Bắt đầu một nét mới, để trống mảng thời gian
    currentStrokeRef.current = [[x], [y], []];
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();

    // Thêm tọa độ trực tiếp vào reference
    currentStrokeRef.current[0].push(x);
    currentStrokeRef.current[1].push(y);
  };

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeRef.current[0].length === 0) return;

    // Đẩy nét vừa vẽ vào tổng các nét
    strokesRef.current.push([...currentStrokeRef.current]);

    try {
      const response = await fetch('https://inputtools.google.com/request?itc=zh-CN-t-i0-handwrit&app=mobilesearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_version: 0.4,
          api_level: "5.37.3",
          device: window.navigator.userAgent,
          input_type: 0,
          options: "enable_pre_space",
          requests: [{
            writing_guide: { writing_area_width: 200, writing_area_height: 200 },
            pre_context: "",
            max_num_results: 6,
            max_completions: 0,
            language: "zh-CN",
            ink: strokesRef.current // Gửi tọa độ chuẩn xác
          }]
        })
      });

      const data = await response.json();
      if (data[0] === "SUCCESS") {
        setHandwritingResult(data[1][0][1]); // Cập nhật danh sách dự đoán
      }
    } catch (err) {
      console.error("Lỗi nhận diện chữ viết tay:", err);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset Data
    setHandwritingResult([]);
    strokesRef.current = [];
    currentStrokeRef.current = [[], [], []];
  };

  // ==========================================
  // FETCH USER DATA & FIREBASE
  // ==========================================
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
              passedHSK1: false, passedHSK2: false, passedHSK3: false,
              passedHSK4: false, passedHSK5: false, passedHSK6: false,
              learnedVocab: [], hskkScore: null
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

  let unlockedAchievements = 0;
  const totalAchievements = 5;
  if (true) unlockedAchievements++; 
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
    <div className="flex min-h-screen font-sans text-slate-800 relative overflow-hidden selection:bg-emerald-200">
      
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: "url('/hskk/nen.jpg')" }} 
      >
        <div className="absolute inset-0 bg-[#F4F8F5]/85 backdrop-blur-[4px]"></div>
      </div>

      <aside className={`relative z-10 border-r border-white/50 hidden md:flex flex-col justify-between sticky top-0 h-screen p-5 transition-all duration-300 bg-white/40 backdrop-blur-xl shadow-[4px_0_24px_rgba(8,166,106,0.05)] ${isSidebarCollapsed ? 'w-24' : 'w-[280px]'}`}>
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-11 h-11 min-w-[44px] bg-[#08A66A] rounded-full flex items-center justify-center text-white text-2xl shadow-sm">🐸</div>
                {!isSidebarCollapsed && (
                  <div>
                    <h2 className="font-black text-slate-900 text-base leading-tight whitespace-nowrap">Xiaoqingwa HSK</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap tracking-wider mt-0.5">Chinh phục tiếng Trung</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="w-8 h-8 rounded-full bg-white/60 border border-white hover:bg-white text-slate-500 flex items-center justify-center text-sm font-bold transition cursor-pointer shrink-0 shadow-sm"
                title={isSidebarCollapsed ? "Mở rộng" : "Thu nhỏ"}
              >
                {isSidebarCollapsed ? "→" : "←"}
              </button>
            </div>

            <nav className="space-y-2">
              <Link href="/" className="flex items-center gap-4 px-4 py-3.5 bg-white/80 text-[#08A66A] border border-white shadow-sm rounded-2xl font-bold text-sm transition">
                <span className="text-xl">🏠</span> {!isSidebarCollapsed && <span>Trang chủ</span>}
              </Link>

              <Link href="/test" className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-white/60 rounded-2xl font-medium text-sm transition">
                <span className="text-xl">🎯</span> {!isSidebarCollapsed && <span>Kiểm tra trình độ</span>}
              </Link>

              <div 
                className="relative"
                onMouseEnter={() => setIsStudyHovered(true)}
                onMouseLeave={() => setIsStudyHovered(false)}
              >
                <div className="flex items-center justify-between px-4 py-3.5 text-slate-600 hover:bg-white/60 rounded-2xl font-medium text-sm transition cursor-pointer">
                  <div className="flex items-center gap-4">
                    <span className="text-xl">📚</span> {!isSidebarCollapsed && <span>Học tập</span>}
                  </div>
                  {!isSidebarCollapsed && <span className="w-5 h-5 bg-[#08A66A] text-white rounded-[6px] flex items-center justify-center text-[10px] shadow-sm shrink-0">▶</span>}
                </div>

                {isStudyHovered && (
                  <div className="absolute left-full top-0 ml-2 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white p-2 z-50 animate-fade-in space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Danh mục học tập</div>
                    {studyTabs.map((tab, idx) => (
                      <Link key={idx} href={tab.link} className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-[#DDF7EA] hover:text-[#08A66A] rounded-xl transition">
                        <span>{tab.icon}</span>
                        <span>{tab.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link href="#" className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-white/60 rounded-2xl font-medium text-sm transition">
                <span className="text-xl">📊</span> {!isSidebarCollapsed && <span>Thống kê</span>}
              </Link>
              <Link href="#" className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-white/60 rounded-2xl font-medium text-sm transition">
                <span className="text-xl">🏆</span> {!isSidebarCollapsed && <span>Thành tích</span>}
              </Link>
              <Link href="#" className="flex items-center gap-4 px-4 py-3.5 text-slate-600 hover:bg-white/60 rounded-2xl font-medium text-sm transition">
                <span className="text-xl">⚙️</span> {!isSidebarCollapsed && <span>Cài đặt</span>}
              </Link>
            </nav>
          </div>

          <div className="pt-6 border-t border-white/40 flex flex-col gap-4">
            {isSignedIn ? (
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} bg-white/60 backdrop-blur-md p-3 rounded-[20px] border border-white shadow-sm`}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <UserButton afterSignOutUrl="/" />
                  {!isSidebarCollapsed && (
                    <div className="truncate text-left">
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Tài khoản</p>
                      <p className="text-sm font-black text-slate-800 truncate">{user?.fullName || "Học viên"}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className={`w-full py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-xs shadow-md hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-2 ${isSidebarCollapsed ? 'px-0' : 'px-4'}`}>
                  <span>👤</span> {!isSidebarCollapsed && <span>Đăng nhập</span>}
                </button>
              </SignInButton>
            )}

            {!isSidebarCollapsed && (
              <div className="bg-[#DDF7EA]/60 border border-white rounded-[20px] p-3 text-center shadow-sm">
                <p className="font-black text-xs text-slate-800 flex justify-center items-center gap-1"><span>🐼</span> 加油！</p>
                <p className="text-[10px] text-[#08A66A] font-bold mt-1">Mỗi ngày một chút tiến bộ!</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        
        <header className="h-20 bg-white/40 backdrop-blur-xl border-b border-white/50 px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          
          <div 
            onClick={() => setIsSearchOpen(true)}
            className="w-full max-w-md relative hidden sm:block cursor-pointer group"
          >
            <div className="w-full bg-white/60 border-2 border-white rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2 group-hover:bg-white/90 transition-all shadow-sm">
              <span className="text-lg opacity-60">🔍</span>
              <span className="text-slate-500 font-medium select-none">Tra từ vựng, ngữ pháp hoặc hỏi AI...</span>
            </div>
            <span className="absolute right-3 top-2.5 bg-white text-slate-400 text-xs font-bold px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm group-hover:text-[#08A66A] transition-colors">
              Ctrl K
            </span>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {isSignedIn && (
              <button 
                onClick={handleResetData}
                className="px-3 py-1.5 bg-white/60 border border-white text-rose-500 rounded-xl font-bold hover:bg-rose-50 transition text-xs cursor-pointer shadow-sm"
                title="Reset dữ liệu"
              >
                🔄 Reset
              </button>
            )}

            <div className="flex items-center gap-2 bg-white/80 border border-white px-3.5 py-1.5 rounded-2xl shadow-sm">
              <span className="text-base">🔥</span>
              <div className="text-left">
                <p className="text-xs font-black text-amber-600 leading-none">{streak} ngày liên tiếp</p>
                <p className="text-[9px] text-slate-500 font-medium mt-0.5">Tuyệt vời, giữ vững phong độ!</p>
              </div>
            </div>

            <button className="w-10 h-10 rounded-2xl bg-white/60 border border-white hover:bg-white flex items-center justify-center text-slate-500 transition relative shadow-sm">
              🔔
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              <section className="flex-1 relative p-6 md:p-8 overflow-hidden rounded-[32px] text-white shadow-xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] border border-white/20 flex flex-col justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,210,100,0.1),transparent_50%)] pointer-events-none"></div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 relative z-10 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFC83D] to-amber-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 text-white">♛</div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-white/10 text-amber-300 mb-1 backdrop-blur-md">
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${hallOfFameTab === "hskk" ? 'bg-[#FFC83D] text-amber-950 shadow-md' : 'text-slate-300 hover:bg-white/10'}`}
                    >
                      <span>🎤</span> Điểm HSKK
                    </button>
                    <button 
                      onClick={() => setHallOfFameTab("streak")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${hallOfFameTab === "streak" ? 'bg-[#FFC83D] text-amber-950 shadow-md' : 'text-slate-300 hover:bg-white/10'}`}
                    >
                      <span>🔥</span> Chuỗi Streak
                    </button>
                    <button 
                      onClick={() => setHallOfFameTab("vocab")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${hallOfFameTab === "vocab" ? 'bg-[#FFC83D] text-amber-950 shadow-md' : 'text-slate-300 hover:bg-white/10'}`}
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
                        ? "bg-gradient-to-r from-[rgba(255,200,61,0.2)] to-[rgba(255,255,255,0.05)] border-amber-400/50 shadow-[0_0_20px_rgba(255,200,61,0.15)]" 
                        : rank === 2 
                          ? "bg-gradient-to-r from-[rgba(210,220,240,0.15)] to-[rgba(255,255,255,0.05)] border-slate-400/40" 
                          : "bg-gradient-to-r from-[rgba(190,120,60,0.15)] to-[rgba(255,180,100,0.05)] border-amber-700/40";

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
                            <strong className="text-lg font-black text-[#FFC83D] leading-none">{rightValue}</strong>
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

              <section 
                className="flex-1 rounded-[32px] p-6 md:p-8 border border-white shadow-md relative overflow-hidden flex flex-col justify-center bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/hskk/tuvung.jpg')" }} 
              >
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] pointer-events-none z-0"></div>

                <div className="max-w-md z-10 relative">
                  <span className="text-xs font-black text-[#08A66A] uppercase tracking-wider block mb-1">Cá nhân hóa lộ trình</span>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-snug mb-2">
                    Làm chủ <span className="underline decoration-[#FFC83D] decoration-wavy underline-offset-4">tiếng Trung</span> thực chiến.
                  </h1>
                  <p className="text-slate-800 text-xs md:text-sm font-bold mb-6">
                    Kiên trì mỗi ngày, thành công tương lai. Học chuẩn New HSK ngay hôm nay 🌿
                  </p>

                  <Link href="/vocab">
                    <button className="px-6 py-3.5 bg-[#08A66A] hover:bg-[#087A55] text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all duration-300 hover:scale-105 cursor-pointer flex items-center gap-2">
                      <span>Bắt đầu học ngay</span>
                      <span>→</span>
                    </button>
                  </Link>
                </div>
              </section>

            </div>

            <div className="lg:col-span-1">
              <div 
                className="relative h-full bg-white/80 backdrop-blur-xl rounded-[32px] p-6 md:p-8 shadow-sm border border-white flex flex-col justify-between"
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-fuchsia-50 text-fuchsia-500 flex items-center justify-center text-3xl shadow-inner border border-white">🎯</div>
                    <h3 className="text-xl font-black text-slate-900">Đánh Giá Trình Độ</h3>
                  </div>
                  
                  <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                    Xác định chính xác năng lực HSK hiện tại của bạn trong 5 phút để tối ưu lộ trình học tập cá nhân hóa.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="min-w-[24px] h-6 rounded-full bg-[#DDF7EA] text-[#08A66A] flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">Đề thi bám sát chuẩn cấu trúc New HSK 3.0 mới nhất.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="min-w-[24px] h-6 rounded-full bg-[#DDF7EA] text-[#08A66A] flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">Phân tích chuyên sâu điểm mạnh & điểm yếu kỹ năng.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="min-w-[24px] h-6 rounded-full bg-[#DDF7EA] text-[#08A66A] flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">Mở khóa lộ trình học tập từ vựng & ngữ pháp phù hợp.</p>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-auto">
                  <div className="bg-white/80 border border-white p-4 rounded-2xl mb-5 text-center shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Thời gian dự kiến</p>
                    <p className="text-xl font-black text-slate-800">5 - 10 Phút</p>
                  </div>

                  <Link href="/test">
                    <button className="w-full py-4 bg-[#172033] hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex items-center justify-center gap-2 group">
                      <span>Kiểm Tra Đầu Vào Ngay</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                  </Link>
                </div>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
            
            <div 
              className="relative rounded-[32px] p-6 shadow-sm border border-white flex flex-col items-center justify-between overflow-hidden bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/hskk/anh1.jpg')" }} 
            >
              <div className="absolute inset-0 bg-white/85 backdrop-blur-[4px] pointer-events-none z-0"></div>

              <div className="relative z-10 w-full flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span>🗺️</span> Roadmap HSK
                </h3>
                <span className="text-[10px] font-bold text-[#08A66A] bg-[#DDF7EA] px-2 py-0.5 rounded-md">HSK 6 mốc</span>
              </div>
              
              <div className="relative z-10 flex-1 flex items-center justify-center w-full">
                <CircleProgress percent={roadmapPercent} colorClass="text-[#08A66A]" size={130} strokeWidth={12}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">HIỆN TẠI</p>
                  <p className="text-2xl font-black text-[#08A66A]">{currentLevel}</p>
                </CircleProgress>
              </div>

              <div className="relative z-10 w-full mt-6 text-center">
                <p className="text-[11px] text-slate-600 font-medium bg-white/50 px-3 py-1.5 rounded-lg inline-block">Hoàn thành {currentLevelNum}/6 cấp độ HSK.</p>
              </div>
            </div>

            <div 
              className="relative rounded-[32px] p-6 shadow-sm border border-white flex flex-col items-center justify-between overflow-hidden bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/hskk/anh2.jpg')" }} 
            >
              <div className="absolute inset-0 bg-white/85 backdrop-blur-[4px] pointer-events-none z-0"></div>

              <div className="relative z-10 w-full flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span>🏆</span> Thành tích ({streak} ngày)
                </h3>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">5 Huy hiệu</span>
              </div>
              
              <div className="relative z-10 flex-1 flex items-center justify-center w-full">
                <CircleProgress percent={achievementPercent} colorClass="text-[#FFC83D]" size={130} strokeWidth={12}>
                  <span className="text-2xl mb-1">🏆</span>
                  <p className="text-2xl font-black text-amber-500">{achievementPercent}%</p>
                </CircleProgress>
              </div>

              <div className="relative z-10 w-full mt-6 text-center">
                <p className="text-[11px] text-slate-600 font-medium bg-white/50 px-3 py-1.5 rounded-lg inline-block">Mở khóa {unlockedAchievements}/{totalAchievements} thành tích.</p>
              </div>
            </div>

            <div 
              className="relative rounded-[32px] p-6 shadow-sm border border-white flex flex-col items-center justify-between overflow-hidden bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/hskk/anh3.jpg')" }} 
            >
              <div className="absolute inset-0 bg-white/85 backdrop-blur-[4px] pointer-events-none z-0"></div>

              <div className="relative z-10 w-full flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span>🎯</span> Mục tiêu từ vựng
                </h3>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">Hôm nay</span>
              </div>
              
              <div className="relative z-10 flex-1 flex items-center justify-center w-full">
                <CircleProgress percent={overallPercent} colorClass="text-blue-500" size={130} strokeWidth={12}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ĐÃ HỌC</p>
                  <p className="text-2xl font-black text-blue-600">{todayVocabLearned}<span className="text-sm text-slate-400">/{dailyVocabTarget}</span></p>
                </CircleProgress>
              </div>

              <div className="relative z-10 w-full mt-6 flex justify-center">
                <Link href="/vocab">
                  <button className="px-5 py-2.5 bg-white border border-white hover:border-blue-200 text-blue-600 font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5">
                    Học tiếp ngay →
                  </button>
                </Link>
              </div>
            </div>

          </div>

          <div className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900">Công cụ học tập</h2>

              <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-md p-1.5 rounded-2xl border border-white shadow-sm">
                <button 
                  onClick={() => setActiveToolTab("all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeToolTab === "all" ? 'bg-[#172033] text-white shadow-xs' : 'text-slate-600 hover:bg-white'}`}
                >
                  Tất cả
                </button>
                <button 
                  onClick={() => setActiveToolTab("vocab")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeToolTab === "vocab" ? 'bg-[#172033] text-white shadow-xs' : 'text-slate-600 hover:bg-white'}`}
                >
                  Học hôm nay
                </button>
                <button 
                  onClick={() => setActiveToolTab("skill")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeToolTab === "skill" ? 'bg-[#172033] text-white shadow-xs' : 'text-slate-600 hover:bg-white'}`}
                >
                  Luyện kỹ năng
                </button>
                <button 
                  onClick={() => setActiveToolTab("test")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeToolTab === "test" ? 'bg-[#172033] text-white shadow-xs' : 'text-slate-600 hover:bg-white'}`}
                >
                  Đánh giá
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredTools.map((tool) => (
                tool.active ? (
                  <Link href={tool.link} key={tool.id}>
                    <div 
                      className="relative p-6 rounded-[32px] shadow-sm border border-white hover:border-[#08A66A] hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between group h-full overflow-hidden bg-cover bg-center bg-no-repeat"
                      style={{ backgroundImage: tool.bgImage }}
                    >
                      <div className="absolute inset-0 bg-white/85 backdrop-blur-[4px] pointer-events-none z-0 group-hover:bg-white/75 transition-all"></div>
                      
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/50 ${tool.bg}`}>
                              {tool.icon}
                            </div>
                          </div>
                          <h3 className={`font-black text-lg mb-1 group-hover:text-[#08A66A] transition ${tool.color}`}>{tool.name}</h3>
                          <p className="text-slate-600 text-xs font-medium leading-relaxed">{tool.desc}</p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-200/50">
                          <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 mb-2">
                            <span>{tool.progress}</span>
                            {tool.percent > 0 && <span>{tool.percent}%</span>}
                          </div>
                          {tool.percent > 0 && (
                            <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden mb-3">
                              <div className="bg-[#08A66A] h-full rounded-full" style={{ width: `${tool.percent}%` }}></div>
                            </div>
                          )}
                          <div className="text-xs font-black text-[#08A66A] flex items-center gap-1 group-hover:translate-x-1 transition-transform bg-white/50 w-fit px-3 py-1.5 rounded-lg">
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
                    className="relative p-6 rounded-[32px] border border-white opacity-80 overflow-hidden flex flex-col justify-between h-full select-none cursor-not-allowed bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: tool.bgImage }}
                  >
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-[4px] pointer-events-none z-0"></div>

                    <div className="absolute top-5 right-5 bg-slate-200 text-slate-500 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm z-10 border border-white">
                      🔒 Đang update
                    </div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl opacity-50 shadow-inner border border-white/50 ${tool.bg}`}>
                            {tool.icon}
                          </div>
                        </div>
                        <h3 className={`font-black text-lg mb-1 ${tool.color} opacity-70`}>{tool.name}</h3>
                        <p className="text-slate-500 text-xs font-medium leading-relaxed">{tool.desc}</p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-200/50">
                        <div className="text-[11px] font-bold text-slate-500 mb-3">
                          <span>{tool.progress}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-400 bg-white/50 w-fit px-3 py-1.5 rounded-lg">
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

      {/* =========================================
          MODAL TÌM KIẾM & HỎI AI (CTRL + K)
          ========================================= */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => { setIsSearchOpen(false); setSearchQuery(""); setAiResponse(null); }}
          ></div>

          <div className="relative bg-white/95 backdrop-blur-xl w-full max-w-3xl rounded-[32px] shadow-2xl border border-white overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
            
            <div className="flex flex-col border-b border-slate-100">
              <div className="flex items-center px-6 py-5">
                <span className="text-2xl mr-4 opacity-50">✨</span>
                <input 
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) handleAskAI();
                  }}
                  placeholder="Tra từ vựng hoặc hỏi AI kiến thức..."
                  className="flex-1 bg-transparent text-xl font-bold text-slate-800 outline-none placeholder:text-slate-300 placeholder:font-medium"
                />
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowHandwriting(!showHandwriting)}
                    className={`p-2 rounded-xl font-black text-xl transition-all border ${showHandwriting ? 'bg-[#08A66A] text-white border-[#08A66A] shadow-md shadow-emerald-500/20' : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-[#08A66A]'}`}
                    title="Viết tay chữ Hán"
                  >
                    ✍️
                  </button>
                  <button 
                    onClick={() => { setIsSearchOpen(false); setSearchQuery(""); setAiResponse(null); }}
                    className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 px-3 py-2 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors"
                  >
                    ESC
                  </button>
                </div>
              </div>

              {showHandwriting && (
                <div className="bg-[#F4F8F5] p-4 border-t border-emerald-100 animate-slide-down">
                  <div className="flex gap-4">
                    <div className="flex-1 relative bg-white rounded-2xl border-2 border-emerald-100 overflow-hidden shadow-inner flex justify-center w-full max-w-[200px] mx-auto h-[200px]">
                      <div className="absolute inset-0 pointer-events-none opacity-20 flex flex-col">
                        <div className="flex-1 border-b border-dashed border-slate-500"></div>
                        <div className="flex-1"></div>
                        <div className="absolute inset-0 flex">
                          <div className="flex-1 border-r border-dashed border-slate-500"></div>
                          <div className="flex-1"></div>
                        </div>
                      </div>

                      <canvas
                        ref={canvasRef}
                        width={200}
                        height={200}
                        className="cursor-crosshair touch-none relative z-10 w-full h-full"
                        onPointerDown={startDrawing}
                        onPointerMove={draw}
                        onPointerUp={stopDrawing}
                        onPointerOut={stopDrawing}
                      ></canvas>

                      <button
                        onClick={clearCanvas}
                        className="absolute bottom-2 right-2 bg-slate-100/80 backdrop-blur-sm text-slate-500 p-1.5 rounded-lg text-[10px] font-bold hover:bg-rose-50 hover:text-rose-500 z-20 transition"
                      >
                        🗑️ Xóa
                      </button>
                    </div>

                    <div className="w-[110px] shrink-0 flex flex-col">
                      <p className="text-[10px] font-black text-[#08A66A] uppercase tracking-wider text-center border-b border-emerald-100 pb-2 mb-2">Dự đoán</p>
                      <div className="grid grid-cols-2 gap-2 content-start flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {handwritingResult.length > 0 ? handwritingResult.map((char, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setSearchQuery(prev => prev + char);
                              clearCanvas();
                            }}
                            className="aspect-square bg-white border border-emerald-100 rounded-xl text-xl font-black text-slate-700 hover:bg-[#08A66A] hover:text-white hover:border-[#08A66A] transition-all shadow-sm flex items-center justify-center"
                          >
                            {char}
                          </button>
                        )) : (
                          <div className="col-span-2 flex items-center justify-center text-slate-400 text-xs text-center border-2 border-dashed border-emerald-100 rounded-xl aspect-[2/1] bg-white">
                            Viết chữ để<br/>nhận diện
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">
              
              {searchQuery.trim() !== "" && !aiResponse && !isAiLoading && (
                <div 
                  onClick={handleAskAI}
                  className="mb-6 p-4 bg-gradient-to-r from-[#DDF7EA] to-emerald-50 border border-[#08A66A]/20 rounded-2xl cursor-pointer hover:shadow-md transition group flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition">🤖</div>
                  <div>
                    <h4 className="font-black text-[#087A55]">Hỏi Giáo viên AI</h4>
                    <p className="text-xs text-[#08A66A] font-medium">Bấm vào đây để AI giải đáp kiến thức: <span className="font-bold text-slate-700">"{searchQuery}"</span></p>
                  </div>
                  <div className="ml-auto text-[#08A66A] font-black px-3 py-1 bg-white rounded-lg opacity-0 group-hover:opacity-100 transition">Enter ↵</div>
                </div>
              )}

              {isAiLoading && (
                <div className="p-6 bg-white border border-emerald-100 rounded-[24px] shadow-sm mb-6 flex items-start gap-4 animate-pulse">
                   <div className="w-10 h-10 bg-[#08A66A] text-white rounded-full flex items-center justify-center text-xl shrink-0">🐸</div>
                   <div className="pt-2">
                     <div className="flex gap-1.5">
                       <div className="w-2.5 h-2.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                       <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                       <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                     </div>
                     <p className="text-xs font-bold text-emerald-600 mt-2">AI đang phân tích câu hỏi...</p>
                   </div>
                </div>
              )}

              {aiResponse && !isAiLoading && (
                <div className="p-6 bg-white border border-emerald-100 rounded-[24px] shadow-sm mb-6 flex items-start gap-4 animate-fade-in relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[#DDF7EA] rounded-bl-full opacity-30 pointer-events-none"></div>
                   
                   <div className="w-10 h-10 bg-[#08A66A] text-white rounded-full flex items-center justify-center text-xl shrink-0 relative z-10 shadow-md">🐸</div>
                   <div className="flex-1 relative z-10">
                     <div className="flex items-center gap-2 mb-2">
                       <h4 className="font-black text-[#087A55]">Giáo viên AI</h4>
                       <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold border border-emerald-100">AI ASSISTANT</span>
                     </div>
                     
                     <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                       {aiResponse}
                     </div>

                     <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
                       <button className="text-xs font-bold text-slate-400 hover:text-[#08A66A] flex items-center gap-1"><span className="text-base">👍</span> Hữu ích</button>
                       <button 
                          onClick={() => { setAiResponse(null); setSearchQuery(""); }} 
                          className="text-xs font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 ml-auto"
                       >
                         Hỏi câu khác
                       </button>
                     </div>
                   </div>
                </div>
              )}

              {!aiResponse && !isAiLoading && searchQuery.trim() !== "" && searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Kết quả từ điển nhanh</p>
                  {searchResults.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-4 bg-white hover:bg-[#DDF7EA]/50 border border-slate-100 hover:border-[#08A66A]/30 rounded-2xl cursor-pointer transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 group-hover:bg-white rounded-xl flex items-center justify-center text-2xl font-black text-[#172033] shadow-inner border border-slate-200/50">
                          {item.hanzi}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 group-hover:text-[#08A66A]">{item.pinyin}</h4>
                          <p className="text-sm text-slate-500 font-medium">{item.meaning}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#08A66A] bg-[#DDF7EA] px-3 py-1 rounded-lg shadow-sm">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.trim() === "" && !aiResponse && (
                <div className="py-16 flex flex-col items-center justify-center text-center opacity-60">
                  <span className="text-6xl mb-4 grayscale opacity-50">🔍</span>
                  <p className="font-bold text-slate-500 text-lg">Bạn muốn tra cứu điều gì?</p>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm">Nhập từ vựng, ngữ pháp, pinyin, tiếng Việt hoặc đặt một câu hỏi cho AI.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}