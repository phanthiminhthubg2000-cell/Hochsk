"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

export default function HskkPage() {
  const [hskkLevel, setHskkLevel] = useState("HSK Cấp 3");
  const [examQuestions, setExamQuestions] = useState([]); 
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState([]); 
  
  const [examPhase, setExamPhase] = useState("idle"); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasPrepped, setHasPrepped] = useState(false);
  const [scratchpad, setScratchpad] = useState("");
  const [hskkFinalResult, setHskkFinalResult] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const examConfig = {
    "HSK Cấp 3": { prepTime: 360, repeat: 10, picture: 15, short: 90 },
    "HSK Cấp 4": { prepTime: 600, repeat: 40, picture: 120, short: 120 },
    "HSK Cấp 5": { prepTime: 600, repeat: 90, picture: 120, short: 150 },
    "HSK Cấp 6": { prepTime: 600, repeat: 90, picture: 120, short: 150 }
  };

  const speak = (text, onEndCallback) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; 
    utterance.rate = 0.85; 
    utterance.onend = onEndCallback;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    let timer;
    if ((examPhase === "speaking" || examPhase === "global_prep") && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && (examPhase === "speaking" || examPhase === "global_prep")) {
      if (examPhase === "global_prep") {
        startQuestionLogic(currentQIndex, true);
      } else if (examPhase === "speaking") {
        stopRecordingAndNext();
      }
    }
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examPhase, timeLeft, currentQIndex]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const generateHskkExam = async () => {
    setExamPhase("loading");
    setExamAnswers([]); setHskkFinalResult(null); 
    setHasPrepped(false); setScratchpad("");
    
    try {
      const res = await fetch('/api/hskk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "generate", level: hskkLevel })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);

      const fullExam = data.map(q => {
        if (q.type === 'picture') {
          const count = q.imageCount || 1;
          const images = Array.from({length: count}, (_, i) => `https://loremflickr.com/800/600/daily,objects?random=${Math.random()}-${i}`);
          return { ...q, images };
        }
        return q;
      });
      
      setExamQuestions(fullExam);
      setCurrentQIndex(0);
      startQuestionLogic(0, false);
    } catch (e) {
      alert("Lỗi AI ra đề thi! Vui lòng thử lại.");
      setExamPhase("idle");
    }
  };

  const startQuestionLogic = (index, prepped = hasPrepped) => {
    const q = examQuestions[index];
    
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
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
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
    const newAnswers = [...examAnswers, { type: currentQ.type, question: currentQ.text, audioBase64 }];
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
    setExamPhase("grading");
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
      setExamPhase("done");
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
        {examPhase === "idle" && (
          <div className="text-center py-10">
            <select value={hskkLevel} onChange={(e) => setHskkLevel(e.target.value)} className="border-2 border-rose-200 text-rose-800 rounded-lg px-6 py-3 text-xl font-bold mb-8 outline-none cursor-pointer">
              <option value="HSK Cấp 3">HSKK Sơ Cấp (Cấp 3)</option>
              <option value="HSK Cấp 4">HSKK Trung Cấp (Cấp 4)</option>
              <option value="HSK Cấp 5">HSKK Cao Cấp (Cấp 5)</option>
              <option value="HSK Cấp 6">HSKK Cao Cấp (Cấp 6)</option>
            </select>
            <div className="py-12 border-2 border-dashed border-rose-200 rounded-2xl bg-rose-50/50">
              <p className="text-slate-600 font-medium text-lg mb-2">Thí sinh Vui lòng cấp quyền Microphone.</p>
              <p className="text-rose-600 font-bold mb-6">Bài thi diễn ra liên tục, không ngắt quãng. Cố gắng hoàn thành tốt nhất!</p>
              <button onClick={generateHskkExam} className="px-10 py-5 bg-rose-600 text-white font-bold text-2xl rounded-2xl shadow-xl hover:bg-rose-700 hover:scale-105 transition-all">
                🚀 Bắt Đầu Thi
              </button>
            </div>
          </div>
        )}

        {(examPhase === "loading" || (examPhase === "grading" && !hskkFinalResult)) && (
           <div className="text-center py-24 flex flex-col items-center">
             <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-6"></div>
             <h2 className="text-3xl font-bold text-rose-600">{examPhase === "loading" ? "AI đang khởi tạo đề thi chuẩn..." : "Giám khảo AI đang phân tích âm thanh..."}</h2>
           </div>
        )}

        {examPhase === "global_prep" && (
          <div className="flex flex-col gap-6 w-full animate-fade-in">
            <div className="bg-rose-100 p-6 rounded-2xl text-center border-4 border-rose-300 shadow-inner">
               <h2 className="text-3xl font-black text-rose-600 mb-2">THỜI GIAN CHUẨN BỊ ĐỀ</h2>
               <p className="text-7xl font-mono font-black text-rose-700">{formatTime(timeLeft)}</p>
               <p className="text-rose-600 mt-3 font-medium text-lg">Hết thời gian đếm ngược, hệ thống sẽ tự động bắt đầu tính giờ thi!</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
               <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 h-[600px] overflow-y-auto">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 sticky top-0 bg-white pb-4 border-b z-10">Phần thi sắp tới:</h3>
                  {examQuestions.filter(q => q.type !== 'repeat').map((q, idx) => (
                     <div key={idx} className="mb-8 pb-6 border-b border-slate-100 last:border-0">
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-sm font-bold mb-3 uppercase tracking-wider">
                          {q.type === 'picture' ? "🖼️ Nhìn Tranh Kể Chuyện" : "❓ Trả Lời Câu Hỏi"}
                        </span>
                        {q.type === 'picture' && q.images && (
                           <div className={`grid gap-2 mb-4 ${q.images.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                              {q.images.map((img, i) => <img key={i} src={img} className="w-full rounded-lg object-cover shadow-sm border border-slate-200" alt={`pic-${i}`} />)}
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
                     className="flex-1 w-full p-6 rounded-2xl border-2 border-slate-200 bg-yellow-50 focus:border-yellow-400 focus:outline-none resize-none text-xl leading-relaxed shadow-inner font-medium text-slate-700"
                     placeholder="Dùng để nháp từ khóa, dàn ý tại đây..."
                  />
               </div>
            </div>
          </div>
        )}

        {(examPhase === "reading" || examPhase === "speaking") && examQuestions.length > 0 && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl">
               <span className="font-bold text-slate-500 uppercase">Câu hỏi {currentQIndex + 1} / {examQuestions.length}</span>
               <span className="px-4 py-1 bg-white rounded-md text-rose-600 font-bold shadow-sm">
                 {examQuestions[currentQIndex].type === "repeat" ? (hskkLevel === "HSK Cấp 3" ? "Nghe Nhắc Lại" : "Nghe Thuật Lại (复述)") : examQuestions[currentQIndex].type === "picture" ? "Nhìn Tranh" : "Trả Lời Câu Hỏi"}
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
                  <div className={`grid gap-4 mb-6 ${examQuestions[currentQIndex].images?.length > 2 ? 'grid-cols-2 max-w-3xl' : 'grid-cols-1 max-w-xl'}`}>
                    {examQuestions[currentQIndex].images?.map((img, i) => (
                      <img key={i} src={img} alt="HSKK" className="w-full rounded-2xl shadow-md border-4 border-slate-200" />
                    ))}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-600">{examQuestions[currentQIndex].text}</h3>
                </div>
              ) : examQuestions[currentQIndex].type !== "repeat" && (
                <h3 className="text-4xl font-bold text-rose-900 leading-normal mb-6">{examQuestions[currentQIndex].text}</h3>
              )}
            </div>
            
            <p className="text-center text-slate-400 font-medium italic mt-4">
              (Hệ thống sẽ tự động chuyển câu khi hết thời gian)
            </p>
          </div>
        )}

        {examPhase === "done" && hskkFinalResult && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white text-center shadow-2xl relative overflow-hidden">
              <h3 className="text-2xl font-bold text-slate-300 mb-2">ĐIỂM TỔNG KẾT HSKK</h3>
              <div className={`text-9xl font-black mb-4 ${hskkFinalResult.totalScore >= 80 ? 'text-green-400' : hskkFinalResult.totalScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {hskkFinalResult.totalScore}<span className="text-4xl text-slate-400">/100</span>
              </div>
              <p className="text-xl leading-relaxed text-slate-200 font-medium px-4 mb-4">{hskkFinalResult.overallFeedback}</p>
              <div className="bg-white/10 p-4 rounded-xl text-left border border-white/20">
                <span className="font-bold text-yellow-300 uppercase text-sm block mb-1">💡 Lời khuyên chung:</span>
                <span className="text-slate-200">{hskkFinalResult.overallImprovement}</span>
              </div>
            </div>

            <h4 className="text-2xl font-black text-slate-800 mt-4 border-b-2 border-slate-100 pb-4">Chi tiết từng câu hỏi:</h4>
            
            <div className="flex flex-col gap-4">
              {hskkFinalResult.details?.map((detail, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-slate-100 flex flex-col items-center justify-center font-bold text-slate-700">
                    <span className="text-xs text-slate-400 uppercase">Điểm</span>
                    <span className="text-2xl">{detail.score}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-slate-800 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">{detail.question}</p>
                    <p className="text-slate-600 leading-relaxed mb-3"><span className="font-bold text-rose-600">Nhận xét:</span> {detail.feedback}</p>
                    <p className="text-slate-600 leading-relaxed"><span className="font-bold text-blue-600">Cách cải thiện:</span> {detail.improvement}</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setExamPhase("idle")} className="mt-8 w-full py-5 bg-rose-600 text-white rounded-xl font-bold text-xl shadow-xl hover:bg-rose-700 transition-colors">
              🔄 Thi Lại Đề Khác
            </button>
          </div>
        )}
      </div>
    </main>
  );
}