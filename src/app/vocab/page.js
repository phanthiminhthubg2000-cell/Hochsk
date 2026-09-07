"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import myCustomData from "../cards.json";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore"; 
import { updateUserProgress } from "../../lib/firebaseUtils"; 

// --- HÀM HỖ TRỢ ---
const generateLevelsFromData = (data, wordsPerLevel = 10) => {
  const levels = [];
  const dataArray = Array.isArray(data) ? data : [];
  for (let i = 0; i < dataArray.length; i += wordsPerLevel) {
    const levelNumber = Math.floor(i / wordsPerLevel) + 1;
    levels.push({ level: levelNumber, words: dataArray.slice(i, i + wordsPerLevel) });
  }
  return levels.length > 0 ? levels : [{ level: 1, words: [] }];
};

export default function FlashcardPage() {
  const { user, isLoaded } = useUser();
  const availableHskLevels = [...new Set(myCustomData.map(item => item.level))].filter(Boolean).sort();
  
  // STATE: CORE VOCAB
  const [selectedHsk, setSelectedHsk] = useState(availableHskLevels[0] || "");
  const [levelsData, setLevelsData] = useState([]);
  const [viewingLevel, setViewingLevel] = useState(1);
  const [wordProgress, setWordProgress] = useState({}); 
  const [filter, setFilter] = useState("all"); 
  
  // STATE: FLASHCARD INTERACTION
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [canFlip, setCanFlip] = useState(false);
  
  // STATE: AI CHALLENGE & ERROR HANDLING
  const [sentenceInput, setSentenceInput] = useState("");
  const [isCheckingSentence, setIsCheckingSentence] = useState(false);
  const [sentenceResult, setSentenceResult] = useState(null); 
  const [aiError, setAiError] = useState(null); // Bắt lỗi AI mượt mà
  
  // STATE: USER & FIREBASE
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [errorDna, setErrorDna] = useState({}); 
  
  // STATE: MỚI SPRINT 2 (LEARN vs REVIEW)
  const [mode, setMode] = useState("learn"); 
  const [reviewQueue, setReviewQueue] = useState([]); 
  const streak = userData?.profile?.streak_days || 0;

  // --- LOGIC FIREBASE MỚI ĐỒNG BỘ ---
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const docRef = doc(db, "user_progress", user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setErrorDna(data.error_dna || {});
            
            if (data.learnedVocab && Array.isArray(data.learnedVocab)) {
              const mappedProgress = {};
              data.learnedVocab.forEach(wordId => { mappedProgress[wordId] = "mastered"; });
              setWordProgress(mappedProgress);
            }
          } else { setUserData({}); }
        } catch (error) {
          console.error("Lỗi lấy dữ liệu user:", error);
          setUserData({});
        } finally { setLoadingUser(false); }
      } else { setLoadingUser(false); }
    };
    fetchUserData();
  }, [user]);

  // --- LOGIC PHÂN TRANG THEO BÀI HỌC ---
  useEffect(() => {
    const dataForHsk = selectedHsk ? myCustomData.filter(item => item.level === selectedHsk) : myCustomData;
    const uniqueData = dataForHsk.filter((item, index, self) => index === self.findIndex((t) => t.front === item.front));
    setLevelsData(generateLevelsFromData(uniqueData, 10));
    setViewingLevel(1); 
    setActiveWordIndex(0);
  }, [selectedHsk]);

  // --- LOGIC ÔN TẬP (REVIEW QUEUE) TỪ ERROR DNA ---
  useEffect(() => {
    if (mode === "review" && Object.keys(errorDna).length > 0) {
      const wordsToReview = myCustomData.filter(item => errorDna[item.front] > 0);
      
      const masteredWordsId = Object.keys(wordProgress).filter(k => wordProgress[k] === "mastered");
      const randomMasteredWords = myCustomData.filter(item => masteredWordsId.includes(item.front)).sort(() => 0.5 - Math.random()).slice(0, 5);

      const finalQueue = [...new Map([...wordsToReview, ...randomMasteredWords].map(item => [item.front, item])).values()];
      setReviewQueue(finalQueue);
      setActiveWordIndex(0);
      setFilter("all");
    }
  }, [mode, errorDna]);

  // --- RESET TRẠNG THÁI THẺ ---
  useEffect(() => {
    setCanFlip(false); setIsFlipped(false); setSentenceInput(""); setSentenceResult(null); setAiError(null);
  }, [activeWordIndex, viewingLevel, filter, selectedHsk, mode]);

  useEffect(() => {
    if (sentenceResult?.isPass) { setCanFlip(true); setIsFlipped(true); }
  }, [sentenceResult]);

  if (levelsData.length === 0 || loadingUser) return (
    <div className="min-h-screen bg-[#EEF5E9] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-[#2F8F6E] border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold text-[#1B5E4B]">Đang tải khu vườn từ vựng...</p>
    </div>
  );

  // --- TÍNH TOÁN DỮ LIỆU HIỂN THỊ DỰA VÀO MODE (LEARN vs REVIEW) ---
  const activeLevelData = levelsData.find(l => l.level === viewingLevel) || levelsData[0];
  
  let currentWordsPool = [];
  if (mode === "learn") {
    currentWordsPool = activeLevelData.words.filter(word => {
      const status = wordProgress[word.front] || "learning";
      if (filter === "all") return true;
      return filter === status;
    });
  } else {
    currentWordsPool = reviewQueue; 
  }

  const activeWord = currentWordsPool[activeWordIndex];
  
  const masteredCount = activeLevelData.words.filter(w => wordProgress[w.front] === "mastered").length;
  const progressPercent = activeLevelData.words.length > 0 ? Math.round((masteredCount / activeLevelData.words.length) * 100) : 0;
  const allCount = activeLevelData.words.length;
  const learningCount = activeLevelData.words.length - masteredCount;

  // --- AI & INTERACTION LOGIC ---
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "zh-CN"; window.speechSynthesis.speak(utterance);
  };

  const handleCheckSentence = async () => {
    if (!sentenceInput.trim() || !activeWord || isCheckingSentence) return;
    
    setIsCheckingSentence(true); 
    setSentenceResult(null);
    setAiError(null); // Xóa lỗi cũ
    
    try {
      const res = await fetch("/api/check-sentence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetWord: activeWord.front, userSentence: sentenceInput })
      });
      
      if (!res.ok) {
        if (res.status === 429) throw new Error("Ếch canh đang trả lời quá nhiều bạn cùng lúc, đợi vài giây rồi thử lại nhé! 💦");
        throw new Error("Lỗi kết nối đến não bộ của Ếch Canh. Vui lòng thử lại! 🐸");
      }
      
      const data = await res.json();
      
      if (data.error) { 
        setAiError(data.error); 
        return; 
      }
      
      setSentenceResult(data);
    } catch (error) { 
      setAiError(error.message || "Lỗi mạng. Vui lòng kiểm tra lại kết nối!"); 
    } finally { 
      setIsCheckingSentence(false); 
    }
  };

  const handleMarkLearning = () => {
    if (!activeWord) return;
    setWordProgress({ ...wordProgress, [activeWord.front]: "learning" });
    if (!isFlipped) { setCanFlip(true); setIsFlipped(true); } 
    else { setActiveWordIndex(prev => prev < currentWordsPool.length - 1 ? prev + 1 : 0); }
  };

  const handleMarkMasteredAndNext = async () => {
    const isAlreadyMastered = wordProgress[activeWord?.front] === "mastered";
    const isPassed = isAlreadyMastered || sentenceResult?.isPass;
    if (!activeWord || !isPassed) return;
    
    const wordId = activeWord.front;
    const newProgress = { ...wordProgress, [wordId]: "mastered" };
    setWordProgress(newProgress);
    
    if (!isAlreadyMastered && user) {
      try {
        const learnedVocabArray = Object.keys(newProgress).filter(k => newProgress[k] === "mastered");
        await setDoc(doc(db, "user_progress", user.id), { learnedVocab: learnedVocabArray }, { merge: true });
        await updateUserProgress(user.id, 5, "vocabulary", 1); 
      } catch (error) { console.error("Lỗi đồng bộ từ vựng:", error); }
    }

    if (mode === "review" && user && errorDna[wordId]) {
       await setDoc(doc(db, "user_progress", user.id), { [`error_dna.${wordId}`]: 0 }, { merge: true });
    }

    setActiveWordIndex(prev => prev < currentWordsPool.length - 1 ? prev + 1 : 0);
  };

  const wordDisplay = activeWord ? activeWord.front : "";
  const pinyinDisplay = activeWord ? activeWord.ipa : "";
  const meaningDisplay = activeWord ? activeWord.back : "";
  const exampleDisplay = activeWord?.example || ""; 
  const isAlreadyMastered = activeWord ? wordProgress[activeWord.front] === "mastered" : false;
  const isFullyPassed = isAlreadyMastered || sentenceResult?.isPass;
  const allowFlip = canFlip || isAlreadyMastered; 

  return (
    <div className="flex min-h-screen bg-[#EEF5E9] font-sans text-[#1B5E4B] selection:bg-[#8FD9A8]/50">
      
      {/* =========================================
          SIDEBAR: HSK GARDEN STYLE
          ========================================= */}
      <aside className="w-[320px] bg-[#F7FAF3] border-r border-[#8FD9A8]/30 flex flex-col h-screen sticky top-0 shadow-sm z-30 shrink-0 hidden lg:flex">
        <div className="p-6 border-b border-[#E2E8F0]">
          <Link href="/">
            <button className="flex items-center gap-2 text-slate-500 hover:text-[#2F8F6E] font-bold text-sm transition-colors mb-6">
              <span>←</span> Trở về Vườn
            </button>
          </Link>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-[#2F8F6E] uppercase tracking-widest">Chọn hành trình</label>
            <div className="relative">
              <select 
                value={selectedHsk} 
                onChange={(e) => { setSelectedHsk(e.target.value); setMode("learn"); }}
                className="w-full appearance-none bg-white border border-[#E2E8F0] text-[#1B5E4B] font-black text-sm rounded-2xl px-4 py-3 outline-none cursor-pointer focus:ring-2 focus:ring-[#8FD9A8]/50 shadow-sm"
              >
                {availableHskLevels.map(lvl => (
                  <option key={lvl} value={lvl}>
                    Bộ {lvl.toUpperCase()}
                  </option>
                ))}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2F8F6E] pointer-events-none text-xs">▼</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-[#1B5E4B] text-sm">DANH SÁCH BÀI HỌC</h3>
            <span className="text-[10px] font-bold text-[#2F8F6E] bg-[#8FD9A8]/30 px-2 py-1 rounded-lg">{levelsData.length} bài</span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-[31px] before:top-4 before:bottom-4 before:w-[4px] before:bg-[#8FD9A8]/40 before:rounded-full">
            {levelsData.map((lvl) => {
              const isActive = lvl.level === viewingLevel && mode === "learn";
              const isCompleted = lvl.words.every(w => wordProgress[w.front] === "mastered") && lvl.words.length > 0;
              
              return (
                <div key={lvl.level} className="relative flex items-center gap-4 group cursor-pointer" onClick={() => { handleLevelChange(lvl); setMode("learn"); }}>
                  <div className="absolute -left-6 flex flex-col items-center justify-center">
                    {isActive && <div className="absolute -top-7 text-2xl animate-bounce z-20 filter drop-shadow-md">🐸</div>}
                    <div className={`w-6 h-6 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] z-10 flex items-center justify-center transition-all shadow-sm ${
                      isActive ? 'bg-[#2F8F6E] text-white scale-110 shadow-[0_0_0_6px_rgba(47,143,110,0.2)]' : isCompleted ? 'bg-[#1B5E4B] text-[#8FD9A8]' : 'bg-[#EEF5E9] text-slate-400 border border-slate-200 group-hover:bg-[#8FD9A8]'
                    }`}>
                      {isCompleted && !isActive ? <span className="text-[10px] font-black">✓</span> : <span className="text-[10px] font-black">{lvl.level}</span>}
                    </div>
                  </div>
                  <div className={`flex-1 p-4 rounded-[20px] transition-all border ${isActive ? 'bg-[#FDFBF7] border-[#FFD666]/40 shadow-sm translate-x-1' : isCompleted ? 'bg-transparent border-transparent opacity-80 hover:opacity-100 hover:bg-white' : 'bg-transparent border-transparent group-hover:bg-white group-hover:border-[#E2E8F0]'}`}>
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className={`font-black text-sm ${isActive ? 'text-[#1B5E4B]' : 'text-slate-700'}`}>Bài {lvl.level}</h4>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">{lvl.words.length} từ vựng</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* =========================================
          MAIN CONTENT: VOCABULARY JOURNEY
          ========================================= */}
      <main className="flex-1 relative flex flex-col min-w-0 h-screen overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 10px 10px, #8FD9A8 2px, transparent 0)", backgroundSize: "40px 40px" }}></div>
        
        <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide pb-20">
          <div className="max-w-4xl mx-auto w-full px-4 md:px-8 pt-6 md:pt-10">

            {/* HEADER: TOGGLE HỌC / ÔN TẬP */}
            <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-2 bg-white/60 p-1.5 rounded-[20px] border border-white shadow-sm backdrop-blur-md">
                <button 
                  onClick={() => setMode("learn")}
                  className={`px-5 py-2.5 rounded-[16px] font-black text-sm transition-all ${mode === "learn" ? 'bg-[#1B5E4B] text-white shadow-md' : 'text-slate-500 hover:text-[#2F8F6E]'}`}
                >
                  🌱 Học Từ Mới
                </button>
                <button 
                  onClick={() => setMode("review")}
                  className={`px-5 py-2.5 rounded-[16px] font-black text-sm transition-all flex items-center gap-2 ${mode === "review" ? 'bg-[#F2765B] text-white shadow-md' : 'text-slate-500 hover:text-[#F2765B]'}`}
                >
                  💦 Ôn Tập
                  {Object.keys(errorDna).length > 0 && <span className={`w-5 h-5 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex justify-center items-center text-[10px] ${mode === "review" ? 'bg-white text-[#F2765B]' : 'bg-[#FFF1F2] text-[#BE123C]'}`}>{Object.keys(errorDna).length}</span>}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white shadow-sm">
                  <span className="text-[#F2765B] text-lg">🔥</span><span className="font-black text-[#1B5E4B] text-sm">{streak} ngày</span>
                </div>
              </div>
            </header>

            {/* TIẾN ĐỘ BÀI HỌC (Ẩn đi nếu đang ở chế độ Ôn Tập) */}
            {mode === "learn" && (
              <div className="bg-white/90 backdrop-blur-xl rounded-[32px] p-6 md:p-8 shadow-sm border border-[#E2E8F0] mb-10">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-4 flex-1 pr-8">
                    <div className="w-full h-3.5 bg-[#EEF5E9] rounded-full overflow-hidden border border-[#E2E8F0]/50 shadow-inner">
                      <div className="h-full bg-[#2F8F6E] rounded-full transition-all duration-700 relative shadow-[0_0_10px_rgba(47,143,110,0.5)]" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <span className="font-black text-[#2F8F6E] text-lg shrink-0">{progressPercent}%</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 shrink-0 bg-[#F4F7F6] px-3 py-1.5 rounded-xl">{masteredCount} / {allCount} từ đã thuộc</span>
                </div>

                <div className="flex flex-wrap items-center bg-[#F4F7F6] p-1.5 rounded-2xl w-fit border border-[#E2E8F0]">
                  <button onClick={() => setFilter("all")} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${filter === "all" ? 'bg-white text-[#1B5E4B] shadow-sm' : 'text-slate-500'}`}>Tất cả <span className="ml-1 opacity-60 font-bold">{allCount}</span></button>
                  <button onClick={() => setFilter("learning")} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${filter === "learning" ? 'bg-white text-[#F2765B] shadow-sm' : 'text-slate-500'}`}>Chưa thuộc <span className="ml-1 opacity-60 font-bold">{learningCount}</span></button>
                  <button onClick={() => setFilter("mastered")} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${filter === "mastered" ? 'bg-white text-[#2F8F6E] shadow-sm' : 'text-slate-500'}`}>Đã thuộc <span className="ml-1 opacity-60 font-bold">{masteredCount}</span></button>
                </div>
              </div>
            )}

            {/* THÔNG BÁO HẾT TỪ */}
            {currentWordsPool.length === 0 ? (
                <div className="bg-white/90 backdrop-blur-xl p-12 rounded-[40px] shadow-sm border border-[#E2E8F0] text-center">
                  <div className="text-6xl mb-6">{mode === "learn" ? "✨" : "🐸🎉"}</div>
                  <h3 className="text-2xl font-black text-[#1B5E4B]">
                    {mode === "learn" ? "Không có từ vựng nào ở mục này!" : "Tuyệt vời! Khu vườn không còn từ nào cần ôn."}
                  </h3>
                </div>
            ) : (
              <>
                {/* KHU VỰC THẺ TỪ VỰNG */}
                <div className="relative mb-10 mt-4">
                  <button onClick={() => setActiveWordIndex(prev => prev > 0 ? prev - 1 : currentWordsPool.length - 1)} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-[#2F8F6E] shadow-md border border-slate-50 hover:scale-110 transition-all z-20"><span className="text-xl font-black">←</span></button>
                  <button onClick={() => setActiveWordIndex(prev => prev < currentWordsPool.length - 1 ? prev + 1 : 0)} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-[#2F8F6E] shadow-md border border-slate-50 hover:scale-110 transition-all z-20"><span className="text-xl font-black">→</span></button>

                  <div className={`w-full max-w-xl mx-auto bg-white rounded-[40px] shadow-xl border-b-[8px] overflow-hidden relative group transition-all ${mode === "review" ? 'border-b-[#F2765B]' : 'border-b-[#2F8F6E]'}`}>
                    
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
                        <span className="font-bold text-slate-300 text-sm tracking-widest">{activeWordIndex + 1} / {currentWordsPool.length}</span>
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border ${wordProgress[wordDisplay] === 'mastered' ? 'bg-[#8FD9A8]/30 text-[#1B5E4B] border-[#8FD9A8]' : mode === 'review' ? 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                          {wordProgress[wordDisplay] === 'mastered' ? '✓ Đã thuộc' : mode === 'review' ? '💦 Cần ôn lại' : 'Đang học'}
                        </span>
                    </div>

                    <div className="px-8 py-16 md:p-16 flex flex-col items-center justify-center text-center relative min-h-[460px] mt-4">
                      <button onClick={(e) => { e.stopPropagation(); speak(wordDisplay); }} className="w-16 h-16 bg-[#F4F7F6] text-[#2F8F6E] border border-[#E2E8F0] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-2xl transition-all hover:scale-110 hover:bg-[#2F8F6E] hover:text-white mb-8 z-10 shadow-sm">🔊</button>
                      
                      <h2 className="text-[120px] md:text-[140px] font-black text-[#1B5E4B] leading-none mb-6 font-serif tracking-tight drop-shadow-sm">{wordDisplay}</h2>

                      <div className={`flex flex-col items-center w-full transition-all duration-500 z-10 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'}`}>
                        <p className="text-2xl font-bold text-slate-400 mb-3 tracking-widest uppercase">{pinyinDisplay}</p>
                        <p className="text-3xl font-black text-[#2F8F6E] mb-6">{meaningDisplay}</p>
                        {exampleDisplay && (
                          <div className="bg-white border border-[#8FD9A8] px-6 py-4 rounded-2xl shadow-sm max-w-lg mt-2 relative">
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-0.5 border border-[#8FD9A8] rounded-full font-black text-[#2F8F6E] text-[9px] uppercase tracking-widest shadow-sm">Mẫu câu</span>
                            <p className="text-base font-medium text-[#1B5E4B] leading-relaxed mt-2">{exampleDisplay}</p>
                          </div>
                        )}
                      </div>

                      {!isFlipped && (
                        <button 
                          onClick={() => {
                            if (allowFlip) setIsFlipped(true);
                          }}
                          className={`absolute bottom-10 flex items-center gap-2 font-black text-xs px-6 py-3 rounded-full shadow-sm border transition-all z-10 ${allowFlip ? 'text-[#2F8F6E] bg-white border-[#E2E8F0] hover:border-[#8FD9A8] hover:-translate-y-1 cursor-pointer animate-pulse' : 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed opacity-50'}`}
                        >
                          {allowFlip ? <><span className="text-lg">👁</span> Bấm để xem nghĩa</> : <><span className="text-lg">🔒</span> Trả lời đúng để mở</>}
                        </button>
                      )}
                    </div>

                    <div className="h-2 w-full bg-[#EEF5E9] flex">
                      <div className={`h-full transition-all ${mode === "review" ? 'bg-[#F2765B]' : 'bg-[#2F8F6E]'}`} style={{ width: `${((activeWordIndex + 1) / currentWordsPool.length) * 100}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* KHU VỰC ĐẶT CÂU & CHẤM ĐIỂM (CÓ SMART ERROR HANDLING) */}
                <div className="max-w-2xl mx-auto mb-10">
                  <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-sm border border-[#E2E8F0] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#FFD666]/20 to-transparent rounded-bl-full -z-0 pointer-events-none"></div>

                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-[#FFF8E8] text-[#FFC83D] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-2xl shadow-sm border border-[#FFC83D]/20">✍️</div>
                        <div>
                          <h3 className="text-sm font-black text-[#1B5E4B] uppercase tracking-widest">Thử thách đặt câu</h3>
                          <p className="text-xs font-medium text-slate-500 mt-1">Dùng từ <strong className="text-[#2F8F6E] text-sm bg-[#8FD9A8]/20 px-2 py-0.5 rounded border border-[#8FD9A8]/30"> {wordDisplay} </strong> để tạo một câu:</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <input 
                          type="text" 
                          placeholder="Nhập chữ Hán hoặc Pinyin..." 
                          value={sentenceInput}
                          onChange={(e) => { 
                            setSentenceInput(e.target.value); 
                            if (sentenceResult && !sentenceResult.isPass) setSentenceResult(null); 
                            if (aiError) setAiError(null); 
                          }}
                          disabled={sentenceResult?.isPass || isCheckingSentence}
                          className="w-full sm:flex-1 bg-white border-2 border-[#E2E8F0] text-[#1B5E4B] font-bold text-sm rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-[#8FD9A8]/30 focus:border-[#2F8F6E] transition-all disabled:opacity-60 disabled:bg-slate-50"
                        />
                        <button 
                          onClick={handleCheckSentence} 
                          disabled={sentenceResult?.isPass || !sentenceInput.trim() || isCheckingSentence}
                          className={`w-full sm:w-auto px-8 py-4 font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${sentenceResult?.isPass ? 'bg-[#2F8F6E] text-white shadow-[#8FD9A8]/50' : 'bg-[#1B5E4B] hover:bg-[#2F8F6E] text-white hover:-translate-y-0.5'}`}
                        >
                          <span>{isCheckingSentence ? "Đang chấm..." : (sentenceResult?.isPass ? "✓ Đã chấm" : "Kiểm tra")}</span>
                        </button>
                      </div>

                      {/* HIỂN THỊ LỖI QUÁ TẢI API (Smart Error Catching) */}
                      {aiError && (
                        <div className="mt-6 p-4 rounded-2xl border bg-[#FFF1F2] border-[#FECDD3] animate-fade-in flex gap-3 items-center shadow-sm">
                           <div className="text-2xl shrink-0">💦</div>
                           <p className="text-xs font-bold text-[#BE123C] leading-relaxed">{aiError}</p>
                        </div>
                      )}

                      {/* HIỂN THỊ KẾT QUẢ CHẤM ĐIỂM CỦA AI */}
                      {sentenceResult && !aiError && (
                        <div className={`mt-6 p-5 rounded-2xl border animate-fade-in flex gap-4 shadow-inner ${sentenceResult.isPass ? 'bg-[#EEF5E9] border-[#8FD9A8]/50' : 'bg-[#FFF1F2] border-[#FECDD3]'}`}>
                            <div className="text-3xl shrink-0 mt-1">{sentenceResult.isPass ? '🐸' : '💦'}</div>
                            <div>
                              <h4 className={`font-black text-sm mb-1 ${sentenceResult.isPass ? 'text-[#1B5E4B]' : 'text-[#BE123C]'}`}>{sentenceResult.isPass ? "太棒了！Tuyệt vời!" : "再试一次！Chưa chính xác:"}</h4>
                              <p className="text-xs font-medium text-[#1B5E4B]/80 mb-2 leading-relaxed">{sentenceResult.feedback}</p>
                              {!sentenceResult.isPass && sentenceResult.suggestion && (
                                  <p className="text-xs text-[#1B5E4B] bg-white p-3 rounded-xl border border-slate-200/60 leading-relaxed shadow-sm"><span className="font-black text-[#FFC83D]">💡 Gợi ý:</span> {sentenceResult.suggestion}</p>
                              )}
                            </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* NÚT ACTION (ĐIỀU HƯỚNG CHÍNH) */}
                <div className="flex gap-4 w-full max-w-xl mx-auto pb-10">
                    <button onClick={() => { handleMarkLearning(); setActiveWordIndex(prev => prev < currentWordsPool.length - 1 ? prev + 1 : 0); }} className="flex-1 py-4 bg-white border-2 border-[#E2E8F0] text-slate-500 rounded-2xl font-black text-sm hover:border-[#F2765B] hover:bg-[#FFF1F2] hover:text-[#BE123C] transition-all shadow-sm flex items-center justify-center gap-2">
                      {!isFlipped ? <><span>👀</span> Xem nghĩa / Bỏ qua</> : <><span>⏭️</span> Từ tiếp theo</>}
                    </button>
                    <button 
                      onClick={handleMarkMasteredAndNext} disabled={!isFullyPassed}
                      className={`flex-[1.5] py-4 rounded-2xl font-black text-sm transition-all shadow-md flex justify-center items-center gap-2 ${isFullyPassed ? 'bg-[#2F8F6E] text-white hover:bg-[#1B5E4B] hover:shadow-lg hover:-translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      <span>✓</span> Đã thuộc (+5 XP) ➔
                    </button>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}