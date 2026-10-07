"use client";
// =====================================================================
// Nhận bài thi KHẨU NGỮ HSKK 3.0 do đề thi (iframe /hskk-exam/...) gửi lên
// và lưu vào Firestore collection "hskk_exams" (+ sub-collection "answers"),
// đúng cấu trúc mà trang Quản lý (/teacher) đang dùng để chấm HSKK.
//
// KHÔNG cần Firebase Storage: mỗi bản ghi âm được lưu dạng base64
// trong trường "audioBase64" của từng câu trả lời (1 câu = 1 document).
//
// Đặt file này CÙNG THƯ MỤC với firebase.js (thư mục gốc dự án),
// cạnh phoneticsResultSaver.js.
//
// Cách dùng trong trang học viên:
//   import { useHskkResultSaver } from "../hskkResultSaver";
//   useHskkResultSaver({ userId, userName: user?.fullName, userEmail: user?.primaryEmailAddress?.emailAddress });
// =====================================================================
import { useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";

// Firestore giới hạn 1 MB / document → để dư chỗ cho các trường khác
const MAX_BASE64_CHARS = 950000;

const isFromOwnIframe = (src) =>
  !!src && Array.from(document.querySelectorAll("iframe")).some((f) => f.contentWindow === src);

const blobToDataUrl = (blob) =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

export function useHskkResultSaver({ userId = null, userName = "", userEmail = "", onSaved } = {}) {
  useEffect(() => {
    const onMessage = async (e) => {
      const d = e.data;
      if (!d || d.source !== "hsk-garden-hskk" || d.type !== "HSKK_SUBMIT") return;
      if (e.origin !== window.location.origin || !isFromOwnIframe(e.source)) return;

      const reply = (msg) => { try { e.source.postMessage({ source: "hsk-garden-dashboard", ...msg }, window.location.origin); } catch (_) {} };
      const answers = Array.isArray(d.answers) ? d.answers : [];
      if (!answers.length) { reply({ type: "HSKK_ERROR", message: "Không có bản ghi âm nào" }); return; }

      try {
        // 1) Chuyển bản ghi âm sang base64 + kiểm tra dung lượng
        const prepared = [];
        for (const a of answers) {
          const audioBase64 = a.blob ? await blobToDataUrl(a.blob) : "";
          if (audioBase64.length > MAX_BASE64_CHARS) {
            throw new Error(`Bản ghi âm câu ${a.q} quá lớn (${Math.round(a.blob.size / 1024)} KB). Hãy dùng Chrome hoặc Edge trên máy tính, hoặc tải file .zip gửi giáo viên`);
          }
          prepared.push({ ...a, audioBase64 });
        }

        // 2) Tạo bài thi (trạng thái "uploading" để giáo viên chưa thấy khi đang lưu dở)
        const examRef = await addDoc(collection(db, "hskk_exams"), {
          userId: userId || "guest",
          userName: userName || d.name || "Học viên ẩn danh",
          userEmail: userEmail || "Không có",
          studentTypedName: d.name || "",
          level: `HSKK ${d.level} 3.0${d.exam ? " · " + d.exam : ""}`,
          examName: d.exam || "",
          examTitle: d.title || "",
          examMode: d.mode || "",
          source: "hskk_3.0",
          totalQuestions: prepared.length,
          status: "uploading",
          teacherScore: null,
          teacherFeedback: "",
          submittedAt: serverTimestamp()
        });

        // 3) Lưu từng câu vào sub-collection "answers"
        let done = 0;
        for (const a of prepared) {
          await addDoc(collection(db, "hskk_exams", examRef.id, "answers"), {
            questionIndex: a.q,
            type: a.type || "answer",          // repeat | picture | answer
            question: a.question || `Câu ${a.q}`,
            images: a.images || [],
            audioBase64: a.audioBase64,
            audioUrl: "",
            teacherComment: "",
            teacherScore: null
          });
          done++; reply({ type: "HSKK_PROGRESS", done, total: prepared.length });
        }

        // 4) Mở cho giáo viên chấm
        await updateDoc(doc(db, "hskk_exams", examRef.id), { status: "pending_teacher" });
        reply({ type: "HSKK_SAVED", id: examRef.id });
        onSaved?.(examRef.id);
      } catch (err) {
        console.error("Lỗi nộp bài HSKK:", err);
        reply({ type: "HSKK_ERROR", message: err.message });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [userId, userName, userEmail, onSaved]);
}
