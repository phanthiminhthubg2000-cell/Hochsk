"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import myCustomData from "../cards.json";
import { useUser } from "@clerk/nextjs";
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
  const { user } = useUser();
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

  // Kiểm tra khóa bộ HSK: HSK 1 luôn mở, từ HSK 2 trở lên yêu cầu đã hoàn thành cấp trước hoặc pass test tương ứng
  const isHskLocked = (lvl) => {
    const cleanLvl = String(lvl).replace(/\D/g, ''); 
    if (!cleanLvl) return true;
    const levelNum = parseInt(cleanLvl, 10);
    
    // HSK 1 mặc định mở cho tất cả mọi người không cần test
    if (levelNum === 1) return false;
    
    // Từ HSK 2 trở lên: Cần phải đạt cờ passed của cấp liền kề trước đó HOẶC passed cấp hiện tại
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

  if (levelsData.length === 0 || loadingUser) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-600">Đang tải dữ liệu từ vựng...</div>;

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
        alert(`🎉 Xuất sắc! Bạn đạt ${examState.score}/${examState.total} điểm. Chứng chỉ cấp độ đã được cập nhật!`);
      } catch (error) {
        console.error("Lỗi cập nhật Firebase:", error);
      }
    } else {
      alert(`😢 Rất tiếc, bạn chỉ đạt ${examState.score}/${examState.total} điểm. Cần tối thiểu ${examState.passScore} điểm để đỗ. Hãy ôn bài và thử lại nhé!`);
    }
    setExamState({ ...examState, isOpen: false });
  };

  const wordDisplay = activeWord ? activeWord.front : "";
  const pinyinDisplay = activeWord ? activeWord.ipa : "";
  const meaningDisplay = activeWord ? activeWord.back : "";
  const exampleDisplay = activeWord ? activeWord.example : "";
  
  const isAlreadyMastered = activeWord ? wordProgress[activeWord.front] === "mastered" : false;
  const isFullyPassed = isAlreadyMastered || sentenceResult?.isPass;
  const allowFlip = canFlip || isAlreadyMastered; 

  const isCurrentHskLocked = isHskLocked(selectedHsk);

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      {examState.isOpen && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
            <button onClick={() => setExamState({ ...examState, isOpen: false })} className="absolute top-4 right-5 text-slate-400 hover:text-red-500 font-bold text-xl">✕</button>
            {!examState.isFinished ? (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <h3 className="text-xl font-bold text-slate-800">Bài thi chứng chỉ {selectedHsk.toUpperCase()}</h3>
                  <span className="font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full">Câu {examState.currentIndex + 1}/{examState.total}</span>
                </div>
                <div className="text-center mb-8">
                  <h1 className={`font-black text-slate-800 mb-2 ${examState.questions[examState.currentIndex].questionText.length > 5 ? 'text-4xl' : 'text-6xl'}`}>
                    {examState.questions[examState.currentIndex].questionText}
                  </h1>
                  {examState.questions[examState.currentIndex].subText && (
                    <p className="text-xl text-slate-500 tracking-widest mt-2">{examState.questions[examState.currentIndex].subText}</p>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {examState.questions[examState.currentIndex].options.map((option, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleAnswer(option)}
                      className={`w-full text-left px-6 py-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-100 hover:border-rose-300 rounded-xl font-medium text-slate-700 transition-all ${option.length < 10 ? 'text-2xl text-center' : 'text-lg'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center animate-fade-in py-10">
                <div className="text-6xl mb-4">{examState.score >= examState.passScore ? '🏆' : '💔'}</div>
                <h3 className="text-3xl font-black text-slate-800 mb-2">Kết quả của bạn</h3>
                <p className={`text-2xl font-bold mb-6 ${examState.score >= examState.passScore ? 'text-green-500' : 'text-red-500'}`}>
                  {examState.score} / {examState.total} câu
                </p>
                <button 
                  onClick={finishExam}
                  className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors"
                >
                  Xác nhận kết quả
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* SIDEBAR */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-10">
                <Link href="/">
                    <button className="w-full mb-6 px-4 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 text-center transition">← Trở về Trang Chủ</button>
                </Link>

                <p className="font-bold text-slate-600 mb-2 uppercase tracking-widest text-sm">Chọn Bộ Từ Vựng</p>
                <select 
                    value={selectedHsk} 
                    onChange={(e) => setSelectedHsk(e.target.value)}
                    className="w-full bg-rose-50 border-2 border-rose-200 text-rose-700 font-bold py-3 px-4 rounded-xl outline-none cursor-pointer hover:bg-rose-100 transition mb-6"
                >
                    {availableHskLevels.map(lvl => {
                        const locked = isHskLocked(lvl);
                        return (
                            <option key={lvl} value={lvl} disabled={locked}>
                                Bộ {lvl} {locked ? "🔒 (Cần hoàn thành cấp trước hoặc làm Test)" : ""}
                            </option>
                        );
                    })}
                </select>

                <p className="font-bold text-slate-800 mb-4">Lộ trình học tập</p>
                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {levelsData.map(lvl => {
                        const isActive = lvl.level === viewingLevel;
                        
                        return (
                            <button 
                                key={lvl.level}
                                onClick={() => handleLevelChange(lvl)}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    isActive ? 'border-rose-500 bg-rose-50 shadow-md' : 'border-slate-200 bg-white hover:border-rose-300 hover:shadow-sm'
                                }`}
                            >
                                <div className="text-left">
                                    <p className={`font-bold text-lg ${isActive ? 'text-rose-600' : 'text-slate-700'}`}>
                                        Bài {lvl.level}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                        {lvl.words.length} từ vựng
                                    </p>
                                </div>
                                <div className="text-2xl">
                                    {isActive ? '🔥' : '📖'}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                    <button 
                        onClick={openExam} 
                        disabled={!canTakeExam}
                        className={`w-full py-4 font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                            canTakeExam 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:-translate-y-1' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        🎓 THI CHỨNG CHỈ {selectedHsk.toUpperCase()}
                    </button>
                    <p className={`text-xs text-center mt-3 font-medium ${canTakeExam ? 'text-slate-500' : 'text-red-500'}`}>
                        {canTakeExam 
                            ? "Làm đúng 80% số câu để vượt qua bài test mở khóa cấp độ!" 
                            : `Bạn cần học thuộc tất cả từ vựng để thi (${masteredWordsForSelectedHsk}/${totalWordsForSelectedHsk})`
                        }
                    </p>
                </div>
            </div>
        </div>

        {/* KHU VỰC HỌC TẬP CHÍNH */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
            {isCurrentHskLocked ? (
              <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[450px]">
                <div className="text-6xl mb-4">🔒</div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">Cấp độ {selectedHsk.toUpperCase()} đang bị khóa!</h3>
                <p className="text-slate-500 mb-6 max-w-md">Bạn cần hoàn thành cấp độ trước đó hoặc tham gia bài kiểm tra trình độ để mở khóa bộ từ vựng này.</p>
                <Link href="/test" className="px-6 py-3 bg-purple-600 text-white font-bold rounded-2xl shadow hover:bg-purple-700 transition">
                  🎯 Đi tới Kiểm Tra Trình Độ ngay
                </Link>
              </div>
            ) : (
              <>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800">
                        Tiến độ Bài {viewingLevel}
                        </h2>
                        <span className="font-black text-rose-600">{progressPercent}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
                        <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                        <button onClick={() => handleFilterChange("all")} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Tất cả</button>
                        <button onClick={() => handleFilterChange("learning")} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'learning' ? 'bg-white shadow-sm text-red-500' : 'text-slate-500'}`}>Chưa thuộc</button>
                        <button onClick={() => handleFilterChange("mastered")} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'mastered' ? 'bg-white shadow-sm text-green-500' : 'text-slate-500'}`}>Đã thuộc</button>
                    </div>
                </div>

                {filteredWords.length > 0 && activeWord ? (
                  <div className="flex flex-col items-center gap-6 animate-fade-in w-full">
                      
                      {/* THANH TRẠNG THÁI KIỂM TRA */}
                      <div className="flex flex-wrap justify-center gap-4 w-full">
                          <div className={`px-4 py-2 rounded-full font-bold text-sm shadow-sm border ${sentenceResult?.isPass || isAlreadyMastered ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                              Đặt câu: {sentenceResult?.isPass || isAlreadyMastered ? '✓ Đạt' : 'Chưa đạt'}
                          </div>
                      </div>

                      <div 
                      onClick={() => {
                        if (allowFlip) {
                          setIsFlipped(!isFlipped);
                        } else {
                          alert("🔒 Hãy vượt qua bài kiểm tra bên dưới hoặc bấm 'Xem nghĩa' để lật thẻ!");
                        }
                      }}
                      className={`w-full p-10 rounded-3xl shadow-xl border-b-8 border-rose-600 text-center transition-all relative min-h-[350px] flex flex-col justify-center items-center ${allowFlip ? 'bg-white cursor-pointer hover:-translate-y-2' : 'bg-slate-50 cursor-not-allowed opacity-90'}`}
                      >
                      <div className="absolute right-6 top-6 flex gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${wordProgress[wordDisplay] === 'mastered' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                          {wordProgress[wordDisplay] === 'mastered' ? '✓ Đã thuộc' : 'Đang học'}
                          </span>
                      </div>

                      <button 
                          onClick={(e) => { e.stopPropagation(); speak(wordDisplay); }} 
                          className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full text-3xl shadow-sm hover:scale-110 transition-transform mb-6 z-10"
                      >
                          🔊
                      </button>
                      
                      <h3 className="text-8xl font-black text-slate-800 mb-6">{wordDisplay}</h3>
                      
                      {isFlipped ? (
                          <div className="animate-fade-in w-full px-4">
                          <p className="text-3xl font-medium text-slate-500 mb-2 tracking-widest">{pinyinDisplay}</p>
                          <p className="text-2xl font-bold text-rose-600 mb-4">{meaningDisplay}</p>
                          {exampleDisplay && (
                              <p className="text-md italic text-slate-600 bg-slate-50 px-6 py-4 rounded-xl shadow-inner inline-block mt-2">
                              <span className="font-bold text-slate-400">VD:</span> {exampleDisplay}
                              </p>
                          )}
                          </div>
                      ) : (
                          <p className={`text-sm font-bold mt-8 px-4 py-2 rounded-full ${allowFlip ? 'text-slate-400 bg-slate-100 animate-pulse' : 'text-rose-500 bg-rose-50'}`}>
                          {allowFlip ? "👆 Chạm vào thẻ để lật xem nghĩa" : "🔒 Vượt qua kiểm tra hoặc bấm 'Xem nghĩa' để lật"}
                          </p>
                      )}
                      </div>

                      <div className="w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                      
                      {/* KIỂM TRA ĐẶT CÂU (AI CHẤM) */}
                      <div className="w-full max-w-md mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 text-center">
                          <p className="font-bold text-slate-600 mb-4">
                              Đặt câu tiếng Trung với từ: <span className="text-rose-600 text-xl">{activeWord.front}</span>
                          </p>
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={sentenceInput}
                                  onChange={(e) => {
                                      setSentenceInput(e.target.value);
                                      if(sentenceResult && !sentenceResult.isPass) setSentenceResult(null);
                                  }}
                                  placeholder={`VD: ${activeWord.front}...`}
                                  disabled={sentenceResult?.isPass || isCheckingSentence}
                                  className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 outline-none transition-colors"
                              />
                              <button 
                                  onClick={handleCheckSentence}
                                  disabled={sentenceResult?.isPass || !sentenceInput.trim() || isCheckingSentence}
                                  className={`px-6 py-3 font-bold rounded-xl transition-all shadow-sm ${sentenceResult?.isPass ? 'bg-green-500 text-white' : 'bg-rose-500 text-white hover:bg-rose-600'} disabled:opacity-50`}
                              >
                                  {isCheckingSentence ? "Đang chấm..." : (sentenceResult?.isPass ? "✓ Chuẩn" : "Kiểm tra")}
                              </button>
                          </div>
                          
                          {/* Hiển thị Feedback của AI */}
                          {sentenceResult && (
                              <div className={`mt-4 p-4 rounded-xl text-left border animate-fade-in ${sentenceResult.isPass ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                                  <p className={`font-bold mb-1 ${sentenceResult.isPass ? 'text-green-700' : 'text-rose-700'}`}>
                                      {sentenceResult.isPass ? "✅ Rất tốt!" : "❌ Chưa chính xác:"}
                                  </p>
                                  <p className="text-sm text-slate-700 mb-2 leading-relaxed">{sentenceResult.feedback}</p>
                                  
                                  {!sentenceResult.isPass && sentenceResult.suggestion && (
                                      <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                                          <span className="font-bold text-yellow-600">💡 Gợi ý:</span> {sentenceResult.suggestion}
                                      </p>
                                  )}
                              </div>
                          )}
                      </div>

                      {/* NÚT ĐIỀU HƯỚNG */}
                      <div className="flex gap-4 w-full max-w-md mx-auto">
                          <button 
                          onClick={handleMarkLearning}
                          className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-md hover:border-red-400 hover:bg-red-50 transition-colors shadow-sm"
                          >
                          {!isFlipped ? "👀 Xem nghĩa / Bỏ qua" : "⏭️ Từ tiếp theo"}
                          </button>
                          <button 
                          onClick={handleMarkMasteredAndNext}
                          disabled={!isFullyPassed}
                          className={`flex-1 py-4 rounded-2xl font-bold text-md transition-all shadow-sm ${
                              isFullyPassed 
                              ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-200 shadow-lg hover:-translate-y-1' 
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                          >
                          ✓ Đã thuộc & Tiếp ➔
                          </button>
                      </div>
                      </div>
                  </div>
                ) : (
                <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 text-center">
                    <div className="text-6xl mb-4">🎉</div>
                    <h3 className="text-2xl font-bold text-slate-800">Bạn đã hoàn thành bộ lọc này!</h3>
                    <p className="text-slate-500 mt-2">Hãy ôn tập lại hoặc thử sức với bài thi chứng chỉ nhé.</p>
                </div>
                )}
              </>
            )}
        </div>
      </div>
    </main>
  );
}