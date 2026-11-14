// ============================================================
// /api/tts?t=<chữ Trung>[&slow=1] — giọng đọc tiếng Trung dạng mp3 cho mọi thiết bị
// Nhiều máy tính bảng / điện thoại không có giọng tiếng Trung cài sẵn nên speechSynthesis im lặng.
// Lấy mp3 từ dịch vụ đọc của Google Dịch (chia đoạn ≤180 chữ; lỗi thì dùng Youdao), CDN của Vercel lưu đệm lâu dài.
// ============================================================
export const runtime = "nodejs";

function split(t, max = 180) {
  const out = []; let cur = "";
  for (const piece of t.split(/(?<=[。！？；，、!?;,.\n])/)) {
    if ((cur + piece).length > max && cur) { out.push(cur); cur = ""; }
    if (piece.length > max) { for (let i = 0; i < piece.length; i += max) out.push(piece.slice(i, i + max)); continue; }
    cur += piece;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

export async function GET(req) {
  const u = new URL(req.url);
  const t = (u.searchParams.get("t") || "").replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!t || !/[㐀-鿿]/.test(t)) return new Response("missing text", { status: 400 });
  const slow = u.searchParams.get("slow") === "1";
  const parts = split(t);
  const bufs = [];
  for (let i = 0; i < parts.length; i++) {
    const q = parts[i];
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&total=${parts.length}&idx=${i}&textlen=${q.length}${slow ? "&ttsspeed=0.3" : ""}&q=${encodeURIComponent(q)}`;
    let r = null;
    for (let k = 0; k < 2 && !(r && r.ok); k++) {
      try { r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", Referer: "https://translate.google.com/" }, cache: "no-store" }); } catch (_) { r = null; }
    }
    if (!r || !r.ok || !(r.headers.get("content-type") || "").includes("audio")) {
      // dự phòng: giọng đọc từ điển Youdao
      try { r = await fetch(`https://dict.youdao.com/dictvoice?le=zh&audio=${encodeURIComponent(q)}`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }); } catch (_) { r = null; }
    }
    if (!r || !r.ok) return new Response("tts unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
    bufs.push(Buffer.from(await r.arrayBuffer()));
  }
  return new Response(Buffer.concat(bufs), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
}
