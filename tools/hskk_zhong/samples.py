# -*- coding: utf-8 -*-
"""Bài mẫu tham khảo HSKK trung cấp: 看图说话 (11-12) + 回答问题 (13-14) + dịch câu 1-10 → <ocr>/<mã>.sa.json
  GEMINI_API_KEY=... python3 tools/hskk_zhong/samples.py <thư mục ocr>"""
import glob, json, os, sys, time
from google import genai
from google.genai import types
O = sys.argv[1]; ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"]); MODELS = os.environ.get("MODELS", "gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite").split(",")
PR = """Bạn là giáo viên luyện thi HSKK（中级）. Viết bài nói mẫu cho học viên Việt Nam (trình độ HSK 4, câu ngắn, tự nhiên như văn nói, MỖI BÀI TỐI THIỂU 170 chữ Hán (đếm kỹ), tối đa 230; chỉ dùng chữ Hán và dấu câu tiếng Trung （，。！？）, tuyệt đối không có chữ Latin; có mở bài – thân bài – kết; không dùng từ quá khó).
Ảnh [11] và [12] là tranh câu 11, 12 (看图说话: mô tả tranh và kể một tình huống hợp lý quanh bức tranh).
Câu 13: {q13}
Câu 14: {q14}
Câu 1-10 (nghe nhắc lại): {s}
Trả JSON: {{"p11":{{"zh":"…","vi":"bản dịch tiếng Việt"}},"p12":{{…}},"q13":{{…}},"q14":{{…}},"s_vi":["dịch câu 1",…]}}   // s_vi rỗng nếu không có câu 1-10. Chỉ trả JSON."""
for f in sorted(glob.glob(os.path.join(O, "H8[01]*.json"))):
    if f.endswith(".sa.json"): continue
    code = os.path.basename(f)[:-5]; dst = f[:-5] + ".sa.json"
    if os.path.exists(dst): continue
    d = json.load(open(f)); parts = []
    for n in (11, 12): parts += [f"[{n}]", types.Part.from_bytes(data=open(os.path.join(ROOT, "public/hskk-exam/img", f"hskkz_{code}_{n}.jpg"), "rb").read(), mime_type="image/jpeg")]
    parts.append(PR.format(q13=d["q13"], q14=d["q14"], s=json.dumps(d.get("s") or [], ensure_ascii=False)))
    for k in range(6):
        m = MODELS[k % 3]
        try:
            r = client.models.generate_content(model=m, contents=parts, config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.4))
            x = json.loads(r.text); x = x[0] if isinstance(x, list) else x; x["_m"] = m
            json.dump(x, open(dst, "w"), ensure_ascii=False, indent=1); print(code, m, len(x["p11"]["zh"]), len(x["q13"]["zh"])); break
        except Exception as e: print(code, m, str(e)[:100]); time.sleep(6)
