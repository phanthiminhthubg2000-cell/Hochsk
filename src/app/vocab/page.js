"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
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
      requiredExp: (levelNumber - 1) * 100,
      words: dataArray.slice(i, i + wordsPerLevel)
    });
  }
  return levels.length > 0 ? levels : [{ level: 1, requiredExp: 0, words: [] }];
};

export default function FlashcardPage() {
  const { user } = useUser();
  const availableHskLevels = [...new Set(myCustomData.map(item => item.level))].filter(Boolean).sort();
  const [selectedHsk, setSelectedHsk] = useState(availableHskLevels[0] || "");
  
  const [levelsData, setLevelsData] = useState([]);
  const [userExp, setUserExp] = useState(0);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(1);
  const [viewingLevel, setViewingLevel] = useState(1);
  
  const [wordProgress, setWordProgress] = useState({}); 
  const [filter, setFilter] = useState("all"); 
  
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [shadowingResult, setShadowingResult] = useState(null);

  // --- TRẠNG THÁI KỶ LUẬT THÉP VÀ BÀI TẬP KÉP ---
  const [canFlip, setCanFlip] = useState(false);
  const [shadowingPassed, setShadowingPassed] = useState(false);
  
  const [meaningInput, setMeaningInput] = useState("");
  const [meaningStatus, setMeaningStatus] = useState("idle"); // idle, correct, incorrect
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [userData, setUserData] = useState(null);

  const [examState, setExamState] = useState({
    isOpen: false,
    questions: [],
    currentIndex: 0,
    score: 0,
    isFinished: false,
    total: 0,
    passScore: 0
  });

  // Reset trạng thái mỗi khi chuyển từ vựng mới
  useEffect(() => {
    setCanFlip(false);
    setShadowingPassed(false);
    setIsFlipped(false);
    setShadowingResult(null);
    setMeaningInput("");
    setMeaningStatus("idle");
  }, [activeWordIndex, viewingLevel, filter, selectedHsk]);

  // Tự động lật thẻ khi qua cả 2 bài test
  useEffect(() => {
    if (meaningStatus === "correct" && shadowingPassed) {
      setCanFlip(true);
      setIsFlipped(true);
    }
  }, [meaningStatus, shadowingPassed]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const docRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        } catch (error) {
          console.error("Lỗi lấy dữ liệu chứng chỉ:", error);
        }
      }
    };
    fetchUserData();
  }, [user]);

  const isHskLocked = (lvl) => {
    const lvlStr = String(lvl).toLowerCase();
    if (lvlStr.includes("2")) return !userData?.passedHSK1;
    if (lvlStr.includes("3")) return !userData?.passedHSK2;
    if (lvlStr.includes("4")) return !userData?.passedHSK3;
    if (lvlStr.includes("5")) return !userData?.passedHSK4;
    if (lvlStr.includes("6")) return !userData?.passedHSK5;
    return false;
  };

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
    const savedExp = localStorage.getItem("hskk_exp");
    const savedProgress = localStorage.getItem("hskk_word_progress");
    if (savedExp) setUserExp(parseInt(savedExp));
    if (savedProgress) setWordProgress(JSON.parse(savedProgress));
  }, []);

  useEffect(() => {
    if (levelsData.length === 0) return;
    let newLevel = 1;
    for (let i = levelsData.length - 1; i >= 0; i--) {
      if (userExp >= levelsData[i].requiredExp) {
        newLevel = levelsData[i].level;
        break;
      }
    }
    setMaxUnlockedLevel(newLevel);
    localStorage.setItem("hskk_exp", userExp);
  }, [userExp, levelsData]);

  useEffect(() => {
    if (Object.keys(wordProgress).length > 0) {
      localStorage.setItem("hskk_word_progress", JSON.stringify(wordProgress));
    }
  }, [wordProgress]);

  if (levelsData.length === 0) return <div className="p-10 text-center">Đang tải dữ liệu từ vựng...</div>;

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

  // --- LOGIC BÀI TẬP 1: KIỂM TRA NGHĨA GẦN ĐÚNG ---
  const handleCheckMeaning = () => {
    if (!meaningInput.trim() || !activeWord) return;
    const inputStr = meaningInput.toLowerCase().trim();
    const targetStr = activeWord.back.toLowerCase().trim();
    
    // Nếu nghĩa học viên nhập nằm trong chuỗi đáp án (hoặc ngược lại) -> Chấp nhận "gần đúng"
    if (targetStr.includes(inputStr) || inputStr.includes(targetStr)) {
      setMeaningStatus("correct");
    } else {
      setMeaningStatus("incorrect");
    }
  };

  // --- LOGIC CHUYỂN TỪ ---
  const handleMarkLearning = () => {
    if (!activeWord) return;
    const wordId = activeWord.front;
    setWordProgress({ ...wordProgress, [wordId]: "learning" });
    
    if (!isFlipped) {
      // Lần đầu bấm: Lật thẻ để học viên xem nghĩa
      setCanFlip(true);
      setIsFlipped(true);
    } else {
      // Lần 2 bấm (đã lật thẻ): Chuyển sang từ tiếp theo nhưng KHÔNG cộng điểm
      if (activeWordIndex < filteredWords.length - 1) {
        setActiveWordIndex(prev => prev + 1);
      } else {
        setActiveWordIndex(0);
      }
    }
  };

  const handleMarkMasteredAndNext = async () => {
    const isFullyPassed = shadowingPassed && meaningStatus === "correct";
    if (!activeWord || !isFullyPassed) return;
    
    const wordId = activeWord.front;
    const isAlreadyMastered = wordProgress[wordId] === "mastered";
    
    const newProgress = { ...wordProgress, [wordId]: "mastered" };
    setWordProgress(newProgress);
    
    if (!isAlreadyMastered) {
      setUserExp(prev => prev + 20); 
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
      if (levelObj.level <= maxUnlockedLevel) {
          setViewingLevel(levelObj.level);
          setActiveWordIndex(0);
          setFilter("all");
      } else {
          alert(`🔒 Bạn cần đạt ${levelObj.requiredExp} EXP để mở khóa Bài ${levelObj.level}!`);
      }
  }

  // --- LOGIC BÀI TẬP 2: GHI ÂM AI CHẤM ĐIỂM ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm', audioBitsPerSecond: 16000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setShadowingResult(null);
    } catch (err) {
      alert("Vui lòng cấp quyền Micro!");
    }
  };

  const stopRecordingAndGrade = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          setIsRecording(false);
          setShadowingResult("loading");
          
          try {
            const targetText = activeWord.front;
            const res = await fetch('/api/shadowing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetText, audioBase64: reader.result })
            });
            const data = await res.json();
            setShadowingResult(data);

            // AI chấm trên 80 điểm thì ghi nhận vượt qua bài test phát âm
            if (data.score >= 80) {
              setShadowingPassed(true);
            }

          } catch (e) {
            alert("Lỗi chấm điểm AI!");
            setShadowingResult(null);
          }
        };
      };
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const dataForSelectedHsk = selectedHsk ? myCustomData.filter(item => item.level === selectedHsk) : myCustomData;
  const uniqueDataForSelectedHsk = dataForSelectedHsk.filter((item, index, self) => index === self.findIndex((t) => t.front === item.front));
  
  const totalWordsForSelectedHsk = uniqueDataForSelectedHsk.length;
  const masteredWordsForSelectedHsk = uniqueDataForSelectedHsk.filter(w => wordProgress[w.front] === "mastered").length;
  const canTakeExam = totalWordsForSelectedHsk > 0 && masteredWordsForSelectedHsk === totalWordsForSelectedHsk;

  // --- LOGIC BÀI THI CHỨNG CHỈ (BỎ QUA DO ĐÃ HOÀN THIỆN Ở BƯỚC TRƯỚC) ---
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
        alert(`🎉 Xuất sắc! Bạn đạt ${examState.score}/${examState.total} điểm. Cấp độ tiếp theo đã được mở khóa!`);
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
  const isFullyPassed = shadowingPassed && meaningStatus === "correct";

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
                                Bộ {lvl} {locked ? "🔒 (Cần đỗ cấp độ trước)" : ""}
                            </option>
                        );
                    })}
                </select>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                    <p className="text-sm font-bold text-slate-500 mb-1">TỔNG EXP CỦA BẠN</p>
                    <p className="text-3xl font-black text-yellow-500 mb-2">{userExp} <span className="text-sm text-slate-400">EXP</span></p>
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${Math.min((userExp / (levelsData.find(l => l.level === maxUnlockedLevel + 1)?.requiredExp || Math.max(userExp, 1))) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-xs font-medium text-slate-400 mt-2 text-right">
                        Cần {levelsData.find(l => l.level === maxUnlockedLevel + 1)?.requiredExp || 'MAX'} EXP để mở khóa bài tiếp theo
                    </p>
                </div>

                <p className="font-bold text-slate-800 mb-4">Lộ trình học tập</p>
                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {levelsData.map(lvl => {
                        const isUnlocked = lvl.level <= maxUnlockedLevel;
                        const isActive = lvl.level === viewingLevel;
                        
                        return (
                            <button 
                                key={lvl.level}
                                onClick={() => handleLevelChange(lvl)}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    isActive ? 'border-rose-500 bg-rose-50 shadow-md' : 
                                    isUnlocked ? 'border-slate-200 bg-white hover:border-rose-300 hover:shadow-sm' : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                                }`}
                            >
                                <div className="text-left">
                                    <p className={`font-bold text-lg ${isActive ? 'text-rose-600' : isUnlocked ? 'text-slate-700' : 'text-slate-400'}`}>
                                        Bài {lvl.level}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                        {isUnlocked ? `${lvl.words.length} từ vựng` : `Cần ${lvl.requiredExp} EXP`}
                                    </p>
                                </div>
                                <div className="text-2xl">
                                    {isActive ? '🔥' : isUnlocked ? '🔓' : '🔒'}
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
                            ? "Làm đúng 80% số câu để mở khóa cấp độ tiếp theo!" 
                            : `Bạn cần học thuộc tất cả từ vựng để thi (${masteredWordsForSelectedHsk}/${totalWordsForSelectedHsk})`
                        }
                    </p>
                </div>
            </div>
        </div>

        {/* KHU VỰC HỌC TẬP CHÍNH */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
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
            <div className="flex flex-col items-center gap-6 animate-fade-in">
                
                {/* THANH TRẠNG THÁI KIỂM TRA KÉP */}
                <div className="flex flex-wrap justify-center gap-4 w-full">
                    <div className={`px-4 py-2 rounded-full font-bold text-sm shadow-sm border ${meaningStatus === 'correct' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                        1. Nhập Nghĩa: {meaningStatus === 'correct' ? '✓ Đạt' : 'Chưa đạt'}
                    </div>
                    <div className={`px-4 py-2 rounded-full font-bold text-sm shadow-sm border ${shadowingPassed ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                        2. Đọc AI (80+): {shadowingPassed ? '✓ Đạt' : 'Chưa đạt'}
                    </div>
                </div>

                <div 
                onClick={() => {
                  if (canFlip) {
                    setIsFlipped(!isFlipped);
                  } else {
                    alert("🔒 Hãy vượt qua cả 2 bài kiểm tra bên dưới hoặc bấm 'Xem nghĩa' để lật thẻ!");
                  }
                }}
                className={`w-full p-10 rounded-3xl shadow-xl border-b-8 border-rose-600 text-center transition-all relative min-h-[350px] flex flex-col justify-center items-center ${canFlip ? 'bg-white cursor-pointer hover:-translate-y-2' : 'bg-slate-50 cursor-not-allowed opacity-90'}`}
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
                    <p className={`text-sm font-bold mt-8 px-4 py-2 rounded-full ${canFlip ? 'text-slate-400 bg-slate-100 animate-pulse' : 'text-rose-500 bg-rose-50'}`}>
                    {canFlip ? "👆 Chạm vào thẻ để lật xem nghĩa" : "🔒 Vượt qua kiểm tra hoặc bấm 'Xem nghĩa' để lật"}
                    </p>
                )}
                </div>

                <div className="w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                
                {/* 1. KIỂM TRA NGHĨA */}
                <div className="w-full max-w-md mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6 text-center">
                    <p className="font-bold text-slate-600 mb-4">1. Nhập Nghĩa Tiếng Việt (Gần đúng)</p>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={meaningInput}
                            onChange={(e) => {
                                setMeaningInput(e.target.value);
                                setMeaningStatus("idle");
                            }}
                            placeholder="VD: xin chào..."
                            disabled={meaningStatus === "correct"}
                            className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 outline-none transition-colors"
                        />
                        <button 
                            onClick={handleCheckMeaning}
                            disabled={meaningStatus === "correct" || !meaningInput.trim()}
                            className={`px-6 py-3 font-bold rounded-xl transition-all shadow-sm ${meaningStatus === 'correct' ? 'bg-green-500 text-white' : 'bg-rose-500 text-white hover:bg-rose-600'}`}
                        >
                            {meaningStatus === "correct" ? "✓ Chuẩn" : "Kiểm tra"}
                        </button>
                    </div>
                    {meaningStatus === "incorrect" && <p className="text-red-500 text-sm mt-3 font-medium animate-bounce">Nghĩa chưa chính xác, thử lại nhé!</p>}
                </div>

                {/* 2. KIỂM TRA PHÁT ÂM */}
                <div className="w-full max-w-md mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 text-center">
                    <p className="font-bold text-slate-600 mb-4">2. Đọc Ghi Âm (Cần 80+ điểm AI)</p>
                    
                    {!isRecording ? (
                    <button onClick={startRecording} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 flex justify-center items-center gap-2 transition shadow-md">
                        🎙️ Nhấn để Ghi âm
                    </button>
                    ) : (
                    <button onClick={stopRecordingAndGrade} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold animate-pulse flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)] transition">
                        ⏹️ Đang thu âm... Bấm để Nộp
                    </button>
                    )}

                    {shadowingResult === "loading" && <p className="text-rose-500 font-bold mt-4 animate-bounce">AI đang nghe và phân tích...</p>}
                    
                    {shadowingResult && shadowingResult !== "loading" && (
                    <div className="mt-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left">
                        <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-700">Điểm số:</span>
                        <span className={`text-2xl font-black ${shadowingResult.score >= 80 ? 'text-green-500' : 'text-red-500'}`}>{shadowingResult.score}/100</span>
                        </div>
                        <p className="text-sm text-slate-600"><span className="font-bold">Nhận xét:</span> {shadowingResult.feedback}</p>
                    </div>
                    )}
                </div>

                {/* NÚT ĐIỀU HƯỚNG */}
                <div className="flex gap-4 w-full max-w-md mx-auto">
                    <button 
                    onClick={handleMarkLearning}
                    className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-md hover:border-red-400 hover:bg-red-50 transition-colors shadow-sm"
                    >
                    {!isFlipped ? "👀 Xem nghĩa / Bỏ qua" : "⏭️ Từ tiếp theo (Không nhận EXP)"}
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
                <p className="text-slate-500 mt-2">Hãy cày thêm EXP để mở khóa bài học tiếp theo nhé.</p>
            </div>
            )}
        </div>
      </div>
    </main>
  );
}