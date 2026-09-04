"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";

import allCards from "../cards.json";
import allDictation from "../dictation.json";

function getRandomItems(arr, n) {
  if (!arr || !Array.isArray(arr)) return [];
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  } else {
    alert("Trình duyệt của bạn không hỗ trợ phát âm thanh.");
  }
}

async function generatePlacementTest(level) {
  try {
    let levelStr = `HSK${level}`;
    let levelStrSpace = `HSK ${level}`;
    const filterByLevel = (item) => item.level === levelStr || item.level === levelStrSpace || item.level == level;

    const vocabFiltered = allCards.filter(filterByLevel);
    const dictationFiltered = allDictation.filter(filterByLevel);

    const repeatCount = level === 3 ? 5 : 2;
    let repeatList = [];
    if (level >= 3) {
      try {
        const repeatData = await import(`@/app/data/hskk/hskk${level}/repeat.json`).catch(() => ({ default: [] }));
        const rawArr = repeatData.default || [];
        repeatList = getRandomItems(rawArr, repeatCount).map(item => typeof item === 'string' ? { sentence: item } : item);
      } catch (e) {
        repeatList = [];
      }
    }

    let shortList = [];
    if (level >= 3) {
      try {
        const shortData = await import(`@/app/data/hskk/hskk${level}/short.json`).catch(() => ({ default: [] }));
        const rawArr = shortData.default || [];
        shortList = getRandomItems(rawArr, 1).map(item => typeof item === 'string' ? { prompt: item } : item);
      } catch (e) {
        shortList = [];
      }
    }

    let testPackage = {
      level: level,
      maxScore: 100,
      sections: {
        vocab: getRandomItems(vocabFiltered.length ? vocabFiltered : allCards, 10),
        dictation: getRandomItems(dictationFiltered.length ? dictationFiltered : allDictation, 5),
        repeat: repeatList,
        writing: shortList.length ? shortList : [
          { prompt: `Phần viết luận (HSK ${level}): Hãy đọc câu hỏi và viết câu trả lời bằng tiếng Trung.` }
        ]
      }
    };

    return { success: true, test: testPackage };
  } catch (error) {
    console.error("Lỗi tạo đề test:", error);
    return { success: false, message: "Không thể khởi tạo đề thi cho cấp độ này." };
  }
}

function evaluateTestResult(level, totalScore) {
  const passScore = 70;
  if (totalScore < passScore) {
    return {
      status: "FAIL",
      message: `Bạn đạt ${totalScore}/100 điểm. Chưa đạt mức tối thiểu (${passScore} điểm) để vượt qua cấp độ HSK ${level}.`
    };
  } else {
    return {
      status: "EXCELLENT",
      message: `🎉 Xuất sắc! Bạn đạt ${totalScore}/100 điểm và đã vượt qua bài kiểm tra định cấp độ HSK ${level}!`
    };
  }
}

export default function PlacementTestPage() {
  const { user } = useUser();
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [playCounts, setPlayCounts] = useState({});
  const [repeatPlayCounts, setRepeatPlayCounts] = useState({});

  const handleStartTest = async (level) => {
    setSelectedLevel(level);
    setLoading(true);
    const res = await generatePlacementTest(level);
    if (res.success) {
      setTestData(res.test);
      setPlayCounts({});
      setRepeatPlayCounts({});
    } else {
      alert(res.message);
    }
    setLoading(false);
  };

  const handleAnswerChange = (section, index, value) => {
    setAnswers(prev => ({
      ...prev,
      [`${section}_${index}`]: value
    }));
  };

  const handlePlayAudio = (idx, text) => {
    const currentCount = playCounts[idx] || 0;
    if (currentCount >= 2) {
      alert("Bạn đã nghe tối đa 2 lần cho audio này!");
      return;
    }
    speakText(text);
    setPlayCounts(prev => ({
      ...prev,
      [idx]: currentCount + 1
    }));
  };

  const handlePlayRepeatAudio = (idx, text) => {
    const currentCount = repeatPlayCounts[idx] || 0;
    if (currentCount >= 2) {
      alert("Bạn đã nghe tối đa 2 lần cho câu này!");
      return;
    }
    speakText(text);
    setRepeatPlayCounts(prev => ({
      ...prev,
      [idx]: currentCount + 1
    }));
  };

  const handleSubmit = async () => {
    const isHSK12 = selectedLevel <= 2;

    // Phân bổ điểm mới (Bỏ phần dịch):
    // HSK 1-2 (2 phần): Vocab (50đ), Dictation (50đ) = 100đ
    // HSK 3-6 (4 phần): Mỗi phần 20đ (Vocab, Dictation, Repeat, Writing) + 20đ tùy chỉnh hoặc chia đều (Vocab 20, Dictation 20, Repeat 20, Writing 20, còn lại cấu trúc linh hoạt)

    let vocabCorrectCount = 0;
    const vocabTotal = testData.sections.vocab?.length || 10;
    testData.sections.vocab?.forEach((item, idx) => {
      const userAns = (answers[`vocab_${idx}`] || "").trim();
      const targetWord = item.front || item.word || "";
      if (userAns.length >= 2 && userAns.includes(targetWord)) vocabCorrectCount++;
    });
    const vocabScore = (vocabCorrectCount / vocabTotal) * (isHSK12 ? 50 : 25);

    let dictationCorrectCount = 0;
    const dictationTotal = testData.sections.dictation?.length || 5;
    testData.sections.dictation?.forEach((item, idx) => {
      const userAns = (answers[`dictation_${idx}`] || "").trim().replace(/\s+/g, "");
      const correctAns = (item.chinese || item.sentence || "").trim().replace(/\s+/g, "").replace(/[.!?。]/g, "");
      if (userAns === correctAns) dictationCorrectCount++;
    });
    const dictationScore = (dictationCorrectCount / dictationTotal) * (isHSK12 ? 50 : 25);

    let repeatScore = 0;
    if (!isHSK12) {
      let repeatDoneCount = 0;
      const repeatTotal = testData.sections.repeat?.length || 1;
      testData.sections.repeat?.forEach((item, idx) => {
        if ((answers[`repeat_${idx}`] || "").trim().length > 0) repeatDoneCount++;
      });
      repeatScore = (repeatDoneCount / repeatTotal) * 30;
    }

    let writingScore = 0;
    if (!isHSK12) {
      const writingAns = (answers[`writing_0`] || "").trim();
      if (writingAns.length >= 10) writingScore = 20;
      else if (writingAns.length > 0) writingScore = 10;
    }

    const totalCalculatedScore = Math.round(vocabScore + dictationScore + repeatScore + writingScore);
    const evaluation = evaluateTestResult(selectedLevel, totalCalculatedScore);
    setResult(evaluation);

    if (totalCalculatedScore >= 70 && user) {
      try {
        const studentRef = doc(db, "progress", user.id);
        let updateData = {};
        for (let i = 1; i <= selectedLevel; i++) {
          updateData[`passedHSK${i}`] = true;
        }
        await setDoc(studentRef, updateData, { merge: true });
      } catch (error) {
        console.error("Lỗi cập nhật tiến độ:", error);
      }
    }
  };

  if (!selectedLevel) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-slate-800 mb-2">Bài Kiểm Tra Định Cấp Độ (Placement Test)</h1>
        <p className="text-slate-500 mb-8">Chọn cấp độ bạn muốn thử sức:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((lvl) => (
            <button
              key={lvl}
              onClick={() => handleStartTest(lvl)}
              className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-rose-500 hover:shadow-md transition text-left cursor-pointer"
            >
              <div className="text-xl font-black text-rose-600 mb-1">HSK {lvl}</div>
              <p className="text-xs text-slate-400 font-medium">{lvl <= 2 ? "2 phần chính (Tổng 100đ)" : "4 phần chuyên sâu (Tổng 100đ)"}</p>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-600">Đang tải dữ liệu HSK {selectedLevel}...</div>;
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 max-w-2xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 w-full">
          <h2 className="text-2xl font-black text-slate-800 mb-4">Kết Quả Kiểm Tra</h2>
          <p className="text-slate-600 font-medium mb-6">{result.message}</p>
          <a href="/" className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-md hover:bg-rose-700 transition inline-block">
            Quay về Trang Chủ
          </a>
        </div>
      </main>
    );
  }

  const isHSK12 = selectedLevel <= 2;

  return (
    <main className="min-h-screen bg-slate-50 p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-800">Đề Thi Thử HSK {selectedLevel} ({isHSK12 ? "2 phần" : "4 phần"})</h1>
        <button onClick={() => setSelectedLevel(null)} className="text-sm font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Quay lại chọn cấp độ</button>
      </div>

      {testData && (
        <div className="space-y-6">
          {/* Phần 1: Đặt câu */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-blue-600 mb-2">Phần 1: Đặt Câu Với Từ Cho Trước ({isHSK12 ? "50 điểm" : "25 điểm"})</h3>
            <div className="space-y-4">
              {testData.sections.vocab?.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl">
                  <p className="font-bold text-slate-700 mb-2">Q{idx + 1}: <span className="text-xl text-blue-600 px-2 py-0.5 bg-blue-50 rounded border border-blue-100">{item.front || item.word}</span></p>
                  <input 
                    type="text" 
                    placeholder="Nhập câu tiếng Trung chứa từ trên..."
                    value={answers[`vocab_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("vocab", idx, e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 bg-white font-medium"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Phần 2: Nghe chép chính tả */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-teal-600 mb-2">Phần 2: Nghe Chép Chính Tả ({isHSK12 ? "50 điểm" : "25 điểm"})</h3>
            <p className="text-xs text-slate-400 mb-4 font-medium">Mỗi audio tối đa nghe 2 lần:</p>
            {testData.sections.dictation?.map((item, idx) => {
              const audioText = item.chinese || item.sentence || "你好";
              const currentCount = playCounts[idx] || 0;
              return (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={currentCount >= 2}
                    onClick={() => handlePlayAudio(idx, audioText)}
                    className={`px-4 py-2 font-bold rounded-xl text-xs transition shadow shrink-0 ${currentCount >= 2 ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"}`}
                  >
                    🔊 Phát Audio {idx + 1} ({2 - currentCount} lần)
                  </button>
                  <input 
                    type="text" 
                    placeholder="Nghe và gõ lại..."
                    value={answers[`dictation_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("dictation", idx, e.target.value)}
                    className="w-full sm:w-1/2 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 bg-white font-medium"
                  />
                </div>
              );
            })}
          </div>

          {/* Phần 3: Nghe Lặp Lại HSKK (Chỉ HSK 3-6) */}
          {!isHSK12 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-purple-600 mb-2">Phần 3: Nghe Lặp Lại HSKK (30 điểm)</h3>
              <p className="text-xs text-slate-400 mb-4 font-medium">⚠️ Mỗi câu mẫu ở đây tối đa nghe 2 lần:</p>
              {testData.sections.repeat?.map((item, idx) => {
                const played = repeatPlayCounts[idx] || 0;
                const sampleText = item.sentence || item.text || item.prompt || "";
                return (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={played >= 2}
                      onClick={() => handlePlayRepeatAudio(idx, sampleText)}
                      className={`px-4 py-2 font-bold rounded-xl text-xs transition shadow shrink-0 ${
                        played >= 2 ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                      }`}
                    >
                      🔊 Nghe Câu Mẫu {idx + 1} ({2 - played} lần)
                    </button>
                    <input 
                      type="text" 
                      placeholder="Gõ lại câu vừa nghe..."
                      value={answers[`repeat_${idx}`] || ""}
                      onChange={(e) => handleAnswerChange("repeat", idx, e.target.value)}
                      className="w-full sm:w-1/2 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-500 bg-white font-medium"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Phần 4: Viết Luận / Phản Xạ HSKK (Chỉ HSK 3-6) */}
          {!isHSK12 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-rose-600 mb-2">Phần 4: Viết Luận / Phản Xạ HSKK (20 điểm)</h3>
              {testData.sections.writing?.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl">
                  <p className="font-bold text-slate-700 mb-3 text-sm bg-rose-50 p-3 rounded-xl border border-rose-100">
                    {item.prompt || item.question || item.content || item}
                  </p>
                  <textarea 
                    rows={4}
                    placeholder="Viết câu trả lời bằng tiếng Trung tại đây..."
                    value={answers[`writing_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("writing", idx, e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500 bg-white font-medium"
                  />
                </div>
              ))}
            </div>
          )}

          <button 
            type="button"
            onClick={handleSubmit}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition shadow-lg cursor-pointer text-lg"
          >
            Nộp Bài & Nhận Kết Quả
          </button>
        </div>
      )}
    </main>
  );
}