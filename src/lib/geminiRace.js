// Gọi Gemini cho bài viết dài: chạy model chính trước, nếu sau `head` ms chưa xong thì chạy thêm model dự phòng song song,
// lấy kết quả nào về trước (hợp lệ JSON). Tổng thời gian ≤ `deadline` để không vượt giới hạn 60 giây của hàm.
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function raceJSON(apiKey, prompt, { models = ["gemini-3.5-flash", "gemini-3.5-flash-lite"], head = 25000, deadline = 110000, temperature = 0.5 } = {}) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const t0 = Date.now();
  const run = (m) => {
    const model = genAI.getGenerativeModel({ model: m, generationConfig: { responseMimeType: "application/json", temperature } }, { timeout: Math.max(5000, deadline - (Date.now() - t0)) });
    return model.generateContent(prompt).then((r) => {
      const d = JSON.parse(r.response.text().replace(/```json|```/g, "").trim());
      return { ...(Array.isArray(d) ? d[0] : d), model: m };
    });
  };
  return new Promise((resolve, reject) => {
    let left = models.length, done = false, last = null, started = 0;
    const fail = (e) => { last = e; if (--left === 0 && !done) reject(last); else if (!done) next(); };
    const next = () => { if (started >= models.length || done) return; const m = models[started++]; run(m).then((d) => { if (!done) { done = true; resolve(d); } }, fail); };
    next();
    setTimeout(next, head); // model chính chậm → chạy song song model dự phòng
    setTimeout(() => { if (!done) { done = true; reject(last || new Error("timeout")); } }, deadline);
  });
}
