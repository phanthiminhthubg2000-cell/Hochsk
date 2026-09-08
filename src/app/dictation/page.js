"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import dictationData from "../dictation.json"; 
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateUserProgress } from "../../lib/firebaseUtils";

// Ảnh nền luân phiên cho các Card
const bgImagePool = [
  "/hskk/anh1.jpg", "/hskk/anh2.jpg", "/hskk/anh3.jpg", 
  "/hskk/anh4.jpg", "/hskk/anh5.jpg", "/hskk/anh6.jpg",
  "/hskk/sapxep.jpg", "/hskk/thucchien.jpg", "/hskk/kiemtra.jpg", 
  "/hskk/hskk.jpg", "/hskk/nghechep.jpg", "/hskk/topic.jpg", "/hskk/tuvung.jpg"
];

export default function DictationPage() {
  const { isSignedIn, userId } = useAuth();
  const { user, isLoaded } = useUser();
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  // --- STATES ĐIỀU HƯỚNG ---
  const [step, setStep] = useState("SELECT_CURRICULUM"); 
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [selectedHskLevel, setSelectedHskLevel] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [currentCard, setCurrentCard] = useState(null); 

  // --- STATES NGƯỜI DÙNG & GIAO DIỆN ---
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  
  // STATE ĐỒNG BỘ XP/WATER TOÀN HỆ THỐNG
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [hskXp, setHskXp] = useState(0);
  const [water, setWater] = useState(0);

  // --- STATES AUDIO ROOM ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0); 
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mode, setMode] = useState("dictation"); // 'dictation' | 'shadowing'
  
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [shadowingResult, setShadowingResult] = useState(null);

  const waveformHeights = [4, 6, 8, 4, 12, 16, 24, 20, 12, 8, 16, 32, 40, 24, 16, 8, 12, 20, 36, 48, 56, 40, 24, 16, 20, 32, 24, 12, 8, 16, 24, 12, 8, 4, 8, 4, 6, 4];

  // --- FETCH DATA ---
  useEffect(() => {
    async function syncUserAndFetchData() {
      if (userId) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          let currentXp = 0;
          let currentWater = 0;
          let currentStreak = 0;

          if (userSnap.exists()) {
            const uData = userSnap.data();
            currentXp = uData.xp || 0;
            currentWater = uData.water || 0;
            currentStreak = uData.streak || 0;
            
            if (uData.role === "teacher" || uData.role === "admin" || user?.publicMetadata?.role === "teacher" || user?.publicMetadata?.role === "admin") {
              setIsTeacher(true);
            }
          }

          const studentRef = doc(db, "progress", userId);
          const docSnap = await getDoc(studentRef);
          if (docSnap.exists()) setUserData(docSnap.data());

          const newStudentRef = doc(db, "user_progress", userId);
          const newDocSnap = await getDoc(newStudentRef);
          if (newDocSnap.exists()) {
            const newData = newDocSnap.data();
            if (currentXp === 0) currentXp = newData.profile?.hsk_xp || 0;
            if (currentStreak === 0) currentStreak = newData.profile?.streak_days || 0;
            setHearts(newData.profile?.hearts ?? 5);
          }

          setHskXp(currentXp);
          setWater(currentWater);
          setStreak(currentStreak);

        } catch (error) { console.error("Lỗi:", error); }
      }
      setLoadingUser(false);
    }
    if (isLoaded) syncUserAndFetchData();
  }, [userId, isLoaded, user]);

  // --- LOGIC LỌC BÀI HỌC ---
  const filteredByCurriculum = dictationData.filter(item => {
    const isNew = selectedCurriculum === "newhsk" ? item.audioUrl?.includes("newhsk") : (item.audioUrl?.includes("oldhsk") || !item.audioUrl?.includes("newhsk"));
    const matchesLevel = item.level?.toLowerCase().includes(selectedHskLevel?.toLowerCase());
    return isNew && matchesLevel;
  });

  const lessonsMap = {};
  filteredByCurriculum.forEach(item => {
    const lessonKey = item.lesson ? item.lesson.split("-")[0].trim() : "Bài 1";
    if (!lessonsMap[lessonKey]) lessonsMap[lessonKey] = [];
    lessonsMap[lessonKey].push(item);
  });

  const totalStandardLessons = Object.keys(lessonsMap).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const cardsInLesson = lessonsMap[selectedLesson] || [];
  const currentCardIndex = cardsInLesson.findIndex(c => c.id === currentCard?.id);

  // --- AUDIO CONTROLS ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current && audioRef.current.duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = clickX / rect.width;
      audioRef.current.currentTime = ratio * audioRef.current.duration;
      setAudioProgress(ratio * 100);
    }
  };

  const cycleSpeed = () => {
      if (!audioRef.current) return;
      const nextSpeed = playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 0.75 : 1;
      audioRef.current.playbackRate = nextSpeed;
      setPlaybackRate(nextSpeed);
  };

  // ============================================================
  // HÀM LƯU XP & WATER ĐỒNG BỘ TOÀN HỆ THỐNG
  // ============================================================
  const claimReward = async () => {
    if (!userId) return;
    const bonusXp = 10; // Nghe chép/Nhại thành công +10 XP
    const bonusWater = 2; // +2 Nước
    
    const newXp = hskXp + bonusXp;
    const newWater = water + bonusWater;

    // Cập nhật lên Topbar
    setHskXp(newXp);
    setWater(newWater);

    try {
      // Lưu Firebase
      await setDoc(doc(db, "users", userId), {
        xp: newXp,
        water: newWater
      }, { merge: true });

      await setDoc(doc(db, "progress", userId), { lastActiveDictation: currentCard.id }, { merge: true });
      await updateUserProgress(userId, bonusXp, "listening", 1);
    } catch (error) {
      console.error("Lỗi cập nhật XP:", error);
    }
  };

  // --- CHECK ĐÁP ÁN (DICTATION) ---
  const checkAnswer = async () => {
      if (!currentCard || !userInput.trim()) return;
      const cleanUser = userInput.replace(/[.,!?，。？！\s]/g, "");
      const cleanTarget = currentCard.fullText.replace(/[.,!?，。？！\s]/g, "");

      if (cleanUser === cleanTarget) {
          setIsCorrect(true);
          await claimReward(); // Thưởng điểm
      } else setIsCorrect(false);
  };

  // --- SHADOWING LOGIC (AI NHẬN DIỆN GIỌNG NÓI) ---
  const handleShadowing = () => {
      if (!('webkitSpeechRecognition' in window)) {
        alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome hoặc Cốc Cốc.");
        return;
      }
      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        const cleanUser = transcript.replace(/[.,!?，。？！\s]/g, "");
        const cleanTarget = currentCard.fullText.replace(/[.,!?，。？！\s]/g, "");
        
        let matches = 0;
        for (let char of cleanUser) { if (cleanTarget.includes(char)) matches++; }
        let score = Math.min(100, Math.round((matches / cleanTarget.length) * 100));
        if (cleanUser === cleanTarget || score > 90) score = 100;
  
        setShadowingResult({ transcript, score });
  
        // Lưu tiến độ và điểm nếu đọc đúng
        if (score >= 80) {
          await claimReward();
        }
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
    };

  useEffect(() => {
    setIsPlaying(false); setUserInput(""); setIsCorrect(null); setShowAnswer(false); setAudioProgress(0); setShadowingResult(null); setIsRecording(false);
  }, [currentCard, mode]);

  if (loadingUser) return <div className="min-h-screen bg-[#F4F7F6]"></div>;

  return (
    <div className="flex min-h-screen font-sans text-slate-800 relative selection:bg-[#8FD9A8]/50">
      
      {/* BACKGROUND MỜ DỊU NHẸ CHUẨN APP */}
      <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30" style={{ backgroundImage: "url('/hskk/nghechep.jpg')" }}>
        <div className="absolute inset-0 bg-[#F4F7F6]/90 backdrop-blur-[4px]"></div>
      </div>

      {/* ==========================================
          SIDEBAR ĐỒNG BỘ 
          ========================================== */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300 md:flex ${isSidebarCollapsed ? "w-[76px]" : "w-[240px]"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center px-4 py-6 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#2F8F6E] text-xl text-white shadow-sm">🐸</div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-black tracking-tight text-[#1B5E4B]">Hành Trình HSK</h2>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-[#2F8F6E]">Khu vườn học tập</p>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
            <Link href="/" className="mb-2 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🏠</span>{!isSidebarCollapsed && <span>Trang chủ</span>}</Link>
            <Link href="/test" className="mb-6 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎯</span>{!isSidebarCollapsed && <span>Kiểm tra năng lực</span>}</Link>

            <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-[#2F8F6E]/60">{!isSidebarCollapsed ? "Góc Học Tập" : "•"}</div>
            <Link href="/vocab" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">📚</span>{!isSidebarCollapsed && <span>Từ vựng</span>}</Link>
            <Link href="/topic" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">💡</span>{!isSidebarCollapsed && <span>Theo chủ đề</span>}</Link>
            <Link href="/arrange" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🧩</span>{!isSidebarCollapsed && <span>Ngữ pháp</span>}</Link>
            <Link href="/dictation" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#1B5E4B] bg-[#8FD9A8]/30 shadow-sm border border-[#8FD9A8]/50"><span className="w-6 text-center text-lg">🎧</span>{!isSidebarCollapsed && <span>Nghe chép</span>}</Link>
            <Link href="/translate" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">✍️</span>{!isSidebarCollapsed && <span>Dịch câu</span>}</Link>
            <Link href="/hskk" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎤</span>{!isSidebarCollapsed && <span>Cuộc chiến khẩu ngữ</span>}</Link>
            <Link href="/roleplay" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎬</span>{!isSidebarCollapsed && <span>Phim trường</span>}</Link>

            {isTeacher && (
              <div className="mt-6 mb-2 border-t border-[#E2E8F0] pt-4">
                <p className="px-3 mb-3 text-[10px] font-black uppercase tracking-widest text-[#FFD666]">{!isSidebarCollapsed ? "Hệ thống" : "•"}</p>
                <Link href="/teacher" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#1B5E4B] bg-[#FFD666]/20 hover:bg-[#FFD666]/40 transition-all shadow-sm">
                  <span className="w-6 text-center text-lg">🛡️</span>{!isSidebarCollapsed && <span>Trang Quản Lý</span>}
                </Link>
              </div>
            )}
          </nav>

          <div className="border-t border-[#E2E8F0] p-4">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="mb-3 flex w-full items-center justify-center rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors shadow-sm">
              {isSidebarCollapsed ? "→" : "← Thu gọn"}
            </button>
            {isSignedIn ? (
              <div className={`flex items-center rounded-2xl bg-white border border-[#E2E8F0] shadow-sm p-2.5 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
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
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B5E4B] py-3 text-xs font-bold text-white hover:bg-[#2F8F6E] shadow-md transition-all">👤 {!isSidebarCollapsed && "Đăng nhập"}</button>
              </SignInButton>
            )}
          </div>
        </div>
      </aside>

      {/* ======================================================
          MAIN CONTENT
          ====================================================== */}
      <main className={`min-h-screen transition-all duration-300 relative z-10 w-full flex flex-col ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        
        {/* TOP BAR ĐỒNG BỘ NƯỚC - LỬA - XP */}
        <header className="sticky top-0 z-30 h-[76px] border-b border-[#E2E8F0] bg-white/80 px-6 backdrop-blur-xl flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            {step !== "SELECT_CURRICULUM" && (
              <button onClick={() => setStep(step === "DO_DICTATION" ? "SELECT_LESSON" : step === "SELECT_LESSON" ? "SELECT_HSK_LEVEL" : "SELECT_CURRICULUM")} className="text-slate-500 hover:text-[#2F8F6E] transition flex items-center gap-2 font-bold text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
                ← <span className="hidden sm:inline">Quay lại</span>
              </button>
            )}
            {step === "DO_DICTATION" ? (
              <div className="flex items-center gap-2 text-sm font-bold bg-[#F4F7F6] px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                <span className="text-[#2F8F6E] hidden sm:inline">{selectedHskLevel}</span>
                <span className="text-slate-300 hidden sm:inline">/</span>
                <span className="text-[#2F8F6E]">{selectedLesson}</span>
                <span className="text-slate-300">/</span>
                <span className="text-[#1B5E4B]">Câu {currentCardIndex + 1}</span>
              </div>
            ) : (
              <h2 className="font-black text-[#1B5E4B] text-lg hidden sm:block tracking-tight">Phòng Nghe Chép (Audio Room)</h2>
            )}
          </div>
          
          <div className="flex items-center gap-3 pl-4">
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-white shadow-sm border border-slate-100 px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">☀️</span><span className="text-xs font-black text-[#FFD666] drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">{streak}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#4FB6C7]/10 shadow-sm border border-[#4FB6C7]/30 px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">💧</span><span className="text-xs font-black text-[#4FB6C7] drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]">{water}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFD666]/20 border border-[#FFD666]/50 shadow-sm px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">⭐</span><span className="text-xs font-black text-[#1B5E4B]">{hskXp.toLocaleString()} XP</span>
            </div>
          </div>
        </header>

        {/* Nội dung Content */}
        <div className="flex-1 p-6 md:p-8 max-w-[1200px] mx-auto w-full">
          
          {/* =========================================
              STEP 1: CHỌN GIÁO TRÌNH
              ========================================= */}
          {step === "SELECT_CURRICULUM" && (
            <div className="animate-fade-in mt-6">
              <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-black text-[#1B5E4B] tracking-tight mb-4 drop-shadow-sm">Luyện Nghe Chép Chính Tả</h1>
                <p className="text-[#2F8F6E] font-medium text-sm">Rèn luyện phản xạ đôi tai và củng cố trí nhớ từ vựng với các bài nghe chuẩn HSK.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <div onClick={() => { setSelectedCurriculum("newhsk"); setStep("SELECT_HSK_LEVEL"); }} className="relative bg-white/60 backdrop-blur-xl border border-[#E2E8F0] hover:border-[#8FD9A8] p-8 md:p-10 rounded-[40px] shadow-sm hover:shadow-xl hover:-translate-y-2 cursor-pointer transition-all group overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/hskk/tuvung.jpg')" }}>
                  <div className="absolute inset-0 bg-white/90 group-hover:bg-white/80 transition-all z-0"></div>
                  <div className="absolute top-0 right-0 bg-[#2F8F6E] text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider shadow-sm z-10">Khuyên dùng</div>
                  <div className="relative z-10 flex flex-col items-center text-center h-full">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm border border-[#E2E8F0] group-hover:scale-110 transition-transform">📚</div>
                    <h3 className="text-2xl font-black text-[#1B5E4B] mb-3 group-hover:text-[#2F8F6E] transition-colors">HSK 3.0 (Chuẩn mới)</h3>
                    <p className="text-sm text-slate-500 mb-8 font-medium">Giáo trình cập nhật nhất, bám sát cấu trúc đề thi thực tế và từ vựng thông dụng hiện nay.</p>
                    <span className="mt-auto text-sm font-bold text-[#2F8F6E] bg-white px-6 py-3 rounded-2xl shadow-sm border border-[#E2E8F0] w-full transition-colors group-hover:border-[#8FD9A8]">Chọn giáo trình →</span>
                  </div>
                </div>

                <div onClick={() => { setSelectedCurriculum("oldhsk"); setStep("SELECT_HSK_LEVEL"); }} className="relative bg-white/60 backdrop-blur-xl border border-[#E2E8F0] hover:border-[#FFD666] p-8 md:p-10 rounded-[40px] shadow-sm hover:shadow-xl hover:-translate-y-2 cursor-pointer transition-all group overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/hskk/topic.jpg')" }}>
                  <div className="absolute inset-0 bg-white/90 group-hover:bg-white/80 transition-all z-0"></div>
                  <div className="relative z-10 flex flex-col items-center text-center h-full">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm border border-[#E2E8F0] group-hover:scale-110 transition-transform">📖</div>
                    <h3 className="text-2xl font-black text-[#1B5E4B] mb-3 group-hover:text-[#F59E0B] transition-colors">HSK 2.0 (Cũ)</h3>
                    <p className="text-sm text-slate-500 mb-8 font-medium">Hệ thống giáo trình truyền thống, quen thuộc để luyện tập bổ trợ.</p>
                    <span className="mt-auto text-sm font-bold text-[#F59E0B] bg-white px-6 py-3 rounded-2xl shadow-sm border border-[#E2E8F0] w-full transition-colors group-hover:border-[#FFD666]">Chọn giáo trình →</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              STEP 2: CHỌN CẤP ĐỘ
              ========================================= */}
          {step === "SELECT_HSK_LEVEL" && (
            <div className="max-w-4xl mx-auto animate-fade-in mt-4">
              <h2 className="text-3xl font-black text-[#1B5E4B] mb-8 text-center tracking-tight">Chọn Trình Độ</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"].map((lvl, index) => {
                  const hasData = dictationData.filter(d => (selectedCurriculum === "newhsk" ? d.audioUrl?.includes("newhsk") : (d.audioUrl?.includes("oldhsk") || !d.audioUrl?.includes("newhsk"))) && d.level?.toLowerCase().includes(lvl.toLowerCase())).length > 0;
                  return (
                    <div key={lvl} onClick={() => { if (hasData) { setSelectedHskLevel(lvl); setStep("SELECT_LESSON"); } }} className={`relative bg-white/60 backdrop-blur-xl border-2 rounded-[32px] p-6 text-center transition-all duration-300 overflow-hidden bg-cover bg-center group ${hasData ? "border-white hover:border-[#8FD9A8] hover:shadow-xl hover:-translate-y-1 cursor-pointer" : "border-transparent opacity-60 cursor-not-allowed"}`} style={{ backgroundImage: `url('/hskk/anh${index + 1}.jpg')` }}>
                      <div className="absolute inset-0 bg-[#EEF5E9]/90 group-hover:bg-[#EEF5E9]/80 transition-all z-0"></div>
                      <div className="relative z-10 flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-2xl mb-4 shadow-sm border ${hasData ? 'bg-white text-[#2F8F6E] border-[#8FD9A8]' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{hasData ? '🎓' : '🔒'}</div>
                        <h3 className={`text-2xl font-black mb-1 ${hasData ? 'text-[#1B5E4B] group-hover:text-[#2F8F6E]' : 'text-slate-400'}`}>{lvl}</h3>
                        <span className={`text-[9px] font-bold uppercase tracking-widest mt-2 px-3 py-1.5 rounded-lg border ${hasData ? 'text-[#1B5E4B] bg-[#8FD9A8]/30 border-[#8FD9A8]/50 shadow-sm' : 'text-slate-500 bg-slate-200 border-slate-300'}`}>{hasData ? "Khả dụng" : "Sắp ra mắt"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================
              STEP 3: CHỌN BÀI HỌC (COMPACT LIST)
              ========================================= */}
          {step === "SELECT_LESSON" && (
            <div className="max-w-3xl mx-auto animate-fade-in mt-4">
              <h2 className="text-3xl font-black text-[#1B5E4B] mb-8 text-center tracking-tight">Danh sách bài học</h2>
              <div className="flex flex-col gap-4 pb-10">
                {totalStandardLessons.map((lessonName, index) => {
                  const lessonCards = lessonsMap[lessonName] || [];
                  const hasData = lessonCards.length > 0;
                  const progress = 0; 

                  return (
                    <div key={lessonName} onClick={() => { if (hasData) { setSelectedLesson(lessonName); setCurrentCard(lessonCards[0]); setStep("DO_DICTATION"); } }} className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all bg-white/80 backdrop-blur-md shadow-sm ${hasData ? "border-white hover:border-[#8FD9A8] hover:shadow-md cursor-pointer" : "border-slate-50 opacity-60 cursor-not-allowed"}`}>
                      <div className="flex items-center gap-5">
                        <span className={`text-3xl font-black ${hasData ? 'text-[#1B5E4B]' : 'text-slate-300'}`}>{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <h3 className="font-black text-slate-800 text-lg mb-1">{lessonName}</h3>
                          {hasData ? (
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-1.5 bg-[#EEF5E9] rounded-full overflow-hidden border border-[#E2E8F0]">
                                <div className="h-full bg-[#2F8F6E]" style={{ width: `${progress}%` }}></div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{progress}%</span>
                            </div>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chưa mở khóa</p>
                          )}
                        </div>
                      </div>
                      {hasData && (
                        <div className="text-xs font-bold text-[#1B5E4B] bg-[#F4F7F6] px-3 py-1.5 rounded-lg border border-[#E2E8F0] shadow-sm">
                          {lessonCards.length} Track
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================
              STEP 4: GIAO DIỆN LÀM BÀI 2 CỘT NHƯ MONG MUỐN + SHADOWING
              ========================================= */}
          {step === "DO_DICTATION" && currentCard && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start transition-all duration-500 pb-10">
              
              {/* CỘT TRÁI: LÀM BÀI CHÍNH (8 cols) */}
              <div className="lg:col-span-8 w-full">
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 md:p-10 shadow-lg border border-white relative overflow-hidden flex flex-col min-h-[600px]">
                  
                  {/* Header "Nghe & Viết" / "Đọc nhại" */}
                  <div className="flex justify-between items-start mb-8 shrink-0">
                     <div>
                        <div className="flex items-center gap-4 mb-2">
                           <div className="w-14 h-14 bg-[#EEF5E9] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-3xl shadow-inner border border-[#8FD9A8]">🎧</div>
                           <h2 className="text-3xl font-black text-[#1B5E4B] tracking-tight">Nghe & {mode === 'dictation' ? 'Viết' : 'Nhại'}</h2>
                        </div>
                        <p className="text-slate-500 text-sm font-medium ml-[72px]">
                          {mode === 'dictation' ? 'Nghe đoạn âm thanh và gõ lại tiếng Trung. Cố gắng viết chính xác nhé!' : 'Nghe và ghi âm đọc lại theo đúng tốc độ và ngữ điệu để AI chấm điểm.'}
                        </p>
                     </div>
                     <div className="hidden sm:flex flex-col items-center rotate-3 opacity-90">
                        <span className="text-[#2F8F6E] font-black text-sm italic tracking-widest">加油！</span>
                        <div className="text-6xl drop-shadow-sm mt-1">🐸</div>
                     </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-10 shrink-0">
                     <div className="flex justify-between items-end mb-3">
                        <h3 className="font-black text-[#1B5E4B] text-lg">Bài khóa {currentCardIndex + 1} / {cardsInLesson.length}</h3>
                        <span className="font-black text-[#2F8F6E] text-lg">{Math.round(((currentCardIndex + 1)/cardsInLesson.length)*100)}%</span>
                     </div>
                     <div className="w-full h-3 bg-[#EEF5E9] rounded-full overflow-hidden border border-[#E2E8F0]/50 shadow-inner">
                        <div className="h-full bg-[#2F8F6E] rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(47,143,110,0.5)]" style={{width: `${((currentCardIndex + 1) / cardsInLesson.length) * 100}%`}}></div>
                     </div>
                  </div>

                  {/* Audio Player Nhỏ Gọn Sáng Sủa */}
                  <div className="bg-[#F4F7F6] rounded-[24px] p-4 flex items-center gap-4 md:gap-6 border border-slate-100 shadow-sm mb-6 relative shrink-0">
                     <audio 
                       ref={audioRef} src={currentCard.audioUrl} className="hidden" 
                       onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)}
                       onTimeUpdate={handleTimeUpdate}
                     />
                     <button onClick={togglePlay} className="w-14 h-14 shrink-0 bg-[#1B5E4B] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 hover:bg-[#2F8F6E] transition-all z-10 border border-[#0F3F31]">
                        {isPlaying ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z"/></svg>}
                     </button>
                     
                     <div className="flex flex-col gap-2 relative z-10">
                       <button onClick={cycleSpeed} className="bg-white border border-slate-200 px-2 py-1 rounded text-[10px] font-bold text-[#1B5E4B] hover:text-[#2F8F6E] hover:border-[#8FD9A8] transition-colors shadow-sm">
                         ⚡ {playbackRate}x
                       </button>
                     </div>
                     
                     {/* Interactive Waveform */}
                     <div className="flex-1 flex items-center gap-[3px] h-12 overflow-hidden cursor-pointer relative z-10" onClick={handleSeek}>
                         {waveformHeights.map((h, i) => {
                             const barProgress = (i / waveformHeights.length) * 100;
                             const isPlayed = audioProgress > barProgress;
                             return (
                               <div key={i} className={`w-1.5 rounded-full transition-all ${isPlayed ? 'bg-[#2F8F6E]' : 'bg-[#8FD9A8]/40'}`} style={{height: `${isPlaying ? h : Math.max(6, h / 2)}px`, animationDelay: `${i * 0.05}s`}}></div>
                             )
                         })}
                     </div>
                     <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 px-2">
                         <span className="text-xs font-bold text-[#2F8F6E] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Đang phát
                         </span>
                     </div>
                  </div>

                  {/* Tabs chuyển đổi Mode */}
                  <div className="flex justify-center mb-6 shrink-0">
                     <div className="bg-[#F4F7F6] p-1 rounded-xl flex gap-1 border border-[#E2E8F0] shadow-sm">
                       <button onClick={() => { setMode("dictation"); setIsCorrect(null); setShowAnswer(false); setShadowingResult(null); }} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${mode === "dictation" ? 'bg-white text-[#2F8F6E] shadow-sm border border-[#8FD9A8]' : 'text-slate-400 hover:text-[#1B5E4B]'}`}>✍️ Gõ chính tả</button>
                       <button onClick={() => { setMode("shadowing"); setIsCorrect(null); setShowAnswer(false); setShadowingResult(null); }} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${mode === "shadowing" ? 'bg-white text-[#2F8F6E] shadow-sm border border-[#8FD9A8]' : 'text-slate-400 hover:text-[#1B5E4B]'}`}>🗣️ Shadowing</button>
                     </div>
                  </div>

                  {/* ==================================
                      MODE 1: DICTATION 
                      ================================== */}
                  {mode === 'dictation' && (
                    <div className="flex flex-col flex-1 animate-fade-in">
                      {/* Tip Box */}
                      <div className="bg-white border border-[#FFD666] rounded-xl py-3 px-6 text-center mb-6 shadow-sm shrink-0 relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#FFD666]/30 to-transparent rounded-bl-full pointer-events-none"></div>
                         <p className="text-xs font-bold text-[#1B5E4B] relative z-10"><span className="text-amber-500 text-sm">💡</span> Mẹo: Nghe kỹ và click vào sóng âm để tua lại khi cần. Chú ý các từ dễ nhầm nhé!</p>
                      </div>

                      {/* Khu Vực Nhập Đáp Án */}
                      <div className="relative mb-6 flex-1 min-h-[120px]">
                         <textarea 
                           ref={inputRef} rows="4" placeholder="Nghe và gõ lại tiếng Trung..." value={userInput}
                           onChange={(e) => { setUserInput(e.target.value); setIsCorrect(null); setShowAnswer(false); }}
                           onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey && userInput.trim() && isCorrect !== true) checkAnswer(); }}
                           className={`w-full h-full bg-white border-2 text-[#1B5E4B] font-bold text-xl md:text-2xl rounded-[24px] p-6 outline-none transition-all resize-none shadow-sm placeholder:text-slate-300 placeholder:font-medium ${isCorrect === true ? 'border-[#8FD9A8] bg-[#EEF5E9]/50 text-[#2F8F6E]' : isCorrect === false ? 'border-[#FECDD3] bg-[#FFF1F2]/50 text-[#BE123C]' : 'border-[#E2E8F0] focus:border-[#2F8F6E] focus:ring-4 focus:ring-[#8FD9A8]/20'}`}
                           disabled={isCorrect === true}
                         ></textarea>
                         <div className="absolute bottom-4 right-4 text-slate-300 text-xl pointer-events-none opacity-50">⌨️</div>
                      </div>

                      {/* Helpers */}
                      <div className="flex justify-between items-center mb-6 px-2 shrink-0">
                         <div className="text-[11px] text-slate-400 font-medium">Nhấn <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold">Ctrl</kbd> + <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold">Enter</kbd> để kiểm tra</div>
                         <div className="text-xs font-bold text-slate-400">{userInput.length} / 100</div>
                      </div>

                      {/* Feedback Box xuất hiện khi Submit */}
                      {isCorrect === false && (
                        <div className="mb-6 p-5 bg-[#FFF1F2] border border-[#FECDD3] rounded-2xl animate-fade-in shrink-0 shadow-sm">
                          <h4 className="font-black text-[#BE123C] text-sm mb-1 flex items-center gap-2"><span>💦</span> Gần đúng rồi, hãy nghe lại nhé!</h4>
                          {showAnswer && <div className="mt-3 bg-white p-4 rounded-xl border border-[#FECDD3] shadow-inner"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Đáp án</span><span className="text-lg font-black text-[#1B5E4B]">{currentCard.fullText}</span></div>}
                        </div>
                      )}

                      {isCorrect === true && (
                        <div className="mb-6 p-5 bg-[#EEF5E9] border border-[#8FD9A8]/50 rounded-2xl flex items-center gap-4 animate-fade-in shrink-0 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#8FD9A8]/30 to-transparent rounded-bl-full pointer-events-none"></div>
                          <div className="text-4xl drop-shadow-sm z-10">🏆</div>
                          <div className="z-10">
                            <h4 className="font-black text-[#1B5E4B] text-base mb-0.5">Tuyệt vời! Chính xác 100%</h4>
                            <p className="text-xs font-bold text-[#2F8F6E]">Đáp án: {currentCard.fullText}</p>
                            <p className="text-[10px] font-black text-[#F2765B] mt-1 bg-white px-2 py-0.5 rounded inline-block border border-white shadow-sm">+10 XP, +2 💧</p>
                          </div>
                        </div>
                      )}

                      {/* Nút Action */}
                      <div className="flex gap-4 shrink-0 mt-auto">
                         {!isCorrect && (
                           <button onClick={() => setShowAnswer(!showAnswer)} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-sm hover:border-[#8FD9A8] hover:text-[#1B5E4B] hover:bg-[#F4F7F6] transition-all shadow-sm">
                             {showAnswer ? "🙈 Ẩn đáp án" : "👁 Xem đáp án"}
                           </button>
                         )}
                         
                         {isCorrect !== true ? (
                           <button onClick={checkAnswer} disabled={!userInput.trim()} className="flex-1 py-4 bg-[#1B5E4B] text-white rounded-2xl font-black text-sm hover:bg-[#2F8F6E] hover:-translate-y-0.5 transition-all shadow-md disabled:opacity-50 disabled:hover:translate-y-0 uppercase tracking-widest border-b-[4px] border-[#0F3F31]">
                             Kiểm tra đáp án →
                           </button>
                         ) : (
                           <button onClick={() => { const nextIdx = currentCardIndex + 1; if (nextIdx < cardsInLesson.length) { setCurrentCard(cardsInLesson[nextIdx]); } else { setStep("SELECT_LESSON"); } }} className="w-full py-4.5 bg-[#2F8F6E] text-white rounded-2xl font-black text-sm hover:bg-[#1B5E4B] hover:-translate-y-0.5 transition-all shadow-xl uppercase tracking-widest border-b-[4px] border-[#0F3F31]">
                             {currentCardIndex + 1 < cardsInLesson.length ? "Câu tiếp theo →" : "Hoàn thành bài học 🎉"}
                           </button>
                         )}
                      </div>
                    </div>
                  )}

                  {/* ==================================
                      MODE 2: SHADOWING
                      ================================== */}
                  {mode === 'shadowing' && (
                    <div className="flex flex-col flex-1 animate-fade-in text-center items-center justify-center py-6">
                      {!shadowingResult ? (
                        <>
                          <button onMouseDown={handleShadowing} onMouseUp={() => {}} className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl shadow-2xl transition-all border-4 relative ${isRecording ? 'bg-[#BE123C] border-[#FECDD3] text-white scale-110 shadow-rose-500/30' : 'bg-white border-slate-100 text-[#1B5E4B] hover:border-[#8FD9A8] hover:scale-105'}`}>
                            {isRecording && <div className="absolute inset-0 border-4 border-[#F2765B] rounded-full animate-ping opacity-50"></div>}
                            🎙️
                          </button>
                          <p className={`mt-8 font-black tracking-widest uppercase text-sm ${isRecording ? 'text-[#BE123C] animate-pulse' : 'text-slate-400'}`}>{isRecording ? "Đang lắng nghe..." : "Nhấn giữ để đọc"}</p>
                          <p className="text-slate-500 text-sm mt-3 font-medium max-w-sm">Nghe câu mẫu ở phía trên, sau đó nhấn giữ nút thu âm và đọc lại để AI chấm điểm phát âm.</p>
                        </>
                      ) : (
                        <div className="w-full animate-slide-up-fade flex flex-col items-center flex-1 justify-center">
                          <div className="relative mb-6">
                            <svg className="w-40 h-40 transform -rotate-90">
                              <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                              <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={2 * Math.PI * 70} strokeDashoffset={(2 * Math.PI * 70) * (1 - shadowingResult.score / 100)} className={`${shadowingResult.score >= 80 ? 'text-[#08A66A]' : shadowingResult.score >= 50 ? 'text-[#F59E0B]' : 'text-[#BE123C]'} transition-all duration-1000 ease-out`} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-3xl font-black text-slate-800">{shadowingResult.score}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm</span>
                            </div>
                          </div>

                          {shadowingResult.score >= 80 && (
                            <p className="text-[10px] font-black text-[#F2765B] bg-[#FFF1F2] px-3 py-1 rounded-lg border border-[#FECDD3] shadow-sm mb-4">+10 XP, +2 💧</p>
                          )}

                          <div className="w-full bg-[#F4F7F6] p-6 rounded-3xl border border-[#E2E8F0] shadow-sm text-left mb-8 max-w-md">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mẫu (Target)</p>
                            <p className="text-lg font-black text-[#1B5E4B] mb-4">{currentCard.fullText}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bạn đọc (You)</p>
                            <p className={`text-base font-bold ${shadowingResult.score >= 80 ? 'text-[#2F8F6E]' : 'text-[#BE123C]'}`}>{shadowingResult.transcript || "Không nhận diện được giọng nói"}</p>
                          </div>

                          <div className="flex gap-4 w-full max-w-md mt-auto">
                            <button onClick={() => setShadowingResult(null)} className="flex-1 py-4.5 bg-white border-2 border-slate-200 text-slate-600 font-black text-sm rounded-2xl hover:bg-[#F4F7F6] hover:border-[#8FD9A8] transition-colors shadow-sm">Thử lại</button>
                            {shadowingResult.score >= 80 && (
                              <button onClick={() => { const nextIdx = currentCardIndex + 1; if (nextIdx < cardsInLesson.length) { setCurrentCard(cardsInLesson[nextIdx]); } else { setStep("SELECT_LESSON"); } }} className="flex-1 py-4.5 bg-[#1B5E4B] text-white rounded-2xl font-black text-sm hover:bg-[#2F8F6E] transition-all shadow-xl border-b-[4px] border-[#0F3F31]">
                                Tiếp theo →
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* CỘT PHẢI: PLAYLIST BÀI HỌC (4 cols) */}
              <div className="lg:col-span-4 w-full">
                 <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white sticky top-[104px]">
                    
                    {/* Header Sidebar */}
                    <div className="flex items-center justify-between mb-6 border-b border-[#F4F7F6] pb-4">
                       <h3 className="text-lg font-black text-[#1B5E4B] flex items-center gap-2">
                          <span className="text-2xl">📖</span> Bài học
                       </h3>
                       <span className="bg-[#EEF5E9] text-[#2F8F6E] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-[#8FD9A8]/50">{selectedHskLevel}</span>
                    </div>
                    
                    <p className="font-bold text-sm text-slate-500 mb-5">{selectedLesson}</p>
                    
                    {/* List Câu Hỏi */}
                    <div className="space-y-2 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                       {cardsInLesson.map((card, idx) => {
                          const isActive = currentCard?.id === card.id;
                          return (
                            <div key={card.id} onClick={() => setCurrentCard(card)} className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-colors group border-2 ${isActive ? 'bg-[#EEF5E9] border-[#8FD9A8]/50 shadow-sm' : 'bg-white border-transparent hover:border-[#8FD9A8]/30 hover:bg-[#F4F7F6]'}`}>
                               <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center font-black text-xs border ${isActive ? 'bg-white text-[#2F8F6E] shadow-sm border-[#8FD9A8]' : 'bg-[#F4F7F6] text-slate-400 border-[#E2E8F0]'}`}>
                                     {idx + 1}
                                  </div>
                                  <span className={`font-bold text-sm flex items-center gap-1.5 ${isActive ? 'text-[#1B5E4B]' : 'text-slate-500 group-hover:text-slate-700'}`}>
                                     {isActive && <span className="text-[10px] text-[#F2765B] animate-pulse">▶</span>} Bài khóa {idx + 1}
                                  </span>
                               </div>
                               {isActive ? (
                                  <div className="w-4 h-4 rounded-full border-[4px] border-[#2F8F6E]"></div>
                               ) : (
                                  <div className="text-slate-300 text-xs">📝</div>
                               )}
                            </div>
                          );
                       })}
                    </div>

                    {/* Quote */}
                    <div className="bg-[#FFF8E8] p-6 rounded-[24px] border border-[#FFD666]/40 text-center relative mt-auto shadow-inner">
                       <span className="absolute top-2 left-3 text-5xl text-[#FFD666]/50 font-serif leading-none">“</span>
                       <p className="text-[#1B5E4B] font-black text-lg mb-1 relative z-10 pt-2 tracking-widest">积少成多，</p>
                       <p className="text-[#2F8F6E] font-bold text-sm mb-3 relative z-10 tracking-widest">坚持就是胜利。</p>
                       <p className="text-xs text-slate-400 font-medium italic relative z-10">— 加油！ —</p>
                    </div>
                 </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}