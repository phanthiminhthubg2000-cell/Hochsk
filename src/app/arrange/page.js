"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
// Đổi nguồn dữ liệu sang sentences.json
import dictationData from "../sentences.json"; 
import { useUser } from "@clerk/nextjs";
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
  const { user } = useUser();

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

  // LẤY CÂU TỪ dictation.json THAY VÌ GỌI API AI
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
          throw new Error(`Chưa có dữ liệu cho ${level} trong file dictation.json.`);
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
      }, 200);

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

  const checkAnswer = async () => { 
    if (!currentSentence) return;
    
    const answerStr = selectedWords.map(w => w.char).join('');
    const expectedStr = currentSentence.chinese.replace(/[.,?!。，？！、]/g, '');
    
    if (answerStr === expectedStr) {
        setFeedback("correct");
        setShowAnswer(false);
        
        // XÁC ĐỊNH CẤP ĐỘ CAO NHẤT MÀ HỌC VIÊN ĐANG ĐỨNG HOẶC ĐÃ MỞ KHÓA
        const currentSelectedNum = parseInt(selectedHsk.replace(/\D/g, ''), 10);
        let highestUnlockedNum = 1;
        for (let lvl of HSK_LEVELS) {
          if (!isHskLocked(lvl.name)) {
            const num = parseInt(lvl.name.replace(/\D/g, ''), 10);
            if (num > highestUnlockedNum) highestUnlockedNum = num;
          }
        }

        // QUY TẮC: Chỉ cộng EXP (+20 EXP) nếu làm đúng ở cấp độ CAO NHẤT hiện tại
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
        
        setTimeout(() => {
            generateNewSentence(selectedHsk);
        }, 1500);
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
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-600">Đang tải dữ liệu sắp xếp...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-10">
                <Link href="/">
                    <button className="w-full mb-6 px-4 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 text-center transition">
                      ← Về Trang Chủ
                    </button>
                </Link>

                <p className="font-bold text-slate-600 mb-2 uppercase tracking-widest text-sm">Chọn Cấp Độ Luyện Tập</p>
                <select 
                    value={selectedHsk} 
                    onChange={handleLevelChange}
                    className="w-full bg-orange-50 border-2 border-orange-200 text-orange-700 font-bold py-3 px-4 rounded-xl outline-none cursor-pointer hover:bg-orange-100 transition mb-6"
                >
                    {HSK_LEVELS.map(lvl => {
                        const locked = isHskLocked(lvl.name);
                        return (
                            <option key={lvl.name} value={lvl.name} disabled={locked}>
                                {lvl.name} {locked ? `🔒 (Cần ${lvl.requiredExp} EXP hoặc pass Test)` : ""}
                            </option>
                        );
                    })}
                </select>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-6">
                    <p className="text-sm font-bold text-slate-500 mb-1">ĐIỂM KINH NGHIỆM (EXP)</p>
                    <p className="text-3xl font-black text-orange-500 mb-2">{userExp} <span className="text-sm text-slate-400">EXP</span></p>
                    
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${expPercent}%` }}></div>
                    </div>
                    
                    {nextLvlObj ? (
                        <p className="text-xs font-bold text-slate-500 text-right">
                            {expPercent}% (Cần thêm {nextLvlObj.requiredExp - userExp} EXP để mở {nextLvlObj.name})
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-orange-500 text-right">ĐÃ ĐẠT CẤP ĐỘ CAO NHẤT!</p>
                    )}
                </div>

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6 text-center">
                    <p className="text-xs font-bold text-purple-800 leading-relaxed">
                      💡 <strong>Quy tắc:</strong> Sắp xếp đúng ở cấp cao nhất ({currentMaxUnlockedName}) nhận <strong>+20 EXP</strong>. Luyện ở cấp thấp hơn sẽ không được cộng EXP!
                    </p>
                    <Link href="/test" className="mt-2 inline-block text-xs font-bold text-purple-600 hover:underline">
                      🎯 Đi tới Kiểm Tra Trình Độ →
                    </Link>
                </div>

                <button 
                  onClick={() => generateNewSentence(selectedHsk)}
                  disabled={isLoading || isCurrentHskLocked}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 {isLoading ? "Đang tải..." : "Bỏ qua & Đổi câu khác"}
                </button>
            </div>
        </div>

        <div className="w-full lg:w-2/3 flex flex-col gap-6">
            {isCurrentHskLocked ? (
              <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[450px]">
                <div className="text-6xl mb-4">🔒</div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">Cấp độ {selectedHsk} đang bị khóa!</h3>
                <p className="text-slate-500 mb-6 max-w-md">
                  Bạn cần tích lũy đủ EXP ở cấp độ cao nhất hoặc vượt qua bài kiểm tra trình độ để mở khóa cấp độ này.
                </p>
                <Link href="/test" className="px-6 py-3 bg-purple-600 text-white font-bold rounded-2xl shadow hover:bg-purple-700 transition">
                  🎯 Đi tới Kiểm Tra Trình Độ ngay
                </Link>
              </div>
            ) : (
              <>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">Sắp Xếp Câu ({selectedHsk})</h2>
                      <p className="text-slate-500 text-sm mt-1">
                        {isPlayingAtMaxLevel 
                          ? "Chạm vào các từ xáo trộn để xếp thành câu tiếng Trung đúng!" 
                          : `⚠️ Bạn đang làm ở cấp thấp hơn cấp cao nhất (${currentMaxUnlockedName}). Sẽ không được cộng EXP ở cấp này!`}
                      </p>
                    </div>
                    <div className="text-4xl">🧩</div>
                </div>

                <div className="w-full bg-white p-10 rounded-3xl shadow-xl border-t-8 border-orange-500 text-center flex flex-col justify-center items-center relative min-h-[450px]">
                    
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center animate-pulse">
                            <div className="text-6xl mb-4">✨</div>
                            <h3 className="text-2xl font-bold text-slate-700">Đang tải câu hỏi từ thư viện...</h3>
                        </div>
                    ) : currentSentence ? (
                        <div className="w-full flex flex-col items-center animate-fade-in">
                            
                            {/* Hiển thị nghĩa tiếng Việt để gợi ý sắp xếp */}
                            <div className="bg-orange-50 px-8 py-6 rounded-2xl border border-orange-100 mb-8 w-full max-w-2xl">
                                <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-1">Gợi ý nghĩa tiếng Việt</p>
                                <p className="text-2xl font-medium text-slate-800 leading-relaxed">{currentSentence.vietnamese}</p>
                            </div>
                            
                            <div className={`w-full max-w-2xl min-h-[100px] border-2 border-dashed rounded-2xl p-4 flex flex-wrap justify-center gap-3 items-center transition-all ${
                                feedback === 'correct' ? 'border-green-500 bg-green-50' : 
                                feedback === 'incorrect' ? 'border-red-500 bg-red-50' : 'border-orange-300 bg-orange-50/30'
                            }`}>
                                {selectedWords.length === 0 && !feedback && (
                                    <span className="text-slate-400 font-medium">Chạm vào các chữ Hán bên dưới để sắp xếp...</span>
                                )}
                                
                                {selectedWords.map(word => (
                                    <button
                                        key={`sel-${word.id}`}
                                        onClick={() => handleDeselectWord(word)}
                                        className="px-5 py-3 bg-white border-2 border-slate-200 text-slate-700 text-2xl font-bold rounded-xl shadow-sm hover:border-orange-400 hover:-translate-y-1 transition-all"
                                    >
                                        {word.char}
                                    </button>
                                ))}
                            </div>

                            {feedback === 'correct' && (
                                <p className="text-green-600 font-bold mt-6 animate-bounce">
                                  {isPlayingAtMaxLevel ? "✨ Xếp câu chính xác! (+20 EXP)" : "✨ Xếp câu chính xác! (Không cộng EXP vì học ở cấp thấp)"}
                                </p>
                            )}
                            {feedback === 'incorrect' && (
                                <p className="text-red-500 font-bold mt-6">❌ Thứ tự chưa đúng, hãy thử lại!</p>
                            )}

                            <div className="w-full max-w-2xl mt-8 flex flex-wrap justify-center gap-3">
                                {shuffledWords.map(word => (
                                    <button
                                        key={`shuf-${word.id}`}
                                        onClick={() => handleSelectWord(word)}
                                        className="px-5 py-3 bg-white border-2 border-slate-200 text-slate-700 text-2xl font-bold rounded-xl shadow-sm hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:-translate-y-1 transition-all"
                                    >
                                        {word.char}
                                    </button>
                                ))}
                            </div>

                            <div className="w-full max-w-2xl mt-10 flex flex-col sm:flex-row gap-4">
                                <button 
                                    onClick={checkAnswer}
                                    disabled={feedback === 'correct' || selectedWords.length === 0}
                                    className={`flex-1 py-4 rounded-xl font-bold text-xl transition-all shadow-md ${
                                        feedback === 'correct' 
                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                                        : 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg'
                                    }`}
                                >
                                    Kiểm tra
                                </button>
                                
                                {feedback === 'incorrect' && (
                                    <button 
                                        onClick={() => {
                                            setShowAnswer(!showAnswer);
                                            if(!showAnswer) speak(currentSentence.chinese);
                                        }}
                                        className="px-6 py-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all animate-fade-in"
                                    >
                                        {showAnswer ? "Ẩn đáp án" : "💡 Xem đáp án"}
                                    </button>
                                )}
                            </div>

                            {showAnswer && feedback === 'incorrect' && (
                                <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-fade-in w-full max-w-2xl text-center">
                                    <p className="text-4xl font-black text-slate-800 mb-2">{currentSentence.chinese}</p>
                                    <p className="text-xl text-slate-600 font-medium mb-3">{currentSentence.pinyin}</p>
                                    <p className="text-sm text-slate-500 italic">Nghĩa: {currentSentence.vietnamese}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                       <div className="text-center">
                            <p className="text-slate-500 font-bold mb-4">Không tìm thấy câu hỏi phù hợp cho cấp độ này.</p>
                            <button onClick={() => generateNewSentence(selectedHsk)} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">Thử lại</button>
                       </div>
                    )}
                </div>
              </>
            )}
        </div>
      </div>
    </main>
  );
}