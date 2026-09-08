"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser, useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateUserProgress, logUserError } from "../../lib/firebaseUtils";
import sentencesData from "../sentences.json";

const HSK_LEVELS = ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"];

// --- HÀM HỖ TRỢ ---
const shuffleArray = (array) => [...array].sort(() => 0.5 - Math.random());
const getRandomItems = (arr, n) => shuffleArray(arr).slice(0, n);

// Thuật toán cắt từ thông minh (Word Chunking)
const segmentWords = (text) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    return [...segmenter.segment(text)]
      .map(s => s.segment)
      .filter(s => !/^[.,?!。，？！、\s]+$/.test(s)); // Bỏ qua dấu câu
  }
  return text.replace(/[.!?。，？！、\s]/g, '').split(''); // Fallback
};

export default function ArrangePage() {
  const { user, isLoaded } = useUser();
  const { userId, isSignedIn } = useAuth();

  // GLOBAL STATES (Đồng bộ hệ thống)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [hskXp, setHskXp] = useState(0);
  const [water, setWater] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(5); // Sẽ được reset về 5 mỗi lượt chơi

  // Cấu hình Game
  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [phase, setPhase] = useState("start"); // start, playing, result
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Trạng thái câu hiện tại
  const [availableWords, setAvailableWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [feedback, setFeedback] = useState(null); // 'correct', 'incorrect', null
  const [showAnswer, setShowAnswer] = useState(false);

  // Gamification & Kết quả
  const [score, setScore] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [earnedWater, setEarnedWater] = useState(0);

  // --- FETCH DỮ LIỆU GLOBAL TỪ FIREBASE ---
  useEffect(() => {
    async function fetchGlobalData() {
      if (userId) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          let currentXp = 0;
          let currentWater = 0;
          let currentStreak = 0;

          if (userSnap.exists()) {
            const data = userSnap.data();
            currentXp = data.xp || 0;
            currentWater = data.water || 0;
            currentStreak = data.streak || 0;

            if (data.role === "teacher" || data.role === "admin" || user?.publicMetadata?.role === "teacher" || user?.publicMetadata?.role === "admin") {
              setIsTeacher(true);
            }
          }

          const newStudentRef = doc(db, "user_progress", userId);
          const newDocSnap = await getDoc(newStudentRef);
          if (newDocSnap.exists()) {
            const newData = newDocSnap.data();
            if (currentXp === 0) currentXp = newData.profile?.hsk_xp || 0;
            if (currentStreak === 0) currentStreak = newData.profile?.streak_days || 0;
          }

          setHskXp(currentXp);
          setWater(currentWater);
          setStreak(currentStreak);

        } catch (error) { console.error("Lỗi đồng bộ dữ liệu:", error); }
      }
    }
    if (isLoaded) fetchGlobalData();
  }, [userId, isLoaded, user]);

  // TEXT TO SPEECH
  const speak = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };

  // KHỞI TẠO LƯỢT CHƠI
  const startGame = () => {
    const targetLvl = selectedHsk.replace(/\s+/g, '').toUpperCase();
    const levelData = sentencesData.filter(item => item.level && item.level.replace(/\s+/g, '').toUpperCase() === targetLvl);

    if (levelData.length === 0) {
      alert(`Chưa có dữ liệu cho ${selectedHsk}`);
      return;
    }

    const sessionQuestions = getRandomItems(levelData, Math.min(10, levelData.length));
    setQuestions(sessionQuestions);
    setCurrentIndex(0);
    setHearts(5); // Reset tim mỗi ván chơi
    setScore(0);
    setPhase("playing");
    loadQuestion(sessionQuestions[0]);
  };

  // TẢI CÂU HỎI MỚI
  const loadQuestion = (questionObj) => {
    const text = questionObj.chinese || questionObj.front || "";
    const words = segmentWords(text);
    setAvailableWords(shuffleArray([...words]).map((text, i) => ({ id: i, text })));
    setSelectedWords([]);
    setFeedback(null);
    setShowAnswer(false);
  };

  // XỬ LÝ CHỌN/BỎ CHỌN TỪ
  const handleSelectWord = (word) => {
    if (feedback === 'correct') return; 
    setAvailableWords(prev => prev.filter(w => w.id !== word.id));
    setSelectedWords(prev => [...prev, word]);
    setFeedback(null);
  };

  const handleDeselectWord = (word) => {
    if (feedback === 'correct') return;
    setSelectedWords(prev => prev.filter(w => w.id !== word.id));
    setAvailableWords(prev => [...prev, word]);
    setFeedback(null);
  };

  const handleClearAll = () => {
    if (feedback === 'correct') return;
    setAvailableWords(prev => [...prev, ...selectedWords]);
    setSelectedWords([]);
    setFeedback(null);
  };

  // KIỂM TRA ĐÁP ÁN
  const checkAnswer = async () => { 
    if (selectedWords.length === 0) return;
    
    const currentQ = questions[currentIndex];
    const correctAns = (currentQ.chinese || currentQ.front || "").replace(/[.!?。，？！、\s]/g, '');
    const userAns = selectedWords.map(w => w.text).join('');
    
    if (userAns === correctAns) {
        setFeedback("correct");
        setScore(prev => prev + 1);
        setShowAnswer(false);
        speak(correctAns);
    } else {
        setFeedback("incorrect");
        setHearts(prev => prev - 1);
        
        if (user) {
          await logUserError(user.id, "arrange_grammar_error");
        }

        if (hearts - 1 <= 0) {
          setTimeout(() => endGame(score), 1000);
        }
    }
  };

  // CHUYỂN CÂU TIẾP THEO
  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length || hearts <= 0) {
      endGame(score);
    } else {
      setCurrentIndex(prev => prev + 1);
      loadQuestion(questions[currentIndex + 1]);
    }
  };

  // ============================================================
  // KẾT THÚC GAME & CỘNG ĐIỂM ĐỒNG BỘ TOÀN HỆ THỐNG
  // ============================================================
  const endGame = async (finalScore) => {
    setPhase("result");
    const xp = finalScore * 15; // 15 XP cho 1 câu đúng
    const bonusWater = Math.floor(finalScore / 2); // 2 câu đúng = 1 giọt nước
    
    setEarnedXp(xp);
    setEarnedWater(bonusWater);

    if (userId && xp > 0) {
      const newXp = hskXp + xp;
      const newWater = water + bonusWater;

      // Cập nhật giao diện lập tức
      setHskXp(newXp);
      setWater(newWater);

      try {
        // Lưu thẳng vào Users Collection
        await setDoc(doc(db, "users", userId), {
          xp: newXp,
          water: newWater
        }, { merge: true });

        await updateUserProgress(userId, xp, "grammar", finalScore);
      } catch (error) {
        console.error("Lỗi đồng bộ XP/Water:", error);
      }
    }
  };

  const progressPercent = questions.length > 0 ? (currentIndex / questions.length) * 100 : 0;

  return (
    <div className="flex min-h-screen bg-[#EEF5E9] font-sans text-[#1B5E4B] selection:bg-[#8FD9A8]/50">
      
      {/* BACKGROUND */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-40 pointer-events-none" style={{ backgroundImage: "url('/hskk/sapxep.jpg')" }}>
        <div className="absolute inset-0 bg-[#F4F7F6]/90 backdrop-blur-[4px]"></div>
      </div>

      {/* ==========================================
          SIDEBAR ĐỒNG BỘ ẾCH XANH
          ========================================== */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E2E8F0] bg-white/80 backdrop-blur-2xl transition-all duration-300 md:flex ${isSidebarCollapsed ? "w-[76px]" : "w-[240px]"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center px-4 py-6 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#2F8F6E] text-xl text-white shadow-sm">🐸</div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-black text-[#1B5E4B] tracking-tight">Khu Vườn HSK</h2>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-[#2F8F6E]">Hành trình của bạn</p>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
            <Link href="/" className="mb-2 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🏠</span>{!isSidebarCollapsed && <span>Trang chủ</span>}</Link>
            <Link href="/test" className="mb-6 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎯</span>{!isSidebarCollapsed && <span>Kiểm tra năng lực</span>}</Link>

            <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-[#2F8F6E]/60">{!isSidebarCollapsed ? "Góc Học Tập" : "•"}</div>
            <Link href="/vocab" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">📚</span>{!isSidebarCollapsed && <span>Từ vựng</span>}</Link>
            <Link href="/topic" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">💡</span>{!isSidebarCollapsed && <span>Theo chủ đề</span>}</Link>
            
            <Link href="/arrange" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#1B5E4B] bg-[#8FD9A8]/30 border border-[#8FD9A8]/50 shadow-sm"><span className="w-6 text-center text-lg">🧩</span>{!isSidebarCollapsed && <span>Ngữ pháp</span>}</Link>
            
            <Link href="/dictation" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎧</span>{!isSidebarCollapsed && <span>Nghe chép</span>}</Link>
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
          MAIN CONTENT AREA
          ====================================================== */}
      <main className={`flex-1 transition-all duration-300 relative z-10 w-full flex flex-col ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        
        {/* TOP BAR ĐỒNG BỘ NƯỚC - LỬA - XP */}
        <header className="sticky top-0 z-30 h-[76px] border-b border-[#E2E8F0] bg-white/80 px-6 backdrop-blur-xl flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            {phase !== "start" && (
              <button onClick={() => setPhase("start")} className="text-slate-500 hover:text-[#2F8F6E] transition flex items-center gap-2 font-bold text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
                ← <span className="hidden sm:inline">Quay lại</span>
              </button>
            )}
            <h2 className="font-black text-[#1B5E4B] text-lg hidden sm:block tracking-tight">Xếp Gạch Ngữ Pháp</h2>
          </div>
          
          <div className="flex items-center gap-3">
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

        <div className="flex-1 flex flex-col items-center w-full py-10 px-4 md:px-6 overflow-y-auto">
          
          {/* =========================================
              PHASE 1: MÀN HÌNH BẮT ĐẦU (START)
              ========================================= */}
          {phase === "start" && (
            <div className="w-full max-w-xl animate-slide-up-fade text-center mt-10 bg-white/90 backdrop-blur-xl p-10 rounded-[40px] shadow-sm border border-[#E2E8F0]">
              <div className="w-24 h-24 bg-[#EEF5E9] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] mx-auto flex items-center justify-center text-5xl mb-6 shadow-inner border border-[#8FD9A8]/50">🧩</div>
              <h2 className="text-3xl md:text-4xl font-black text-[#1B5E4B] mb-4 tracking-tight drop-shadow-sm">Trò Chơi Xếp Gạch</h2>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                Huấn luyện tư duy cấu trúc ngữ pháp. Mỗi lượt bạn có <span className="text-[#F2765B] font-black">5 ❤️</span>. Xếp đúng câu để nhận XP và Nước cho khu vườn!
              </p>
              
              <div className="mb-8 text-left bg-[#F4F7F6] p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <label className="font-black text-slate-400 uppercase tracking-widest text-[10px] block mb-2">Chọn cấp độ luyện tập</label>
                <select 
                  value={selectedHsk} 
                  onChange={(e) => setSelectedHsk(e.target.value)}
                  className="w-full bg-white border-2 border-[#E2E8F0] text-[#2F8F6E] text-lg font-black py-4 px-5 rounded-2xl outline-none cursor-pointer hover:border-[#8FD9A8] transition shadow-sm appearance-none"
                >
                  {HSK_LEVELS.map(lvl => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={startGame} 
                className="w-full py-5 bg-[#2F8F6E] text-white font-black text-lg rounded-[24px] shadow-xl hover:bg-[#1B5E4B] hover:-translate-y-1 transition-all uppercase tracking-widest flex justify-center items-center gap-2 border-b-[4px] border-[#0F3F31]"
              >
                Bắt Đầu Ghép Câu <span>➔</span>
              </button>
            </div>
          )}

          {/* =========================================
              PHASE 2: TRONG GAME (PLAYING)
              ========================================= */}
          {phase === "playing" && questions.length > 0 && (
            <div className="w-full max-w-3xl animate-fade-in flex flex-col items-center">
              
              {/* Header: Tiến độ & Tim */}
              <div className="w-full flex items-center justify-between bg-white/95 backdrop-blur-xl p-5 rounded-[24px] shadow-sm border border-[#E2E8F0] mb-6">
                <div className="flex items-center gap-1 text-[#F2765B] font-black text-xl">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`transition-all ${i < hearts ? "opacity-100 scale-100 drop-shadow-sm" : "opacity-20 grayscale scale-75"}`}>❤️</span>
                  ))}
                </div>
                <div className="flex-1 mx-6 h-3 bg-[#EEF5E9] rounded-full overflow-hidden border border-[#E2E8F0]/50 shadow-inner">
                  <div className="h-full bg-[#2F8F6E] rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(47,143,110,0.5)]" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <div className="font-black text-[#2F8F6E] bg-[#EEF5E9] px-4 py-1.5 rounded-lg border border-[#8FD9A8]/40">{currentIndex + 1} / 10</div>
              </div>

              {/* Màn hình Ghép Câu */}
              <div className="w-full bg-white/95 backdrop-blur-xl p-8 rounded-[32px] shadow-sm border border-[#E2E8F0] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#8FD9A8]/20 to-transparent rounded-bl-full pointer-events-none opacity-50"></div>
                
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <span className="text-base">🧩</span> Chạm vào từ để ghép câu
                  </p>
                  
                  {/* Khu vực Drop (Các từ đã chọn) */}
                  <div className={`w-full min-h-[120px] rounded-[24px] p-6 flex flex-wrap content-start gap-3 items-center transition-all mb-8 shadow-inner ${
                    feedback === 'correct' ? 'border-2 border-[#8FD9A8] bg-[#EEF5E9]/50' : 
                    feedback === 'incorrect' ? 'border-2 border-[#FECDD3] bg-[#FFF1F2]/50 animate-shake' : 
                    'border-2 border-dashed border-[#8FD9A8]/60 bg-[#F4F7F6]'
                  }`}>
                    {selectedWords.length === 0 && !feedback && (
                      <span className="text-slate-400 font-medium w-full text-center py-4 opacity-60">
                        (Khu vực ghép câu)
                      </span>
                    )}
                    {selectedWords.map((word) => (
                      <button
                        key={`sel-${word.id}`}
                        onClick={() => handleDeselectWord(word)}
                        className={`px-6 py-3 bg-white border-2 border-[#E2E8F0] text-[#1B5E4B] text-2xl font-black rounded-2xl shadow-sm hover:border-[#F2765B] hover:bg-[#FFF1F2] hover:text-[#BE123C] hover:line-through transition-all ${feedback === 'correct' ? 'pointer-events-none border-transparent shadow-none bg-[#2F8F6E] text-white' : ''}`}
                      >
                        {word.text}
                      </button>
                    ))}
                  </div>

                  {/* Feedback Thông Báo */}
                  {feedback === 'correct' && (
                    <div className="mb-8 p-6 bg-[#EEF5E9] border border-[#8FD9A8]/50 rounded-[24px] flex items-center gap-4 animate-slide-up-fade shadow-sm">
                      <div className="text-5xl drop-shadow-sm">🎉</div>
                      <div>
                        <h4 className="font-black text-[#1B5E4B] text-lg mb-1">太棒了！Tuyệt vời!</h4>
                        <p className="text-sm font-bold text-[#2F8F6E]">Sắp xếp hoàn toàn chính xác.</p>
                      </div>
                    </div>
                  )}

                  {feedback === 'incorrect' && (
                    <div className="mb-8 p-6 bg-[#FFF1F2] border border-[#FECDD3] rounded-[24px] flex items-start gap-4 animate-slide-up-fade shadow-sm">
                      <div className="text-4xl mt-1 drop-shadow-sm">💔</div>
                      <div>
                        <h4 className="font-black text-[#BE123C] text-lg mb-1">再试一次！Sai rồi!</h4>
                        <p className="text-sm font-bold text-[#BE123C]/80 mb-2">Thứ tự chưa chính xác. Bạn bị trừ 1 ❤️.</p>
                        <div className="bg-white p-3.5 rounded-xl border border-[#FECDD3] shadow-sm mt-2 inline-block">
                          <p className="text-xs font-black text-[#F59E0B] mb-1">💡 LỜI KHUYÊN:</p>
                          <p className="text-xs text-slate-600 font-medium">Hãy nhớ trật tự cơ bản: Chủ ngữ → Vị ngữ → Tân ngữ</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gợi ý đáp án (Khi sai) */}
                  {showAnswer && feedback !== 'correct' && (
                    <div className="mb-8 p-6 bg-white rounded-[24px] border border-[#FFD666] animate-fade-in relative overflow-hidden shadow-sm">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD666]"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Đáp án tham khảo</p>
                      <p className="text-2xl font-black text-[#1B5E4B] tracking-widest">{questions[currentIndex].chinese || questions[currentIndex].front}</p>
                    </div>
                  )}

                  {/* Khu vực Chọn (Các từ còn lại) */}
                  {feedback !== 'correct' && (
                    <div className="w-full mt-2 mb-10 flex flex-wrap justify-center gap-3">
                      {availableWords.map(word => (
                        <button
                          key={`avail-${word.id}`}
                          onClick={() => handleSelectWord(word)}
                          className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-700 text-2xl font-black rounded-2xl shadow-sm hover:-translate-y-1 hover:border-[#8FD9A8] hover:text-[#2F8F6E] hover:bg-[#EEF5E9] transition-all"
                        >
                          {word.text}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Các nút hành động */}
                  <div className="mt-auto flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-100">
                    {feedback === 'correct' ? (
                      <button 
                        onClick={nextQuestion}
                        className="w-full py-4.5 bg-[#2F8F6E] text-white rounded-2xl font-black text-sm hover:bg-[#1B5E4B] transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2 uppercase tracking-widest border-b-[4px] border-[#0F3F31]"
                      >
                        Câu tiếp theo ➔
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => setShowAnswer(!showAnswer)}
                          className="flex-1 py-4 bg-[#F4F7F6] border-2 border-[#E2E8F0] text-slate-500 rounded-2xl font-black text-sm hover:border-[#FFD666] hover:text-amber-600 hover:bg-[#FFF8E8] transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <span className="text-lg">💡</span> {showAnswer ? "Ẩn gợi ý" : "Xem gợi ý"}
                        </button>
                        
                        <button 
                          onClick={handleClearAll}
                          disabled={selectedWords.length === 0}
                          className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:border-[#FECDD3] hover:text-[#BE123C] hover:bg-[#FFF1F2] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="text-lg">↶</span> Làm lại
                        </button>

                        <button 
                          onClick={checkAnswer}
                          disabled={selectedWords.length === 0}
                          className="flex-[2] py-4 bg-[#1B5E4B] text-white rounded-2xl font-black text-sm hover:bg-[#2F8F6E] transition-all shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider border-b-[4px] border-[#0F3F31]"
                        >
                          Kiểm tra →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              PHASE 3: MÀN HÌNH KẾT QUẢ (RESULT)
              ========================================= */}
          {phase === "result" && (
            <div className="w-full max-w-xl animate-slide-up-fade text-center mt-10 bg-white/95 backdrop-blur-xl p-10 md:p-14 rounded-[40px] shadow-2xl border border-white">
              <div className="text-8xl mb-6 drop-shadow-sm">{hearts > 0 ? "🎉" : "💔"}</div>
              <p className="text-[10px] font-black text-[#2F8F6E] uppercase tracking-widest mb-2">Hoàn thành phiên tập</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#1B5E4B] mb-8">{hearts > 0 ? "Rất Xuất Sắc!" : "Hết Năng Lượng!"}</h2>

              <div className="bg-[#FFF8E8] border border-[#FFD666]/40 rounded-[32px] p-8 mb-10 text-center shadow-inner flex justify-around relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/40 rounded-bl-full pointer-events-none"></div>
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-2">Số câu đúng</p>
                  <p className="text-4xl font-black text-slate-800">{score} <span className="text-lg text-slate-400">/ {questions.length}</span></p>
                </div>
                <div className="w-px bg-[#FFD666]/30"></div>
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-2">Phần thưởng</p>
                  <p className="text-2xl font-black text-[#FFD666] drop-shadow-sm mb-1">⭐ +{earnedXp}</p>
                  <p className="text-2xl font-black text-[#4FB6C7] drop-shadow-sm">💧 +{earnedWater}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/" className="flex-1">
                  <button className="w-full py-4.5 bg-[#F4F7F6] text-slate-600 font-black rounded-2xl hover:bg-white border border-[#E2E8F0] transition uppercase tracking-widest text-sm shadow-sm hover:border-[#8FD9A8]">
                    Về Bản Đồ
                  </button>
                </Link>
                <button 
                  onClick={() => setPhase("start")} 
                  className="flex-1 py-4.5 bg-[#1B5E4B] text-white font-black rounded-2xl shadow-xl hover:bg-[#2F8F6E] hover:-translate-y-1 transition-all uppercase tracking-widest text-sm border-b-[4px] border-[#0F3F31]"
                >
                  Chơi Lại Lần Nữa
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}