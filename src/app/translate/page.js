"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import arrangeData from "../arrange.json"; 
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

const HSK_LEVELS = [
  { name: "HSK 1", requiredExp: 0 },
  { name: "HSK 2", requiredExp: 2000 },
  { name: "HSK 3", requiredExp: 4000 },
  { name: "HSK 4", requiredExp: 6000 },
  { name: "HSK 5", requiredExp: 8000 },
  { name: "HSK 6", requiredExp: 10000 },
];

export default function TranslatePage() {
  const { user, isLoaded } = useUser();

  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [userData, setUserData] = useState(null);
  const [userExp, setUserExp] = useState(0); 
  const [loadingUser, setLoadingUser] = useState(true);
  
  const [currentSentence, setCurrentSentence] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false); 
  
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [evaluation, setEvaluation] = useState(null); 
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [sentenceHistory, setSentenceHistory] = useState([]);
  
  // UI States
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Lấy dữ liệu Streak (Mô phỏng từ userData)
  const streak = userData?.streakCount || 0;

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const docRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            const cloudExp = data.translateExp !== undefined ? data.translateExp : (parseInt(localStorage.getItem("ai_translate_exp")) || 0);
            setUserExp(cloudExp);
          } else {
            setUserData({});
            const localExp = parseInt(localStorage.getItem("ai_translate_exp")) || 0;
            setUserExp(localExp);
          }
        } catch (error) {
          console.error("Lỗi lấy dữ liệu tiến độ:", error);
          setUserData({});
          setUserExp(parseInt(localStorage.getItem("ai_translate_exp")) || 0);
        } finally {
          setLoadingUser(false);
        }
      } else {
        setUserExp(parseInt(localStorage.getItem("ai_translate_exp")) || 0);
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!loadingUser) {
      localStorage.setItem("ai_translate_exp", userExp);
    }
  }, [userExp, loadingUser]);

  const isHskLocked = (lvlName) => {
    const cleanLvl = String(lvlName).replace(/\D/g, ''); 
    if (!cleanLvl) return true;
    const levelNum = parseInt(cleanLvl, 10);
    
    if (levelNum === 1) return false;
    
    const requiredFlag = `passedHSK${levelNum - 1}`;
    const currentFlag = `passedHSK${levelNum}`;
    const passedTest = userData?.[requiredFlag] || userData?.[currentFlag];

    const targetLvlObj = HSK_LEVELS.find(l => l.name === lvlName);
    const hasEnoughExp = targetLvlObj && userExp >= targetLvlObj.requiredExp;

    return !(passedTest || hasEnoughExp);
  };

  useEffect(() => {
    if (userData && isHskLocked(selectedHsk)) {
      const firstUnlocked = HSK_LEVELS.find(lvl => !isHskLocked(lvl.name));
      if (firstUnlocked) {
        setSelectedHsk(firstUnlocked.name);
      }
    }
  }, [userData, userExp, selectedHsk]);

  useEffect(() => {
    const savedHistory = localStorage.getItem("ai_translate_history");
    let historyArr = [];
    if (savedHistory) {
        historyArr = JSON.parse(savedHistory);
        setSentenceHistory(historyArr);
    }
    generateNewSentence("HSK 1", historyArr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sentenceHistory.length > 0) {
      const recent = sentenceHistory.slice(-50);
      localStorage.setItem("ai_translate_history", JSON.stringify(recent));
    }
  }, [sentenceHistory]);

  const generateNewSentence = (level, history = sentenceHistory) => {
    setIsLoading(true);
    setEvaluation(null);
    setUserInput("");
    setShowAnswer(false);
    setErrorMsg(null);
    
    try {
      const targetLvl = level.replace(/\s+/g, '').toUpperCase();
      
      let availableSentences = arrangeData.filter(item => {
          if (!item.level) return false;
          const itemLvl = item.level.replace(/\s+/g, '').toUpperCase();
          return itemLvl === targetLvl && !history.includes(item.vietnamese);
      });

      if (availableSentences.length === 0) {
          const totalInLevel = arrangeData.filter(item => item.level && item.level.replace(/\s+/g, '').toUpperCase() === targetLvl);
          if (totalInLevel.length === 0) {
               throw new Error(`Chưa có dữ liệu cho ${level} trong file JSON.`);
          } else {
               availableSentences = totalInLevel; 
          }
      }

      const randomIndex = Math.floor(Math.random() * availableSentences.length);
      
      setTimeout(() => {
          setCurrentSentence(availableSentences[randomIndex]);
          setIsLoading(false);
      }, 300); // Thêm tí delay mượt mà
      
    } catch (error) {
      setCurrentSentence(null); 
      setErrorMsg(error.message);
      setIsLoading(false);
    }
  };

  const submitTranslation = async () => {
    if (!currentSentence || !userInput.trim()) return;
    setIsGrading(true);
    setEvaluation(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: "grade",
            vietnamese: currentSentence.vietnamese,
            chinese: currentSentence.chinese,
            userInput: userInput.trim()
        })
      });

      if (!res.ok) throw new Error("Lỗi khi kết nối với Giáo viên AI");
      
      const result = await res.json();
      setEvaluation(result);

      if (result.isCorrect) {
          setSentenceHistory(prev => [...prev, currentSentence.vietnamese]); 

          const currentSelectedNum = parseInt(selectedHsk.replace(/\D/g, ''), 10);
          
          let highestUnlockedNum = 1;
          for (let lvl of HSK_LEVELS) {
            if (!isHskLocked(lvl.name)) {
              const num = parseInt(lvl.name.replace(/\D/g, ''), 10);
              if (num > highestUnlockedNum) highestUnlockedNum = num;
            }
          }

          if (currentSelectedNum >= highestUnlockedNum) {
              const newExp = userExp + 10; 
              setUserExp(newExp); 

              if (user) {
                try {
                  const studentRef = doc(db, "progress", user.id);
                  await setDoc(studentRef, { translateExp: newExp }, { merge: true });
                } catch (error) {
                  console.error("Lỗi đồng bộ EXP lên đám mây:", error);
                }
              }
          }
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsGrading(false);
    }
  };

  const handleKeyDown = (e) => {
      if (e.key === 'Enter' && e.ctrlKey && !isLoading && !isGrading && userInput.trim() && !evaluation?.isCorrect) {
          submitTranslation();
      }
  };

  const currentLevelIndex = HSK_LEVELS.findIndex(
    (l, idx) => userExp >= l.requiredExp && (idx === HSK_LEVELS.length - 1 || userExp < HSK_LEVELS[idx + 1].requiredExp)
  );
  const currentLvlObj = HSK_LEVELS[currentLevelIndex !== -1 ? currentLevelIndex : 0];
  const nextLvlObj = HSK_LEVELS[currentLevelIndex + 1];
  
  let expPercent = 100;
  if (nextLvlObj) {
      const expInCurrentLevel = userExp - currentLvlObj.requiredExp;
      const expNeeded = nextLvlObj.requiredExp - currentLvlObj.requiredExp;
      expPercent = Math.min(Math.round((expInCurrentLevel / expNeeded) * 100), 100);
  }

  const isCurrentHskLocked = isHskLocked(selectedHsk);

  let currentMaxUnlockedName = "HSK 1";
  for (let lvl of HSK_LEVELS) {
    if (!isHskLocked(lvl.name)) currentMaxUnlockedName = lvl.name;
  }
  const isPlayingAtMaxLevel = selectedHsk === currentMaxUnlockedName;

  const recentHistory = [...sentenceHistory].reverse().slice(0, 10);
  
  // Tính toán trước EXP cần thiết để tránh ghi trực tiếp logic hàm trong JSX
  const requiredExpForSelectedHsk = HSK_LEVELS.find(l => l.name === selectedHsk)?.requiredExp || 0;

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#F4F8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-6xl animate-bounce">🐸</div>
          <p className="font-black text-[#08A66A] tracking-widest uppercase">Đang tải không gian học...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F8F5] font-sans text-slate-800 relative overflow-hidden flex flex-col selection:bg-emerald-200">
      
      {/* BACKGROUND ẢNH CÓ LỚP PHỦ MỜ */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: "url('/hskk/dich.jpg')" }} 
      >
        <div className="absolute inset-0 bg-[#F4F8F5]/90 backdrop-blur-[2px]"></div>
      </div>

      {/* =========================================
          TẦNG 1: HEADER CỐ ĐỊNH (TOP NAV)
          ========================================= */}
      <header className="relative z-20 bg-white/80 backdrop-blur-md border-b border-emerald-100 shadow-sm sticky top-0">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 bg-[#08A66A] rounded-full flex items-center justify-center text-white text-2xl shadow-sm">🐸</div>
            <div>
              <h1 className="font-black text-slate-900 text-lg leading-tight">Hành Trình HSK</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Học tiếng Trung, chạm đến tương lai</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <Link href="/" className="px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-emerald-50 hover:text-[#08A66A] transition-colors flex items-center gap-2">
              <span className="text-lg">🏠</span> Trang chủ
            </Link>
            <Link href="/vocab" className="px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-emerald-50 hover:text-[#08A66A] transition-colors flex items-center gap-2">
              <span className="text-lg">📚</span> Học tập
            </Link>
            <div className="px-5 py-2.5 rounded-2xl text-sm font-black bg-[#DDF7EA] text-[#08A66A] shadow-sm flex items-center gap-2 cursor-pointer">
              <span className="text-lg">✍️</span> Dịch câu
            </div>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-emerald-50">
              <span className="text-amber-500 text-lg">🔥</span>
              <div className="flex flex-col">
                <span className="font-black text-slate-800 text-xs leading-none">{streak} ngày</span>
                <span className="text-[8px] text-slate-400 font-bold">Chuỗi học liên tiếp</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-amber-50">
              <span className="text-[#FFC83D] text-lg">⭐</span>
              <div className="flex flex-col">
                <span className="font-black text-slate-800 text-xs leading-none">{userExp} XP</span>
                <span className="text-[8px] text-slate-400 font-bold">Điểm dịch thuật</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              {isLoaded && user ? (
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-[9px] text-slate-400 font-bold">Xin chào,</p>
                    <p className="text-xs font-black text-slate-800">{user.firstName || "Bạn"}</p>
                  </div>
                  <UserButton afterSignOutUrl="/" />
                </div>
              ) : (
                <SignInButton mode="modal">
                  <button className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md">Đăng nhập</button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================
          TẦNG 2 & 3: MAIN WORKSPACE
          ========================================= */}
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide py-8">
        <div className="max-w-[1400px] mx-auto px-6">
          
          {/* Top Breadcrumb & Focus Mode */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4 md:gap-6">
              <Link href="/">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl font-bold text-sm text-slate-600 shadow-sm border border-white hover:text-[#08A66A] transition-all">
                  <span>←</span> Quay lại
                </button>
              </Link>
              
              <div className="hidden sm:flex items-center gap-2 text-sm font-bold bg-white/60 px-4 py-2 rounded-xl backdrop-blur-md">
                <span className="text-slate-600">Học tập</span>
                <span className="text-slate-400">›</span>
                <span className="text-slate-600">Dịch thuật</span>
                <span className="text-slate-400">›</span>
                <span className="text-[#08A66A] font-black">{selectedHsk}</span>
              </div>
            </div>

            <button 
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm transition-all shadow-sm border ${
                isFocusMode 
                  ? 'bg-[#08A66A] text-white border-[#087A55] shadow-emerald-500/20' 
                  : 'bg-white text-[#08A66A] border-white hover:bg-[#DDF7EA]'
              }`}
            >
              <span>🌿</span> Chế độ tập trung
            </button>
          </div>

          {/* LAYOUT CHIA 3 CỘT (Left Sidebar - Main Center - Right Sidebar) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start transition-all duration-500">
            
            {/* --- CỘT TRÁI: HỒ SƠ TIẾN BỘ --- */}
            {!isFocusMode && (
              <div className="lg:col-span-3 transition-all duration-500 animate-fade-in w-full">
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white sticky top-28">
                  
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <span className="text-xl">🎯</span> Hành trình
                    </h3>
                  </div>

                  <div className="bg-[#F4F8F5] p-5 rounded-2xl border border-emerald-100/50 mb-6">
                    <p className="text-[10px] font-black text-[#08A66A] tracking-widest uppercase mb-1">Cấp độ hiện tại</p>
                    <p className="text-2xl font-black text-slate-800 mb-2">{currentLvlObj?.name}</p>
                    
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-[#08A66A] transition-all duration-500" style={{ width: `${expPercent}%` }}></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                      <span>{userExp} XP</span>
                      {nextLvlObj && <span>→ {nextLvlObj.name}</span>}
                    </div>
                  </div>

                  <p className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-widest text-[10px]">Chuyển cấp độ bài tập</p>
                  <select 
                      value={selectedHsk} 
                      onChange={(e) => {
                          setSelectedHsk(e.target.value);
                          generateNewSentence(e.target.value);
                      }}
                      className="w-full bg-white border-2 border-slate-100 text-[#087A55] font-black py-3 px-4 rounded-xl outline-none cursor-pointer hover:border-[#08A66A] transition mb-6 shadow-sm"
                  >
                      {HSK_LEVELS.map(lvl => {
                          const locked = isHskLocked(lvl.name);
                          return (
                              <option key={lvl.name} value={lvl.name} disabled={locked}>
                                  {lvl.name} {locked ? `🔒 (Cần ${lvl.requiredExp} XP)` : ""}
                              </option>
                          );
                      })}
                  </select>

                  <div className="flex flex-col items-center mt-6 pt-6 border-t border-slate-100 text-center">
                    <div className="text-5xl drop-shadow-sm mb-3">🐸</div>
                    <h4 className="font-black text-[#087A55] text-sm">加油！</h4>
                    <p className="text-xs font-medium text-emerald-700 mt-1 leading-relaxed">
                      {isPlayingAtMaxLevel 
                        ? "Làm bài ở cấp độ này sẽ được cộng +10 XP mỗi câu!" 
                        : "Ôn tập thật tốt nhé! Không cộng XP ở cấp độ này."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* --- CỘT GIỮA: KHU VỰC DỊCH THUẬT (MAIN CARD) --- */}
            <div className={`${isFocusMode ? 'lg:col-span-8 lg:col-start-3' : 'lg:col-span-6'} transition-all duration-500 w-full`}>
              {isCurrentHskLocked ? (
                <div className="bg-white/95 backdrop-blur-xl p-12 rounded-[32px] shadow-lg border border-white text-center flex flex-col items-center justify-center min-h-[500px]">
                  <div className="text-6xl mb-6">🔒</div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3">Cấp độ {selectedHsk} đang bị khóa!</h3>
                  <p className="text-slate-500 mb-8 max-w-md font-medium leading-relaxed">
                    Bạn cần đạt đủ {requiredExpForSelectedHsk} EXP hoặc vượt qua bài kiểm tra để mở khóa.
                  </p>
                  <Link href="/test" className="px-6 py-3.5 bg-[#172033] text-white font-bold rounded-2xl shadow hover:bg-slate-800 transition">
                    🎯 Kiểm Tra Trình Độ ngay
                  </Link>
                </div>
              ) : (
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 md:p-10 shadow-lg shadow-emerald-900/5 border border-white relative overflow-hidden flex flex-col h-full min-h-[600px]">
                  
                  {/* Header trong Card */}
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[#FFC83D] text-2xl">✦</span>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Thử Thách Dịch Thuật</h2>
                      </div>
                      <p className="text-slate-500 text-sm font-bold bg-slate-100 px-3 py-1 rounded-lg w-fit ml-8">
                        {selectedHsk}
                      </p>
                    </div>
                  </div>

                  {isLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center animate-pulse py-20">
                          <div className="text-6xl mb-4">🗂️</div>
                          <h3 className="text-xl font-bold text-slate-500">Đang chọn câu hỏi mới...</h3>
                      </div>
                  ) : currentSentence ? (
                      <div className="flex-1 flex flex-col w-full animate-fade-in relative z-10">
                          
                          {/* PROMPT CARD (CÂU TIẾNG VIỆT) */}
                          <div className="bg-[#F4F8F5] p-8 rounded-[24px] border border-emerald-100/50 mb-8 relative">
                            <div className="absolute -top-3 left-6 bg-[#08A66A] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                              🇻🇳 Hãy dịch sang Tiếng Trung
                            </div>
                            <p className="text-2xl md:text-[28px] font-bold text-slate-800 leading-relaxed mt-2 text-center">
                              {currentSentence.vietnamese}
                            </p>
                          </div>

                          {/* INPUT AREA */}
                          <div className="relative mb-8">
                              <p className="text-[10px] font-black text-[#08A66A] uppercase tracking-widest mb-2 pl-2 flex items-center gap-1.5">
                                <span className="text-base">✍️</span> Bản dịch của bạn
                              </p>
                              <textarea 
                                  rows="3"
                                  value={userInput}
                                  onChange={(e) => {
                                      setUserInput(e.target.value);
                                      setEvaluation(null);
                                      setShowAnswer(false);
                                  }}
                                  onKeyDown={handleKeyDown}
                                  placeholder="Nhập bản dịch tiếng Trung..."
                                  className={`w-full bg-white border-2 text-slate-800 font-bold text-xl rounded-[24px] p-6 outline-none transition-all resize-none shadow-sm placeholder:text-slate-300 placeholder:font-medium ${
                                      evaluation?.isCorrect === true ? 'border-emerald-500 bg-[#DDF7EA]/50 text-[#087A55]' :
                                      evaluation?.isCorrect === false ? 'border-rose-400 bg-rose-50/50 text-rose-700' :
                                      'border-slate-200 focus:border-[#08A66A] focus:ring-4 focus:ring-[#08A66A]/10'
                                  }`}
                                  disabled={evaluation?.isCorrect || isGrading}
                              ></textarea>
                              <div className="absolute bottom-4 right-4 flex items-center gap-3">
                                <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded-md hidden sm:block">Ctrl + Enter</span>
                                <span className="text-xs font-bold text-slate-300">{userInput.length} / 100</span>
                              </div>
                          </div>

                          {/* FEEDBACK TỪ AI */}
                          {isGrading && (
                              <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 font-bold text-sm mb-8 animate-pulse w-fit">
                                <span className="text-xl">👨‍🏫</span> AI đang đọc và chấm bài...
                              </div>
                          )}

                          {evaluation && (
                              <div className={`mb-8 p-6 rounded-[24px] border relative animate-fade-in ${evaluation.isCorrect ? 'bg-[#DDF7EA] border-[#08A66A]/30' : 'bg-rose-50 border-rose-200'}`}>
                                  {evaluation.isCorrect && isPlayingAtMaxLevel && (
                                    <div className="absolute -top-8 right-4 flex flex-col items-center animate-slide-up-fade">
                                      <span className="text-2xl">✨</span>
                                      <span className="font-black text-[#FFC83D] text-lg drop-shadow-md">+10 XP</span>
                                    </div>
                                  )}

                                  <div className="flex items-start gap-4">
                                    <div className="text-4xl mt-1">{evaluation.isCorrect ? '🐸' : '🐸'}</div>
                                    <div className="flex-1">
                                      <h4 className={`font-black text-lg mb-2 ${evaluation.isCorrect ? 'text-[#087A55]' : 'text-rose-700'}`}>
                                          {evaluation.isCorrect ? "太棒了！Rất tốt!" : "Gần đúng rồi! Thử lại nhé."}
                                      </h4>
                                      <p className="text-sm text-slate-700 leading-relaxed font-medium mb-3">
                                        {evaluation.message}
                                      </p>
                                      
                                      {!evaluation.isCorrect && evaluation.suggestion && (
                                          <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
                                            <p className="text-xs font-black text-[#FFC83D] mb-1">💡 GỢI Ý MẸO NHỚ:</p>
                                            <p className="text-sm text-slate-600 leading-relaxed">{evaluation.suggestion}</p>
                                          </div>
                                      )}
                                    </div>
                                  </div>
                              </div>
                          )}

                          {/* BẢNG ĐÁP ÁN (Khi bấm xem) */}
                          {showAnswer && !evaluation?.isCorrect && (
                              <div className="mb-8 p-6 bg-slate-50 rounded-[24px] border border-slate-200 animate-fade-in text-center relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/50 rounded-bl-full -z-0"></div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 relative z-10">Đáp án chuẩn tham khảo</p>
                                  <p className="text-3xl font-black text-[#172033] mb-2 relative z-10">{currentSentence.chinese}</p>
                                  <p className="text-lg font-bold text-slate-500 relative z-10">{currentSentence.pinyin}</p>
                              </div>
                          )}

                          {/* NÚT ACTION - Luôn neo ở dưới */}
                          <div className="mt-auto flex flex-col sm:flex-row gap-4 pt-4">
                              {!evaluation?.isCorrect && (
                                  <button 
                                      onClick={() => setShowAnswer(!showAnswer)}
                                      className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2"
                                  >
                                      <span className="text-lg">{showAnswer ? "🙈" : "👁"}</span> {showAnswer ? "Ẩn đáp án" : "Xem đáp án chuẩn"}
                                  </button>
                              )}

                              {!evaluation?.isCorrect ? (
                                  <button 
                                      onClick={submitTranslation}
                                      disabled={isGrading || !userInput.trim()}
                                      className="flex-1 py-4 bg-[#08A66A] text-white rounded-2xl font-black text-sm hover:bg-[#087A55] transition-all shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                  >
                                      ✨ Nộp bài cho AI chấm
                                  </button>
                              ) : (
                                  <button 
                                      onClick={() => generateNewSentence(selectedHsk)}
                                      className="w-full py-4 bg-[#172033] text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                  >
                                      Câu tiếp theo ➔
                                  </button>
                              )}
                          </div>

                      </div>
                  ) : (
                      <div className="text-center bg-red-50 p-6 rounded-2xl border border-red-200 m-auto">
                          <p className="text-red-600 font-bold text-xl mb-2">Thông báo</p>
                          <p className="text-red-500 font-medium max-w-md mx-auto">{errorMsg || "Lỗi không xác định"}</p>
                      </div>
                  )}
                </div>
              )} 
            </div>

            {/* --- CỘT PHẢI: GỢI Ý & LỊCH SỬ --- */}
            {!isFocusMode && (
              <div className="lg:col-span-3 transition-all duration-500 animate-fade-in w-full flex flex-col gap-6">
                
                {/* Gợi ý nhỏ */}
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-5">
                    <span className="text-xl">💡</span> Gợi ý nhỏ
                  </h3>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <span className="text-[#08A66A] shrink-0 mt-0.5">🎧</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">Đọc kỹ câu Tiếng Việt và xác định thì/thể của câu.</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#08A66A] shrink-0 mt-0.5">📚</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">Sử dụng đúng từ vựng thuộc {selectedHsk}.</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#08A66A] shrink-0 mt-0.5">🌿</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">Dịch tự nhiên, không cần word-by-word.</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#08A66A] shrink-0 mt-0.5">⭐</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">AI sẽ chấm độ tự nhiên và ngữ pháp.</p>
                    </li>
                  </ul>
                </div>

                {/* Lịch sử làm bài */}
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white flex-1 min-h-[300px]">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <span className="text-xl">⏳</span> Lịch sử
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{recentHistory.length} câu</span>
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {recentHistory.length > 0 ? recentHistory.map((sent, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-[#F4F8F5] rounded-xl border border-emerald-50">
                        <span className="text-[#08A66A] font-black text-xs shrink-0 mt-0.5">✓</span>
                        <p className="text-xs font-bold text-slate-600 line-clamp-2 leading-relaxed" title={sent}>{sent}</p>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 font-medium text-center py-10 italic">
                        Chưa có lịch sử làm bài.<br/>Hãy dịch câu đầu tiên nhé!
                      </p>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}