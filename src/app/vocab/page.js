"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import myCustomData from "../cards.json";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore"; 

const generateLevelsFromData = (data, wordsPerLevel = 10) => {
  const levels = [];
  const dataArray = Array.isArray(data) ? data : [];
  for (let i = 0; i < dataArray.length; i += wordsPerLevel) {
    const levelNumber = Math.floor(i / wordsPerLevel) + 1;
    levels.push({
      level: levelNumber,
      words: dataArray.slice(i, i + wordsPerLevel)
    });
  }
  return levels.length > 0 ? levels : [{ level: 1, words: [] }];
};

export default function FlashcardPage() {
  const { user, isLoaded } = useUser();
  const availableHskLevels = [...new Set(myCustomData.map(item => item.level))].filter(Boolean).sort();
  const [selectedHsk, setSelectedHsk] = useState(availableHskLevels[0] || "");
  
  const [levelsData, setLevelsData] = useState([]);
  const [viewingLevel, setViewingLevel] = useState(1);
  
  const [wordProgress, setWordProgress] = useState({}); 
  const [filter, setFilter] = useState("all"); 
  
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [canFlip, setCanFlip] = useState(false);
  
  const [sentenceInput, setSentenceInput] = useState("");
  const [isCheckingSentence, setIsCheckingSentence] = useState(false);
  const [sentenceResult, setSentenceResult] = useState(null); 
  
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const streak = userData?.streakCount || 0;

  const [examState, setExamState] = useState({
    isOpen: false,
    questions: [],
    currentIndex: 0,
    score: 0,
    isFinished: false,
    total: 0,
    passScore: 0
  });

  useEffect(() => {
    setCanFlip(false);
    setIsFlipped(false);
    setSentenceInput("");
    setSentenceResult(null);
  }, [activeWordIndex, viewingLevel, filter, selectedHsk]);

  useEffect(() => {
    if (sentenceResult?.isPass) {
      setCanFlip(true);
      setIsFlipped(true);
    }
  }, [sentenceResult]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const docRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            setUserData({});
          }
        } catch (error) {
          console.error("Lỗi lấy dữ liệu chứng chỉ:", error);
          setUserData({});
        } finally {
          setLoadingUser(false);
        }
      } else {
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [user]);

  // Kiểm tra khóa bộ HSK
  const isHskLocked = (lvl) => {
    const cleanLvl = String(lvl).replace(/\D/g, ''); 
    if (!cleanLvl) return true;
    const levelNum = parseInt(cleanLvl, 10);
    
    if (levelNum === 1) return false;
    
    const requiredFlag = `passedHSK${levelNum - 1}`;
    const currentFlag = `passedHSK${levelNum}`;
    
    return !userData?.[requiredFlag] && !userData?.[currentFlag];
  };

  useEffect(() => {
    if (userData && isHskLocked(selectedHsk)) {
      const firstUnlocked = availableHskLevels.find(lvl => !isHskLocked(lvl));
      if (firstUnlocked) {
        setSelectedHsk(firstUnlocked);
      }
    }
  }, [userData, selectedHsk]);

  useEffect(() => {
    const dataForHsk = selectedHsk 
      ? myCustomData.filter(item => item.level === selectedHsk) 
      : myCustomData;
      
    const uniqueData = dataForHsk.filter((item, index, self) =>
      index === self.findIndex((t) => t.front === item.front)
    );
      
    const generatedLevels = generateLevelsFromData(uniqueData, 10); 
    setLevelsData(generatedLevels);
    setViewingLevel(1); 
    setActiveWordIndex(0);
  }, [selectedHsk]);

  useEffect(() => {
    const savedProgress = localStorage.getItem("hskk_word_progress");
    if (savedProgress) setWordProgress(JSON.parse(savedProgress));
  }, []);

  useEffect(() => {
    if (Object.keys(wordProgress).length > 0) {
      localStorage.setItem("hskk_word_progress", JSON.stringify(wordProgress));
    }
  }, [wordProgress]);

  if (levelsData.length === 0 || loadingUser) return (
    <div className="min-h-screen bg-[#F4F8F5] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="text-6xl animate-bounce">🐸</div>
        <p className="font-black text-[#08A66A] tracking-widest uppercase">Đang tải dữ liệu từ vựng...</p>
      </div>
    </div>
  );

  const activeLevelData = levelsData.find(l => l.level === viewingLevel) || levelsData[0];
  const filteredWords = activeLevelData.words.filter(word => {
    const wordId = word.front;
    const status = wordProgress[wordId] || "learning";
    if (filter === "all") return true;
    return filter === status;
  });

  const activeWord = filteredWords[activeWordIndex];
  const masteredCount = activeLevelData.words.filter(w => wordProgress[w.front] === "mastered").length;
  const progressPercent = activeLevelData.words.length > 0 
    ? Math.round((masteredCount / activeLevelData.words.length) * 100) : 0;

  // Thống kê filter
  const allCount = activeLevelData.words.length;
  const learningCount = activeLevelData.words.length - masteredCount;

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };

  const handleCheckSentence = async () => {
    if (!sentenceInput.trim() || !activeWord) return;
    
    setIsCheckingSentence(true);
    setSentenceResult(null);

    try {
      const res = await fetch("/api/check-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetWord: activeWord.front, userSentence: sentenceInput })
      });
      
      const data = await res.json();
      
      if (data.error) {
        alert(data.error);
        setSentenceResult(null);
        return;
      }

      setSentenceResult(data);
    } catch (error) {
      alert("Lỗi kết nối AI để chấm câu! Vui lòng thử lại.");
    } finally {
      setIsCheckingSentence(false);
    }
  };

  const handleMarkLearning = () => {
    if (!activeWord) return;
    const wordId = activeWord.front;
    setWordProgress({ ...wordProgress, [wordId]: "learning" });
    
    if (!isFlipped) {
      setCanFlip(true);
      setIsFlipped(true);
    } else {
      if (activeWordIndex < filteredWords.length - 1) {
        setActiveWordIndex(prev => prev + 1);
      } else {
        setActiveWordIndex(0);
      }
    }
  };

  const handleMarkMasteredAndNext = async () => {
    const isAlreadyMastered = wordProgress[activeWord?.front] === "mastered";
    const isPassed = isAlreadyMastered || sentenceResult?.isPass;
    
    if (!activeWord || !isPassed) return;
    
    const wordId = activeWord.front;
    const newProgress = { ...wordProgress, [wordId]: "mastered" };
    setWordProgress(newProgress);
    
    if (!isAlreadyMastered) {
      if (user) {
        try {
          const learnedVocabArray = Object.keys(newProgress).filter(k => newProgress[k] === "mastered");
          const studentRef = doc(db, "progress", user.id);
          await setDoc(studentRef, { learnedVocab: learnedVocabArray }, { merge: true });
        } catch (error) {
          console.error("Lỗi đồng bộ từ vựng:", error);
        }
      }
    }

    if (activeWordIndex < filteredWords.length - 1) {
      setActiveWordIndex(prev => prev + 1);
    } else {
      setActiveWordIndex(0);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setActiveWordIndex(0);
  };

  const handleLevelChange = (levelObj) => {
    setViewingLevel(levelObj.level);
    setActiveWordIndex(0);
    setFilter("all");
  };

  const handlePrevWord = () => {
    setActiveWordIndex(prev => prev > 0 ? prev - 1 : filteredWords.length - 1);
  };

  const handleNextWord = () => {
    setActiveWordIndex(prev => prev < filteredWords.length - 1 ? prev + 1 : 0);
  };

  const dataForSelectedHsk = selectedHsk ? myCustomData.filter(item => item.level === selectedHsk) : myCustomData;
  const uniqueDataForSelectedHsk = dataForSelectedHsk.filter((item, index, self) => index === self.findIndex((t) => t.front === item.front));
  
  const totalWordsForSelectedHsk = uniqueDataForSelectedHsk.length;
  const masteredWordsForSelectedHsk = uniqueDataForSelectedHsk.filter(w => wordProgress[w.front] === "mastered").length;
  const canTakeExam = totalWordsForSelectedHsk > 0 && masteredWordsForSelectedHsk === totalWordsForSelectedHsk;

  const openExam = () => {
    if (!user) return alert("Bạn cần đăng nhập để thi!");
    if (!canTakeExam) return alert("Bạn phải đánh dấu 'Đã thuộc' tất cả từ vựng của bộ này mới được phép thi!");
    
    const maxQuestions = Math.min(50, uniqueDataForSelectedHsk.length);
    if (maxQuestions < 10) return alert("Chưa đủ từ vựng để tạo đề thi (Cần tối thiểu 10 từ)!");

    const shuffledWords = [...uniqueDataForSelectedHsk].sort(() => 0.5 - Math.random());
    const testWords = shuffledWords.slice(0, maxQuestions);

    const generatedQuestions = testWords.map(word => {
      const questionType = Math.floor(Math.random() * 4);
      let questionText, subText, correctAnswer, optionPool;

      switch (questionType) {
        case 0: questionText = word.front; subText = word.ipa; correctAnswer = word.back; optionPool = uniqueDataForSelectedHsk.map(w => w.back); break;
        case 1: questionText = word.back; subText = "Chọn chữ Hán đúng:"; correctAnswer = word.front; optionPool = uniqueDataForSelectedHsk.map(w => w.front); break;
        case 2: questionText = word.ipa; subText = word.back; correctAnswer = word.front; optionPool = uniqueDataForSelectedHsk.map(w => w.front); break;
        case 3: questionText = word.front; subText = word.back; correctAnswer = word.ipa; optionPool = uniqueDataForSelectedHsk.map(w => w.ipa); break;
      }

      const wrongOptions = optionPool.filter(opt => opt !== correctAnswer).sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [...wrongOptions, correctAnswer].sort(() => 0.5 - Math.random());
      
      return { questionText, subText, options, correctAnswer };
    });

    setExamState({ isOpen: true, questions: generatedQuestions, currentIndex: 0, score: 0, isFinished: false, total: maxQuestions, passScore: Math.ceil(maxQuestions * 0.8) });
  };

  const handleAnswer = (selectedOption) => {
    const isCorrect = selectedOption === examState.questions[examState.currentIndex].correctAnswer;
    const newScore = isCorrect ? examState.score + 1 : examState.score;

    if (examState.currentIndex + 1 < examState.questions.length) {
      setExamState({ ...examState, currentIndex: examState.currentIndex + 1, score: newScore });
    } else {
      setExamState({ ...examState, currentIndex: examState.currentIndex + 1, score: newScore, isFinished: true });
    }
  };

  const finishExam = async () => {
    if (examState.score >= examState.passScore) {
      const levelNum = selectedHsk.replace(/\D/g, ''); 
      const flagName = `passedHSK${levelNum}`;
      
      try {
        const studentRef = doc(db, "progress", user.id);
        await setDoc(studentRef, { [flagName]: true }, { merge: true });
        setUserData(prev => ({ ...prev, [flagName]: true }));
      } catch (error) {
        console.error("Lỗi cập nhật Firebase:", error);
      }
    }
    setExamState({ ...examState, isOpen: false });
  };

  const wordDisplay = activeWord ? activeWord.front : "";
  const pinyinDisplay = activeWord ? activeWord.ipa : "";
  const meaningDisplay = activeWord ? activeWord.back : "";
  const exampleDisplay = activeWord?.example || ""; 
  
  const isAlreadyMastered = activeWord ? wordProgress[activeWord.front] === "mastered" : false;
  const isFullyPassed = isAlreadyMastered || sentenceResult?.isPass;
  const allowFlip = canFlip || isAlreadyMastered; 
  const isCurrentHskLocked = isHskLocked(selectedHsk);

  return (
    <div className="flex min-h-screen bg-[#F4F8F5] font-sans text-slate-800 selection:bg-emerald-200">
      
      {/* =========================================
          EXAM MODAL (NÂNG CẤP GIAO DIỆN PREMIUM)
          ========================================= */}
      {examState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col">
            
            {/* Progress Bar (Nằm dính trên cùng Modal) */}
            <div className="w-full h-2.5 bg-slate-100">
              <div className="h-full bg-[#08A66A] transition-all duration-500" style={{ width: `${(examState.currentIndex / examState.total) * 100}%` }}></div>
            </div>

            <div className="p-8 md:p-10 relative">
              <button onClick={() => setExamState({ ...examState, isOpen: false })} className="absolute top-6 right-6 w-10 h-10 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 font-bold text-xl flex items-center justify-center transition-colors z-10 border border-slate-100">✕</button>
              
              {!examState.isFinished ? (
                <div className="animate-slide-up-fade mt-2">
                  <div className="flex items-center gap-3 mb-8">
                    <span className="text-3xl">🎓</span>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">Bài Thi {selectedHsk.toUpperCase()}</h3>
                      <p className="text-[10px] font-black text-[#08A66A] tracking-widest uppercase">Câu {examState.currentIndex + 1} / {examState.total}</p>
                    </div>
                  </div>

                  <div className="text-center mb-10 bg-[#F4F8F5] py-12 px-6 rounded-3xl border border-emerald-100 shadow-inner">
                    <h1 className={`font-black text-slate-800 mb-2 ${examState.questions[examState.currentIndex].questionText.length > 5 ? 'text-4xl md:text-5xl' : 'text-6xl md:text-7xl'}`}>
                      {examState.questions[examState.currentIndex].questionText}
                    </h1>
                    {examState.questions[examState.currentIndex].subText && (
                      <p className="text-base text-slate-500 tracking-widest mt-4 font-bold">{examState.questions[examState.currentIndex].subText}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {examState.questions[examState.currentIndex].options.map((option, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleAnswer(option)}
                        className={`w-full text-left px-6 py-4.5 bg-white hover:bg-[#DDF7EA]/50 border-2 border-slate-100 hover:border-[#08A66A] rounded-2xl font-bold text-slate-700 hover:text-[#087A55] transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${option.length < 10 ? 'text-xl text-center' : 'text-base'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center animate-fade-in py-8">
                  <div className="text-7xl mb-6 drop-shadow-md">{examState.score >= examState.passScore ? '🎉' : '💦'}</div>
                  <h3 className="text-3xl font-black text-slate-800 mb-2">{examState.score >= examState.passScore ? 'Chúc mừng!' : 'Chưa đạt yêu cầu!'}</h3>
                  <p className="text-slate-500 font-medium mb-8">Bạn cần đạt {examState.passScore} điểm để vượt qua bài kiểm tra.</p>

                  <div className={`p-6 rounded-[24px] mb-8 border relative overflow-hidden ${examState.score >= examState.passScore ? 'bg-[#DDF7EA] border-[#08A66A]/30' : 'bg-rose-50 border-rose-200'}`}>
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-50 ${examState.score >= examState.passScore ? 'bg-white/40' : 'bg-white/50'}`}></div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 relative z-10">Điểm của bạn</p>
                    <p className={`text-5xl font-black relative z-10 ${examState.score >= examState.passScore ? 'text-[#08A66A]' : 'text-rose-500'}`}>
                      {examState.score} <span className="text-2xl opacity-60">/ {examState.total}</span>
                    </p>
                  </div>

                  <button 
                    onClick={finishExam}
                    className="w-full py-4.5 bg-[#172033] hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-xl transition-all hover:-translate-y-1 uppercase tracking-widest"
                  >
                    Xác nhận kết quả
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          SIDEBAR: BẢN ĐỒ HÀNH TRÌNH (LEARNING MAP)
          ========================================= */}
      <aside className="w-[320px] bg-white border-r border-emerald-100 flex flex-col h-screen sticky top-0 shadow-[4px_0_24px_rgba(8,166,106,0.04)] z-30 shrink-0 hidden lg:flex">
        
        {/* Header Sidebar */}
        <div className="p-6 border-b border-emerald-50">
          <Link href="/">
            <button className="flex items-center gap-2 text-slate-500 hover:text-[#08A66A] font-bold text-sm transition-colors mb-6">
              <span>←</span> Trở về Trang Chủ
            </button>
          </Link>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-[#08A66A] uppercase tracking-widest">Chọn hành trình</label>
            <div className="relative">
              <select 
                value={selectedHsk} 
                onChange={(e) => setSelectedHsk(e.target.value)}
                className="w-full appearance-none bg-[#DDF7EA]/50 border border-[#08A66A]/20 text-[#087A55] font-black text-sm rounded-2xl px-4 py-3 outline-none cursor-pointer focus:ring-2 focus:ring-[#08A66A]/20 shadow-sm"
              >
                {availableHskLevels.map(lvl => {
                  const locked = isHskLocked(lvl);
                  return (
                    <option key={lvl} value={lvl} disabled={locked}>
                      Bộ {lvl.toUpperCase()} {locked ? "🔒 (Hoàn thành cấp trước hoặc Pass Test)" : ""}
                    </option>
                  );
                })}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#08A66A] pointer-events-none text-xs">▼</span>
            </div>
          </div>
        </div>

        {/* Roadmap Map */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-900 text-sm">BẢN ĐỒ HỌC TẬP</h3>
            <span className="text-[10px] font-bold text-[#08A66A] bg-[#DDF7EA] px-2 py-1 rounded-lg">{levelsData.length} bài</span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-[31px] before:top-4 before:bottom-4 before:w-[3px] before:bg-emerald-100/50 before:rounded-full">
            {levelsData.map((lvl) => {
              const isActive = lvl.level === viewingLevel;
              const isCompleted = lvl.words.every(w => wordProgress[w.front] === "mastered") && lvl.words.length > 0;
              
              return (
                <div key={lvl.level} className="relative flex items-center gap-4 group cursor-pointer" onClick={() => handleLevelChange(lvl)}>
                  {/* Node & Mascot */}
                  <div className="absolute -left-6 flex flex-col items-center justify-center">
                    {isActive && (
                      <div className="absolute -top-7 text-2xl animate-bounce z-20 filter drop-shadow-md">🐸</div>
                    )}
                    <div className={`w-5 h-5 rounded-full border-[3px] z-10 flex items-center justify-center transition-all ${
                      isActive 
                        ? 'bg-white border-[#08A66A] scale-125 shadow-[0_0_0_4px_rgba(8,166,106,0.15)]' 
                        : isCompleted 
                          ? 'bg-[#08A66A] border-[#08A66A]' 
                          : 'bg-white border-slate-200'
                    }`}>
                      {isCompleted && !isActive && <span className="text-white text-[8px] font-black">✓</span>}
                    </div>
                  </div>

                  {/* Lesson Card */}
                  <div 
                    className={`flex-1 p-3.5 rounded-2xl border transition-all ${
                      isActive 
                        ? 'bg-white border-[#08A66A] shadow-lg shadow-emerald-900/5 translate-x-1' 
                        : isCompleted
                          ? 'bg-[#F4F8F5] border-transparent opacity-80 hover:opacity-100 hover:bg-[#DDF7EA]/50'
                          : 'bg-white border-slate-100 hover:border-[#08A66A]/40'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className={`font-black text-sm ${isActive ? 'text-[#08A66A]' : 'text-slate-700'}`}>Bài {lvl.level}</h4>
                      {isActive ? <span className="text-amber-500 text-xs">🔥</span> : isCompleted ? <span className="text-emerald-500 text-xs">✓</span> : null}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">{lvl.words.length} từ vựng</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Sidebar: Exam Button */}
        <div className="p-6 border-t border-emerald-50 bg-white">
          <button 
            onClick={openExam} 
            disabled={!canTakeExam}
            className={`w-full py-3.5 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${
                canTakeExam 
                ? 'bg-[#08A66A] text-white hover:bg-[#087A55] hover:-translate-y-0.5 shadow-emerald-600/20' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
            }`}
          >
            <span>🎓</span> THI CHỨNG CHỈ {selectedHsk.toUpperCase()}
          </button>
          <p className={`text-center text-[9px] font-bold mt-3 ${canTakeExam ? 'text-[#08A66A]' : 'text-slate-400'}`}>
            {canTakeExam ? "Bạn đã sẵn sàng làm bài thi!" : `Hoàn thành ${masteredWordsForSelectedHsk}/${totalWordsForSelectedHsk} từ để thi`}
          </p>
        </div>
      </aside>

      {/* =========================================
          MAIN CONTENT: VOCABULARY JOURNEY
          ========================================= */}
      <main className="flex-1 relative flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* BACKGROUND ẢNH VỚI LỚP PHỦ */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
          style={{ backgroundImage: "url('/hskk/backcover.jpg')" }} 
        >
          {/* Lớp phủ màu Mint-tinted để làm nổi bật UI Card */}
          <div className="absolute inset-0 bg-[#F4F8F5]/85 backdrop-blur-[4px]"></div>
        </div>

        {/* NỘI DUNG CHÍNH (Cuộn được) */}
        <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide pb-20">
          <div className="max-w-4xl mx-auto w-full px-4 md:px-8 pt-6 md:pt-10">

            {isCurrentHskLocked ? (
               <div className="bg-white/90 backdrop-blur-xl p-12 rounded-[32px] shadow-xl border border-white text-center flex flex-col items-center justify-center min-h-[500px] mt-10">
                 <div className="text-7xl mb-6 drop-shadow-sm">🔒</div>
                 <h3 className="text-2xl font-black text-slate-800 mb-3">Cấp độ {selectedHsk.toUpperCase()} đang bị khóa!</h3>
                 <p className="text-slate-500 mb-8 max-w-md font-medium leading-relaxed">Bạn cần hoàn thành bài kiểm tra của cấp độ trước đó hoặc tham gia thi vượt cấp để mở khóa cấp độ này.</p>
                 <Link href="/test" className="px-8 py-4 bg-[#172033] text-white font-black text-sm rounded-2xl shadow-lg hover:bg-slate-800 hover:-translate-y-1 transition-all">
                   🎯 Đi tới Kiểm Tra Trình Độ
                 </Link>
               </div>
            ) : (
              <>
                {/* HEADER: GAMIFICATION & PROGRESS */}
                <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                      <span>Bài {viewingLevel}</span>
                    </h1>
                    <p className="text-sm font-bold text-[#08A66A] mt-1.5 flex items-center gap-1.5">
                      <span>🐸</span> Tiếp tục hành trình nào!
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white shadow-sm">
                      <span className="text-amber-500 text-lg">🔥</span>
                      <span className="font-black text-slate-800 text-sm">{streak} ngày</span>
                    </div>
                    {/* Placeholder cho XP */}
                    <div className="flex items-center gap-1.5 bg-[#FFF8E8] px-3.5 py-2 rounded-xl border border-[#FFC83D]/30 shadow-sm">
                      <span className="text-[#FFC83D] text-lg">⭐</span>
                      <span className="font-black text-amber-700 text-sm">{masteredWordsForSelectedHsk * 10} XP</span>
                    </div>
                  </div>
                </header>

                {/* TIẾN ĐỘ BÀI HỌC VÀ TABS */}
                <div className="bg-white/90 backdrop-blur-xl rounded-[28px] p-6 md:p-8 shadow-sm border border-white mb-10">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4 flex-1 pr-8">
                      <div className="w-full h-3 bg-[#F4F8F5] rounded-full overflow-hidden border border-emerald-50">
                        <div className="h-full bg-[#08A66A] rounded-full transition-all duration-500 relative" style={{ width: `${progressPercent}%` }}>
                          <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/20 blur-[2px]"></div>
                        </div>
                      </div>
                      <span className="font-black text-[#08A66A] text-sm shrink-0">{progressPercent}%</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400 shrink-0">{masteredCount} / {allCount} từ đã thuộc</span>
                  </div>

                  {/* Segmented Control */}
                  <div className="flex flex-wrap items-center bg-[#F4F8F5] p-1.5 rounded-2xl w-fit border border-emerald-100/50">
                    <button 
                      onClick={() => handleFilterChange("all")}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${filter === "all" ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Tất cả <span className="ml-1 opacity-60 font-bold">{allCount}</span>
                    </button>
                    <button 
                      onClick={() => handleFilterChange("learning")}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${filter === "learning" ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Chưa thuộc <span className="ml-1 opacity-60 font-bold">{learningCount}</span>
                    </button>
                    <button 
                      onClick={() => handleFilterChange("mastered")}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${filter === "mastered" ? 'bg-white text-[#08A66A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Đã thuộc <span className="ml-1 opacity-60 font-bold">{masteredCount}</span>
                    </button>
                  </div>
                </div>

                {filteredWords.length === 0 ? (
                   <div className="bg-white/90 backdrop-blur-xl p-10 rounded-[32px] shadow-sm border border-white text-center">
                     <div className="text-5xl mb-4">✨</div>
                     <h3 className="text-xl font-bold text-slate-800">Không có từ vựng nào ở mục này!</h3>
                   </div>
                ) : (
                  <>
                    {/* KHU VỰC THẺ TỪ VỰNG (THE CORE) */}
                    <div className="relative mb-10 mt-4">
                      {/* Nút điều hướng */}
                      <button 
                        onClick={handlePrevWord}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-[#08A66A] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-50 hover:scale-110 transition-all z-20"
                      >
                        <span className="text-xl font-black">←</span>
                      </button>
                      <button 
                        onClick={handleNextWord}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-[#08A66A] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-50 hover:scale-110 transition-all z-20"
                      >
                        <span className="text-xl font-black">→</span>
                      </button>

                      {/* Vocab Card */}
                      <div className="w-full max-w-xl mx-auto bg-white rounded-[40px] shadow-[0_20px_60px_-15px_rgba(8,166,106,0.12)] border border-white overflow-hidden relative group">
                        
                        {/* Trạng thái từ vựng & Progress */}
                        <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
                           <span className="font-bold text-slate-300 text-sm tracking-widest">{activeWordIndex + 1} / {filteredWords.length}</span>
                           <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase border ${wordProgress[wordDisplay] === 'mastered' ? 'bg-[#DDF7EA] text-[#08A66A] border-[#08A66A]/20' : 'bg-slate-100 text-slate-500 border-slate-200/50'}`}>
                             {wordProgress[wordDisplay] === 'mastered' ? '✓ Đã thuộc' : 'Đang học'}
                           </span>
                        </div>

                        <div className="px-8 py-16 md:p-16 flex flex-col items-center justify-center text-center relative min-h-[460px] mt-4">
                          
                          {/* Nút Nghe */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); speak(wordDisplay); }}
                            className="w-14 h-14 bg-[#F4F8F5] hover:bg-[#DDF7EA] text-slate-400 hover:text-[#08A66A] rounded-full flex items-center justify-center text-2xl transition-all hover:scale-110 mb-8 border border-emerald-50 shadow-sm"
                          >
                            🔊
                          </button>

                          {/* Character */}
                          <h2 className="text-[120px] md:text-[140px] font-black text-[#172033] leading-none mb-6 font-serif tracking-tight drop-shadow-sm">
                            {wordDisplay}
                          </h2>

                          {/* Thông tin chi tiết (Lật hoặc hiển thị luôn) */}
                          <div className={`flex flex-col items-center w-full transition-all duration-500 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'}`}>
                            <p className="text-3xl font-bold text-[#08A66A] mb-4 tracking-wider">{pinyinDisplay}</p>
                            <p className="text-xl font-medium text-slate-600 mb-8 flex items-center gap-2">
                              <span className="text-rose-400">❤️</span> {meaningDisplay}
                            </p>

                            {/* Ví dụ (nếu có) */}
                            {exampleDisplay && (
                              <div className="bg-[#FFF8E8] w-full max-w-sm p-5 rounded-3xl border border-[#FFC83D]/20">
                                <p className="text-lg font-black text-slate-800 mb-1">{exampleDisplay}</p>
                                <p className="text-xs font-bold text-slate-500">Mẫu câu minh họa</p>
                              </div>
                            )}
                          </div>

                          {/* Nút lật thẻ nếu chưa lật */}
                          {!isFlipped && (
                            <button 
                              onClick={() => {
                                if (allowFlip) setIsFlipped(true);
                                else alert("🔒 Vượt qua thử thách đặt câu hoặc đánh dấu 'Đã thuộc' để mở nghĩa!");
                              }}
                              className={`absolute bottom-10 flex items-center gap-2 font-black text-xs px-6 py-3 rounded-full shadow-sm border transition-all ${allowFlip ? 'text-slate-500 hover:text-[#08A66A] bg-white border-slate-200 hover:border-[#08A66A] hover:-translate-y-1 cursor-pointer animate-pulse' : 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed'}`}
                            >
                              {allowFlip ? <><span className="text-lg">👁</span> Bấm để xem nghĩa</> : <><span className="text-lg">🔒</span> Mở khóa bằng thử thách</>}
                            </button>
                          )}
                        </div>

                        {/* Progress Bar đính kèm đáy thẻ */}
                        <div className="h-2 w-full bg-slate-50 flex">
                          <div className="h-full bg-[#08A66A] transition-all" style={{ width: `${((activeWordIndex + 1) / filteredWords.length) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>

                    {/* ACTION AREA: MINI CHALLENGE ĐẶT CÂU */}
                    <div className="max-w-2xl mx-auto mb-10">
                      <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-white relative overflow-hidden">
                        {/* Trang trí góc */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#FFC83D]/10 to-transparent rounded-bl-full -z-0"></div>

                        <div className="relative z-10">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-[#FFF8E8] text-[#FFC83D] rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-[#FFC83D]/20">✍️</div>
                            <div>
                              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Thử thách đặt câu</h3>
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                Dùng từ <strong className="text-[#08A66A] text-sm bg-[#DDF7EA] px-2 py-0.5 rounded"> {wordDisplay} </strong> để tạo một câu:
                              </p>
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
                              }}
                              disabled={sentenceResult?.isPass || isCheckingSentence}
                              className="w-full sm:flex-1 bg-white border-2 border-slate-100 text-slate-800 font-bold text-sm rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-[#08A66A]/10 focus:border-[#08A66A] transition-all disabled:opacity-60 disabled:bg-slate-50"
                            />
                            <button 
                              onClick={handleCheckSentence}
                              disabled={sentenceResult?.isPass || !sentenceInput.trim() || isCheckingSentence}
                              className={`w-full sm:w-auto px-8 py-4 font-black text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
                                sentenceResult?.isPass 
                                  ? 'bg-[#08A66A] text-white shadow-emerald-600/30' 
                                  : 'bg-[#172033] hover:bg-slate-800 text-white shadow-slate-900/20 hover:-translate-y-0.5'
                              }`}
                            >
                              <span>{isCheckingSentence ? "Đang chấm..." : (sentenceResult?.isPass ? "✓ Đã chấm" : "Kiểm tra")}</span>
                            </button>
                          </div>

                          {/* Thông báo Feedback của AI */}
                          {sentenceResult && (
                            <div className={`mt-6 p-5 rounded-2xl border animate-fade-in flex gap-4 ${sentenceResult.isPass ? 'bg-[#DDF7EA] border-[#08A66A]/30' : 'bg-rose-50 border-rose-200'}`}>
                               <div className="text-3xl shrink-0 mt-1">{sentenceResult.isPass ? '🐸' : '💦'}</div>
                               <div>
                                  <h4 className={`font-black text-sm mb-1 ${sentenceResult.isPass ? 'text-[#087A55]' : 'text-rose-700'}`}>
                                    {sentenceResult.isPass ? "太棒了！Tuyệt vời!" : "再试一次！Chưa chính xác:"}
                                  </h4>
                                  <p className="text-xs font-medium text-slate-700 mb-2 leading-relaxed">{sentenceResult.feedback}</p>
                                  
                                  {!sentenceResult.isPass && sentenceResult.suggestion && (
                                      <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60 leading-relaxed shadow-sm">
                                          <span className="font-black text-[#FFC83D]">💡 Gợi ý:</span> {sentenceResult.suggestion}
                                      </p>
                                  )}
                               </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ACTION BUTTONS (ĐIỀU HƯỚNG CHÍNH) */}
                    <div className="flex gap-4 w-full max-w-xl mx-auto pb-10">
                        <button 
                          onClick={handleMarkLearning}
                          className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:border-[#08A66A] hover:text-[#08A66A] hover:bg-[#F4F8F5] transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          {!isFlipped ? <><span>👀</span> Xem nghĩa / Bỏ qua</> : <><span>⏭️</span> Từ tiếp theo</>}
                        </button>
                        <button 
                          onClick={handleMarkMasteredAndNext}
                          disabled={!isFullyPassed}
                          className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                              isFullyPassed 
                              ? 'bg-gradient-to-b from-[#08A66A] to-[#087A55] text-white hover:shadow-lg hover:-translate-y-1 hover:shadow-emerald-600/20' 
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <span>✓</span> Đã thuộc & Tiếp ➔
                        </button>
                    </div>

                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}