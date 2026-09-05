"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

export default function HskkPage() {
  const { user, isLoaded } = useUser();

  const [hskkLevel, setHskkLevel] = useState("HSK Cấp 3");
  const [examQuestions, setExamQuestions] = useState([]); 
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState([]); 
  
  // Trạng thái hành trình thi (Exam Journey)
  const [examPhase, setExamPhase] = useState("idle"); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasPrepped, setHasPrepped] = useState(false);
  const [scratchpad, setScratchpad] = useState("");
  
  // Thiết bị
  const [isSpeakerTested, setIsSpeakerTested] = useState(false);
  const [isMicTested, setIsMicTested] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState(null);

  const [levelAvailability, setLevelAvailability] = useState({
    "HSK Cấp 3": { available: true, desc: "Sơ cấp • 15 câu hỏi (Đủ 3 phần)" },
    "HSK Cấp 4": { available: false, desc: "Trung cấp • Đang cập nhật ngân hàng đề" },
    "HSK Cấp 5": { available: false, desc: "Cao cấp • Đang cập nhật ngân hàng đề" },
    "HSK Cấp 6": { available: false, desc: "Cao cấp • Đang cập nhật ngân hàng đề" }
  });

  const [myHistory, setMyHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedHistoryExam, setSelectedHistoryExam] = useState(null);
  const [examAnswersDetail, setExamAnswersDetail] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const utteranceRef = useRef(null);

  const examConfig = {
    "HSK Cấp 3": { prepTime: 420, repeat: 10, picture: 15, short: 90 },
    "HSK Cấp 4": { prepTime: 600, repeat: 40, picture: 120, short: 120 },
    "HSK Cấp 5": { prepTime: 600, repeat: 90, picture: 120, short: 150 },
    "HSK Cấp 6": { prepTime: 600, repeat: 90, picture: 120, short: 150 }
  };

  const introScripts = {
    "HSK Cấp 3": "欢迎参加汉语水平考试（HSK）三级口语考试！本次考试分为三个部分，共十五题。第一部分是听后重复，共八题。第二部分是看图说话，共五题。第三部分是回答问题，共两题。全部考试时间为十五分钟，其中包含准备时间六分钟。请做好准备。现在，考试开始。",
    "HSK Cấp 4": "欢迎参加汉语水平考试（HSK）四级口语考试！本次考试分为三个部分，共五题。第一部分是听后复述，共两题。第二部分是看图说话，共一题。第三部分是回答问题，共两题。全部考试时间为二十分钟，其中包含准备时间十分钟。请做好准备。现在，考试开始。",
    "HSK Cấp 5": "欢迎参加汉语水平考试（HSK）五级口语考试！本次考试分为三个部分，共五题。第一部分是听后复述，共两题。第二部分是看图说话，共一题。第三部分是回答问题，共两题。全部考试时间为二十三分钟，其中包含准备时间十分钟。请做好准备。现在，考试开始。",
    "HSK Cấp 6": "欢迎参加汉语水平考试（HSK）六级口语考试！本次考试分为三个部分，共五题。第一部分是听后复述，共两题。第二部分是看图说话，共一题。第三部分是回答问题，共两题。全部考试时间为二十三分钟，其中包含准备时间十分钟。请做好准备。现在，考试开始。"
  };

  useEffect(() => {
    async function fetchMyHistory() {
      if (!user) return;
      try {
        const q = query(
          collection(db, "hskk_exams"),
          where("userId", "==", user.id),
          orderBy("submittedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMyHistory(list);
      } catch (err) {
        console.error("Lỗi tải lịch sử:", err);
      } finally {
        setLoadingHistory(false);
      }
    }

    if (isLoaded && user) {
      fetchMyHistory();
    } else if (isLoaded && !user) {
      setLoadingHistory(false);
    }
  }, [user, isLoaded]);

  const openExamDetail = async (exam) => {
    setSelectedHistoryExam(exam);
    try {
      const answersRef = collection(db, "hskk_exams", exam.id, "answers");
      const snap = await getDocs(answersRef);
      const details = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      details.sort((a, b) => a.questionIndex - b.questionIndex);
      setExamAnswersDetail(details);
    } catch (err) {
      console.error("Lỗi lấy chi tiết bài thi:", err);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const speak = (text, onEndCallback = () => {}) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEndCallback();
      return;
    }

    window.speechSynthesis.cancel(); 
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.lang = "zh-CN"; 
      utterance.rate = 0.85; 

      const voices = window.speechSynthesis.getVoices();
      const premiumVoice = voices.find(v => v.name.includes("Xiaoxiao")) 
                          || voices.find(v => v.name.includes("Google") && v.lang.includes("zh-CN"))
                          || voices.find(v => v.name.includes("Yaoyao"))
                          || voices.find(v => v.lang.includes("zh") || v.lang.includes("ZH"));
      
      if (premiumVoice) {
        utterance.voice = premiumVoice;
      }

      let isFinished = false;
      const safeEndCallback = () => {
        if (!isFinished) {
          isFinished = true;
          utteranceRef.current = null; 
          onEndCallback();
        }
      };

      utterance.onend = safeEndCallback;
      utterance.onerror = safeEndCallback; 
      window.speechSynthesis.speak(utterance);

      const safeTimeoutMs = (text.length * 250) + 3000;
      setTimeout(() => {
        safeEndCallback();
      }, safeTimeoutMs);
    }, 100);
  };

  const testSpeaker = () => {
    speak("欢迎参加汉语水平考试。设备测试。");
  };

  const testMic = async () => {
    setIsTestingMic(true);
    setTestAudioUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000 
      });
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setTestAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
        setIsTestingMic(false);
      };

      mediaRecorder.start();
      
      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }, 3000);

    } catch (err) {
      console.error("Lỗi truy cập Micro:", err);
      alert("Không thể truy cập Micro. Vui lòng cấp quyền trong cài đặt trình duyệt!");
      setIsTestingMic(false);
    }
  };

  useEffect(() => {
    let timer;
    if (["intro_countdown", "speaking", "global_prep"].includes(examPhase) && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      if (examPhase === "intro_countdown") {
        setCurrentQIndex(0);
        startQuestionLogic(0, false); 
      } else if (examPhase === "global_prep") {
        startQuestionLogic(currentQIndex, true);
      } else if (examPhase === "speaking") {
        stopRecordingAndNext();
      }
    }
    return () => clearInterval(timer);
  }, [examPhase, timeLeft, currentQIndex, hasPrepped]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const startExamSequence = async () => {
    setExamPhase("loading");
    setExamAnswers([]); 
    setHasPrepped(false); 
    setScratchpad("");
    setExamQuestions([]);
    
    try {
      const res = await fetch('/api/hskk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "generate", level: hskkLevel })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);

      let fullExam = data.map(q => {
        if (q.type === 'picture') {
          const images = q.images ? q.images : (q.image ? [q.image] : []);
          return { ...q, images };
        }
        return q;
      });
      
      const typeOrder = { 'repeat': 1, 'picture': 2, 'short': 3 };
      fullExam.sort((a, b) => (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4));
      
      setExamQuestions(fullExam);

      setExamPhase("intro");
      const introText = introScripts[hskkLevel] || introScripts["HSK Cấp 3"];
      
      speak(introText, () => {
        setExamPhase("intro_countdown");
        setTimeLeft(10);
      });
    } catch (e) {
      alert("Lỗi AI ra đề thi! Vui lòng thử lại.");
      setExamPhase("idle");
    }
  };

  const startQuestionLogic = (index, prepped = hasPrepped, questions = examQuestions) => {
    const q = questions[index];
    if (!q) return;

    if (q.type !== 'repeat' && !prepped) {
      setExamPhase("global_prep");
      setTimeLeft(examConfig[hskkLevel].prepTime);
      setHasPrepped(true);
      return;
    }

    if (q.type === 'repeat' || q.type === 'short') {
      setExamPhase("reading");
      speak(q.text, () => {
        setExamPhase("speaking");
        setTimeLeft(examConfig[hskkLevel][q.type]);
        startRecording();
      });
    } else {
      setExamPhase("speaking");
      setTimeLeft(examConfig[hskkLevel].picture);
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000 
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.start();
    } catch (err) {
      console.error("Không truy cập được Micro", err);
    }
  };

  const stopRecordingAndNext = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          handleNextQuestion(reader.result);
        };
      };
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    } else {
      handleNextQuestion(null);
    }
  };

  const handleNextQuestion = (audioBase64) => {
    const currentQ = examQuestions[currentQIndex];
    const newAnswers = [
      ...examAnswers, 
      { 
        type: currentQ.type, 
        question: currentQ.text, 
        images: currentQ.images || [], 
        audioBase64 
      }
    ];
    setExamAnswers(newAnswers);

    if (currentQIndex < examQuestions.length - 1) {
      const nextIdx = currentQIndex + 1;
      setCurrentQIndex(nextIdx);
      startQuestionLogic(nextIdx, hasPrepped);
    } else {
      submitFullExam(newAnswers);
    }
  };

  const submitFullExam = async (allAnswers) => {
    setExamPhase("submitting");
    if (!user) {
      alert("Lỗi: Bạn chưa đăng nhập, không thể lưu bài thi!");
      setExamPhase("idle");
      return;
    }

    try {
      const fallbackName = user.primaryEmailAddress?.emailAddress?.split('@')[0] || "Học viên ẩn danh";
      const finalUserName = user.fullName || fallbackName;

      const examsRef = collection(db, "hskk_exams");
      const newExamDoc = await addDoc(examsRef, {
        userId: user.id,
        userName: finalUserName,
        userEmail: user.primaryEmailAddress?.emailAddress || "",
        level: hskkLevel,
        submittedAt: serverTimestamp(),
        status: "pending_teacher",
        teacherScore: null,
        teacherFeedback: null
      });

      const answersCollectionRef = collection(db, "hskk_exams", newExamDoc.id, "answers");
      for (let i = 0; i < allAnswers.length; i++) {
        await addDoc(answersCollectionRef, {
          questionIndex: i + 1,
          type: allAnswers[i].type,
          question: allAnswers[i].question || "",
          images: allAnswers[i].images || [],
          audioBase64: allAnswers[i].audioBase64 || null,
          teacherComment: "" 
        });
      }
      
      setExamPhase("done");
    } catch (error) {
      console.error("Lỗi nộp bài thi:", error);
      alert("Lỗi kết nối máy chủ! Quá trình nộp bài bị gián đoạn do mất mạng.");
      setExamPhase("idle");
    }
  };

  return (
    <div className="min-h-screen font-sans text-slate-800 relative overflow-hidden flex flex-col selection:bg-rose-200">
      
      {/* =========================================
          BACKGROUND GLOBAL VỚI LỚP PHỦ MỜ
          ========================================= */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: "url('/hskk/kiemtra.jpg')" }} 
      >
        <div className="absolute inset-0 bg-[#F4F8F5]/90 backdrop-blur-[4px]"></div>
      </div>
      
      {/* =========================================
          HEADER CỐ ĐỊNH TÍCH HỢP ẾCH MASCOT
          ========================================= */}
      <header className="w-full bg-white/80 backdrop-blur-xl border-b border-rose-100/60 sticky top-0 z-30 shadow-sm px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center text-white text-2xl shadow-sm border border-rose-600">🐸</div>
            <div className="hidden sm:block">
              <h1 className="font-black text-slate-900 text-lg leading-tight">Hành Trình HSK</h1>
              <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-0.5">Phòng thi HSKK</p>
            </div>
          </Link>
          <div className="hidden lg:flex items-center gap-2 text-sm font-black bg-rose-50 text-rose-700 px-4 py-1.5 rounded-full border border-rose-100 ml-4">
            🎙️ MÔ PHỎNG KHẢO THÍ CHUẨN QUỐC TẾ
          </div>
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          {isLoaded && user ? (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Học viên</p>
                <p className="text-xs font-black text-slate-800">{user.fullName || user.firstName}</p>
              </div>
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <SignInButton mode="modal">
              <button className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md hover:bg-slate-800 transition">Đăng nhập</button>
            </SignInButton>
          )}
        </div>
      </header>

      {/* =========================================
          MAIN WORKSPACE
          ========================================= */}
      <main className="relative z-10 flex-1 overflow-y-auto scrollbar-hide flex flex-col items-center w-full pb-20 pt-8 px-4">
        
        <div className="w-full max-w-5xl animate-fade-in">
          
          {/* BƯỚC 1: CHỌN CẤP ĐỘ & XEM LỊCH SỬ */}
          {examPhase === "idle" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Cột trái: Lịch sử bài thi */}
              <div className="lg:col-span-5 bg-white/95 backdrop-blur-xl p-8 rounded-[32px] shadow-sm border border-white sticky top-28">
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                  <span>📚</span> Lịch sử bài thi của bạn
                </h3>
                
                {loadingHistory ? (
                  <div className="py-10 flex justify-center"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div></div>
                ) : myHistory.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-4xl mb-3 block opacity-60">📭</span>
                    <p className="text-slate-500 font-medium text-sm">Bạn chưa hoàn thành bài thi HSKK nào.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {myHistory.map((exam) => {
                      const dateStr = exam.submittedAt?.toDate ? exam.submittedAt.toDate().toLocaleDateString("vi-VN") : "Vừa xong";
                      const isGraded = exam.status === "graded" || exam.teacherScore !== null;

                      return (
                        <div key={exam.id} className="p-5 rounded-2xl border border-slate-100 bg-white hover:border-rose-400/30 hover:bg-rose-50/50 transition-all flex flex-col gap-3 shadow-sm group">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-black text-slate-800 text-base">{exam.level}</span>
                              <span className="text-slate-400 text-xs font-bold block mt-0.5">{dateStr}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${isGraded ? 'bg-[#DDF7EA] text-[#08A66A] border-[#08A66A]/20' : 'bg-amber-50 text-amber-600 border-amber-200/50'}`}>
                              {isGraded ? "Đã chấm" : "Chờ chấm"}
                            </span>
                          </div>

                          <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                            {isGraded ? (
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Điểm số</span>
                                <p className="text-2xl font-black text-[#08A66A] leading-none">{exam.teacherScore} <span className="text-sm text-slate-400">/100</span></p>
                              </div>
                            ) : (
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Điểm số</span>
                                <p className="text-sm font-black text-slate-300">-- / 100</p>
                              </div>
                            )}
                            <button 
                              onClick={() => openExamDetail(exam)}
                              className="px-4 py-2 bg-white text-slate-600 font-bold rounded-xl text-xs hover:bg-rose-600 hover:text-white border border-slate-200 transition cursor-pointer"
                            >
                              Xem chi tiết
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cột phải: Chọn đề thi mới */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                <div className="bg-white/95 backdrop-blur-xl p-8 md:p-10 rounded-[32px] shadow-sm border border-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-rose-100/50 to-transparent rounded-bl-full z-0 pointer-events-none"></div>
                  
                  <div className="relative z-10 mb-8 flex gap-4 items-center">
                    <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl shadow-inner border border-rose-200">🐸</div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Vào Phòng Thi HSKK</h2>
                      <p className="text-slate-500 font-medium text-sm mt-1">Chọn cấp độ để bắt đầu mô phỏng bài thi thực tế.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 relative z-10">
                    {Object.keys(levelAvailability).map((lvl) => {
                      const info = levelAvailability[lvl];
                      const isSelected = hskkLevel === lvl;

                      return (
                        <div
                          key={lvl}
                          onClick={() => {
                            if (info.available) setHskkLevel(lvl);
                          }}
                          className={`p-6 rounded-[24px] border-2 transition-all flex flex-col justify-between text-left relative overflow-hidden ${
                            !info.available 
                              ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed select-none' 
                              : isSelected 
                                ? 'border-rose-500 bg-rose-50/30 shadow-md ring-4 ring-rose-500/10 cursor-pointer' 
                                : 'border-slate-200 bg-white hover:border-rose-300 hover:shadow-sm cursor-pointer'
                          }`}
                        >
                          {!info.available && (
                            <div className="absolute top-4 right-4 bg-slate-200 text-slate-500 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-slate-300">
                              🔒 Khóa
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Khẩu Ngữ</span>
                            <h4 className="text-xl font-black text-slate-800">{lvl}</h4>
                            <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">{info.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Box xác nhận */}
                  {levelAvailability[hskkLevel]?.available && (
                    <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                      <div>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Cấp độ đã chọn</p>
                        <p className="text-rose-600 font-black text-xl">{hskkLevel}</p>
                      </div>
                      <button 
                        onClick={() => setExamPhase("device_check")} 
                        className="w-full md:w-auto px-8 py-4 bg-rose-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-rose-600/20 hover:bg-rose-700 hover:-translate-y-1 transition-all cursor-pointer uppercase tracking-wider flex gap-2 items-center justify-center"
                      >
                        Bắt đầu thi <span>➔</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Box Hướng dẫn phòng thi */}
                <div className="bg-[#FFF8E8]/90 backdrop-blur-xl p-8 rounded-[32px] shadow-sm border border-amber-200/60">
                  <h3 className="text-base font-black text-amber-900 mb-4 flex items-center gap-2">
                    <span>💡</span> Nguyên Tắc Phòng Thi
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="text-amber-500 mt-0.5 font-bold">1.</span>
                      <p className="text-sm font-medium text-amber-800/80 leading-relaxed">Tuyệt đối không được xem đáp án hay bản dịch trong quá trình thi.</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-amber-500 mt-0.5 font-bold">2.</span>
                      <p className="text-sm font-medium text-amber-800/80 leading-relaxed">Sau khi nộp bài, trạng thái sẽ chuyển sang chờ giáo viên chấm.</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-amber-500 mt-0.5 font-bold">3.</span>
                      <p className="text-sm font-medium text-amber-800/80 leading-relaxed">Chỉ khi giáo viên chấm xong mới có thể xem điểm và nhận xét chi tiết.</p>
                    </li>
                  </ul>
                </div>

              </div>
            </div>
          )}

          {/* MODAL XEM CHI TIẾT BÀI THI */}
          {selectedHistoryExam && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-[40px] max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 md:p-10 shadow-2xl relative custom-scrollbar">
                
                <button 
                  onClick={() => setSelectedHistoryExam(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 font-bold rounded-full flex items-center justify-center text-xl transition cursor-pointer border border-slate-200">
                  ✕
                </button>

                <div className="mb-8 border-b border-slate-100 pb-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Hồ sơ bài thi</span>
                  <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                    {selectedHistoryExam.level}
                  </h2>
                </div>

                {selectedHistoryExam.teacherScore === null ? (
                  /* GIAO DIỆN KHI ĐANG CHỜ CHẤM */
                  <div className="text-center py-16 bg-[#F4F8F5] rounded-[32px] border border-emerald-100">
                    <div className="text-7xl mb-6">⏳</div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Đang chờ giáo viên chấm</h3>
                    <p className="text-slate-500 font-medium max-w-md mx-auto">
                      Bài thi của bạn đã được lưu an toàn. Giáo viên sẽ nghe bản ghi âm và cập nhật điểm số sớm nhất có thể. Hãy quay lại sau nhé!
                    </p>
                  </div>
                ) : (
                  /* GIAO DIỆN KHI ĐÃ CHẤM XONG */
                  <div className="animate-slide-up-fade">
                    <div className="bg-gradient-to-br from-[#DDF7EA] to-emerald-50 border border-[#08A66A]/20 rounded-[32px] p-8 mb-10 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/40 rounded-bl-full pointer-events-none"></div>
                      
                      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                          <h3 className="font-black text-[#087A55] text-lg mb-1">Đánh giá của giáo viên</h3>
                          <p className="text-slate-600 font-medium text-sm max-w-md bg-white/60 p-4 rounded-2xl border border-white mt-3 italic">
                            &quot;{selectedHistoryExam.teacherFeedback || "Bài làm tốt, cần luyện thêm ngữ điệu tự nhiên hơn."}&quot;
                          </p>
                        </div>
                        
                        <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-emerald-100 text-center shrink-0">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng điểm</p>
                          <p className="text-4xl font-black text-[#08A66A]">{selectedHistoryExam.teacherScore}<span className="text-xl text-slate-300">/100</span></p>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                      <span>🎧</span> Nhận xét chi tiết từng câu
                    </h3>
                    
                    <div className="flex flex-col gap-6">
                      {examAnswersDetail.map((item, idx) => (
                        <div key={idx} className="p-6 rounded-[24px] border border-slate-200 bg-white shadow-sm flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-black text-sm flex items-center justify-center border border-slate-200 shrink-0">
                              {item.questionIndex}
                            </span>
                            <div>
                              <span className="text-[10px] font-black text-[#08A66A] bg-[#DDF7EA] px-2 py-0.5 rounded-lg uppercase tracking-wider mb-2 inline-block">
                                {item.type}
                              </span>
                              <p className="font-bold text-slate-800 text-base">{item.question}</p>
                            </div>
                          </div>
                          
                          {item.audioUrl && (
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Bản thu âm của bạn</span>
                              <audio src={item.audioUrl} controls className="w-full h-10" />
                            </div>
                          )}

                          <div className="bg-[#FFF8E8] p-4 rounded-2xl border border-[#FFC83D]/30">
                            <p className="text-xs font-black text-amber-700 mb-1 flex items-center gap-1.5"><span>👨‍🏫</span> Lời phê:</p>
                            <p className="text-slate-700 text-sm font-medium">
                              {item.teacherComment ? item.teacherComment : "Giáo viên không để lại lời phê cho câu này."}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BƯỚC 2: KIỂM TRA THIẾT BỊ (DEVICE CHECK) */}
          {examPhase === "device_check" && (
            <div className="max-w-3xl mx-auto py-8 animate-fade-in bg-white/95 backdrop-blur-xl p-8 md:p-12 rounded-[40px] shadow-sm border border-white relative overflow-hidden mt-6">
              <div className="text-center mb-10 relative z-10 flex flex-col items-center">
                <div className="text-5xl mb-4">🐸</div>
                <h2 className="text-3xl font-black text-slate-900 mb-3">Kiểm Tra Loa & Micro</h2>
                <p className="text-slate-500 font-medium">Hoàn tất 2 bước dưới đây để tránh rủi ro mất bản ghi âm khi thi nhé.</p>
              </div>

              <div className={`p-6 md:p-8 rounded-[32px] border-2 mb-6 transition-all relative z-10 ${isSpeakerTested ? 'border-[#08A66A] bg-[#DDF7EA]/30' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${isSpeakerTested ? 'bg-[#08A66A] text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>🔊</div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">1. Kiểm tra Loa</h3>
                    <p className="text-slate-500 text-xs font-medium mt-1">Phát audio tiếng Trung để chắc chắn bạn nghe rõ đề bài.</p>
                  </div>
                </div>
                
                <div className="pl-16 flex flex-wrap gap-3">
                  <button onClick={testSpeaker} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:shadow hover:-translate-y-0.5 transition text-sm flex items-center gap-2">
                    <span>▶</span> Phát âm thanh mẫu
                  </button>
                  <button onClick={() => setIsSpeakerTested(true)} className={`px-6 py-3 font-bold rounded-xl text-sm transition-all flex items-center gap-2 ${isSpeakerTested ? 'bg-[#08A66A] text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
                    <span>✓</span> Tôi đã nghe rõ
                  </button>
                </div>
              </div>

              <div className={`p-6 md:p-8 rounded-[32px] border-2 mb-10 transition-all relative z-10 ${isMicTested ? 'border-[#08A66A] bg-[#DDF7EA]/30' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${isMicTested ? 'bg-[#08A66A] text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>🎙️</div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">2. Kiểm tra Micro</h3>
                    <p className="text-slate-500 text-xs font-medium mt-1">Đọc to "Ni hao" trong vòng 3 giây và nghe lại bản ghi.</p>
                  </div>
                </div>
                
                <div className="pl-16">
                  {isTestingMic && <div className="text-rose-500 font-bold mb-4 text-sm animate-pulse flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Đang ghi âm (3 giây)...</div>}
                  {testAudioUrl && !isTestingMic && (
                    <div className="mb-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-sm">
                      <audio src={testAudioUrl} controls className="w-full h-10" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button onClick={testMic} disabled={isTestingMic} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:shadow hover:-translate-y-0.5 transition text-sm flex items-center gap-2 disabled:opacity-50">
                      <span className="text-rose-500">●</span> Ghi thử 3 giây
                    </button>
                    {testAudioUrl && (
                      <button onClick={() => setIsMicTested(true)} className={`px-6 py-3 font-bold rounded-xl text-sm transition-all flex items-center gap-2 ${isMicTested ? 'bg-[#08A66A] text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
                        <span>✓</span> Nghe rõ tiếng mình
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center border-t border-slate-100 pt-8 relative z-10 gap-4">
                <button onClick={() => setExamPhase("idle")} className="w-full md:w-auto px-6 py-4 font-bold text-slate-500 hover:text-slate-700 text-sm transition bg-slate-50 rounded-2xl">
                  ← Hủy và quay lại
                </button>
                <button 
                  onClick={startExamSequence} 
                  disabled={!isSpeakerTested || !isMicTested} 
                  className={`w-full md:w-auto px-10 py-4 font-black text-sm rounded-2xl shadow-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${
                    isSpeakerTested && isMicTested 
                      ? 'bg-rose-600 text-white hover:bg-rose-700 hover:-translate-y-1 shadow-rose-600/20' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  Vào Phòng Thi ➔
                </button>
              </div>
            </div>
          )}

          {/* LOADING VÀ SUBMITTING */}
          {(examPhase === "loading" || examPhase === "submitting") && (
             <div className="text-center py-32 flex flex-col items-center animate-fade-in bg-white/95 backdrop-blur-xl rounded-[40px] shadow-sm border border-white max-w-2xl mx-auto w-full mt-10">
               <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 relative shadow-inner">
                  <div className="text-5xl absolute z-10">🐸</div>
                  <div className="absolute inset-0 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
               <h2 className="text-2xl font-black text-slate-800 mb-2">
                 {examPhase === "loading" ? "Đang lấy đề thi từ Server..." : "Đang mã hóa và nộp bản ghi âm..."}
               </h2>
               <p className="text-slate-500 font-medium">Vui lòng không đóng trình duyệt lúc này.</p>
             </div>
          )}

          {/* BƯỚC 3: TRONG PHÒNG THI CHÍNH THỨC */}
          {examPhase === "intro" && (
            <div className="text-center py-20 animate-fade-in flex flex-col items-center bg-white/95 backdrop-blur-xl rounded-[40px] shadow-sm border border-white max-w-4xl mx-auto px-6 w-full mt-10">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner border border-blue-100">🐸</div>
              <h2 className="text-3xl font-black text-slate-900 mb-8 uppercase tracking-widest">Khai Mạc Kỳ Thi</h2>
              
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 w-full mb-10 shadow-inner">
                <p className="text-xl md:text-2xl font-bold text-slate-700 leading-relaxed max-w-2xl mx-auto font-serif">
                  {introScripts[hskkLevel]}
                </p>
              </div>
              
              <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-full border border-blue-100">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
                <p className="text-blue-700 font-bold text-sm tracking-wider">Hệ thống đang phát thông báo tự động...</p>
              </div>
            </div>
          )}

          {examPhase === "intro_countdown" && (
            <div className="text-center py-24 animate-fade-in flex flex-col items-center bg-white/95 backdrop-blur-xl rounded-[40px] shadow-sm border border-white max-w-3xl mx-auto w-full mt-10">
              <div className="text-6xl mb-6 animate-bounce">🐸</div>
              <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-widest">Kỳ thi bắt đầu sau</h2>
              <p className="text-slate-500 font-medium mb-10">Vui lòng giữ im lặng và chú ý màn hình.</p>
              
              <div className="w-48 h-48 bg-rose-50 border-4 border-rose-200 rounded-full flex items-center justify-center shadow-inner relative">
                <div className="absolute inset-0 rounded-full border-4 border-rose-500 border-dashed animate-[spin_4s_linear_infinite] opacity-50"></div>
                <div className="text-8xl font-black font-mono text-rose-600 drop-shadow-md">
                  {timeLeft}
                </div>
              </div>
            </div>
          )}

          {examPhase === "global_prep" && (
            <div className="flex flex-col lg:flex-row gap-6 w-full max-w-5xl mx-auto animate-fade-in mt-6">
              <div className="lg:w-1/3 flex flex-col gap-6">
                <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[32px] text-center border border-white shadow-sm flex flex-col items-center justify-center h-full min-h-[300px]">
                   <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner">⏱</div>
                   <h2 className="text-sm font-black text-slate-400 mb-2 uppercase tracking-widest">Thời gian đọc đề</h2>
                   <p className="text-6xl md:text-7xl font-mono font-black text-rose-600 drop-shadow-md tracking-tighter">
                     {formatTime(timeLeft)}
                   </p>
                   <p className="text-xs font-bold text-slate-500 mt-6 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">Hệ thống sẽ tự chuyển khi hết giờ.</p>
                </div>
              </div>

              <div className="lg:w-2/3 flex flex-col gap-6">
                <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[32px] shadow-sm border border-white h-[350px] flex flex-col">
                   <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                     <span>📋</span> Nội dung đề bài (Phần 2 & 3)
                   </h3>
                   <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-4">
                     {examQuestions.filter(q => q.type !== 'repeat').map((q, idx) => (
                        <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                          <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mb-3 ${q.type === 'picture' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {q.type === 'picture' ? "🖼️ Nhìn Tranh" : "❓ Trả Lời C.Hỏi"}
                          </span>
                          {q.images && q.images.length > 0 && (
                            <div className="flex gap-2 mb-3">
                               <div className="h-24 w-32 bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center text-slate-400 text-xs font-bold border border-slate-300">(Hình ảnh ẩn)</div>
                            </div>
                          )}
                          <p className="font-bold text-slate-800 text-base">{q.text}</p>
                        </div>
                     ))}
                   </div>
                </div>

                <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[32px] shadow-sm border border-white flex flex-col h-[300px]">
                   <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                     <span>📝</span> Giấy Nháp Điện Tử
                   </h3>
                   <textarea 
                     value={scratchpad} 
                     onChange={e => setScratchpad(e.target.value)} 
                     className="flex-1 w-full p-6 rounded-2xl border-2 border-amber-100 bg-[#FFF8E8]/50 resize-none text-base font-medium outline-none focus:border-amber-400 focus:bg-[#FFF8E8] transition-colors placeholder:text-amber-700/30" 
                     placeholder="Đề bài khó ghi chú tại đây nhé..." 
                   />
                </div>
              </div>
            </div>
          )}

          {(examPhase === "reading" || examPhase === "speaking") && examQuestions.length > 0 && (
            <div className="flex flex-col gap-6 animate-slide-up-fade max-w-4xl mx-auto py-8 mt-6">
              
              <div className="flex justify-between items-center bg-white/95 backdrop-blur-xl p-6 rounded-[32px] border border-white shadow-sm">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-xl font-black text-slate-400 border border-slate-200">
                     {currentQIndex + 1}
                   </div>
                   <div>
                     <h3 className="font-black text-slate-800 text-lg">Câu hỏi số {currentQIndex + 1}</h3>
                     <p className="text-xs font-bold text-slate-500">Tổng số: {examQuestions.length} câu</p>
                   </div>
                 </div>
                 <span className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-xs shadow-md tracking-widest uppercase">
                   {examQuestions[currentQIndex].type}
                 </span>
              </div>

              {examQuestions[currentQIndex].images && examQuestions[currentQIndex].images.length > 0 && (
                <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[32px] border border-white shadow-sm flex justify-center gap-4 flex-wrap">
                  {examQuestions[currentQIndex].images.map((img, i) => (
                    <img key={i} src={img} alt="Đề bài" className="max-h-64 object-contain rounded-2xl shadow-sm border border-slate-100" />
                  ))}
                </div>
              )}
              
              {examPhase === "reading" ? (
                <div className="p-12 text-center rounded-[32px] border-2 bg-blue-50/90 backdrop-blur-xl border-blue-200 shadow-inner">
                  <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm animate-pulse">🔊</div>
                  <p className="font-black text-2xl text-blue-800 tracking-wider">Lắng nghe Audio...</p>
                  <p className="text-sm font-medium text-blue-600/60 mt-2">Vui lòng không thao tác lúc này</p>
                </div>
              ) : (
                <div className="p-12 text-center rounded-[32px] border-4 bg-rose-50/90 backdrop-blur-xl border-rose-500 shadow-lg relative overflow-hidden">
                  <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner relative z-10">
                    🎙️
                    <div className="absolute inset-0 border-4 border-rose-400 rounded-full animate-ping opacity-50"></div>
                  </div>
                  <p className="font-black text-xl text-rose-600 tracking-widest uppercase mb-4 relative z-10">Bắt đầu trả lời</p>
                  <p className="text-8xl md:text-9xl font-black font-mono text-rose-700 drop-shadow-md relative z-10 tracking-tighter">
                    {formatTime(timeLeft)}
                  </p>
                </div>
              )}
              
              {examQuestions[currentQIndex].type !== 'repeat' && (
                <div className="text-center py-10 px-8 bg-white/95 backdrop-blur-xl rounded-[32px] border border-white shadow-sm mt-2">
                  <h3 className="text-2xl md:text-3xl font-black text-slate-800 leading-snug">{examQuestions[currentQIndex].text}</h3>
                </div>
              )}
            </div>
          )}

          {/* BƯỚC 4: HOÀN THÀNH - CHỜ CHẤM */}
          {examPhase === "done" && (
            <div className="flex flex-col items-center justify-center gap-8 animate-slide-up-fade text-center py-16 px-4 max-w-2xl mx-auto mt-10 bg-white/95 backdrop-blur-xl rounded-[40px] shadow-sm border border-white">
              
              <div className="w-32 h-32 bg-[#DDF7EA] rounded-full flex items-center justify-center relative shadow-inner border border-emerald-100">
                <div className="text-6xl absolute z-10">🐸</div>
                <div className="absolute -inset-4 border-2 border-emerald-400 border-dashed rounded-full animate-[spin_10s_linear_infinite] opacity-50"></div>
              </div>

              <div>
                <h2 className="text-3xl font-black text-slate-900 mb-3">Hoàn Thành Bài Thi!</h2>
                <p className="text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
                  Bản ghi âm đã được tải lên máy chủ an toàn. Vui lòng nghỉ ngơi trong khi chờ giáo viên chuyên môn đánh giá nhé.
                </p>
              </div>

              <div className="bg-[#F4F8F5] w-full rounded-[32px] border border-emerald-50 p-8 shadow-inner text-left">
                 <h4 className="font-black text-slate-800 mb-6 border-b border-slate-200/60 pb-4">Trạng thái xử lý</h4>
                 
                 <div className="flex flex-col gap-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                   
                   <div className="flex items-center gap-4 relative z-10">
                     <div className="w-8 h-8 bg-[#08A66A] rounded-full text-white font-black flex items-center justify-center text-xs shadow-sm ring-4 ring-[#F4F8F5]">✓</div>
                     <div>
                       <p className="font-black text-slate-800 text-sm">Nộp bài thi</p>
                       <p className="text-xs text-slate-500 font-medium">Hoàn tất lưu file âm thanh.</p>
                     </div>
                   </div>

                   <div className="flex items-center gap-4 relative z-10">
                     <div className="w-8 h-8 bg-amber-400 rounded-full text-white font-black flex items-center justify-center text-xs shadow-sm ring-4 ring-[#F4F8F5] animate-pulse">⏳</div>
                     <div>
                       <p className="font-black text-amber-600 text-sm">Đang chờ chấm điểm</p>
                       <p className="text-xs text-slate-500 font-medium">Giáo viên đang xử lý...</p>
                     </div>
                   </div>

                   <div className="flex items-center gap-4 relative z-10 opacity-40">
                     <div className="w-8 h-8 bg-slate-200 rounded-full text-slate-500 font-black flex items-center justify-center text-xs shadow-sm ring-4 ring-[#F4F8F5]">🔒</div>
                     <div>
                       <p className="font-black text-slate-600 text-sm">Xem kết quả</p>
                       <p className="text-xs text-slate-500 font-medium">Chỉ mở khi có điểm thi.</p>
                     </div>
                   </div>

                 </div>
              </div>

              <button 
                onClick={() => {
                  setExamPhase("idle");
                  window.location.reload(); 
                }} 
                className="mt-2 w-full py-4.5 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition-all hover:-translate-y-1 uppercase tracking-widest cursor-pointer"
              >
                Về Trang Lịch Sử
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}