"use client";
import Link from "next/link";
import { useState } from "react";
import topicCards from "../topics.json";

export default function TopicPage() {
  const availableTopics = [...new Set(topicCards.map(c => c.topic))];
  const [activeTopic, setActiveTopic] = useState(availableTopics[0] || "");
  const [topicVocabIndex, setTopicVocabIndex] = useState(0);
  const [isTopicFlipped, setIsTopicFlipped] = useState(false);

  const speak = (text, e) => {
    if (e) e.stopPropagation(); 
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; 
    utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  const filteredTopicCards = topicCards.filter(c => c.topic === activeTopic);

  const handleTopicChange = (topic) => {
    setActiveTopic(topic);
    setTopicVocabIndex(0);
    setIsTopicFlipped(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2">
            <span>←</span> Về Trang Chủ
          </button>
        </Link>
        <h1 className="text-3xl font-extrabold text-pink-600">Từ Vựng Chủ Đề</h1>
      </div>

      <div className="flex flex-col items-center w-full max-w-2xl">
        <div className="flex gap-2 mb-8 w-full overflow-x-auto pb-2 scrollbar-hide justify-center px-4">
          {availableTopics.map(topic => (
            <button key={topic} onClick={() => handleTopicChange(topic)} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border ${activeTopic === topic ? "bg-pink-600 text-white border-pink-600 shadow-md" : "bg-white text-slate-600 hover:bg-pink-50"}`}>
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
    </main>
  );
}