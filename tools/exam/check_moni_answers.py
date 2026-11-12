# -*- coding: utf-8 -*-
"""Lượt soát độc lập: chỉ đọc trang đáp án, so với JSON trung gian; in chỗ lệch.
  GEMINI_API_KEY=... python3 tools/exam/check_moni_answers.py <moni.pdf> <thư mục JSON> [đề...]"""
import json, os, sys, time, re
sys.argv += [] 
from google import genai
from google.genai import types
PDF, SRC = sys.argv[1], sys.argv[2]
WANT = [int(x) for x in sys.argv[3:]] or list(range(1, 11))
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location("o", os.path.join(os.path.dirname(__file__), "ocr_moni.py"))
A = {1: (237, 243), 2: (242, 248), 3: (247, 253), 4: (252, 259), 5: (258, 264), 6: (263, 270), 7: (269, 276), 8: (275, 280), 9: (279, 286), 10: (285, 293)}
c = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
for k in WANT:
    d = json.load(open(os.path.join(SRC, f"moni{k:02d}.json"), encoding="utf-8"))
    parts = []
    for p in range(*A[k]) if False else range(A[k][0], A[k][1] + 1):
        f = os.path.join(SRC, "tmp", f"p{p:03d}.jpg")
        parts += [f"[PAGE {p}]", types.Part.from_bytes(data=open(f, "rb").read(), mime_type="image/jpeg")]
    parts.append(f'Đây là trang 答案及说明. Chỉ lấy đáp án của 模拟试卷{k}. Trả JSON {{"1":"A",...,"90":"D"}} đủ 90 câu trắc nghiệm.')
    for lan in range(3):
        try:
            r = c.models.generate_content(model="gemini-3.5-flash", contents=parts, config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0))
            v = json.loads(r.text); break
        except Exception as e:
            print(k, "thử lại", str(e)[:100]); time.sleep(30); v = {}
    diff = [n for n in range(1, 91) if str(v.get(str(n), "")).strip()[:1].upper() != str(d["answers"].get(str(n), "")).strip()[:1].upper()]
    json.dump(v, open(os.path.join(SRC, f"check{k:02d}.json"), "w"), ensure_ascii=False)
    print(k, "lệch:", [(n, d["answers"].get(str(n)), v.get(str(n))) for n in diff], flush=True)
