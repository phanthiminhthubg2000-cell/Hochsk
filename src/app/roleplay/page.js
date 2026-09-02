"use client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { db } from "../../firebase"; 
import { doc, setDoc, increment } from "firebase/firestore";

export default function RoleplayPage() {
  const { user } = useUser();
  const [chatHistory, setChatHistory] = useState([{ 
    role: 'assistant', 
    content: 'ZH: 你好！我是你的中文练习伙伴。\nPY: Nǐ hǎo! Wǒ shì nǐ de zhōngwén liànxí huǒbàn.\nVI: Xin chào! Tôi là bạn luyện tập của bạn.',
    showTranslation: false
  }]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatContainerRef = useRef(null);

  const speak = (text) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatHistory, isChatting]);

  const toggleTranslate = (index) => {
    const newHistory = [...chatHistory];
    newHistory[index].showTranslation = !newHistory[index].showTranslation;
    setChatHistory(newHistory);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const newUserMsg = { role: 'user', content: chatInput };
    const newHistory = [...chatHistory, newUserMsg];
    
    setChatHistory(newHistory); 
    setChatInput(""); 
    setIsChatting(true);

    try {
      // Chỉ truyền role và content (bỏ trạng thái showTranslation) lên cho API
      const apiMessages = newHistory.map(msg => ({ role: msg.role, content: msg.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });
      
      const data = await res.json();
      setChatHistory([...newHistory, { role: 'assistant', content: data.reply, showTranslation: false }]);

      if (user) {
        const studentRef = doc(db, "progress", user.id);
        await setDoc(studentRef, { roleplayExp: increment(10) }, { merge: true });
      }

    } catch (error) { 
      alert("Lỗi kết nối Chat AI! Vui lòng kiểm tra lại mạng."); 
    } finally { 
      setIsChatting(false); 
    }
  };

  // Hàm chuyên xử lý cắt và vẽ giao diện tin nhắn của AI
  const renderAiMessage = (msg, index) => {
    let zh = msg.content; let py = ""; let vi = "";
    
    // Dùng Regex cắt 3 thành phần từ chuỗi trả về
    const zhMatch = msg.content.match(/ZH:\s*(.*)/i);
    const pyMatch = msg.content.match(/PY:\s*(.*)/i);
    const viMatch = msg.content.match(/VI:\s*(.*)/i);
    
    if (zhMatch) zh = zhMatch[1].trim();
    if (pyMatch) py = pyMatch[1].trim();
    if (viMatch) vi = viMatch[1].trim();

    return (
      <div className="flex flex-col">
        {/* Hàng trên: Tiếng Trung + Nút loa */}
        <div className="flex items-center gap-3">
          <p className="text-xl font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{zh}</p>
          <button onClick={() => speak(zh)} className="w-8 h-8 flex-shrink-0 bg-green-100 text-green-700 hover:text-white hover:bg-green-600 rounded-full transition-colors flex items-center justify-center shadow-sm" title="Nghe phát âm">🔊</button>
        </div>
        
        {/* Hàng dưới: Pinyin & Dịch ẩn/hiện */}
        {msg.showTranslation ? (
          <div className="mt-3 pt-3 border-t border-slate-200">
            {py && <p className="mb-1 text-green-700 font-medium text-sm">{py}</p>}
            {vi && <p className="italic text-slate-600 text-sm">{vi}</p>}
            <button onClick={() => toggleTranslate(index)} className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline">Ẩn bản dịch</button>
          </div>
        ) : (
          <button onClick={() => toggleTranslate(index)} className="self-start text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition mt-2 shadow-sm">Dịch tiếng Việt</button>
        )}
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2"><span>←</span> Về Trang Chủ</button>
        </Link>
        <h1 className="text-3xl font-extrabold text-green-600">Thực Chiến Bản Xứ</h1>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-6 flex flex-col h-[650px] border">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
          <h3 className="text-xl font-bold text-green-700">Chat cùng AI Bản Xứ</h3>
          <button onClick={() => setChatHistory([{ role: 'assistant', content: 'ZH: 你好！我们重新开始吧。\nPY: Nǐ hǎo! Wǒmen chóngxīn kāishǐ ba.\nVI: Xin chào! Chúng ta bắt đầu lại nhé.', showTranslation: false }])} className="text-sm px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">
            Xóa lịch sử
          </button>
        </div>
        
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-4 p-4 bg-slate-50 rounded-2xl flex flex-col gap-4 border border-slate-100">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex flex-col max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-green-500 text-white self-end rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 self-start rounded-tl-sm'}`}>
              {msg.role === 'user' ? (
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              ) : (
                renderAiMessage(msg, i)
              )}
            </div>
          ))}
          {isChatting && <div className="self-start max-w-[85%] bg-white border border-slate-200 text-slate-500 p-4 rounded-2xl shadow-sm flex items-center gap-2 tracking-widest animate-pulse">● ● ●</div>}
        </div>
        
        <form onSubmit={handleChatSubmit} className="flex gap-3 mt-auto">
          <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Gõ tiếng Trung..." className="flex-1 px-5 py-4 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none text-lg bg-slate-50" disabled={isChatting} />
          <button type="submit" disabled={isChatting || !chatInput.trim()} className="bg-green-600 text-white font-bold px-8 rounded-xl disabled:opacity-50 hover:bg-green-700 shadow-md transition">Gửi</button>
        </form>
      </div>
    </main>
  );
}