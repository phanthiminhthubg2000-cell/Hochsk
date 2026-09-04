"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { doc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function HskkPage() {
  const { user } = useUser();

  const [hskkLevel, setHskkLevel] = useState("HSK Cấp 3");
  const [examQuestions, setExamQuestions] = useState([]); 
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState([]); 
  
  // examPhase: idle -> device_check -> loading -> intro -> intro_countdown -> global_prep -> reading -> speaking -> submitting -> done
  const [examPhase, setExamPhase] = useState("idle"); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasPrepped, setHasPrepped] = useState(false);
  const [scratchpad, setScratchpad] = useState("");
  
  // States cho phần kiểm tra thiết bị
  const [isSpeakerTested, setIsSpeakerTested] = useState(false);
  const [isMicTested, setIsMicTested] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState(null);

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
      // Ép nén dung lượng test mic
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
      // ÉP NÉN BITRATE ĐỂ TRÁNH LỖI DUNG LƯỢNG 1MB CỦA FIRESTORE
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
          audioBase64: allAnswers[i].audioBase64 || null
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
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-5xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition">
            ← Về Trang Chủ
          </button>
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-800">Phòng Khảo Thí HSKK</h1>
      </div>

      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border-t-8 border-rose-600 p-8">
        
        {/* BƯỚC 1: CHỌN ĐỀ */}
        {examPhase === "idle" && (
          <div className="text-center py-10 animate-fade-in">
            <select value={hskkLevel} onChange={(e) => setHskkLevel(e.target.value)} className="border-2 border-rose-200 text-rose-800 rounded-lg px-6 py-3 text-xl font-bold mb-8 outline-none cursor-pointer">
              <option value="HSK Cấp 3">HSKK Sơ Cấp (Cấp 3)</option>
              <option value="HSK Cấp 4">HSKK Trung Cấp (Cấp 4)</option>
              <option value="HSK Cấp 5">HSKK Cao Cấp (Cấp 5)</option>
              <option value="HSK Cấp 6">HSKK Cao Cấp (Cấp 6)</option>
            </select>
            <div className="py-12 border-2 border-dashed border-rose-200 rounded-2xl bg-rose-50/50">
              <p className="text-slate-600 font-medium text-lg mb-2">Hệ thống sẽ bốc thăm đề ngẫu nhiên từ Ngân hàng Dữ liệu.</p>
              <button onClick={() => setExamPhase("device_check")} className="mt-6 px-10 py-5 bg-rose-600 text-white font-bold text-2xl rounded-2xl shadow-xl hover:bg-rose-700 hover:scale-105 transition-all">
                🚀 Chuẩn bị vào thi
              </button>
            </div>
          </div>
        )}

        {/* BƯỚC 2: KIỂM TRA LOA VÀ MICRO */}
        {examPhase === "device_check" && (
          <div className="max-w-2xl mx-auto py-6 animate-fade-in">
            <h2 className="text-3xl font-black text-slate-800 mb-2 text-center">Kiểm tra loa và micro</h2>
            <p className="text-slate-500 mb-8 text-center">Hãy hoàn tất hai bước dưới đây trước khi vào phòng thi.</p>

            <div className={`p-6 rounded-2xl border-2 mb-6 transition-all ${isSpeakerTested ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'}`}>
              <h3 className="text-xl font-bold text-slate-700 mb-2 flex items-center gap-2">
                🔊 1. Kiểm tra loa
              </h3>
              <p className="text-slate-600 mb-4">Phát thử trực tiếp audio để xác nhận loa đang hoạt động tốt.</p>
              
              {isSpeakerTested && (
                <div className="bg-green-100 text-green-700 p-3 rounded-lg font-medium mb-4 flex items-center gap-2">
                  ✓ Bạn đã xác nhận nghe rõ audio.
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <button onClick={testSpeaker} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">
                  ▶ Phát thử audio
                </button>
                <button 
                  onClick={() => setIsSpeakerTested(true)} 
                  className={`px-5 py-2.5 font-bold rounded-xl border-2 transition ${isSpeakerTested ? 'border-green-500 text-green-600 bg-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  ✓ Tôi nghe rõ
                </button>
              </div>
            </div>

            <div className={`p-6 rounded-2xl border-2 mb-8 transition-all ${isMicTested ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'}`}>
              <h3 className="text-xl font-bold text-slate-700 mb-2 flex items-center gap-2">
                🎙️ 2. Kiểm tra micro
              </h3>
              <p className="text-slate-600 mb-4">Cho phép quyền micro, nói thử khoảng 3 giây rồi nghe lại bản ghi.</p>

              {isTestingMic && (
                <div className="text-rose-600 font-bold mb-4 animate-pulse flex items-center gap-2">
                  <div className="w-3 h-3 bg-rose-600 rounded-full"></div>
                  Đang ghi âm (3 giây)...
                </div>
              )}

              {testAudioUrl && !isTestingMic && (
                <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-600 font-medium mb-2">Nghe lại bản ghi âm của bạn:</p>
                  <audio src={testAudioUrl} controls className="w-full h-10" />
                </div>
              )}

              {isMicTested && (
                <div className="bg-green-100 text-green-700 p-3 rounded-lg font-medium mb-4 flex items-center gap-2">
                  ✓ Micro của bạn hoạt động bình thường.
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={testMic} 
                  disabled={isTestingMic}
                  className={`px-5 py-2.5 font-bold rounded-xl transition ${isTestingMic ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  🎙️ Ghi thử 3 giây
                </button>
                
                {testAudioUrl && (
                  <button 
                    onClick={() => setIsMicTested(true)} 
                    className={`px-5 py-2.5 font-bold rounded-xl border-2 transition ${isMicTested ? 'border-green-500 text-green-600 bg-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    ✓ Nghe rõ bản ghi
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-6">
              <button 
                onClick={() => setExamPhase("idle")} 
                className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition">
                ← Quay lại
              </button>
              <div className="flex flex-col items-end">
                {(!isSpeakerTested || !isMicTested) && (
                  <span className="text-sm text-rose-500 font-medium mb-2">
                    Cần hoàn thành cả 2 bước kiểm tra để bắt đầu
                  </span>
                )}
                <button 
                  onClick={startExamSequence}
                  disabled={!isSpeakerTested || !isMicTested}
                  className={`px-8 py-3 font-bold text-lg rounded-xl transition shadow-lg ${
                    isSpeakerTested && isMicTested 
                      ? 'bg-rose-600 text-white hover:bg-rose-700 hover:scale-105' 
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}>
                  VÀO PHÒNG THI
                </button>
              </div>
            </div>
          </div>
        )}

        {(examPhase === "loading" || examPhase === "submitting") && (
           <div className="text-center py-24 flex flex-col items-center animate-fade-in">
             <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-6"></div>
             <h2 className="text-3xl font-bold text-rose-600">
               {examPhase === "loading" ? "Đang chuẩn bị đề thi..." : "Đang đóng gói file ghi âm và gửi cho Giáo viên..."}
             </h2>
             {examPhase === "submitting" && <p className="text-slate-500 mt-4">Vui lòng không đóng trình duyệt lúc này!</p>}
           </div>
        )}

        {examPhase === "intro" && (
          <div className="text-center py-12 animate-fade-in flex flex-col items-center">
            <h2 className="text-4xl font-black text-rose-600 mb-6 uppercase tracking-wider">Phòng Thi HSKK</h2>
            
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8 max-w-3xl text-center mb-8 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 animate-pulse"></div>
              <p className="text-2xl font-bold text-blue-900 mb-3 tracking-wide leading-relaxed">
                {introScripts[hskkLevel]}
              </p>
            </div>

            <div className="flex flex-col items-center mt-4">
               <div className="w-14 h-14 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-rose-600 font-bold animate-pulse text-xl">🔊 Hệ thống đang đọc thông báo...</p>
            </div>
          </div>
        )}

        {examPhase === "intro_countdown" && (
          <div className="text-center py-12 animate-fade-in flex flex-col items-center">
            <h2 className="text-4xl font-black text-rose-600 mb-6 uppercase tracking-wider">Chuẩn bị bắt đầu</h2>
            
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-10 max-w-xl text-center mb-8 shadow-inner">
              <p className="text-xl text-slate-700 font-medium mb-6">Kỳ thi sẽ chính thức bắt đầu sau:</p>
              <div className="text-9xl font-black font-mono text-rose-600 animate-pulse">
                {timeLeft}
              </div>
            </div>
            
            <p className="text-slate-500 font-medium text-lg">Hãy hít một hơi thật sâu và sẵn sàng nhé!</p>
          </div>
        )}

        {examPhase === "global_prep" && (
          <div className="flex flex-col gap-6 w-full animate-fade-in">
            <div className="bg-rose-100 p-6 rounded-2xl text-center border-4 border-rose-300 shadow-inner">
               <h2 className="text-3xl font-black text-rose-600 mb-2">THỜI GIAN CHUẨN BỊ ĐỀ</h2>
               <p className="text-7xl font-mono font-black text-rose-700">{formatTime(timeLeft)}</p>
               <p className="text-rose-600 mt-3 font-medium text-lg">Hết thời gian đếm ngược, hệ thống sẽ tự động chuyển vào bài thi!</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
               <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 h-[600px] overflow-y-auto custom-scrollbar">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 sticky top-0 bg-white pb-4 border-b z-10">Phần thi sắp tới (Câu {examQuestions.findIndex(q => q.type !== 'repeat') + 1} - {examQuestions.length}):</h3>
                  {examQuestions.filter(q => q.type !== 'repeat').map((q, idx) => (
                     <div key={idx} className="mb-8 pb-6 border-b border-slate-100 last:border-0">
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-sm font-bold mb-3 uppercase tracking-wider">
                          {q.type === 'picture' ? "🖼️ Nhìn Tranh Kể Chuyện" : "❓ Trả Lời Câu Hỏi"}
                        </span>
                        {q.type === 'picture' && q.images && (
                           <div className={`grid gap-2 mb-4 ${q.images.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                              {q.images.map((img, i) => (
                                <img key={i} src={img} className="w-full aspect-video rounded-lg object-cover shadow-sm border border-slate-200" alt={`pic-${i}`} />
                              ))}
                           </div>
                        )}
                        <p className="font-bold text-slate-700 text-lg">{q.text}</p>
                     </div>
                  ))}
               </div>
               
               <div className="flex flex-col h-[600px]">
                  <h3 className="text-xl font-bold text-slate-800 mb-6">Giấy Nháp (Không thu lại)</h3>
                  <textarea 
                     value={scratchpad} 
                     onChange={e => setScratchpad(e.target.value)}
                     className="flex-1 w-full p-6 rounded-2xl border-2 border-slate-200 bg-yellow-50 focus:border-yellow-400 focus:outline-none resize-none text-xl leading-relaxed shadow-inner font-medium text-slate-700 custom-scrollbar"
                     placeholder="Dùng để nháp từ khóa, dàn ý tại đây..."
                  />
               </div>
            </div>
          </div>
        )}

        {(examPhase === "reading" || examPhase === "speaking") && examQuestions.length > 0 && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl">
               <span className="font-bold text-slate-500 uppercase tracking-widest">Câu hỏi {currentQIndex + 1} / {examQuestions.length}</span>
               <span className="px-4 py-1 bg-white rounded-md text-rose-600 font-bold shadow-sm">
                 {examQuestions[currentQIndex].type === "repeat" ? "Nghe Nhắc Lại" : examQuestions[currentQIndex].type === "picture" ? "Nhìn Tranh Nói" : "Trả Lời Câu Hỏi"}
               </span>
            </div>

            {examPhase === "reading" ? (
              <div className="p-8 text-center rounded-2xl border-4 bg-blue-50 border-blue-200 transition-all">
                <p className="font-black uppercase tracking-widest text-2xl mb-2 text-blue-500 animate-pulse">
                  🔊 ĐANG PHÁT AUDIO CÂU HỎI...
                </p>
                <p className="text-slate-500 font-medium">Vui lòng lắng nghe kỹ, mic sẽ mở ngay sau khi kết thúc.</p>
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl border-4 bg-red-50 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)] transition-all">
                <p className="font-black uppercase tracking-widest text-2xl mb-2 text-red-500 animate-pulse">
                  🎙️ ĐANG GHI ÂM - HÃY NÓI VÀO MIC!
                </p>
                <p className="text-8xl font-black font-mono text-red-600">
                  {formatTime(timeLeft)}
                </p>
              </div>
            )}

            <div className="text-center py-4">
              {examQuestions[currentQIndex].type === "picture" ? (
                <div className="flex flex-col items-center">
                  <div className={`grid gap-4 mb-6 ${examQuestions[currentQIndex].images?.length > 2 ? 'grid-cols-2 max-w-4xl' : 'grid-cols-1 max-w-2xl'}`}>
                    {examQuestions[currentQIndex].images?.map((img, i) => (
                      <img key={i} src={img} alt="HSKK Visual" className="w-full aspect-video object-cover rounded-2xl shadow-lg border-4 border-slate-200" />
                    ))}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-600">{examQuestions[currentQIndex].text}</h3>
                </div>
              ) : examQuestions[currentQIndex].type !== "repeat" && (
                <h3 className="text-4xl font-bold text-rose-900 leading-normal mb-6">{examQuestions[currentQIndex].text}</h3>
              )}
            </div>
            
            <p className="text-center text-slate-400 font-medium italic mt-4">
              (Hệ thống tự ngắt mic và chuyển sang câu tiếp theo khi hết thời gian)
            </p>
          </div>
        )}

        {examPhase === "done" && (
          <div className="flex flex-col gap-6 animate-fade-in text-center py-8">
            <div className="p-12 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-2xl relative overflow-hidden">
              <div className="text-9xl mb-6 drop-shadow-lg">🎉</div>
              <h3 className="text-4xl font-black mb-4">Đã nộp bài thành công!</h3>
              <p className="text-xl leading-relaxed font-medium px-4 mb-6">
                Bài thi HSKK của bạn đã được mã hóa và gửi an toàn lên hệ thống.<br/>
                Giáo viên của trung tâm sẽ trực tiếp nghe lại file ghi âm và chấm điểm cho bạn.
              </p>
              
              <div className="inline-block bg-black/20 p-5 rounded-2xl border border-white/20">
                <div className="flex items-center justify-center gap-3 text-2xl font-bold text-yellow-300 mb-2">
                  <span>📧</span> Check Gmail của bạn nhé!
                </div>
                <p className="text-emerald-50 text-lg">
                  Kết quả và nhận xét chi tiết sẽ được gửi tự động vào email <br/> 
                  <span className="font-bold text-white">{user?.primaryEmailAddress?.emailAddress || "của bạn"}</span> ngay khi giáo viên chấm xong.
                </p>
              </div>
            </div>

            <button onClick={() => {
              setExamPhase("idle");
              setIsSpeakerTested(false);
              setIsMicTested(false);
              setTestAudioUrl(null);
            }} className="mt-6 w-full py-5 bg-rose-600 text-white rounded-xl font-bold text-xl shadow-xl hover:bg-rose-700 transition-colors">
              🔄 Về Phòng Chờ / Trang Chủ
            </button>
          </div>
        )}
      </div>
    </main>
  );
}