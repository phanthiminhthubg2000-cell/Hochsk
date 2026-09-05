"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
// Đổi nguồn dữ liệu sang sentences.json
import dictationData from "../sentences.json"; 
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

const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function ArrangePage() {
  const { user, isLoaded } = useUser();

  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [userData, setUserData] = useState(null);
  const [userExp, setUserExp] = useState(0); 
  const [loadingUser, setLoadingUser] = useState(true);
  
  const [currentSentence, setCurrentSentence] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [shuffledWords, setShuffledWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedback, setFeedback] = useState(null); 
  const [sentenceHistory, setSentenceHistory] = useState([]);

  // UI States Mới
  const [isFocusMode, setIsFocusMode] = useState(false);
  const streak = userData?.streakCount || 0;

  // LẤY DỮ LIỆU TIẾN ĐỘ VÀ EXP TỪ FIRESTORE VÀ LOCALSTORAGE
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const docRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            const cloudExp = data.arrangeExp !== undefined ? data.arrangeExp : (parseInt(localStorage.getItem("ai_arrange_exp")) || 0);
            setUserExp(cloudExp);
          } else {
            setUserData({});
            const localExp = parseInt(localStorage.getItem("ai_arrange_exp")) || 0;
            setUserExp(localExp);
          }
        } catch (error) {
          console.error("Lỗi lấy dữ liệu tiến độ:", error);
          setUserData({});
          setUserExp(parseInt(localStorage.getItem("ai_arrange_exp")) || 0);
        } finally {
          setLoadingUser(false);
        }
      } else {
        setUserExp(parseInt(localStorage.getItem("ai_arrange_exp")) || 0);
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!loadingUser) {
      localStorage.setItem("ai_arrange_exp", userExp);
    }
  }, [userExp, loadingUser]);

  // LOGIC MỞ KHÓA KÉP: ĐÃ PASS TEST HOẶC CÀY ĐỦ EXP THEO CẤP ĐỘ
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
    const savedHistory = localStorage.getItem("ai_arrange_sit_history");
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
      localStorage.setItem("ai_arrange_sit_history", JSON.stringify(recent));
    }
  }, [sentenceHistory]);

  const generateNewSentence = (level, history = sentenceHistory) => {
    setIsLoading(true);
    setFeedback(null);
    setSelectedWords([]);
    setShuffledWords([]);
    setShowAnswer(false);
    
    try {
      const targetLvl = level.replace(/\s+/g, '').toUpperCase();
      
      let availableSentences = dictationData.filter(item => {
        if (!item.level) return false;
        const itemLvl = item.level.replace(/\s+/g, '').toUpperCase();
        return itemLvl === targetLvl && !history.includes(item.chinese);
      });

      if (availableSentences.length === 0) {
        const totalInLevel = dictationData.filter(item => item.level && item.level.replace(/\s+/g, '').toUpperCase() === targetLvl);
        if (totalInLevel.length === 0) {
          throw new Error(`Chưa có dữ liệu cho ${level} trong file json.`);
        } else {
          availableSentences = totalInLevel; // Reset vòng lặp nếu đã làm hết
        }
      }

      const randomIndex = Math.floor(Math.random() * availableSentences.length);
      const chosen = availableSentences[randomIndex];

      setTimeout(() => {
        setCurrentSentence(chosen);
        setSentenceHistory(prev => [...prev, chosen.chinese]);

        const cleanChinese = chosen.chinese.replace(/[.,?!。，？！、]/g, '');
        const wordsArray = cleanChinese.split('').map((char, index) => ({ id: index, char }));
        setShuffledWords(shuffleArray(wordsArray));

        setIsLoading(false);
      }, 300);

    } catch (error) {
      console.error(error);
      setCurrentSentence(null);
      setIsLoading(false);
    }
  };

  const handleSelectWord = (word) => {
    if (feedback === 'correct') return; 
    setShuffledWords(prev => prev.filter(w => w.id !== word.id));
    setSelectedWords(prev => [...prev, word]);
    setFeedback(null);
  };

  const handleDeselectWord = (word) => {
    if (feedback === 'correct') return;
    setSelectedWords(prev => prev.filter(w => w.id !== word.id));
    setShuffledWords(prev => [...prev, word]);
    setFeedback(null);
  };

  const handleClearAll = () => {
    if (feedback === 'correct') return;
    setShuffledWords(prev => [...prev, ...selectedWords]);
    setSelectedWords([]);
    setFeedback(null);
  };

  const checkAnswer = async () => { 
    if (!currentSentence || selectedWords.length === 0) return;
    
    const answerStr = selectedWords.map(w => w.char).join('');
    const expectedStr = currentSentence.chinese.replace(/[.,?!。，？！、]/g, '');
    
    if (answerStr === expectedStr) {
        setFeedback("correct");
        setShowAnswer(false);
        
        const currentSelectedNum = parseInt(selectedHsk.replace(/\D/g, ''), 10);
        let highestUnlockedNum = 1;
        for (let lvl of HSK_LEVELS) {
          if (!isHskLocked(lvl.name)) {
            const num = parseInt(lvl.name.replace(/\D/g, ''), 10);
            if (num > highestUnlockedNum) highestUnlockedNum = num;
          }
        }

        if (currentSelectedNum >= highestUnlockedNum) {
            const newExp = userExp + 20;
            setUserExp(newExp); 

            if (user) {
              try {
                const studentRef = doc(db, "progress", user.id);
                await setDoc(studentRef, { arrangeExp: newExp }, { merge: true });
              } catch (error) {
                console.error("Lỗi đồng bộ điểm lên đám mây:", error);
              }
            }
        }
    } else {
        setFeedback("incorrect");
    }
  };

  const handleLevelChange = (e) => {
    const targetLevel = e.target.value;
    setSelectedHsk(targetLevel);
    generateNewSentence(targetLevel);
  };

  const speak = (text) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
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
        style={{ backgroundImage: "url('/hskk/sapxep.jpg')" }}
      >
        <div className="absolute inset-0 bg-[#F4F8F5]/90 backdrop-blur-[2px]"></div>
      </div>

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
              <span className="text-lg">🧩</span> Sắp xếp
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
                <span className="text-[8px] text-slate-400 font-bold">Điểm ngữ pháp</span>
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

      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide py-8">
        <div className="max-w-[1400px] mx-auto px-6">
          
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
                <span className="text-slate-600">Sắp xếp câu</span>
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start transition-all duration-500">
            
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
                      onChange={handleLevelChange}
                      className="w-full bg-white border-2 border-slate-100 text-[#087A55] font-black py-3 px-4 rounded-xl outline-none cursor-pointer hover:border-[#08A66A] transition mb-6 shadow-sm"
                  >
                      {HSK_LEVELS.map(lvl => {
                          const locked = isHskLocked(lvl.name);
                          return (
                              <option key={lvl.name} value={lvl.name} disabled={locked}>
                                  {lvl.name} {locked ? "🔒 (Hoàn thành cấp trước hoặc Pass Test)" : ""}
                              </option>
                          );
                      })}
                  </select>

                  <div className="flex flex-col items-center mt-6 pt-6 border-t border-slate-100 text-center">
                    <div className="text-5xl drop-shadow-sm mb-3">
                      {feedback === 'correct' ? '🎉' : feedback === 'incorrect' ? '💦' : '🐸'}
                    </div>
                    <h4 className="font-black text-[#087A55] text-sm">
                      {feedback === 'correct' ? '太棒了！' : feedback === 'incorrect' ? '再试一次！' : '思考一下！'}
                    </h4>
                    <p className="text-xs font-medium text-emerald-700 mt-1 leading-relaxed">
                      {isPlayingAtMaxLevel 
                        ? "Hoàn thành câu ở cấp này để nhận +20 XP!" 
                        : "Luyện tập tốt nhé! Cấp này không cộng XP."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className={`${isFocusMode ? 'lg:col-span-8 lg:col-start-3' : 'lg:col-span-9'} transition-all duration-500 w-full`}>
              {isCurrentHskLocked ? (
                <div className="bg-white/95 backdrop-blur-xl p-12 rounded-[32px] shadow-lg border border-white text-center flex flex-col items-center justify-center min-h-[500px]">
                  <div className="text-6xl mb-6">🔒</div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3">Cấp độ {selectedHsk} đang bị khóa!</h3>
                  <p className="text-slate-500 mb-8 max-w-md font-medium leading-relaxed">
                    Bạn cần hoàn thành bài kiểm tra của cấp độ trước đó hoặc tham gia thi vượt cấp để mở khóa cấp độ này.
                  </p>
                  <Link href="/test" className="px-6 py-3.5 bg-[#172033] text-white font-bold rounded-2xl shadow hover:bg-slate-800 transition">
                    🎯 Kiểm Tra Trình Độ ngay
                  </Link>
                </div>
              ) : (
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 md:p-10 shadow-lg shadow-emerald-900/5 border border-white relative overflow-hidden flex flex-col h-full min-h-[600px]">
                  
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[#FFC83D] text-2xl">🧩</span>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">SẮP XẾP CÂU</h2>
                      </div>
                      <p className="text-[#08A66A] font-bold bg-[#DDF7EA] px-3 py-1 rounded-lg text-xs w-fit ml-9 uppercase tracking-widest mt-1">
                        {selectedHsk}
                      </p>
                    </div>

                    <button 
                      onClick={() => generateNewSentence(selectedHsk)}
                      disabled={isLoading || isCurrentHskLocked}
                      className="px-4 py-2 bg-slate-50 text-slate-500 rounded-xl font-bold text-xs hover:bg-[#DDF7EA] hover:text-[#08A66A] transition border border-slate-100 flex items-center gap-1.5"
                    >
                      Bỏ qua ➔
                    </button>
                  </div>

                  {isLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center animate-pulse py-20">
                          <div className="text-6xl mb-4">✨</div>
                          <h3 className="text-xl font-bold text-slate-500">Đang chuẩn bị câu hỏi...</h3>
                      </div>
                  ) : currentSentence ? (
                      <div className="flex-1 flex flex-col w-full animate-fade-in relative z-10">
                          
                          <div className="mb-8 relative">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-2 flex items-center gap-1.5">
                                Chạm vào các từ bên dưới để sắp xếp
                              </p>
                              
                              <div className={`w-full min-h-[140px] rounded-[24px] p-6 flex flex-wrap content-start gap-3 items-center transition-all ${
                                  feedback === 'correct' ? 'border-2 border-[#08A66A] bg-[#DDF7EA]/50 shadow-inner' : 
                                  feedback === 'incorrect' ? 'border-2 border-rose-400 bg-rose-50/50 shadow-inner' : 
                                  'border-2 border-dashed border-emerald-200 bg-[#F4F8F5]'
                              }`}>
                                  {selectedWords.length === 0 && !feedback && (
                                      <span className="text-slate-400 font-medium w-full text-center py-6 opacity-60">
                                          (Khu vực ghép câu)
                                      </span>
                                  )}
                                  
                                  {selectedWords.map((word) => (
                                      <button
                                          key={`sel-${word.id}`}
                                          onClick={() => handleDeselectWord(word)}
                                          className={`px-6 py-3.5 bg-white border-2 border-emerald-100 text-[#172033] text-3xl font-black rounded-2xl shadow-sm hover:border-rose-300 hover:bg-rose-50 transition-all ${feedback === 'correct' ? 'pointer-events-none border-transparent shadow-none' : ''}`}
                                      >
                                          {word.char}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {feedback === 'correct' && (
                              <div className="mb-8 p-6 bg-[#DDF7EA] border border-[#08A66A]/30 rounded-[24px] flex items-center gap-4 animate-slide-up-fade shadow-sm">
                                  <div className="text-5xl">🎉</div>
                                  <div>
                                      <h4 className="font-black text-[#087A55] text-lg mb-1">太棒了！Tuyệt vời!</h4>
                                      <p className="text-sm font-bold text-[#08A66A] mb-1">✓ Sắp xếp chính xác</p>
                                      {isPlayingAtMaxLevel && <p className="text-xs font-black text-[#FFC83D] uppercase tracking-wider mt-2 drop-shadow-sm">⭐ +20 XP</p>}
                                  </div>
                              </div>
                          )}

                          {feedback === 'incorrect' && (
                              <div className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-[24px] flex items-start gap-4 animate-shake">
                                  <div className="text-4xl mt-1">🐸</div>
                                  <div>
                                      <h4 className="font-black text-rose-700 text-lg mb-1">再试一次！</h4>
                                      <p className="text-sm font-bold text-rose-600 mb-2">Thứ tự chưa chính xác, hãy thử lại nhé!</p>
                                      <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm mt-3 inline-block">
                                        <p className="text-xs font-black text-[#FFC83D] mb-1">💡 GỢI Ý NGỮ PHÁP:</p>
                                        <p className="text-xs text-slate-600 font-medium">Hãy nhớ trật tự cơ bản: Chủ ngữ → Vị ngữ → Tân ngữ</p>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {showAnswer && feedback !== 'correct' && (
                              <div className="mb-8 p-6 bg-slate-50 rounded-[24px] border border-slate-200 animate-fade-in text-center relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/50 rounded-bl-full -z-0"></div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 relative z-10">Đáp án chuẩn</p>
                                  <p className="text-3xl font-black text-[#172033] mb-2 relative z-10 tracking-widest">{currentSentence.chinese}</p>
                              </div>
                          )}

                          <div className="w-full mt-2 mb-10 flex flex-wrap justify-center gap-3">
                              {shuffledWords.map(word => (
                                  <button
                                      key={`shuf-${word.id}`}
                                      onClick={() => handleSelectWord(word)}
                                      className="px-6 py-4 bg-white border-2 border-slate-100 text-slate-800 text-3xl font-black rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-1.5 hover:border-[#08A66A] hover:text-[#08A66A] hover:shadow-lg transition-all"
                                  >
                                      {word.char}
                                  </button>
                              ))}
                          </div>

                          <div className="mt-auto flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
                              
                              {feedback !== 'correct' ? (
                                  <>
                                    <button 
                                        onClick={() => setShowAnswer(!showAnswer)}
                                        className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:border-[#FFC83D] hover:text-amber-600 hover:bg-[#FFF8E8] transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <span className="text-lg">💡</span> {showAnswer ? "Ẩn đáp án" : "Gợi ý"}
                                    </button>
                                    
                                    <button 
                                        onClick={handleClearAll}
                                        disabled={selectedWords.length === 0}
                                        className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="text-lg">↶</span> Làm lại
                                    </button>

                                    <button 
                                        onClick={checkAnswer}
                                        disabled={selectedWords.length === 0}
                                        className="flex-[2] py-4 bg-[#08A66A] text-white rounded-2xl font-black text-sm hover:bg-[#087A55] transition-all shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 uppercase tracking-wider"
                                    >
                                        Kiểm tra →
                                    </button>
                                  </>
                              ) : (
                                  <button 
                                      onClick={() => generateNewSentence(selectedHsk)}
                                      className="w-full py-4.5 bg-[#172033] text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2 uppercase tracking-widest"
                                  >
                                      Câu tiếp theo ➔
                                  </button>
                              )}
                          </div>

                      </div>
                  ) : (
                      <div className="text-center bg-red-50 p-6 rounded-2xl border border-red-200 m-auto">
                          <p className="text-red-600 font-bold text-xl mb-2">Thông báo</p>
                          <p className="text-red-500 font-medium max-w-md mx-auto">Không lấy được dữ liệu. Hãy tải lại trang nhé!</p>
                      </div>
                  )}
                </div>
              )} 
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}