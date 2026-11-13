# -*- coding: utf-8 -*-
"""JSON trung gian (ocr_moni.py) → đề Phòng thi HSK 2.0: public/hsk2-exam/papers/moni5-XX.json + ảnh câu 100
  python3 tools/exam/moni_to_paper.py <thư mục JSON> <moni.pdf>"""
import json, os, re, sys, subprocess, glob
from collections import Counter
SRC, PDF = sys.argv[1], sys.argv[2]
BOOK = os.environ.get("BOOK", "moni")
CFG = {"moni": ("moni5", "MONI5", "HSK五级模拟试题集 · 模拟试卷{k}"), "jj": ("jj5", "JJ5", "HSK五级精讲精练 · 模拟试卷{k}")}[BOOK]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "hsk2-exam")
LET = "ABCD"
# Đáp án câu ghép bị đọc lệch so với từ cho sẵn (đã soát tay)
FIX_W = {(4, 93): ["教室里的桌椅摆得整整齐齐。"]} if os.environ.get("BOOK", "moni") == "jj" else {(2, 97): ["我好容易才听懂她说的话。"], (7, 96): ["市中心的房价远远高过农村。"]}
FIX_WORDS = {} if os.environ.get("BOOK", "moni") != "moni" else {(6, 91): ["和你", "开", "我", "个", "只不过", "玩笑"]}
norm = lambda x: re.sub(r"[\s，。、？！?!,.；;：:\"“”（）()…·]", "", x or "")
def clean(x):
    if isinstance(x, list): return [clean(i) for i in x]
    if not isinstance(x, str): return x
    x = re.sub(r"\s*<u>\s*(\{\d+\})\s*</u>\s*", r"\1", x)            # chỗ trống không cần gạch chân
    x = re.sub(r"\s*(\{\d+\})\s*", r"\1", x)
    x = re.sub(r"<u>(.*?)</u>", r"<u><b>\1</b></u>", x)
    x = re.sub(r"^\s*[A-D][\.．、]?\s+", "", x)
    x = re.sub(r"(?<=[一-鿿，。、：；！？“”])\s+(?=[一-鿿，。、：；！？“”\d])|(?<=\d)\s+(?=[一-鿿])", "", x)
    return x.strip()

def build(k, d):
    probs = []; units = []; A = {int(n): v.strip().upper()[:1] for n, v in d.get("answers", {}).items()}
    def q4(n, o):
        o = clean(o)
        if len(o) != 4 or any(not x for x in o): probs.append(f"{n}: phương án {o}")
        if A.get(n) not in list(LET): probs.append(f"{n}: đáp án {A.get(n)}")
        return o
    L = {x["n"]: x for x in d["listening"]}
    for a, b in [(1, 5), (6, 10), (11, 15), (16, 20), (21, 25), (26, 30), (31, 35), (36, 40), (41, 45)]:
        qs = [{"n": n, "t": "c", "o": q4(n, L[n]["o"]), "a": A.get(n, "")} for n in range(a, b + 1) if n in L]
        if len(qs) != b - a + 1: probs.append(f"nghe {a}-{b} thiếu câu")
        units.append({"sec": "L", "part": 1 if b <= 20 else 2, "label": f"{a}-{b}", "head": "第1-20题：请选出正确答案。" if b <= 20 else "第21-45题：请选出正确答案。", "qs": qs})
    for g in d["reading1"]:
        a, b = g["range"]; P = clean(g["passage"])
        for n in range(a, b + 1):   # chỗ trống in thành số trơn
            if "{%d}" % n not in "".join(P):
                for i, t in enumerate(P):
                    t2 = re.sub(r"(?<!\d)\s*%d\s*(?!\d)" % n, "{%d}" % n, t, count=1)
                    if t2 != t: P[i] = t2; break
        miss = [n for n in range(a, b + 1) if "{%d}" % n not in "".join(P)]
        if miss: probs.append(f"{a}-{b}: thiếu chỗ trống {miss}")
        units.append({"sec": "R", "part": 1, "label": f"{a}-{b}", "head": "第46-60题：请选出正确答案。", "passage": P, "qs": [{"n": q["n"], "t": "c", "o": q4(q["n"], q["o"]), "a": A.get(q["n"], "")} for q in g["qs"]]})
    r2 = sorted(d["reading2"], key=lambda x: x["n"])
    for a, b in [(61, 65), (66, 70)]:
        units.append({"sec": "R", "part": 2, "label": f"{a}-{b}", "head": "第61-70题：请选出与试题内容一致的一项。", "qs": [{"n": q["n"], "t": "c", "p": clean(q["p"]), "o": q4(q["n"], q["o"]), "a": A.get(q["n"], "")} for q in r2 if a <= q["n"] <= b]})
    for g in d["reading3"]:
        a, b = g["range"]
        units.append({"sec": "R", "part": 3, "label": f"{a}-{b}", "head": "第71-90题：请选出正确答案。", "passage": clean(g["passage"]), "qs": [{"n": q["n"], "t": "c", "s": clean(q.get("s", "")), "o": q4(q["n"], q["o"]), "a": A.get(q["n"], "")} for q in g["qs"]]})
    WA = {int(n): v for n, v in d.get("write_answers", {}).items()}
    wq = []
    for x in sorted(d["write1"], key=lambda x: x["n"]):
        n = x["n"]; w = FIX_WORDS.get((k, n)) or [clean(t) for t in x["w"] if clean(t)]
        alts = [re.sub(r"[A-Za-z]+", "", clean(s)) for s in ([WA.get(n)] if isinstance(WA.get(n), str) else (WA.get(n) or []))]
        alts = FIX_W.get((k, n), alts)
        ok = [s for s in alts if Counter(norm(s)) == Counter(norm("".join(w)))]
        if not ok: probs.append(f"{n}: đáp án không khớp từ {alts} / {w}")
        wq.append({"n": n, "t": "b", "w": w, "a": ok or alts or [""]})
    w99 = "、".join(x for x in re.split(r"[\s、，,]+", d.get("q99", "")) if x)
    pid = f"{CFG[0]}-{k:02d}"
    units.append({"sec": "W", "part": 1, "label": "91-98", "head": "第91-98题：完成句子。", "ex": "发表　这篇论文　什么时候　是　的 → 这篇论文是什么时候发表的？", "qs": wq})
    units.append({"sec": "W", "part": 2, "label": "99", "head": "第99-100题：写短文。", "qs": [{"n": 99, "t": "w", "prompt": f"请结合下列词语（要全部使用），写一篇80字左右的短文。\n{w99}", "word": w99, "min": 80}]})
    units.append({"sec": "W", "part": 2, "label": "100", "head": "第99-100题：写短文。", "qs": [{"n": 100, "t": "w", "prompt": "请结合这张图片写一篇80字左右的短文。", "img": f"/hsk2-exam/assets/{pid}_100.jpg", "min": 80}]})
    # tranh câu 100: cắt từ trang scan theo khung Gemini trả về
    try:
        pg = int(d["q100"]["page"]); y0, x0, y1, x1 = d["q100"]["box"]
        tmp = os.path.join(SRC, f"q100_{BOOK}{k}.png")
        subprocess.run(["pdftoppm", "-r", "200", "-f", str(pg), "-l", str(pg), "-png", "-singlefile", PDF, tmp[:-4]], check=True)
        W, H = map(int, subprocess.run(["identify", "-format", "%w %h", tmp], capture_output=True, text=True).stdout.split())
        pad = 8
        cx, cy = int(x0 / 1000 * W) - pad, int(y0 / 1000 * H) - pad
        cw, ch = int((x1 - x0) / 1000 * W) + 2 * pad, int((y1 - y0) / 1000 * H) + 2 * pad
        subprocess.run(["convert", tmp, "-crop", f"{cw}x{ch}+{max(0,cx)}+{max(0,cy)}", "+repage", "-trim", "-quality", "85", os.path.join(OUT, "assets", f"{pid}_100.jpg")], check=True)
    except Exception as e:
        probs.append(f"tranh 100: {e}")
    nq = sum(len(u["qs"]) for u in units)
    if nq != 100: probs.append(f"tổng {nq} câu")
    P = {"id": pid, "level": 5, "name": CFG[2].format(k=k), "audio": [f"/hsk2-exam/audio/{CFG[1]}_{k:02d}.mp3"], "dur": {"R": 45 * 60, "W": 40 * 60}, "units": units}
    if d.get("script"): P["script"] = d["script"].strip()
    return P, probs

for f in sorted(glob.glob(os.path.join(SRC, f"{BOOK}[0-9]*.json"))):
    k = int(re.search(r"(\d+)", os.path.basename(f)).group(1))
    d = json.load(open(f, encoding="utf-8")); d = d[0] if isinstance(d, list) else d
    P, probs = build(k, d)
    print(P["id"], "lỗi:", len(probs)); [print("   ", p) for p in probs[:15]]
    json.dump(P, open(os.path.join(OUT, "papers", P["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
