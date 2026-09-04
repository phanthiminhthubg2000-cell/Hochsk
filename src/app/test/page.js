"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { db } from "../../firebase"; // Đã sửa đúng đường dẫn lùi 2 cấp thư mục ra thư mục chứa firebase
import { doc, setDoc } from "firebase/firestore";

// Hàm sinh đề kiểm tra trực quan tương thích hoàn toàn với môi trường build của Vercel
async function generatePlacementTest(level) {
  try {
    let testPackage = {
      level: level,
      maxScore: level <= 2 ? 200 : 300,
      passScore: level <= 2 ? 120 : 180,
      warningScore: level <= 2 ? 150 : 230,
      sections: {
        vocab: [
          { word: "你好", meaning: "Xin chào" },
          { word: "谢谢", meaning: "Cảm ơn" },
          { word: "再见", meaning: "Tạm biệt" },
          { word: "老师", meaning: "Giáo viên" },
          { word: "学生", meaning: "Học sinh" }
        ],
        arrange: [
          { sentence: "我喜欢学中文。" },
          { sentence: "今天天气很好。" }
        ],
        translate: [
          { vi: "Tôi thích học tiếng Trung." },
          { vi: "Hôm nay thời tiết rất đẹp." }
        ],
        dictation: [
          { text: "Nǐ hào ma?" },
          { text: "Wǒ hěn hǎo." }
        ],
        writing: [
          { prompt: `Hãy viết một đoạn văn ngắn giới thiệu về bản thân bằng tiếng Trung (Cấp độ HSK ${level}).` }
        ]
      }
    };

    return { success: true, test: testPackage };
  } catch (error) {
    console.error("Lỗi tạo đề test:", error);
    return { success: false, message: "Không thể khởi tạo đề thi cho cấp độ này." };
  }
}

// Hàm đánh giá kết quả và phân loại điểm số
function evaluateTestResult(level, totalScore) {
  const isHSK12 = level <= 2;
  const passScore = isHSK12 ? 120 : 180;
  const warningScore = isHSK12 ? 150 : 230;

  if (totalScore < passScore) {
    return {
      status: "FAIL",
      message: `Bạn đạt ${totalScore} điểm. Chưa đạt mức tối thiểu (${passScore}/${isHSK12 ? 200 : 300}). Bạn nên bắt đầu học từ cấp độ thấp hơn để củng cố kiến thức!`
    };
  } else if (totalScore < warningScore) {
    return {
      status: "PASS_WITH_WARNING",
      message: `Chúc mừng bạn đã vượt qua mốc điểm đạt (${totalScore}/${isHSK12 ? 200 : 300})! Tuy nhiên, điểm số của bạn dưới mức ${warningScore}, hệ thống khuyên bạn nên ôn tập kỹ lại một chút để không bị hổng kiến thức.`
    };
  } else {
    return {
      status: "EXCELLENT",
      message: `Xuất sắc! Bạn đạt ${totalScore}/${isHSK12 ? 200 : 300} điểm. Hệ thống đã mở khóa toàn bộ thông suốt từ HSK 1 đến HSK ${level} cho bạn!`
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

  const handleStartTest = async (level) => {
    setSelectedLevel(level);
    setLoading(true);
    const res = await generatePlacementTest(level);
    if (res.success) {
      setTestData(res.test);
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

  const handleSubmit = async () => {
    let correctCount = 0;
    let totalQuestions = 0;

    testData.sections.vocab?.forEach((item, idx) => {
      totalQuestions++;
      const userAns = answers[`vocab_${idx}`]?.trim().toLowerCase();
      const correctAns = (item.meaning || item.definition || "").toLowerCase();
      if (userAns && correctAns.includes(userAns)) {
        correctCount++;
      }
    });

    testData.sections.arrange?.forEach((item, idx) => {
      totalQuestions++;
      const userAns = answers[`arrange_${idx}`]?.trim();
      const correctAns = item.sentence || item.original;
      if (userAns === correctAns) {
        correctCount++;
      }
    });

    testData.sections.translate?.forEach((item, idx) => {
      totalQuestions++;
      const userAns = answers[`translate_${idx}`]?.trim();
      const correctAns = item.sentence || item.translation;
      if (userAns === correctAns) {
        correctCount++;
      }
    });

    testData.sections.dictation?.forEach((item, idx) => {
      totalQuestions++;
      const userAns = answers[`dictation_${idx}`]?.trim();
      const correctAns = item.text || item.sentence;
      if (userAns === correctAns) {
        correctCount++;
      }
    });

    const maxScore = testData.maxScore || (selectedLevel <= 2 ? 200 : 300);
    const calculatedScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * maxScore) : 100;
    
    const evaluation = evaluateTestResult(selectedLevel, calculatedScore);
    setResult(evaluation);

    if (evaluation.status !== "FAIL" && user) {
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
        <p className="text-slate-500 mb-8">Chọn cấp độ bạn muốn thử sức để mở khóa hệ thống nhanh chóng:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((lvl) => (
            <button
              key={lvl}
              onClick={() => handleStartTest(lvl)}
              className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-rose-500 hover:shadow-md transition text-left cursor-pointer"
            >
              <div className="text-xl font-black text-rose-600 mb-1">HSK {lvl}</div>
              <p className="text-xs text-slate-400 font-medium">Làm đề test mở khóa đến cấp {lvl}</p>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-600">Đang khởi tạo đề thi HSK {selectedLevel}...</div>;
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

  return (
    <main className="min-h-screen bg-slate-50 p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-800">Đề Thi Thử HSK {selectedLevel}</h1>
        <button onClick={() => setSelectedLevel(null)} className="text-sm font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Quay lại chọn cấp độ</button>
      </div>

      {testData && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-blue-600 mb-4">Phần 1: Từ Vựng</h3>
            <div className="space-y-4">
              {testData.sections.vocab?.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl">
                  <p className="font-bold text-slate-700 mb-2">Q{idx + 1}: <span className="text-xl text-blue-600">{item.word}</span></p>
                  <input 
                    type="text" 
                    placeholder="Nhập nghĩa..."
                    onChange={(e) => handleAnswerChange("vocab", idx, e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-orange-600 mb-4">Phần 2: Sắp Xếp Câu</h3>
            {testData.sections.arrange?.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl mb-3">
                <p className="font-bold text-slate-700 mb-2">Câu {idx + 1}: <span className="text-orange-500">{item.sentence}</span></p>
                <input 
                  type="text" 
                  placeholder="Nhập lại câu..."
                  onChange={(e) => handleAnswerChange("arrange", idx, e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 bg-white"
                />
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-indigo-600 mb-4">Phần 3: Dịch Câu</h3>
            {testData.sections.translate?.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl mb-3">
                <p className="font-bold text-slate-700 mb-2">Câu {idx + 1}: {item.vi}</p>
                <input 
                  type="text" 
                  placeholder="Nhập tiếng Trung..."
                  onChange={(e) => handleAnswerChange("translate", idx, e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-teal-600 mb-4">Phần 4: Nghe Chép Chính Tả</h3>
            {testData.sections.dictation?.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl mb-3">
                <p className="font-bold text-slate-700 mb-2">Audio {idx + 1}</p>
                <input 
                  type="text" 
                  placeholder="Nghe và gõ lại..."
                  onChange={(e) => handleAnswerChange("dictation", idx, e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 bg-white"
                />
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-rose-600 mb-4">Phần 5: Viết Luận HSKK</h3>
            {testData.sections.writing?.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl">
                <p className="font-bold text-slate-700 mb-2">{item.prompt}</p>
                <textarea 
                  rows={4}
                  placeholder="Viết câu trả lời..."
                  onChange={(e) => handleAnswerChange("writing", idx, e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500 bg-white"
                />
              </div>
            ))}
          </div>

          <button 
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