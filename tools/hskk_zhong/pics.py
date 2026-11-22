# -*- coding: utf-8 -*-
"""Tách tranh câu 11-12: PDF có ảnh nhúng → pdfimages (giữ nguyên chất lượng); bản scan → cắt theo khung Gemini trả về.
  python3 tools/hskk_zhong/pics.py <thư mục pdf> <thư mục ocr>"""
import glob, json, os, subprocess, sys
from PIL import Image
P, O = sys.argv[1], sys.argv[2]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DST = os.path.join(ROOT, "public", "hskk-exam", "img"); os.makedirs(DST, exist_ok=True)
EMB = {"H81001": "H81001.pdf", "H81002": "H81002.pdf", "H81003": "H81003.pdf", "H81311": "H81311.pdf", "H81312": "H81312.pdf", "H81416": "H81416.pdf", "H80000": "H80000.pdf"}
def save(im, code, n):
    im = im.convert("RGB"); im.thumbnail((640, 640)); im.save(os.path.join(DST, f"hskkz_{code}_{n}.jpg"), quality=85)
for f in sorted(x for x in glob.glob(os.path.join(O, "H8[01]*.json")) if x.count(".") == 1):
    d = json.load(open(f)); code = os.path.basename(f)[:-5]
    if code in EMB:
        tmp = os.path.join(O, "emb_" + code); subprocess.run(["pdfimages", "-f", "2", "-l", "2", "-j", os.path.join(P, EMB[code]), tmp], check=True)
        ims = sorted(glob.glob(tmp + "-*"))
        for n, x in zip((11, 12), ims): save(Image.open(x), code, n)
    else:
        for pc in d["pics"]:
            im = Image.open(d["_qimgs"][int(pc["img"])]); W, H = im.size; y0, x0, y1, x1 = pc["box"]
            pad = 8; box = (max(0, x0 * W // 1000 - pad), max(0, y0 * H // 1000 - pad), min(W, x1 * W // 1000 + pad), min(H, y1 * H // 1000 + pad))
            save(im.crop(box), code, int(pc["n"]))
    print(code, "ok")
