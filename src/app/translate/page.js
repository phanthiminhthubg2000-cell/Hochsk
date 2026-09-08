"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateUserProgress } from "../../lib/firebaseUtils";

// IMPORT DATA TỪ FILE ARRANGE.JSON
import translationData from "../arrange.json"; 

// --- HÀM CHUẨN HÓA LEVEL ---
const matchLevel = (dataLevel, targetLevel) => {
  if (!dataLevel || !targetLevel) return false;
  const cleanDataLevel = dataLevel.toString().replace(/\s+/g, '').toUpperCase();
  const cleanTargetLevel = targetLevel.toString().replace(/\s+/g, '').toUpperCase();
  return cleanDataLevel === cleanTargetLevel;
};

// --- THUẬT TOÁN DỰ PHÒNG ---
const getSimilarity = (s1, s2) => {
  let longer = s1.length > s2.length ? s1 : s2;
  let shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  const costs = new Array();
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i == 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) != shorter.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longer.length - costs[shorter.length]) / parseFloat(longer.length);
};

export default function TranslatePage() {
  const { isSignedIn, userId } = useAuth();
  const { user, isLoaded } = useUser();

  // --- STATES ĐIỀU HƯỚNG ---
  const [step, setStep] = useState("SELECT_LEVEL"); 
  const [selectedHskLevel, setSelectedHskLevel] = useState(null);
  const [taskList, setTaskList] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  // --- STATES NGƯỜI DÙNG & GIAO DIỆN ---
  const [loadingUser, setLoadingUser] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [hskXp, setHskXp] = useState(0);
  const [water, setWater] = useState(0); // THÊM STATE NƯỚC

  // --- STATES NHẮN TIN (MESSAGING UI) ---
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [feedbackState, setFeedbackState] = useState("idle"); 
  const [showAnswer, setShowAnswer] = useState(false);
  const [combo, setCombo] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false); 
  const chatContainerRef = useRef(null);

  // --- FETCH DATA FIREBASE ĐỒNG BỘ ---
  useEffect(() => {
    async function syncUserAndFetchData() {
      if (userId) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          const progressRef = doc(db, "user_progress", userId);
          const progressSnap = await getDoc(progressRef);

          let currentXp = 0;
          let currentWater = 0;
          let currentStreak = 0;

          if (userSnap.exists()) {
            const uData = userSnap.data();
            currentXp = uData.xp || 0;
            currentWater = uData.water || 0;
            currentStreak = uData.streak || 0;
          }

          if (progressSnap.exists()) {
            const pData = progressSnap.data();
            if (currentXp === 0) currentXp = pData.profile?.hsk_xp || 0;
            if (currentStreak === 0) currentStreak = pData.profile?.streak_days || 0;
            setHearts(pData.profile?.hearts ?? 5);
          }

          setHskXp(currentXp);
          setWater(currentWater);
          setStreak(currentStreak);

        } catch (error) { console.error("Lỗi:", error); }
      }
      setLoadingUser(false);
    }
    if (isLoaded) syncUserAndFetchData();
  }, [userId, isLoaded]);

  // Cuộn chat xuống cuối tự động
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isEvaluating]);

  // --- KHỞI TẠO BÀI TẬP ---
  const startLevel = (level) => {
    const rawData = translationData.filter(t => matchLevel(t.level, level) && t.vietnamese && t.chinese);
    
    if (rawData.length > 0) {
      const shuffled = [...rawData].sort(() => 0.5 - Math.random());
      const selectedTasks = shuffled.slice(0, 10);
      
      setSelectedHskLevel(level);
      setTaskList(selectedTasks);
      setCurrentTaskIndex(0);
      setCombo(0);
      
      setChatHistory([
        { role: 'system', content: `Phiên luyện dịch: ${level} (10 Câu)` },
        { role: 'contact', content: `Chào bạn! Cùng luyện dịch nhé. Hãy dịch câu sau sang tiếng Trung:\n\n「 ${selectedTasks[0].vietnamese} 」` }
      ]);
      setStep("DO_TRANSLATION");
      setUserInput("");
      setFeedbackState("idle");
      setShowAnswer(false);
    } else {
      alert(`Dữ liệu cấp độ ${level} chưa sẵn sàng. Vui lòng thử cấp độ khác!`);
    }
  };

  // --- GỌI AI CHẤM ĐIỂM CHI TIẾT ---
  const checkAnswer = async () => {
    if (!userInput.trim() || feedbackState === "correct" || isEvaluating) return;

    const currentTask = taskList[currentTaskIndex];
    const currentUserInput = userInput;
    setUserInput("");
    
    setChatHistory(prev => [...prev, { role: 'user', content: currentUserInput, status: 'pending' }]);
    setIsEvaluating(true);

    try {
      const response = await fetch('/api/evaluate-translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vietnamese: currentTask.vietnamese,
          targetChinese: currentTask.chinese,
          userTranslation: currentUserInput
        })
      });

      let aiResult;
      if (response.ok) {
        aiResult = await response.json();
      } else {
        throw new Error("API Route not found or failed");
      }

      handleEvaluationResult(aiResult, currentUserInput, currentTask);

    } catch (error) {
      console.warn("⚠️ API Chấm điểm chưa sẵn sàng. Đang sử dụng thuật toán dự phòng (Fallback)...");
      const cleanUser = currentUserInput.replace(/[.,!?，。？！\s]/g, "").toLowerCase();
      const cleanTarget = currentTask.chinese.replace(/[.,!?，。？！\s]/g, "").toLowerCase();
      const simScore = Math.round(getSimilarity(cleanUser, cleanTarget) * 100);
      
      const fallbackResult = {
        score: simScore,
        feedback: simScore >= 80 ? "Ngữ pháp và từ vựng của bạn khá ổn, truyền đạt đúng ý nghĩa cơ bản!" : "Câu dịch bị lệch nghĩa hoặc sai từ vựng khá nhiều.",
        suggestion: `Người bản xứ thường dùng cấu trúc: ${currentTask.chinese}`
      };
      handleEvaluationResult(fallbackResult, currentUserInput, currentTask);
    }
  };

  // ============================================================
  // CẬP NHẬT XP & NƯỚC NGAY LẬP TỨC KHI TRẢ LỜI ĐÚNG
  // ============================================================
  const handleEvaluationResult = async (result, currentUserInput, currentTask) => {
    const isPass = result.score >= 80;
    
    setChatHistory(prev => {
      const newHistory = [...prev];
      const lastUserMsgIndex = newHistory.map(m => m.role).lastIndexOf('user');
      if(lastUserMsgIndex !== -1) newHistory[lastUserMsgIndex].status = isPass ? 'correct' : 'incorrect';
      return newHistory;
    });

    setChatHistory(prev => [...prev, { 
      role: 'contact', 
      isDetailedFeedback: true,
      score: result.score,
      feedback: result.feedback,
      suggestion: result.suggestion,
      isPass: isPass
    }]);

    setIsEvaluating(false);

    if (isPass) {
      setFeedbackState("correct");
      setCombo(prev => prev + 1);

      if (userId) {
        // TÍNH TOÁN ĐIỂM MỚI (Thử thách dịch được 15 XP và 2 Nước)
        const bonusXp = 15;
        const bonusWater = 2;
        const newXp = hskXp + bonusXp;
        const newWater = water + bonusWater;

        // CẬP NHẬT GIAO DIỆN NGAY LẬP TỨC
        setHskXp(newXp);
        setWater(newWater);

        try {
          // LƯU CỨNG VÀO FIREBASE
          await setDoc(doc(db, "users", userId), {
            xp: newXp,
            water: newWater
          }, { merge: true });

          await updateUserProgress(userId, bonusXp, "writing", 2); 
        } 
        catch (e) { console.error("Lỗi đồng bộ dữ liệu:", e); }
      }
    } else {
      setFeedbackState("incorrect");
      setCombo(0);
    }
  };

  // --- CHUYỂN SANG CÂU TIẾP THEO ---
  const nextTask = () => {
    const nextIdx = currentTaskIndex + 1;
    if (nextIdx < taskList.length) {
      setCurrentTaskIndex(nextIdx);
      setUserInput("");
      setFeedbackState("idle");
      setShowAnswer(false);
      
      setChatHistory(prev => [
        ...prev, 
        { role: 'contact', content: `Tiếp tục nhé! Câu này thì sao:\n\n「 ${taskList[nextIdx].vietnamese} 」` }
      ]);
    } else {
      setChatHistory(prev => [
        ...prev, 
        { role: 'system', content: "🎉 HOÀN THÀNH BÀI TẬP 🎉" },
        { role: 'contact', content: "Tuyệt vời, bạn đã hoàn thành toàn bộ thử thách dịch thuật của phiên này! Bạn rất siêu đó nha 🐸✨" }
      ]);
      setFeedbackState("finished");
    }
  };

  if (loadingUser) return <div className="min-h-screen bg-[#EEF5E9]"></div>;

  return (
    <div className="flex min-h-screen font-sans text-[#1B5E4B] bg-[#EEF5E9] selection:bg-[#8FD9A8]/50">
      
      {/* ==========================================
          SIDEBAR ĐỒNG BỘ THEME VƯỜN HSK
          ========================================== */}
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
            <Link href="/" className="mb-6 flex items-center gap-3 rounded-2xl bg-[#8FD9A8]/30 px-3 py-3 text-sm font-bold text-[#1B5E4B] transition-all"><span className="w-6 text-center text-lg">🏡</span>{!isSidebarCollapsed && <span>Trang chủ</span>}</Link>

            <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-[#2F8F6E]/60">{!isSidebarCollapsed ? "🌱 KHU RÈN LUYỆN" : "•"}</div>
            <Link href="/vocab" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🌱</span>{!isSidebarCollapsed && <span>Từ vựng</span>}</Link>
            <Link href="/topic" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🪷</span>{!isSidebarCollapsed && <span>Chủ đề</span>}</Link>
            <Link href="/arrange" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">☀️</span>{!isSidebarCollapsed && <span>Ngữ pháp</span>}</Link>
            <Link href="/dictation" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">💧</span>{!isSidebarCollapsed && <span>Nghe chép</span>}</Link>
            <Link href="/translate" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#1B5E4B] bg-[#8FD9A8]/30 border border-[#8FD9A8]/50 shadow-sm"><span className="w-6 text-center text-lg">🍃</span>{!isSidebarCollapsed && <span>Dịch câu</span>}</Link>
            
            <Link href="/hskk" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎤</span>{!isSidebarCollapsed && <span>Cuộc chiến khẩu ngữ</span>}</Link>
            <Link href="/roleplay" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors"><span className="w-6 text-center text-lg opacity-80">🎬</span>{!isSidebarCollapsed && <span>Phim trường</span>}</Link>
          </nav>

          <div className="border-t border-[#8FD9A8]/20 p-4">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="mb-3 flex w-full items-center justify-center rounded-xl bg-white/50 py-2.5 text-xs font-bold text-slate-500 hover:bg-white transition-colors shadow-sm">
              {isSidebarCollapsed ? "→" : "← Thu gọn"}
            </button>
            {isSignedIn ? (
              <div className={`flex items-center rounded-2xl bg-white shadow-sm p-2.5 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
                <UserButton afterSignOutUrl="/" />
                {!isSidebarCollapsed && (
                  <div className="min-w-0"><p className="truncate text-xs font-black text-[#1B5E4B]">{user?.fullName || "Người làm vườn"}</p></div>
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

      <main className={`min-h-screen transition-all duration-300 relative w-full flex flex-col ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        
        {/* ==========================================
            TOP BAR ĐỒNG BỘ
            ========================================== */}
        <header className="sticky top-0 z-30 h-[76px] border-b border-[#8FD9A8]/30 bg-[#EEF5E9]/80 px-5 backdrop-blur-xl md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {step === "DO_TRANSLATION" ? (
              <button onClick={() => setStep("SELECT_LEVEL")} className="text-slate-500 hover:text-[#2F8F6E] transition flex items-center gap-1 font-bold text-sm bg-white px-4 py-2 rounded-xl border border-[#E2E8F0] shadow-sm">
                ← <span className="hidden sm:inline">Trở về</span>
              </button>
            ) : (
              <h2 className="font-black text-lg hidden sm:block text-[#1B5E4B]">Dịch Thuật Cùng Ếch xanh</h2>
            )}
            
            {step === "DO_TRANSLATION" && (
              <div className="flex items-center gap-2 text-sm font-bold bg-[#F4F7F6] px-4 py-2 rounded-xl border border-[#E2E8F0] shadow-sm">
                <span className="text-[#2F8F6E]">Tiến trình: {currentTaskIndex + 1} / {taskList.length}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {combo > 1 && <span className="text-xs font-black text-[#F2765B] bg-[#FFF1F2] px-3 py-1.5 rounded-xl border border-[#FECDD3] animate-pulse shadow-sm">🔥 Combo {combo}</span>}
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-white/90 backdrop-blur-md shadow-sm px-4 py-2.5 border border-slate-100">
              <span className="text-lg drop-shadow-sm">🔥</span><span className="text-xs font-black text-[#F2765B]">{streak} ngày</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-[#4FB6C7]/10 backdrop-blur-md border border-[#4FB6C7]/30 shadow-sm px-4 py-2.5 rounded-2xl">
              <span className="text-lg drop-shadow-sm">💧</span><span className="text-xs font-black text-[#4FB6C7]">{water} giọt</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-[#FFD666]/20 backdrop-blur-md border border-[#FFD666]/50 shadow-sm px-4 py-2.5 rounded-2xl">
              <span className="text-lg drop-shadow-sm">⭐</span><span className="text-xs font-black text-[#1B5E4B]">{hskXp.toLocaleString()} XP</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 max-w-[1200px] mx-auto w-full">
          
          {/* PHASE 1: CHỌN CẤP ĐỘ */}
          {step === "SELECT_LEVEL" && (
            <div className="animate-fade-in mt-6 max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-white rounded-[24px] mx-auto flex items-center justify-center text-4xl mb-6 shadow-sm border border-[#E2E8F0]">✍️</div>
                <h1 className="text-3xl md:text-4xl font-black text-[#1B5E4B] tracking-tight mb-4">Luyện Dịch AI</h1>
                <p className="text-slate-500 font-medium text-sm max-w-lg mx-auto">Giáo viên Ếch Xanh sẽ chấm điểm chi tiết, phân tích lỗi sai và gợi ý cách diễn đạt tự nhiên như người bản xứ.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"].map((lvl) => {
                  const tasks = translationData.filter(t => matchLevel(t.level, lvl) && t.vietnamese && t.chinese);
                  const hasData = tasks.length > 0;
                  
                  return (
                    <div key={lvl} onClick={() => { if (hasData) startLevel(lvl); }} className={`bg-white border rounded-[24px] p-6 text-center transition-all ${hasData ? "border-[#E2E8F0] hover:border-[#8FD9A8] hover:shadow-md cursor-pointer hover:-translate-y-1" : "border-[#E2E8F0] opacity-60 cursor-not-allowed bg-[#F8FAFC]"}`}>
                      <div className={`w-14 h-14 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-2xl mb-4 mx-auto shadow-inner ${hasData ? 'bg-[#EEF5E9] text-[#2F8F6E] border border-[#8FD9A8]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                        {hasData ? '🎓' : '🔒'}
                      </div>
                      <h3 className="text-lg font-black text-[#1B5E4B] mb-1">{lvl}</h3>
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${hasData ? 'text-[#2F8F6E]' : 'text-[#94A3B8]'}`}>{hasData ? `${tasks.length} Câu hỏi` : "Sắp ra mắt"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PHASE 2: GIAO DIỆN NHẮN TIN (AI TEACHER CHAT) */}
          {step === "DO_TRANSLATION" && taskList.length > 0 && (
            <div className="h-[calc(100vh-160px)] flex flex-col lg:flex-row gap-6 animate-fade-in">
              
              {/* CỘT TRÁI: ĐIỆN THOẠI NHẮN TIN */}
              <div className="lg:col-span-8 w-full flex flex-col h-full bg-white rounded-[32px] border border-[#E2E8F0] shadow-xl overflow-hidden relative">
                
                {/* Header Điện thoại */}
                <div className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 shrink-0 z-10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#EEF5E9] border border-[#8FD9A8] flex items-center justify-center text-xl shadow-sm">🐸</div>
                    <div>
                      <h3 className="font-black text-[#1B5E4B] text-sm">Giáo viên Ếch xanh</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#2F8F6E] animate-pulse"></div>
                        <span className="text-[9px] font-bold text-[#2F8F6E] uppercase tracking-wider">Đang theo dõi</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Khung Chat Liên Tục */}
                <div ref={chatContainerRef} className="flex-1 bg-[#F4F7F6] p-4 md:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 relative scroll-smooth">
                  
                  {chatHistory.map((msg, idx) => {
                    if (msg.role === 'system') {
                      return (
                        <div key={idx} className="flex justify-center w-full my-2 animate-fade-in">
                          <span className="bg-[#1B5E4B]/80 backdrop-blur-md text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest text-center shadow-sm">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }
                    if (msg.role === 'contact') {
                      if (msg.isDetailedFeedback) {
                        return (
                          <div key={idx} className="flex items-end gap-2 w-full animate-fade-in">
                            <div className="w-8 h-8 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#EEF5E9] border border-[#8FD9A8] flex items-center justify-center text-sm shrink-0 mb-1 shadow-sm">🐸</div>
                            <div className={`p-5 rounded-2xl rounded-bl-sm max-w-[85%] shadow-sm border ${msg.isPass ? 'bg-[#EEF5E9] border-[#8FD9A8]' : 'bg-[#FFF1F2] border-[#FECDD3]'}`}>
                              <div className="flex items-center gap-2 mb-3 border-b border-black/5 pb-3">
                                 <span className={`text-3xl font-black ${msg.isPass ? 'text-[#2F8F6E]' : 'text-[#BE123C]'}`}>{msg.score}</span>
                                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/80 px-2 py-1 rounded-lg">Điểm AI</span>
                              </div>
                              <p className="text-[14px] font-medium text-[#1B5E4B] whitespace-pre-wrap leading-relaxed mb-3"><strong>📝 Phân tích:</strong> {msg.feedback}</p>
                              {msg.suggestion && (
                                <p className="text-[14px] font-medium text-[#1B5E4B] whitespace-pre-wrap leading-relaxed bg-white/80 p-4 rounded-xl border border-black/5 shadow-sm"><strong className="text-[#F2765B]">💡 Gợi ý hay:</strong> {msg.suggestion}</p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="flex items-end gap-2 w-full animate-fade-in">
                          <div className="w-8 h-8 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#EEF5E9] border border-[#8FD9A8] flex items-center justify-center text-sm shrink-0 mb-1 shadow-sm">🐸</div>
                          <div className={`p-4 rounded-2xl rounded-bl-sm max-w-[85%] shadow-sm ${msg.isReaction ? 'bg-transparent shadow-none text-3xl p-0' : 'bg-white border border-[#E2E8F0] text-[#1B5E4B]'}`}>
                            {msg.isReaction ? msg.content : <p className="text-[15px] font-medium whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                          </div>
                        </div>
                      );
                    }
                    if (msg.role === 'user') {
                      return (
                        <div key={idx} className="flex items-end gap-2 w-full flex-row-reverse animate-fade-in">
                          <div className="w-8 h-8 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#2F8F6E] text-white flex items-center justify-center text-sm shrink-0 mb-1 shadow-sm">🧑‍🎓</div>
                          <div className={`p-4 rounded-2xl rounded-br-sm max-w-[85%] shadow-sm transition-all ${msg.status === 'correct' ? 'bg-[#2F8F6E] text-white' : msg.status === 'incorrect' ? 'bg-[#F2765B] text-white' : 'bg-[#E2E8F0] text-slate-600'}`}>
                            <p className="text-[15px] font-medium whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      );
                    }
                  })}

                  {/* HIỆU ỨNG AI ĐANG GÕ */}
                  {isEvaluating && (
                    <div className="flex items-end gap-2 w-full animate-fade-in">
                      <div className="w-8 h-8 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#EEF5E9] border border-[#8FD9A8] flex items-center justify-center text-sm shrink-0 mb-1 shadow-sm">🐸</div>
                      <div className="px-5 py-4 rounded-2xl rounded-bl-sm bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-1.5 h-[46px]">
                        <div className="w-2 h-2 bg-[#8FD9A8] rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-[#2F8F6E] rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                        <div className="w-2 h-2 bg-[#1B5E4B] rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Khu vực Gõ Tin Nhắn */}
                <div className="bg-white border-t border-[#E2E8F0] p-4 shrink-0">
                  <div className="bg-[#F4F7F6] border border-[#E2E8F0] rounded-2xl p-2 flex flex-col gap-2 transition-all focus-within:border-[#8FD9A8] focus-within:bg-white focus-within:shadow-md">
                    <textarea 
                      rows="2"
                      placeholder={feedbackState === "finished" ? "Bạn đã hoàn thành phiên luyện tập này." : isEvaluating ? "Giáo viên AI đang chấm điểm..." : "Gõ bản dịch tiếng Trung vào đây..."}
                      value={userInput}
                      onChange={(e) => { setUserInput(e.target.value); setFeedbackState("idle"); setShowAnswer(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey && userInput.trim() && feedbackState !== 'correct' && feedbackState !== 'finished' && !isEvaluating) checkAnswer(); }}
                      disabled={feedbackState === "correct" || feedbackState === "finished" || isEvaluating}
                      className="w-full bg-transparent resize-none outline-none text-[#1B5E4B] font-medium px-3 py-2 placeholder:text-slate-400 disabled:opacity-50 text-[15px]"
                    ></textarea>
                    <div className="flex items-center justify-between px-3 pb-1">
                      <span className="text-[10px] font-bold text-slate-400">Ctrl + ↵ để gửi</span>
                      <button 
                        onClick={checkAnswer} 
                        disabled={!userInput.trim() || feedbackState === "correct" || feedbackState === "finished" || isEvaluating}
                        className="bg-[#1B5E4B] text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#2F8F6E] disabled:opacity-50 disabled:bg-[#E2E8F0] shadow-md transition-all"
                      >
                        Gửi
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: THÔNG TIN BỔ TRỢ */}
              <aside className="lg:col-span-4 w-full h-full flex flex-col gap-4">
                
                {feedbackState !== "finished" && (
                  <div className="bg-white rounded-[32px] border border-[#E2E8F0] p-8 shadow-sm flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#F4F7F6] shrink-0">
                      <span className="text-2xl">🎯</span>
                      <h3 className="font-black text-[#1B5E4B] text-lg">Câu cần dịch hiện tại</h3>
                    </div>
                    
                    <p className="text-[#2F8F6E] font-bold text-xl leading-relaxed mb-6 shrink-0 bg-[#EEF5E9] p-5 rounded-2xl border border-[#8FD9A8]/40 shadow-inner">"{taskList[currentTaskIndex]?.vietnamese}"</p>

                    {/* KHU VỰC TRẠNG THÁI (LẤP ĐẦY KHOẢNG TRỐNG) */}
                    <div className="flex-1 flex flex-col justify-center mb-6">
                      
                      {feedbackState === "idle" && !isEvaluating && !showAnswer && (
                        <div className="bg-white border border-[#E2E8F0] border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center h-full animate-fade-in shadow-sm">
                          <div className="w-16 h-16 bg-[#EEF5E9] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-3xl shadow-inner mb-4 border border-[#8FD9A8]">💬</div>
                          <h4 className="text-base font-black text-[#1B5E4B] mb-2">Đến lượt bạn!</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed px-2">Nhập bản dịch vào khung chat bên trái để Giáo viên AI chấm điểm nhé.</p>
                        </div>
                      )}

                      {isEvaluating && (
                        <div className="bg-[#EEF5E9]/50 border border-[#8FD9A8]/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center h-full animate-fade-in">
                          <div className="w-12 h-12 border-[5px] border-[#2F8F6E] border-t-transparent rounded-full animate-spin mb-5 shadow-sm"></div>
                          <h4 className="text-sm font-bold text-[#2F8F6E] animate-pulse">Xiao Qingwa đang chấm điểm...</h4>
                        </div>
                      )}

                      {showAnswer && (
                        <div className="bg-white p-6 rounded-3xl border border-[#8FD9A8] shadow-sm h-full flex flex-col justify-center animate-fade-in relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#8FD9A8]/30 to-transparent rounded-bl-full pointer-events-none"></div>
                          <span className="text-[10px] font-black text-[#2F8F6E] uppercase tracking-widest block mb-3 text-center bg-[#EEF5E9] py-1.5 rounded-lg w-fit mx-auto px-4 border border-[#8FD9A8]/50">Đáp án tiêu chuẩn</span>
                          <span className="text-2xl font-black text-[#1B5E4B] text-center mb-3">{taskList[currentTaskIndex]?.chinese}</span>
                          {taskList[currentTaskIndex]?.ipa && <p className="text-sm font-bold text-slate-500 text-center">{taskList[currentTaskIndex]?.ipa}</p>}
                        </div>
                      )}

                      {feedbackState === "correct" && (
                        <div className="bg-[#FFF8E8] p-8 rounded-3xl border border-[#FFD666] h-full flex flex-col items-center justify-center text-center animate-fade-in shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FFD666]/30 to-transparent rounded-bl-full pointer-events-none"></div>
                          <div className="text-5xl mb-4 drop-shadow-md">🏆</div>
                          <p className="text-xs font-black text-[#F2765B] uppercase tracking-widest mb-1">Chính xác!</p>
                          <p className="text-4xl font-black text-[#1B5E4B] drop-shadow-sm">+15 XP <span className="text-xl">& +2 💧</span></p>
                        </div>
                      )}
                    </div>

                    {/* Vùng Button (Cố định dưới cùng) */}
                    <div className="shrink-0">
                      {feedbackState === "incorrect" && !isEvaluating && (
                        <button onClick={() => setShowAnswer(!showAnswer)} className="w-full py-4 mb-3 bg-[#F4F7F6] border border-[#E2E8F0] text-slate-600 font-bold text-sm rounded-2xl hover:bg-white hover:border-[#8FD9A8] transition-all shadow-sm">
                          {showAnswer ? "Ẩn đáp án" : "Bí quá? Xem đáp án mẫu"}
                        </button>
                      )}

                      <button 
                        onClick={nextTask}
                        disabled={feedbackState !== "correct"}
                        className="w-full py-4.5 bg-[#2F8F6E] text-white rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1B5E4B] hover:-translate-y-1 transition-all shadow-md"
                      >
                        Câu tiếp theo →
                      </button>
                    </div>
                  </div>
                )}

                {/* Khi kết thúc Session */}
                {feedbackState === "finished" && (
                  <div className="bg-white rounded-[32px] border border-[#E2E8F0] p-10 shadow-sm flex flex-col items-center justify-center flex-1 text-center animate-fade-in relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#8FD9A8]/20 to-transparent rounded-bl-full pointer-events-none"></div>
                    <div className="text-7xl mb-6 drop-shadow-md">🐸🎉</div>
                    <h3 className="font-black text-[#1B5E4B] text-3xl mb-3">Tuyệt cú mèo!</h3>
                    <p className="text-sm text-slate-500 font-medium mb-10 leading-relaxed max-w-[80%]">Bạn đã xuất sắc hoàn thành phiên dịch cùng Xiao Qingwa. Khu vườn lại thêm xanh tươi!</p>
                    <button 
                      onClick={() => setStep("SELECT_LEVEL")}
                      className="w-full py-4.5 bg-[#2F8F6E] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#1B5E4B] hover:-translate-y-1 transition-all shadow-xl"
                    >
                      Chọn cấp độ khác
                    </button>
                  </div>
                )}

              </aside>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}