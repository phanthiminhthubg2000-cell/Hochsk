// Hàm trộn ngẫu nhiên và lấy ra n phần tử
function getRandomItems(arr, n) {
  if (!arr || !Array.isArray(arr)) return [];
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

// 1. Hàm sinh đề kiểm tra bốc tách từ các nguồn data
export async function generatePlacementTest(level) {
  try {
    let testPackage = {
      level: level,
      maxScore: level <= 2 ? 200 : 300,
      passScore: level <= 2 ? 120 : 180,
      warningScore: level <= 2 ? 150 : 230,
      sections: {}
    };

    const cardsData = await import(`@/app/data/vocab/${level}/cards.json`).catch(() => ({ default: [] }));
    testPackage.sections.vocab = getRandomItems(cardsData.default, 20);

    const arrangeData1 = await import(`@/app/data/vocab/${level}/arrange.json`).catch(() => ({ default: [] }));
    testPackage.sections.arrange = getRandomItems(arrangeData1.default, 5);

    const arrangeData2 = await import(`@/app/data/vocab/${level}/arrange.json`).catch(() => ({ default: [] }));
    testPackage.sections.translate = getRandomItems(arrangeData2.default, 5);

    const dictationData = await import(`@/app/data/vocab/${level}/dictation.json`).catch(() => ({ default: [] }));
    testPackage.sections.dictation = getRandomItems(dictationData.default, 5);

    if (level >= 3) {
      const repeatCount = level === 3 ? 5 : 2;
      const repeatData = await import(`@/app/data/hskk/hskk${level}/repeat.json`).catch(() => ({ default: [] }));
      testPackage.sections.repeat = getRandomItems(repeatData.default, repeatCount);
    }

    const writingData = await import(`@/app/data/hskk/hskk${level}/short.json`).catch(() => ({ default: [] }));
    testPackage.sections.writing = getRandomItems(writingData.default, 1);

    return { success: true, test: testPackage };
  } catch (error) {
    console.error("Lỗi tạo đề test:", error);
    return { success: false, message: "Không thể khởi tạo đề thi cho cấp độ này." };
  }
}

// 2. Hàm đánh giá kết quả và phân loại điểm số
export function evaluateTestResult(level, totalScore) {
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