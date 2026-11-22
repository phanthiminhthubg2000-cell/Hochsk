# -*- coding: utf-8 -*-
"""Đọc đề HSKK trung cấp (H81xxx) từ PDF (bản chữ hoặc scan) bằng Gemini → <ra>/<mã>.json
  GEMINI_API_KEY=... python3 tools/hskk_zhong/ocr.py <thư mục pdf> <thư mục ra>
Mỗi đề: câu 1-10 (lời ghi âm, nếu có trang 录音材料), câu 13-14, khung tranh câu 11-12."""
import json, os, subprocess, sys, time
from google import genai
from google.genai import types

P, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
SCAN = os.path.join(P, "HSKK-01_10.pdf")
# mã → (pdf đề, [trang đề], pdf lời ghi âm, [trang])
JOBS = {
    "H81001": ("H81001.pdf", [2, 3], SCAN, [4]), "H81002": ("H81002.pdf", [2, 3], "H81002_a.pdf", [1]),
    "H81003": ("H81003.pdf", [2, 3], None, []), "H81004": ("H81004.pdf", [2, 3], "H81004_a.pdf", [1]),
    "H81105": ("H81105.pdf", [2, 3], "H81105_a.pdf", [1]), "H81106": ("H81106.pdf", [2, 3], "H81106_a.pdf", [1]),
    "H81107": ("H81107.pdf", [2, 3], "H81107_a.pdf", [1]), "H81208": (SCAN, [10, 11], SCAN, [12]),
    "H81209": (SCAN, [14, 15], SCAN, [16]), "H81210": (SCAN, [18, 19], SCAN, [20]),
    "H81311": ("H81311.pdf", [2, 3], "H81311_a.pdf", [1]), "H81312": ("H81312.pdf", [2, 3], None, []),
    "H81416": ("H81416.pdf", [2, 3], "H81416_a.pdf", [1]),
}
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]

def img(pdf, p, tag):
    pdf = pdf if os.path.isabs(pdf) else os.path.join(P, pdf)
    f = os.path.join(OUT, f"{tag}_p{p}.jpg")
    if not os.path.exists(f): subprocess.run(["pdftoppm", "-r", "150", "-f", str(p), "-l", str(p), "-jpeg", "-singlefile", pdf, f[:-4]], check=True)
    return f

PROMPT = """Đây là các trang của đề thi HSKK（中级）{code}. Ảnh [Q] là trang đề (第二部分 看图说话 câu 11-12 có tranh, 第三部分 回答问题 câu 13-14), ảnh [A] (nếu có) là trang 录音材料.
Trả JSON:
{{"s":["câu 1",…,"câu 10"],   // lời câu 1-10 lấy từ trang [A], chép chính xác chữ Hán, bỏ số thứ tự và (10秒); nếu không có trang [A] thì []
 "q13":"câu hỏi 13 (chỉ chữ Hán, bỏ pinyin, bỏ (2分钟))","q14":"câu hỏi 14",
 "pics":[{{"n":11,"img":chỉ số ảnh [Q] chứa tranh (0 hoặc 1),"box":[ymin,xmin,ymax,xmax]}},{{"n":12,…}}]}}   // khung bao CHỈ phần tranh, toạ độ 0-1000
Chỉ trả JSON."""

for code, (qp, qpages, ap, apages) in JOBS.items():
    dst = os.path.join(OUT, f"{code}.json")
    if os.path.exists(dst): print(code, "đã có"); continue
    parts = []; qimgs = []
    for i, p in enumerate(qpages):
        f = img(qp, p, code + "q"); qimgs.append(f)
        parts += [f"[Q{i}]", types.Part.from_bytes(data=open(f, "rb").read(), mime_type="image/jpeg")]
    for p in apages:
        f = img(ap, p, code + "a"); parts += ["[A]", types.Part.from_bytes(data=open(f, "rb").read(), mime_type="image/jpeg")]
    parts.append(PROMPT.format(code=code))
    for k in range(6):
        m = MODELS[k % len(MODELS)]
        try:
            r = client.models.generate_content(model=m, contents=parts, config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0))
            d = json.loads(r.text); d = d[0] if isinstance(d, list) else d; d["_m"] = m; d["_qimgs"] = qimgs
            json.dump(d, open(dst, "w"), ensure_ascii=False, indent=1); print(code, "xong", m, len(d.get("s") or []), d.get("q13", "")[:20]); break
        except Exception as e:
            print(code, m, str(e)[:120]); time.sleep(6)
