"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { updateUserProgress } from "../../lib/firebaseUtils";

// IMPORT DATA TỪ FILE ARRANGE.JSON
import translationData from "../arrange.json"; 

// --- HÀM CHUẨN HÓA LEVEL (Khắc phục lỗi đếm thiếu câu do khoảng trắng) ---
const matchLevel = (dataLevel, targetLevel) => {
  if (!dataLevel || !targetLevel) return false;
  // Xóa mọi dấu cách, đưa về viết hoa (Ví dụ: "HSK 6" hay "hsk6" đều thành "HSK6")
  const cleanDataLevel = dataLevel.toString().replace(/\s+/g, '').toUpperCase();
  const cleanTargetLevel = targetLevel.toString().replace(/\s+/g, '').toUpperCase();
  return cleanDataLevel === cleanTargetLevel;
};

// --- THUẬT TOÁN DỰ PHÒNG (NẾU API LỖI) ---
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

  // --- STATES NHẮN TIN (MESSAGING UI) ---
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [feedbackState, setFeedbackState] = useState("idle"); 
  const [showAnswer, setShowAnswer] = useState(false);
  const [combo, setCombo] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false); 
  const chatContainerRef = useRef(null);

  // --- FETCH DATA FIREBASE ---
  useEffect(() => {
    async function syncUserAndFetchData() {
      if (userId) {
        try {
          const newStudentRef = doc(db, "user_progress", userId);
          const newDocSnap = await getDoc(newStudentRef);
          if (newDocSnap.exists()) {
            const newData = newDocSnap.data();
            setHskXp(newData.profile?.hsk_xp || 0);
            setHearts(newData.profile?.hearts ?? 5);
            setStreak(newData.profile?.streak_days || 0);
          }
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
    // Sử dụng hàm chuẩn hóa matchLevel thay cho includes
    const rawData = translationData.filter(t => 
      matchLevel(t.level, level) && 
      t.vietnamese && t.chinese
    );
    
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
        try { await updateUserProgress(userId, 15, "writing", 2); } 
        catch (e) { console.error(e); }
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

  if (loadingUser) return <div className="min-h-screen bg-[#F7FAF8]"></div>;

  return (
    <div className="flex min-h-screen font-sans text-[#142033] bg-[#F7FAF8] selection:bg-[#10B981]/20">
      
      {/* ==========================================
          SIDEBAR
          ========================================== */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300 md:flex ${isSidebarCollapsed ? "w-[76px]" : "w-[240px]"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center px-6 py-6 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#10B981] text-white shadow-sm">🐸</div>
            {!isSidebarCollapsed && <h2 className="truncate text-base font-black tracking-tight text-[#142033]">Hành Trình HSK</h2>}
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
            <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-2">{!isSidebarCollapsed ? "Học tập" : "•"}</p>
            <Link href="/" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033] transition-colors"><span className="text-lg opacity-80">🏠</span>{!isSidebarCollapsed && <span>Trang chủ</span>}</Link>
            <Link href="/vocab" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033] transition-colors"><span className="text-lg opacity-80">📚</span>{!isSidebarCollapsed && <span>Từ vựng</span>}</Link>
            <Link href="/dictation" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033] transition-colors"><span className="text-lg opacity-80">🎧</span>{!isSidebarCollapsed && <span>Nghe chép</span>}</Link>
            <Link href="/arrange" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033] transition-colors"><span className="text-lg opacity-80">🧩</span>{!isSidebarCollapsed && <span>Ngữ pháp</span>}</Link>
            <Link href="/translate" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30"><span className="text-lg">✍️</span>{!isSidebarCollapsed && <span>Dịch câu</span>}</Link>
            <Link href="/roleplay" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033] transition-colors"><span className="text-lg opacity-80">💬</span>{!isSidebarCollapsed && <span>Thực chiến AI</span>}</Link>
          </nav>

          <div className="border-t border-[#E2E8F0] p-4">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="mb-3 flex w-full items-center justify-center rounded-xl bg-[#F8FAFC] py-2.5 text-xs font-bold text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
              {isSidebarCollapsed ? "→" : "← Thu gọn"}
            </button>
            {isSignedIn ? (
              <div className={`flex items-center rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-2 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
                <UserButton afterSignOutUrl="/" />
                {!isSidebarCollapsed && <div className="min-w-0"><p className="truncate text-xs font-bold">{user?.fullName || "Học viên"}</p></div>}
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#142033] py-3 text-xs font-bold text-white hover:bg-black">👤 {!isSidebarCollapsed && "Đăng nhập"}</button>
              </SignInButton>
            )}
          </div>
        </div>
      </aside>

      <main className={`min-h-screen transition-all duration-300 relative w-full flex flex-col ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 h-16 border-b border-[#E2E8F0] bg-white/90 px-6 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-4">
            {step === "DO_TRANSLATION" ? (
              <button onClick={() => setStep("SELECT_LEVEL")} className="text-[#64748B] hover:text-[#142033] transition flex items-center gap-1 font-bold text-sm bg-[#F8FAFC] px-3 py-1.5 rounded-lg border border-[#E2E8F0] shadow-sm">
                ← <span className="hidden sm:inline">Trở về</span>
              </button>
            ) : (
              <h2 className="font-black text-lg hidden sm:block text-[#142033]">Dịch Thuật Ứng Dụng (Translation)</h2>
            )}
            
            {step === "DO_TRANSLATION" && (
              <div className="flex items-center gap-2 text-sm font-bold bg-white px-4 py-1.5 rounded-lg border border-[#E2E8F0] shadow-sm">
                <span className="text-[#10B981]">Tiến trình: {currentTaskIndex + 1} / {taskList.length}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {combo > 1 && <span className="text-xs font-black text-[#F4B740] bg-[#FFFBEB] px-3 py-1 rounded-full border border-[#FDE68A] animate-pulse">🔥 Combo {combo}</span>}
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 shadow-sm">
              <span className="text-sm">⭐</span><span className="text-xs font-black text-[#F4B740]">{hskXp}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 shadow-sm">
              <span className="text-sm">❤️</span><span className="text-xs font-black text-[#F43F70]">{hearts}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 max-w-[1200px] mx-auto w-full">
          
          {/* PHASE 1: CHỌN CẤP ĐỘ */}
          {step === "SELECT_LEVEL" && (
            <div className="animate-fade-in mt-6 max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-white rounded-[24px] mx-auto flex items-center justify-center text-4xl mb-6 shadow-sm border border-[#E2E8F0]">✍️</div>
                <h1 className="text-3xl md:text-4xl font-black text-[#142033] tracking-tight mb-4">Luyện Dịch AI</h1>
                <p className="text-[#64748B] font-medium text-sm max-w-lg mx-auto">Giáo viên Ếch Xanh sẽ chấm điểm chi tiết, phân tích lỗi sai và gợi ý cách diễn đạt tự nhiên như người bản xứ.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"].map((lvl) => {
                  const tasks = translationData.filter(t => matchLevel(t.level, lvl) && t.vietnamese && t.chinese);
                  const hasData = tasks.length > 0;
                  
                  return (
                    <div key={lvl} onClick={() => { if (hasData) startLevel(lvl); }} className={`bg-white border rounded-[24px] p-6 text-center transition-all ${hasData ? "border-[#E2E8F0] hover:border-[#10B981] hover:shadow-md cursor-pointer hover:-translate-y-1" : "border-[#E2E8F0] opacity-60 cursor-not-allowed bg-[#F8FAFC]"}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 mx-auto ${hasData ? 'bg-[#ECFDF5] text-[#10B981]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                        {hasData ? '🎓' : '🔒'}
                      </div>
                      <h3 className="text-lg font-black text-[#142033] mb-1">{lvl}</h3>
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${hasData ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}>{hasData ? `${tasks.length} Câu hỏi` : "Sắp ra mắt"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PHASE 2: GIAO DIỆN NHẮN TIN (AI TEACHER CHAT) */}
          {step === "DO_TRANSLATION" && taskList.length > 0 && (
            <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6 animate-fade-in">
              
              {/* CỘT TRÁI: ĐIỆN THOẠI NHẮN TIN */}
              <div className="lg:col-span-8 w-full flex flex-col h-full bg-white rounded-[32px] border border-[#E2E8F0] shadow-xl overflow-hidden relative">
                
                {/* Header Điện thoại */}
                <div className="h-16 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center px-6 shrink-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-xl shadow-sm">🐸</div>
                    <div>
                      <h3 className="font-bold text-[#142033] text-sm">Xiao Qingwa (Giáo viên AI)</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></div>
                        <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-wider">Đang trực tuyến</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Khung Chat Liên Tục */}
                <div ref={chatContainerRef} className="flex-1 bg-[#F8FAFC] p-4 md:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 relative scroll-smooth">
                  
                  {chatHistory.map((msg, idx) => {
                    if (msg.role === 'system') {
                      return (
                        <div key={idx} className="flex justify-center w-full my-2 animate-fade-in">
                          <span className="bg-[#1E293B]/80 backdrop-blur-md text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest text-center max-w-[80%]">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }
                    if (msg.role === 'contact') {
                      if (msg.isDetailedFeedback) {
                        return (
                          <div key={idx} className="flex items-end gap-2 w-full animate-fade-in">
                            <div className="w-8 h-8 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-sm shrink-0 mb-1">🐸</div>
                            <div className={`p-4 rounded-2xl rounded-bl-sm max-w-[85%] shadow-sm border ${msg.isPass ? 'bg-[#ECFDF5] border-[#A7F3D0]' : 'bg-[#FFF1F2] border-[#FECDD3]'}`}>
                              <div className="flex items-center gap-2 mb-3 border-b border-black/5 pb-2">
                                 <span className={`text-2xl font-black ${msg.isPass ? 'text-[#059669]' : 'text-[#E11D48]'}`}>{msg.score}</span>
                                 <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] bg-white/80 px-2 py-1 rounded">Điểm AI</span>
                              </div>
                              <p className="text-[14px] font-medium text-[#142033] whitespace-pre-wrap leading-relaxed mb-3"><strong>📝 Phân tích:</strong> {msg.feedback}</p>
                              {msg.suggestion && (
                                <p className="text-[14px] font-medium text-[#142033] whitespace-pre-wrap leading-relaxed bg-white/80 p-3 rounded-xl border border-black/5"><strong>💡 Gợi ý hay:</strong> {msg.suggestion}</p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="flex items-end gap-2 w-full animate-fade-in">
                          <div className="w-8 h-8 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-sm shrink-0 mb-1">🐸</div>
                          <div className={`p-3.5 rounded-2xl rounded-bl-sm max-w-[85%] shadow-sm ${msg.isReaction ? 'bg-transparent shadow-none text-2xl p-0' : 'bg-white border border-[#E2E8F0] text-[#142033]'}`}>
                            {msg.isReaction ? msg.content : <p className="text-[15px] font-medium whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                          </div>
                        </div>
                      );
                    }
                    if (msg.role === 'user') {
                      return (
                        <div key={idx} className="flex items-end gap-2 w-full flex-row-reverse animate-fade-in">
                          <div className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center text-sm shrink-0 mb-1 shadow-sm">🧑‍🎓</div>
                          <div className={`p-3.5 rounded-2xl rounded-br-sm max-w-[85%] shadow-sm transition-all ${msg.status === 'correct' ? 'bg-[#10B981] text-white' : msg.status === 'incorrect' ? 'bg-[#F43F70] text-white' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                            <p className="text-[15px] font-medium whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      );
                    }
                  })}

                  {/* HIỂU ỨNG AI ĐANG GÕ */}
                  {isEvaluating && (
                    <div className="flex items-end gap-2 w-full animate-fade-in">
                      <div className="w-8 h-8 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-sm shrink-0 mb-1">🐸</div>
                      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-1.5 h-[42px]">
                        <div className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                        <div className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Khu vực Gõ Tin Nhắn */}
                <div className="bg-white border-t border-[#E2E8F0] p-4 shrink-0">
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-2 flex flex-col gap-2 transition-all focus-within:border-[#10B981] focus-within:bg-white focus-within:shadow-sm">
                    <textarea 
                      rows="2"
                      placeholder={feedbackState === "finished" ? "Bạn đã hoàn thành phiên luyện tập này." : isEvaluating ? "Giáo viên AI đang chấm điểm..." : "Gõ bản dịch tiếng Trung vào đây..."}
                      value={userInput}
                      onChange={(e) => { setUserInput(e.target.value); setFeedbackState("idle"); setShowAnswer(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey && userInput.trim() && feedbackState !== 'correct' && feedbackState !== 'finished' && !isEvaluating) checkAnswer(); }}
                      disabled={feedbackState === "correct" || feedbackState === "finished" || isEvaluating}
                      className="w-full bg-transparent resize-none outline-none text-[#142033] font-medium px-2 py-1 placeholder:text-[#94A3B8] disabled:opacity-50 text-[15px]"
                    ></textarea>
                    <div className="flex items-center justify-between px-2 pb-1">
                      <span className="text-[10px] font-bold text-[#94A3B8]">Ctrl + ↵ để gửi</span>
                      <button 
                        onClick={checkAnswer} 
                        disabled={!userInput.trim() || feedbackState === "correct" || feedbackState === "finished" || isEvaluating}
                        className="bg-[#142033] text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black disabled:opacity-50 disabled:bg-[#CBD5E1] shadow-md transition-all"
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
                  <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-6 shadow-sm flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[#F1F5F9] shrink-0">
                      <span className="text-xl">🎯</span>
                      <h3 className="font-black text-[#142033] text-base">Câu cần dịch hiện tại</h3>
                    </div>
                    
                    <p className="text-[#142033] font-bold text-lg leading-relaxed mb-6 shrink-0">"{taskList[currentTaskIndex]?.vietnamese}"</p>

                    {/* KHU VỰC TRẠNG THÁI (LẤP ĐẦY KHOẢNG TRỐNG) */}
                    <div className="flex-1 flex flex-col justify-center mb-6">
                      
                      {feedbackState === "idle" && !isEvaluating && !showAnswer && (
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center h-full animate-fade-in">
                          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm mb-3">💬</div>
                          <h4 className="text-sm font-black text-[#142033] mb-1">Đến lượt bạn!</h4>
                          <p className="text-xs text-[#64748B] font-medium leading-relaxed px-2">Nhập bản dịch vào khung chat bên trái để Giáo viên AI chấm điểm nhé.</p>
                        </div>
                      )}

                      {isEvaluating && (
                        <div className="bg-[#ECFDF5]/50 border border-[#A7F3D0]/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-full animate-fade-in">
                          <div className="w-10 h-10 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin mb-4"></div>
                          <h4 className="text-sm font-bold text-[#10B981] animate-pulse">Xiao Qingwa đang chấm điểm...</h4>
                        </div>
                      )}

                      {showAnswer && (
                        <div className="bg-[#ECFDF5] p-5 rounded-2xl border border-[#A7F3D0] h-full flex flex-col justify-center animate-fade-in">
                          <span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest block mb-2 text-center">Đáp án tiêu chuẩn</span>
                          <span className="text-xl font-black text-[#142033] text-center mb-2">{taskList[currentTaskIndex]?.chinese}</span>
                          {taskList[currentTaskIndex]?.ipa && <p className="text-sm font-bold text-[#10B981] text-center">{taskList[currentTaskIndex]?.ipa}</p>}
                        </div>
                      )}

                      {feedbackState === "correct" && (
                        <div className="bg-[#FFFBEB] p-6 rounded-2xl border border-[#FDE68A] h-full flex flex-col items-center justify-center text-center animate-fade-in">
                          <div className="text-4xl mb-2">🏆</div>
                          <p className="text-xs font-black text-[#F59E0B] uppercase tracking-widest mb-1">Chính xác!</p>
                          <p className="text-3xl font-black text-[#F59E0B]">+15 XP</p>
                        </div>
                      )}
                    </div>

                    {/* Vùng Button (Cố định dưới cùng) */}
                    <div className="shrink-0">
                      {feedbackState === "incorrect" && !isEvaluating && (
                        <button onClick={() => setShowAnswer(!showAnswer)} className="w-full py-3.5 mb-3 bg-white border border-[#E2E8F0] text-[#64748B] font-bold text-sm rounded-xl hover:bg-[#F8FAFC] transition-colors shadow-sm">
                          {showAnswer ? "Ẩn đáp án" : "Bí quá? Xem đáp án mẫu"}
                        </button>
                      )}

                      <button 
                        onClick={nextTask}
                        disabled={feedbackState !== "correct"}
                        className="w-full py-4 bg-[#10B981] text-white rounded-xl font-black text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#059669] transition-colors shadow-md"
                      >
                        Câu tiếp theo →
                      </button>
                    </div>
                  </div>
                )}

                {/* Khi kết thúc Session */}
                {feedbackState === "finished" && (
                  <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-8 shadow-sm flex flex-col items-center justify-center flex-1 text-center animate-fade-in">
                    <div className="text-6xl mb-4">🐸🎉</div>
                    <h3 className="font-black text-[#142033] text-2xl mb-2">Tuyệt cú mèo!</h3>
                    <p className="text-sm text-[#64748B] font-medium mb-8">Bạn đã xuất sắc hoàn thành phiên dịch cùng Xiao Qingwa.</p>
                    <button 
                      onClick={() => setStep("SELECT_LEVEL")}
                      className="w-full py-4 bg-[#10B981] text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-[#059669] transition-colors shadow-xl"
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