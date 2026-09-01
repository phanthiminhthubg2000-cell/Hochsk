"use client";
import { useState, useEffect, useRef } from "react";
import { localCards, localSentences, localArrangements } from "./data"; 
import topicCards from "./topics.json";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vocab"); 
  const [filterLevel, setFilterLevel] = useState("");

  const [learnedCards, setLearnedCards] = useState([]);
  const [translatedSentences, setTranslatedSentences] = useState([]);
  const [arrangedSentences, setArrangedSentences] = useState([]); 
  const [dictatedSentences, setDictatedSentences] = useState([]); 

  // --- STATES TỪNG TAB ---
  const [vocabIndex, setVocabIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const [transIndex, setTransIndex] = useState(0);
  const [transInput, setTransInput] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  
  const [arrangeIndex, setArrangeIndex] = useState(0);
  const [availableChars, setAvailableChars] = useState([]);
  const [selectedChars, setSelectedChars] = useState([]);
  const [arrangeFeedback, setArrangeFeedback] = useState(null);
  
  const [dictationIndex, setDictationIndex] = useState(0);
  const [dictationInput, setDictationInput] = useState("");
  const [dictationFeedback, setDictationFeedback] = useState(null);
  const [showDictationAnswer, setShowDictationAnswer] = useState(false);

  const [chatHistory, setChatHistory] = useState([{ role: 'ai', content: '你好！我是你的中文练习伙伴。(Xin chào! Tôi là bạn luyện tập của bạn.)' }]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatContainerRef = useRef(null);

  const availableTopics = [...new Set(topicCards.map(c => c.topic))];
  const [activeTopic, setActiveTopic] = useState(availableTopics[0] || "");
  const [topicVocabIndex, setTopicVocabIndex] = useState(0);
  const [isTopicFlipped, setIsTopicFlipped] = useState(false);

  // --- STATES PHÒNG THI HSKK (NON-STOP) ---
  const [hskkLevel, setHskkLevel] = useState("HSK Cấp 3");
  const [examQuestions, setExamQuestions] = useState([]); 
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState([]); 
  
  const [examState, setExamState] = useState("idle"); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [spokenText, setSpokenText] = useState("");
  const [hskkFinalResult, setHskkFinalResult] = useState(null);
  
  const recognitionRef = useRef(null);

  // --- HÀM PHÁT ÂM CHUNG ---
  const speak = (text, e) => {
    if (e) e.stopPropagation(); 
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; 
    utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  // Tự động cuộn khung chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isChatting]);

  // Load tiến độ từ LocalStorage
  useEffect(() => {
    const savedCards = JSON.parse(localStorage.getItem("hsk_learnedCards") || "[]");
    const savedTrans = JSON.parse(localStorage.getItem("hsk_translated") || "[]");
    const savedArr = JSON.parse(localStorage.getItem("hsk_arranged") || "[]");
    const savedDict = JSON.parse(localStorage.getItem("hsk_dictated") || "[]"); 
    
    setLearnedCards(savedCards); 
    setTranslatedSentences(savedTrans);
    setArrangedSentences(savedArr); 
    setDictatedSentences(savedDict);

    const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
    const allLevels = [...new Set([
      ...localCards.map(c => normalizeLevel(c.level)), 
      ...localSentences.map(s => normalizeLevel(s.level)), 
      ...localArrangements.map(a => normalizeLevel(a.level))
    ].filter(Boolean))].sort((a, b) => {
        return (parseInt(a.replace(/[^\d]/g, '')) || 0) - (parseInt(b.replace(/[^\d]/g, '')) || 0);
    });

    if (allLevels.length > 0) setFilterLevel(allLevels[0]);
    setLoading(false);
  }, []);

  // Reset UI khi đổi Tab hoặc Level
  useEffect(() => {
    setVocabIndex(0); setIsFlipped(false);
    setTransIndex(0); setTransInput(""); setAiFeedback(null); setShowAnswer(false);
    setArrangeIndex(0); setArrangeFeedback(null);
    setDictationIndex(0); setDictationInput(""); setDictationFeedback(null); setShowDictationAnswer(false);
    setExamState("idle"); setTimeLeft(0); setExamQuestions([]); setExamAnswers([]); stopRecording();
  }, [filterLevel, activeTab, hskkLevel]);

  useEffect(() => { 
    setTopicVocabIndex(0); setIsTopicFlipped(false); 
  }, [activeTopic]);

  // --- LOGIC HSKK TIMER TỰ ĐỘNG CHUYỂN CÂU ---
  const getTimesForType = (type) => {
    switch(type) {
      case 'repeat': return { prep: 10, speak: 30 };
      case 'retell': return { prep: 45, speak: 90 };
      case 'picture': return { prep: 60, speak: 120 };
      case 'short': return { prep: 60, speak: 120 };
      default: return { prep: 30, speak: 60 };
    }
  };

  useEffect(() => {
    let timer;
    if ((examState === "prep" || examState === "speaking") && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && (examState === "prep" || examState === "speaking")) {
      const currentQ = examQuestions[currentQIndex];
      if (!currentQ) return;
      if (examState === "prep") {
        setExamState("speaking");
        setTimeLeft(getTimesForType(currentQ.type).speak);
        startRecording();
      } else if (examState === "speaking") {
        handleNextQuestion(spokenText);
      }
    }
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examState, timeLeft, spokenText, currentQIndex, examQuestions]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- XỬ LÝ DỮ LIỆU & LỌC THEO LEVEL ---
  const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
  const vocabularies = localCards.map(c => ({ ...c, level: normalizeLevel(c.level), is_learned: learnedCards.includes(c.id) }));
  const sentences = localSentences.map(s => ({ ...s, level: normalizeLevel(s.level), is_translated: translatedSentences.includes(s.id), is_dictated: dictatedSentences.includes(s.id) }));
  const arrangements = localArrangements.map(a => ({ ...a, level: normalizeLevel(a.level), is_arranged: arrangedSentences.includes(a.id) }));

  const filteredCards = vocabularies.filter(card => card.level === filterLevel);
  const filteredSentences = sentences.filter(sent => sent.level === filterLevel);
  const filteredArrangements = arrangements.filter(arr => arr.level === filterLevel);
  const filteredTopicCards = topicCards.filter(c => c.topic === activeTopic);

  // Thống kê tiến độ bản đồ
  const uniqueLevels = [...new Set([...vocabularies.map(c=>c.level), ...sentences.map(s=>s.level), ...arrangements.map(a=>a.level)].filter(Boolean))].sort((a, b) => {
    return (parseInt(a.replace(/[^\d]/g, '')) || 0) - (parseInt(b.replace(/[^\d]/g, '')) || 0);
  });
  let cumulativeVocabUnlock = true; let cumulativeTransUnlock = true; let cumulativeArrUnlock = true;
  const levelStats = uniqueLevels.map((lvl) => {
    const vocabInLevel = vocabularies.filter(c => c.level === lvl);
    const sentInLevel = sentences.filter(s => s.level === lvl);
    const arrInLevel = arrangements.filter(a => a.level === lvl);
    
    const vocabLearned = vocabInLevel.filter(c => c.is_learned).length;
    const transLearned = sentInLevel.filter(s => s.is_translated).length;
    const dictLearned = sentInLevel.filter(s => s.is_dictated).length;
    const arrLearned = arrInLevel.filter(a => a.is_arranged).length;
    
    const vocabProgress = vocabInLevel.length ? Math.round((vocabLearned / vocabInLevel.length) * 100) : 0;
    const transProgress = sentInLevel.length ? Math.round((transLearned / sentInLevel.length) * 100) : 0;
    const dictProgress = sentInLevel.length ? Math.round((dictLearned / sentInLevel.length) * 100) : 0;
    const arrProgress = arrInLevel.length ? Math.round((arrLearned / arrInLevel.length) * 100) : 0;
    
    const vocabUnlocked = cumulativeVocabUnlock; const transUnlocked = cumulativeTransUnlock; const arrUnlocked = cumulativeArrUnlock;

    if (vocabInLevel.length > 0 && vocabLearned < vocabInLevel.length) cumulativeVocabUnlock = false;
    if (sentInLevel.length > 0 && transLearned < sentInLevel.length) cumulativeTransUnlock = false;
    if (arrInLevel.length > 0 && arrLearned < arrInLevel.length) cumulativeArrUnlock = false;

    return { 
      lvl, vocabUnlocked, transUnlocked, arrUnlocked,
      vocabTotal: vocabInLevel.length, vocabLearned, vocabProgress,
      transTotal: sentInLevel.length, transLearned, transProgress,
      dictTotal: sentInLevel.length, dictLearned, dictProgress,
      arrTotal: arrInLevel.length, arrLearned, arrProgress
    };
  });
  const currentStats = levelStats.find(s => s.lvl === filterLevel) || { vocabProgress: 0, transProgress: 0, dictProgress: 0, arrProgress: 0 };

  // Xáo trộn chữ Hán cho phần Sắp Xếp
  useEffect(() => {
    if (activeTab === "arrange" && filteredArrangements.length > 0) {
      const currentSent = filteredArrangements[arrangeIndex];
      const cleanChinese = currentSent.chinese.replace(/[.,!?。，！？]/g, '').trim();
      const charsArray = cleanChinese.split('');
      const shuffled = charsArray.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }, index) => ({ id: index, char: value }));
      setAvailableChars(shuffled); setSelectedChars([]); setArrangeFeedback(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, arrangeIndex, filterLevel]);

  // --- HÀM TƯƠNG TÁC NGƯỜI DÙNG ---
  const toggleLearnedStatus = () => {
    if (filteredCards.length === 0) return;
    const cardId = filteredCards[vocabIndex].id;
    let newSaved;
    if (learnedCards.includes(cardId)) { newSaved = learnedCards.filter(id => id !== cardId); } 
    else { newSaved = [...learnedCards, cardId]; }
    setLearnedCards(newSaved); localStorage.setItem("hsk_learnedCards", JSON.stringify(newSaved)); 
  };

  const handleTranslateSubmit = async (e) => {
    e.preventDefault();
    if (!transInput.trim() || filteredSentences.length === 0) return;
    setIsGrading(true);
    const currentTransCard = filteredSentences[transIndex];
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vietnamese: currentTransCard.vietnamese, userTranslation: transInput })
      });
      const data = await res.json();
      setAiFeedback(data); setShowAnswer(true);
      if (data.isCorrect && !currentTransCard.is_translated) {
        const newSaved = [...translatedSentences, currentTransCard.id];
        setTranslatedSentences(newSaved); localStorage.setItem("hsk_translated", JSON.stringify(newSaved));
      }
    } catch (error) { alert("Lỗi kết nối Giáo viên AI!"); } finally { setIsGrading(false); }
  };

  const handleDictationSubmit = (e) => {
    e.preventDefault();
    if (!dictationInput.trim() || filteredSentences.length === 0) return;
    const currentSent = filteredSentences[dictationIndex];
    const cleanTarget = currentSent.chinese.replace(/[.,!?。，！？\s]/g, '').trim();
    const cleanInput = dictationInput.replace(/[.,!?。，！？\s]/g, '').trim();
    if (cleanInput === cleanTarget) {
      setDictationFeedback("correct"); setShowDictationAnswer(true);
      if (!currentSent.is_dictated) {
        const newSaved = [...dictatedSentences, currentSent.id];
        setDictatedSentences(newSaved); localStorage.setItem("hsk_dictated", JSON.stringify(newSaved));
      }
    } else { setDictationFeedback("incorrect"); }
  };

  const handleSelectChar = (charObj) => { setAvailableChars(availableChars.filter(c => c.id !== charObj.id)); setSelectedChars([...selectedChars, charObj]); };
  const handleDeselectChar = (charObj) => { setSelectedChars(selectedChars.filter(c => c.id !== charObj.id)); setAvailableChars([...availableChars, charObj]); };

  const checkArrangement = () => {
    const currentSent = filteredArrangements[arrangeIndex];
    const cleanChinese = currentSent.chinese.replace(/[.,!?。，！？]/g, '').trim();
    const userString = selectedChars.map(c => c.char).join('');
    if (userString === cleanChinese) {
      setArrangeFeedback("correct");
      if (!currentSent.is_arranged) {
        const newSaved = [...arrangedSentences, currentSent.id];
        setArrangedSentences(newSaved); localStorage.setItem("hsk_arranged", JSON.stringify(newSaved));
      }
    } else { setArrangeFeedback("incorrect"); }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newUserMsg = { role: 'user', content: chatInput };
    const newHistory = [...chatHistory, newUserMsg];
    setChatHistory(newHistory); setChatInput(""); setIsChatting(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory })
      });
      const data = await res.json();
      setChatHistory([...newHistory, { role: 'ai', content: data.reply }]);
    } catch (error) { alert("Lỗi kết nối Chat AI!"); } finally { setIsChatting(false); }
  };

  // --- HÀM ĐIỀU PHỐI HSKK ---
  const generateHskkExam = async () => {
    setExamState("scoring");
    setExamAnswers([]); setSpokenText(""); setHskkFinalResult(null); 
    
    try {
      const res = await fetch('/api/hskk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "generate", level: hskkLevel })
      });
      const data = await res.json();
      const fullExam = data.map(q => q.type === 'picture' ? { ...q, image: `https://picsum.photos/seed/${Math.random()}/800/400` } : q);
      setExamQuestions(fullExam);
      setCurrentQIndex(0);
      setExamState("prep");
      setTimeLeft(getTimesForType(fullExam[0].type).prep);
    } catch (e) {
      alert("Lỗi AI ra đề thi! Hãy kiểm tra lại file .env.local và API Key.");
      setExamState("idle");
    }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true; 
    recognition.interimResults = false;
    
    recognition.onresult = (e) => {
      let currentTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        currentTranscript += e.results[i][0].transcript;
      }
      setSpokenText(prev => prev ? prev + "，" + currentTranscript : currentTranscript); 
    };
    
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecording = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const handleNextQuestion = (currentText) => {
    stopRecording();
    const currentQ = examQuestions[currentQIndex];
    const newAnswers = [...examAnswers, { type: currentQ.type, question: currentQ.text, answer: currentText || "(Không trả lời)" }];
    setExamAnswers(newAnswers);
    setSpokenText("");

    if (currentQIndex < examQuestions.length - 1) {
      const nextQIndex = currentQIndex + 1;
      setCurrentQIndex(nextQIndex);
      setExamState("prep");
      setTimeLeft(getTimesForType(examQuestions[nextQIndex].type).prep);
    } else {
      submitFullExam(newAnswers);
    }
  };

  const submitFullExam = async (allAnswers) => {
    setExamState("scoring");
    try {
      const res = await fetch('/api/hskk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "grade", level: hskkLevel, answers: allAnswers })
      });
      const data = await res.json();
      setHskkFinalResult(data);
    } catch (error) {
      alert("Lỗi chấm điểm bài thi!");
    } finally {
      setExamState("done");
    }
  };

  // --- RENDER GIAO DIỆN ---
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><h1 className="text-2xl font-bold text-blue-500 animate-pulse">Đang tải dữ liệu...</h1></main>;

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <h1 className="text-4xl font-extrabold mb-6 text-slate-800 tracking-tight">Hành Trình HSK</h1>
      
      {/* THANH MENU TỔNG HỢP 7 TABS */}
      <div className="flex flex-wrap bg-slate-200 p-1 rounded-xl mb-6 w-full max-w-6xl shadow-inner gap-1 justify-center">
        <button onClick={() => setActiveTab("vocab")} className={`px-4 py-3 rounded-lg font-bold text-sm transition-all flex-grow ${activeTab === "vocab" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>🗂️ HSK</button>
        <button onClick={() => setActiveTab("topic")} className={`px-4 py-3 rounded-lg font-bold text-sm transition-all flex-grow ${activeTab === "topic" ? "bg-white text-pink-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>📚 Chủ Đề</button>
        <button onClick={() => setActiveTab("dictation")} className={`px-4 py-3 rounded-lg font-bold text-sm transition-all flex-grow ${activeTab === "dictation" ? "bg-white text-teal-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>🎧 Chép Chính Tả</button>
        <button onClick={() => setActiveTab("translate")} className={`px-4 py-3 rounded-lg font-bold text-sm transition-all flex-grow ${activeTab === "translate" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>✍️ Dịch Câu</button>
        <button onClick={() => setActiveTab("arrange")} className={`px-4 py-3 rounded-lg font-bold text-sm transition-all flex-grow ${activeTab === "arrange" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>🧩 Sắp Xếp</button>
        <button onClick={() => setActiveTab("roleplay")} className={`px-4 py-3 rounded-lg font-bold text-sm transition-all flex-grow ${activeTab === "roleplay" ? "bg-white text-green-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>💬 Thực Chiến</button>
        <button onClick={() => setActiveTab("hskk")} className={`px-4 py-3 rounded-lg font-bold text-sm transition-all flex-grow ${activeTab === "hskk" ? "bg-rose-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>🎤 Thi HSKK</button>
      </div>

      {/* BẢN ĐỒ TIẾN ĐỘ HỌC */}
      {(activeTab === "vocab" || activeTab === "translate" || activeTab === "arrange" || activeTab === "dictation") && (
        <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-bold text-slate-600">Bản đồ HSK:</span>
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="border border-slate-300 bg-slate-50 text-slate-800 rounded-lg px-4 py-2 outline-none font-bold cursor-pointer">
              {levelStats.map(stat => {
                const isUnlocked = activeTab === "vocab" ? stat.vocabUnlocked : (activeTab === "translate" || activeTab === "dictation") ? stat.transUnlocked : stat.arrUnlocked;
                return (
                  <option key={stat.lvl} value={stat.lvl} disabled={!isUnlocked}>
                    {isUnlocked ? `🔓 ${stat.lvl}` : `🔒 ${stat.lvl} (Khóa)`}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <div className="flex justify-between text-sm font-semibold mb-1">
               <span className={activeTab === "vocab" ? "text-blue-600" : activeTab === "translate" ? "text-indigo-600" : activeTab === "dictation" ? "text-teal-600" : "text-orange-600"}>
                {activeTab === "vocab" ? "Tiến độ thuộc từ vựng" : activeTab === "translate" ? "Tiến độ dịch chuẩn xác" : activeTab === "dictation" ? "Tiến độ nghe chuẩn xác" : "Tiến độ xếp câu đúng"}
              </span>
              <span className="text-slate-600">
                {activeTab === "vocab" ? `${currentStats.vocabLearned} / ${currentStats.vocabTotal} (${currentStats.vocabProgress}%)` : 
                 activeTab === "translate" ? `${currentStats.transLearned} / ${currentStats.transTotal} (${currentStats.transProgress}%)` :
                 activeTab === "dictation" ? `${currentStats.dictLearned} / ${currentStats.dictTotal} (${currentStats.dictProgress}%)` :
                 `${currentStats.arrLearned} / ${currentStats.arrTotal} (${currentStats.arrProgress}%)`}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
               <div className={`h-3 rounded-full transition-all duration-500 ${activeTab === "vocab" ? "bg-blue-500" : activeTab === "translate" ? "bg-indigo-500" : activeTab === "dictation" ? "bg-teal-500" : "bg-orange-500"}`} 
                    style={{ width: `${activeTab === "vocab" ? currentStats.vocabProgress : activeTab === "translate" ? currentStats.transProgress : activeTab === "dictation" ? currentStats.dictProgress : currentStats.arrProgress}%` }}>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: TỪ VỰNG HSK */}
      {activeTab === "vocab" && (
        <div className="flex flex-col items-center w-full max-w-2xl">
          {filteredCards.length === 0 ? <div className="bg-white border border-slate-200 text-slate-500 p-8 rounded-2xl text-center w-full">Chưa có từ vựng.</div> : (
            <>
              <div className="w-80 h-[420px] [perspective:1000px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-3xl shadow-xl border-2 p-6 [backface-visibility:hidden]">
                    <h2 className="text-7xl font-bold text-slate-800 mb-4">{filteredCards[vocabIndex].front}</h2>
                    <button onClick={(e) => speak(filteredCards[vocabIndex].front, e)} className="w-14 h-14 bg-blue-50 text-blue-500 rounded-full text-2xl hover:bg-blue-100 transition">🔊</button>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50 rounded-3xl shadow-xl border-2 border-blue-200 p-6 text-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    <h2 className="text-4xl font-extrabold text-blue-800 mb-2">{filteredCards[vocabIndex].back}</h2>
                    <p className="text-slate-600 text-xl font-medium">{filteredCards[vocabIndex].ipa}</p>
                  </div>
                </div>
              </div>
              <button onClick={toggleLearnedStatus} className={`mt-8 px-8 py-3 rounded-2xl font-bold text-white shadow-lg ${filteredCards[vocabIndex].is_learned ? "bg-orange-500" : "bg-emerald-500"}`}>
                {filteredCards[vocabIndex].is_learned ? "↺ Bỏ đánh dấu thuộc" : "✓ Chốt! Đã thuộc"}
              </button>
              <div className="flex items-center gap-6 mt-6">
                <button onClick={() => {setIsFlipped(false); setVocabIndex(vocabIndex - 1)}} disabled={vocabIndex === 0} className="w-12 h-12 bg-white rounded-full font-bold text-xl disabled:opacity-30 border">←</button>
                <span className="font-medium text-slate-500">{vocabIndex + 1} / {filteredCards.length}</span>
                <button onClick={() => {setIsFlipped(false); setVocabIndex(vocabIndex + 1)}} disabled={vocabIndex === filteredCards.length - 1} className="w-12 h-12 bg-blue-600 text-white rounded-full font-bold text-xl disabled:opacity-50">→</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: TỪ VỰNG CHỦ ĐỀ */}
      {activeTab === "topic" && (
        <div className="flex flex-col items-center w-full max-w-2xl">
          <div className="flex gap-2 mb-8 w-full overflow-x-auto pb-2 scrollbar-hide justify-center px-4">
            {availableTopics.map(topic => (
              <button key={topic} onClick={() => setActiveTopic(topic)} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border ${activeTopic === topic ? "bg-pink-600 text-white border-pink-600 shadow-md" : "bg-white text-slate-600 hover:bg-pink-50"}`}>
                {topic}
              </button>
            ))}
          </div>
          {filteredTopicCards.length === 0 ? <div className="text-slate-500 bg-white p-8 rounded-2xl w-full text-center border">Chưa có từ vựng nào.</div> : (
            <>
              <div className="w-80 h-[420px] [perspective:1000px] cursor-pointer" onClick={() => setIsTopicFlipped(!isTopicFlipped)}>
                <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isTopicFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-3xl shadow-xl border-2 border-pink-100 p-6 [backface-visibility:hidden]">
                    <span className="absolute top-4 right-4 bg-pink-100 text-pink-600 text-xs px-2 py-1 rounded font-bold uppercase">{activeTopic}</span>
                    <h2 className="text-7xl font-bold text-slate-800 mb-4">{filteredTopicCards[topicVocabIndex].front}</h2>
                    <button onClick={(e) => speak(filteredTopicCards[topicVocabIndex].front, e)} className="w-14 h-14 bg-pink-50 text-pink-500 rounded-full text-2xl hover:bg-pink-100">🔊</button>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-pink-50 rounded-3xl shadow-xl border-2 border-pink-200 p-6 text-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    <h2 className="text-4xl font-extrabold text-pink-800 mb-2">{filteredTopicCards[topicVocabIndex].back}</h2>
                    <p className="text-slate-600 text-xl font-medium">{filteredTopicCards[topicVocabIndex].ipa}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 mt-10">
                <button onClick={() => {setIsTopicFlipped(false); setTopicVocabIndex(topicVocabIndex - 1)}} disabled={topicVocabIndex === 0} className="w-12 h-12 bg-white rounded-full font-bold text-xl disabled:opacity-30 border">←</button>
                <span className="font-medium text-slate-500">{topicVocabIndex + 1} / {filteredTopicCards.length}</span>
                <button onClick={() => {setIsTopicFlipped(false); setTopicVocabIndex(topicVocabIndex + 1)}} disabled={topicVocabIndex === filteredTopicCards.length - 1} className="w-12 h-12 bg-pink-600 text-white rounded-full font-bold text-xl disabled:opacity-50">→</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: NGHE CHÉP CHÍNH TẢ */}
      {activeTab === "dictation" && (
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border p-8 text-center">
          {filteredSentences.length === 0 ? <div className="text-slate-500">Chưa có dữ liệu bài tập nghe.</div> : (
            <>
              {filteredSentences[dictationIndex].is_dictated && <div className="absolute top-4 right-4 bg-teal-100 text-teal-700 text-xs px-3 py-1 rounded-full font-bold shadow-sm">ĐÃ NGHE ĐÚNG</div>}
              <p className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">Nghe và Gõ lại chữ Hán</p>
              <button onClick={() => speak(filteredSentences[dictationIndex].chinese)} className="w-24 h-24 mx-auto flex items-center justify-center bg-teal-50 text-teal-600 rounded-full hover:bg-teal-100 hover:scale-105 transition-all shadow-md text-5xl mb-8 animate-pulse">🔊</button>
              {!showDictationAnswer ? (
                <form onSubmit={handleDictationSubmit} className="flex flex-col gap-4">
                  <input type="text" placeholder="Gõ chính xác những gì bạn nghe được..." value={dictationInput} onChange={(e) => setDictationInput(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 focus:border-teal-500 outline-none text-xl text-center" />
                  <button type="submit" className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-teal-700 transition">Kiểm tra</button>
                  <button type="button" onClick={() => setShowDictationAnswer(true)} className="text-sm text-slate-500 underline mt-2 hover:text-slate-800">Nghe không ra? Xem đáp án</button>
                </form>
              ) : (
                <div className="flex flex-col gap-4 text-left">
                  {dictationFeedback && (
                    <div className={`p-4 rounded-xl border ${dictationFeedback === "correct" ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      <h4 className="font-bold">{dictationFeedback === "correct" ? '🎉 Đôi tai vàng! Hoàn toàn chính xác.' : '❌ Chưa chính xác rồi.'}</h4>
                    </div>
                  )}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center mt-2">
                    <p className="text-xs font-bold text-teal-500 uppercase mb-2">Đáp án gốc</p>
                    <h3 className="text-3xl font-bold text-slate-800 mb-2">{filteredSentences[dictationIndex].chinese}</h3>
                    <p className="text-lg text-slate-600">{filteredSentences[dictationIndex].vietnamese}</p>
                  </div>
                  <div className="flex justify-between mt-4">
                    <button onClick={() => {setDictationIndex(dictationIndex - 1); setShowDictationAnswer(false); setDictationInput(""); setDictationFeedback(null);}} disabled={dictationIndex === 0} className="px-6 py-3 bg-white border rounded-xl font-bold disabled:opacity-30">Câu Trước</button>
                    <button onClick={() => {setDictationIndex(dictationIndex + 1); setShowDictationAnswer(false); setDictationInput(""); setDictationFeedback(null);}} disabled={dictationIndex === filteredSentences.length - 1} className="px-8 py-3 bg-teal-600 text-white rounded-xl font-bold shadow-md disabled:opacity-50">Câu Tiếp</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 4: DỊCH CÂU */}
      {activeTab === "translate" && (
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-8 border">
             {filteredSentences.length === 0 ? <div className="text-center text-slate-500">Chưa có dữ liệu bài tập dịch.</div> : (
               <>
                 <div className="text-center mb-6">
                    <p className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">Dịch sang tiếng Trung</p>
                    <h3 className="text-3xl font-bold text-indigo-900 leading-normal">"{filteredSentences[transIndex]?.vietnamese}"</h3>
                 </div>
                 {!showAnswer ? (
                    <form onSubmit={handleTranslateSubmit} className="flex flex-col gap-4">
                      <textarea rows="2" placeholder="Gõ tiếng Trung..." value={transInput} onChange={(e) => setTransInput(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 focus:border-indigo-500 outline-none text-xl" />
                      <button type="submit" disabled={isGrading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 disabled:opacity-70 transition">
                        {isGrading ? "⏳ AI Đang chấm bài..." : "Nộp bài cho AI"}
                      </button>
                      <button type="button" onClick={() => setShowAnswer(true)} className="text-sm text-slate-500 underline mt-2 hover:text-slate-800">Bỏ cuộc? Xem đáp án</button>
                    </form>
                 ) : (
                    <div className="flex flex-col gap-4">
                      {aiFeedback && (
                        <div className={`p-4 rounded-xl border ${aiFeedback.isCorrect ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          <h4 className="font-bold">{aiFeedback.isCorrect ? '🎉 Chính xác!' : '❌ Sai rồi'}</h4>
                          <p>{aiFeedback.feedback}</p>
                        </div>
                      )}
                      <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center mt-2 border">
                        <div>
                          <p className="text-xs font-bold text-indigo-400 uppercase">Đáp án gốc</p>
                          <p className="text-2xl font-bold text-slate-800 mt-1">{filteredSentences[transIndex]?.chinese}</p>
                        </div>
                        <button onClick={() => speak(filteredSentences[transIndex]?.chinese)} className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full text-xl hover:bg-indigo-200">🔊</button>
                      </div>
                      <div className="flex justify-between mt-4">
                        <button onClick={() => {setTransIndex(transIndex - 1); setShowAnswer(false); setTransInput("")}} disabled={transIndex === 0} className="px-6 py-2 bg-white border rounded-xl disabled:opacity-30 font-bold">Trước</button>
                        <button onClick={() => {setTransIndex(transIndex + 1); setShowAnswer(false); setTransInput("")}} disabled={transIndex === filteredSentences.length - 1} className="px-6 py-2 bg-indigo-600 text-white rounded-xl disabled:opacity-50 font-bold">Tiếp</button>
                      </div>
                    </div>
                 )}
               </>
             )}
          </div>
      )}

      {/* TAB 5: SẮP XẾP CÂU */}
      {activeTab === "arrange" && (
        <div className="flex flex-col items-center w-full max-w-2xl">
          {filteredArrangements.length === 0 ? <div className="bg-orange-50 text-orange-700 border border-orange-200 p-6 rounded-2xl w-full text-center"><h3 className="font-bold">Chưa có bài tập sắp xếp!</h3></div> : (
            <div className="w-full bg-white rounded-3xl shadow-xl p-8 relative overflow-hidden border">
              {filteredArrangements[arrangeIndex].is_arranged && <div className="absolute top-4 right-[-35px] bg-green-500 text-white font-bold text-xs py-1 px-10 rotate-45 shadow-sm">ĐÃ QUA</div>}
              <div className="mb-6 text-center">
                <p className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">Gợi ý nghĩa tiếng Việt</p>
                <h3 className="text-2xl font-bold text-slate-800 leading-normal">"{filteredArrangements[arrangeIndex].vietnamese}"</h3>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100">
                <div className="min-h-[80px] bg-white border-2 border-dashed border-orange-300 rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-center justify-center">
                  {selectedChars.length === 0 && <span className="text-slate-400 font-medium">Chạm vào ô bên dưới để xếp câu...</span>}
                  {selectedChars.map((charObj) => (
                    <button key={charObj.id} onClick={() => handleDeselectChar(charObj)} className="px-4 py-3 bg-orange-500 text-white font-bold text-2xl rounded-lg shadow-md hover:bg-orange-600 active:scale-95 transition-transform">{charObj.char}</button>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-3 mb-8 min-h-[60px]">
                  {availableChars.map((charObj) => (
                    <button key={charObj.id} onClick={() => handleSelectChar(charObj)} className="px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold text-2xl rounded-lg shadow-sm hover:border-orange-500 hover:text-orange-500 active:scale-95 transition-all">{charObj.char}</button>
                  ))}
                </div>
                <div className="flex flex-col gap-4">
                  {!arrangeFeedback && availableChars.length === 0 && <button onClick={checkArrangement} className="w-full py-4 bg-orange-600 text-white font-bold rounded-xl text-lg animate-bounce shadow-md">Kiểm Tra</button>}
                  {arrangeFeedback && (
                    <div className={`p-4 flex items-center justify-between rounded-xl border font-bold text-lg ${arrangeFeedback === 'correct' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                      <span>{arrangeFeedback === 'correct' ? '🎉 Chính xác hoàn toàn!' : '❌ Sai thứ tự rồi, hãy thử lại!'}</span>
                      {arrangeFeedback === 'correct' && (
                         <button onClick={() => speak(filteredArrangements[arrangeIndex].chinese)} className="w-10 h-10 flex items-center justify-center bg-white text-green-600 rounded-full shadow-sm text-xl">🔊</button>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between mt-2">
                    <button onClick={() => setArrangeIndex(arrangeIndex - 1)} disabled={arrangeIndex === 0} className="px-6 py-3 bg-white border rounded-xl font-bold disabled:opacity-30">Câu Trước</button>
                    {arrangeFeedback === 'incorrect' ? (
                       <button onClick={() => { setArrangeFeedback(null); setAvailableChars([...availableChars, ...selectedChars].sort((a,b) => Math.random() - 0.5)); setSelectedChars([]); }} className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300">Làm lại</button>
                    ) : (
                       <button onClick={() => setArrangeIndex(arrangeIndex + 1)} disabled={arrangeIndex === filteredArrangements.length - 1} className="px-8 py-3 bg-orange-600 text-white rounded-xl font-bold shadow-md disabled:opacity-50">Câu Tiếp ➔</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: THỰC CHIẾN (ROLEPLAY) */}
      {activeTab === "roleplay" && (
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-6 flex flex-col h-[650px] border">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
            <h3 className="text-xl font-bold text-green-700">Chat cùng AI Bản Xứ</h3>
            <button onClick={() => setChatHistory([{ role: 'ai', content: '你好！我们重新开始吧。(Xin chào! Chúng ta bắt đầu lại nhé.)' }])} className="text-sm px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">Xóa lịch sử</button>
          </div>
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-4 p-4 bg-slate-50 rounded-2xl flex flex-col gap-4 border border-slate-100">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex flex-col max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-green-500 text-white self-end rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 self-start rounded-tl-sm'}`}>
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'ai' && <button onClick={() => speak(msg.content)} className="mt-3 self-end w-8 h-8 bg-slate-100 text-slate-500 hover:text-green-600 hover:bg-slate-200 rounded-full transition-colors flex items-center justify-center">🔊</button>}
              </div>
            ))}
            {isChatting && <div className="self-start max-w-[85%] bg-white border border-slate-200 text-slate-500 p-4 rounded-2xl shadow-sm flex items-center gap-2 tracking-widest animate-pulse">● ● ●</div>}
          </div>
          <form onSubmit={handleChatSubmit} className="flex gap-3 mt-auto">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Gõ tiếng Trung (hoặc Pinyin)..." className="flex-1 px-5 py-4 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none text-lg bg-slate-50" disabled={isChatting} />
            <button type="submit" disabled={isChatting || !chatInput.trim()} className="bg-green-600 text-white font-bold px-8 rounded-xl disabled:opacity-50 hover:bg-green-700 shadow-md transition">Gửi</button>
          </form>
        </div>
      )}

      {/* TAB 7: PHÒNG KHẢO THÍ HSKK TỰ ĐỘNG */}
      {activeTab === "hskk" && (
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border-t-8 border-rose-600 p-8">
          
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
            <h2 className="text-2xl font-black text-rose-800">Phòng Khảo Thí HSKK</h2>
            <select 
              value={hskkLevel} 
              onChange={(e) => { setHskkLevel(e.target.value); setExamState("idle"); }} 
              disabled={examState !== "idle" && examState !== "done"}
              className="border-2 border-rose-200 text-rose-800 rounded-lg px-4 py-2 font-bold outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="HSK Cấp 3">HSKK Sơ Cấp (Cấp 3)</option>
              <option value="HSK Cấp 4">HSKK Trung Cấp (Cấp 4)</option>
              <option value="HSK Cấp 5">HSKK Cao Cấp (Cấp 5)</option>
              <option value="HSK Cấp 6">HSKK Cao Cấp (Cấp 6)</option>
            </select>
          </div>

          {examState === "idle" && (
            <div className="text-center py-20 border-2 border-dashed border-rose-200 rounded-2xl bg-rose-50/50">
              <div className="mb-6">
                <p className="text-slate-600 font-medium text-lg mb-2">Bài thi mô phỏng sẽ diễn ra liên tục không ngừng.</p>
                <p className="text-rose-600 font-bold">Hết thời gian đếm ngược, hệ thống tự động ngắt mic và chuyển câu.</p>
              </div>
              <button onClick={generateHskkExam} className="px-10 py-5 bg-rose-600 text-white font-bold text-2xl rounded-2xl shadow-xl hover:bg-rose-700 hover:scale-105 transition-all">
                🚀 Bắt Đầu Thi
              </button>
            </div>
          )}

          {examState === "scoring" && (
             <div className="text-center py-24 flex flex-col items-center">
               <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-6"></div>
               <h2 className="text-3xl font-bold text-rose-600">Hệ thống đang xử lý bài thi qua AI...</h2>
             </div>
          )}

          {(examState === "prep" || examState === "speaking") && examQuestions.length > 0 && (
            <div className="flex flex-col gap-6">
              
              <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl">
                 <span className="font-bold text-slate-500 tracking-widest uppercase">
                   Câu hỏi {currentQIndex + 1} / {examQuestions.length}
                 </span>
                 <span className="px-4 py-1 bg-white rounded-md text-rose-600 font-bold shadow-sm">
                   {examQuestions[currentQIndex].type === "repeat" ? "Nghe Nhắc Lại" : examQuestions[currentQIndex].type === "retell" ? "Nghe Thuật Lại" : examQuestions[currentQIndex].type === "picture" ? "Nhìn Tranh" : "Trả Lời Câu Hỏi"}
                 </span>
              </div>

              <div className={`p-6 text-center rounded-2xl border-4 transition-all ${examState === "prep" ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]"}`}>
                <p className={`font-black uppercase tracking-widest text-lg mb-2 ${examState === "prep" ? "text-blue-500" : "text-red-500 animate-pulse"}`}>
                  {examState === "prep" ? "THỜI GIAN NHÁP Ý" : "🎙️ MICRO ĐANG MỞ - BẮT ĐẦU NÓI!"}
                </p>
                <p className={`text-7xl font-black font-mono ${examState === "prep" ? "text-blue-700" : "text-red-600"}`}>
                  {formatTime(timeLeft)}
                </p>
              </div>

              <div className="text-center py-4">
                {examQuestions[currentQIndex].type === "picture" ? (
                  <div className="flex flex-col items-center">
                    <img src={examQuestions[currentQIndex].image} alt="HSKK" className="max-w-[500px] w-full rounded-2xl shadow-md border-4 border-slate-200 mb-6" />
                    <h3 className="text-2xl font-bold text-rose-900">{examQuestions[currentQIndex].text}</h3>
                  </div>
                ) : (examQuestions[currentQIndex].type === "repeat" || examQuestions[currentQIndex].type === "retell") ? (
                  <div className="flex flex-col items-center py-6">
                    <button onClick={() => speak(examQuestions[currentQIndex].text)} className="w-28 h-28 bg-rose-100 text-rose-600 rounded-full text-6xl shadow-md mb-6 hover:bg-rose-200 transition-colors animate-bounce">🔊</button>
                    <p className="text-slate-500 font-medium">Bấm vào biểu tượng loa để nghe lại câu hỏi.</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-4xl font-bold text-rose-900 leading-normal mb-6">{examQuestions[currentQIndex].text}</h3>
                    <button onClick={() => speak(examQuestions[currentQIndex].text)} className="w-16 h-16 inline-flex items-center justify-center bg-rose-50 text-rose-600 rounded-full text-3xl shadow-sm hover:bg-rose-100">🔊</button>
                  </div>
                )}
              </div>

              {examState === "speaking" && (
                <div className="flex flex-col animate-fade-in-up">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Băng ghi âm trực tiếp (Có thể gõ đè nếu hệ thống nghe sai)</p>
                  <textarea rows="4" value={spokenText} onChange={(e) => setSpokenText(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 border-red-200 focus:border-red-500 focus:outline-none text-xl bg-white shadow-inner" />
                  
                  <button onClick={() => handleNextQuestion(spokenText)} className="mt-6 w-full bg-slate-800 text-white font-bold py-5 text-xl rounded-xl shadow-xl hover:scale-[1.02] hover:bg-slate-900 transition-all">
                    {currentQIndex < examQuestions.length - 1 ? "Bỏ Qua Thời Gian Chờ ➔ Chuyển Câu Tiếp" : "📝 Hoàn Thành Bài Thi"}
                  </button>
                </div>
              )}
            </div>
          )}

          {examState === "done" && hskkFinalResult && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white text-center shadow-2xl relative overflow-hidden">
                <h3 className="text-2xl font-bold text-slate-300 mb-2">ĐIỂM TỔNG KẾT HSKK</h3>
                <div className={`text-9xl font-black mb-4 ${hskkFinalResult.totalScore >= 80 ? 'text-green-400' : hskkFinalResult.totalScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {hskkFinalResult.totalScore}
                </div>
                <p className="text-xl leading-relaxed text-slate-200 font-medium px-4">{hskkFinalResult.overallFeedback}</p>
              </div>

              <h4 className="text-2xl font-black text-slate-800 mt-4 border-b-2 border-slate-100 pb-4">Chi tiết từng câu hỏi:</h4>
              
              <div className="flex flex-col gap-4">
                {hskkFinalResult.details?.map((detail, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex gap-6 items-start">
                    <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-slate-100 flex flex-col items-center justify-center font-bold text-slate-700">
                      <span className="text-xs text-slate-400 uppercase">Điểm</span>
                      <span className="text-2xl">{detail.score}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-400 mb-2 font-bold uppercase">Câu hỏi gốc / Chủ đề</p>
                      <p className="text-lg font-bold text-slate-800 mb-4 bg-slate-50 p-3 rounded-lg">{detail.question}</p>
                      <p className="text-slate-600 leading-relaxed"><span className="font-bold text-rose-600">Nhận xét:</span> {detail.feedback}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setExamState("idle")} className="mt-8 w-full py-5 bg-rose-600 text-white rounded-xl font-bold text-xl shadow-xl hover:bg-rose-700 transition-colors">
                🔄 Thi Lại Đề Khác
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}