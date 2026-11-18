# -*- coding: utf-8 -*-
"""JSON do ocr_hsk4.py đọc ra → đề cho Phòng thi HSK 2.0 (cấu trúc giống parse_hsk4_v2.py)
  python3 tools/exam/hsk4_ocr_to_paper.py <pages.json> <thư mục OCR> [số đề ...]
pages.json cần thêm: "id":"xl4", "name":"HSK四级 · …", "audio":"thư mục mp3 (01.mp3 …)" """
import json, os, re, subprocess, sys
from collections import Counter
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "hsk2-exam")
LET = "ABCDEF"; TF = ["对（√）", "错（×）"]
norm = lambda x: re.sub(r"[\s，。、？！?!,.；;：:\"“”（）()…·<>/a-z]", "", x or "")
CJK = r"[一-鿿，。、：；！？“”（）]"

def tidy(x):
    if isinstance(x, list): return [tidy(i) for i in x]
    if not isinstance(x, str): return x
    x = re.sub(r"(?<=%s)\s+(?=%s)" % (CJK, CJK), "", x)
    return x.strip()

def strip_letter(o):
    o = o if isinstance(o, str) else ""
    return re.sub(r"^\s*[A-F]\s*[．.、]?\s*", "", o).strip()

def blank(s):
    s = tidy(re.sub(r"<u>\s*[A-F]?\s*</u>", "", s or ""))
    m = re.search(r"_{2,}|＿+|[（(]\s*[）)]", s)
    if not m: return None
    return tidy(s[:m.start()]), tidy(s[m.end():])

def ans_tf(v):
    v = (v or "").strip()
    if v in ("√", "✓", "✔", "对", "T"): return "A"
    if v in ("×", "✗", "✘", "X", "x", "错", "F"): return "B"
    return ""

def build(cfg, k, d):
    pid = f"{cfg['id']}-{int(k):02d}"; probs = []; units = []
    A = {str(n): (v or "").strip().replace(" ", "").upper() if not re.match(r"[√×✓✗]", (v or "").strip()) else v.strip() for n, v in (d.get("answers") or {}).items()}
    # nghe 1-10
    tf = {int(x["n"]): x for x in d.get("tf", [])}
    for a, b in [(1, 5), (6, 10)]:
        qs = []
        for n in range(a, b + 1):
            s = tidy(re.sub(r"^★\s*|[（(]\s*[）)]\s*$", "", tf.get(n, {}).get("s", "")))
            av = ans_tf(A.get(str(n)))
            if not s: probs.append(f"{n}: thiếu câu")
            if not av: probs.append(f"{n}: đáp án {A.get(str(n))}")
            qs.append({"n": n, "t": "c", "s": "★ " + s, "o": TF, "a": av})
        units.append({"sec": "L", "part": 1, "label": f"{a}-{b}", "head": "第1-10题：判断对错。", "qs": qs})
    L = {int(x["n"]): x for x in d.get("listening", [])}
    for lo, hi, part in [(11, 25, 2), (26, 45, 3)]:
        for a in range(lo, hi + 1, 5):
            qs = []
            for n in range(a, min(a + 4, hi) + 1):
                o = [tidy(strip_letter(x)) for x in L.get(n, {}).get("o", [])]
                if len(o) != 4 or not all(o): probs.append(f"{n}: phương án {o}")
                if A.get(str(n)) not in list("ABCD"): probs.append(f"{n}: đáp án {A.get(str(n))}")
                qs.append({"n": n, "t": "c", "o": (o + [""] * 4)[:4], "a": A.get(str(n), "")})
            units.append({"sec": "L", "part": part, "label": f"{a}-{min(a + 4, hi)}", "head": f"第{lo}-{hi}题：请选出正确答案。", "qs": qs})
    # đọc 46-55
    for lo, hi, bk, exk, rk in [(46, 50, "bank46", "ex46", "r46"), (51, 55, "bank51", "ex51", "r51")]:
        bank = [tidy(strip_letter(x)) for x in d.get(bk, [])]
        if len(bank) != 6: probs.append(f"{lo}: bảng từ {bank}"); bank = (bank + [""] * 6)[:6]
        ex = tidy(re.sub(r"^例如[：:]?\s*", "", d.get(exk, "") or ""))
        mx = re.search(r"[（(]\s*([A-F])\s*[）)]", ex); used = mx.group(1) if mx else ""
        ex = re.sub(r"[（(]\s*([A-F])\s*[）)]", r"（<b class='exa'>\1</b>）", ex)
        R = {int(x["n"]): x for x in d.get(rk, [])}
        qs = []
        for n in range(lo, hi + 1):
            ps = blank(R.get(n, {}).get("s", ""))
            if not ps: probs.append(f"{n}: không thấy chỗ trống"); ps = (tidy(R.get(n, {}).get("s", "")), "")
            if A.get(str(n)) not in list(LET): probs.append(f"{n}: đáp án {A.get(str(n))}")
            qs.append({"n": n, "t": "m", "a": A.get(str(n), ""), "pre": ps[0], "post": ps[1]})
        u = {"sec": "R", "part": 1, "label": f"{lo}-{hi}", "head": f"第{lo}-{hi}题：选词填空。", "ref": {"kind": "words", "items": [{"k": LET[i], "hz": bank[i]} for i in range(6)]}, "unique": True, "qs": qs}
        if ex: u["ex"] = ex; u["exUsed"] = used
        units.append(u)
    # đọc 56-65
    R = {int(x["n"]): x for x in d.get("r56", [])}
    for a, b in [(56, 60), (61, 65)]:
        qs = []
        for n in range(a, b + 1):
            p = {x: tidy(R.get(n, {}).get(x, "")) for x in "ABC"}
            if not all(p.values()): probs.append(f"{n}: sắp xếp {p}")
            o = re.sub(r"[^ABC]", "", A.get(str(n), ""))
            if len(o) != 3 or len(set(o)) != 3: probs.append(f"{n}: đáp án {A.get(str(n))}"); o = ""
            qs.append({"n": n, "t": "b", "head": "排列顺序", "w": [p[x] for x in "ABC"], "a": ["".join(p[x] for x in o)] if o else [""], "key": o})
        units.append({"sec": "R", "part": 2, "label": f"{a}-{b}", "head": "第56-65题：排列顺序。", "ex": "A 可是今天起晚了　B 平时我骑自行车上下班　C 所以就打车来公司 → B A C", "qs": qs})
    # đọc 66-79
    R = {int(x["n"]): x for x in d.get("r66", [])}
    single = []
    for n in range(66, 80):
        x = R.get(n)
        if not x: probs.append(f"{n}: thiếu"); continue
        o = [tidy(strip_letter(y)) for y in x.get("o", [])]
        if len(o) != 4 or not all(o): probs.append(f"{n}: phương án {o}")
        if A.get(str(n)) not in list("ABCD"): probs.append(f"{n}: đáp án {A.get(str(n))}")
        single.append({"n": n, "t": "c", "p": tidy(x.get("p", "")), "s": "★ " + tidy(re.sub(r"^★\s*", "", x.get("s", ""))), "o": (o + [""] * 4)[:4], "a": A.get(str(n), "")})
    for a in range(66, 80, 5):
        g = [q for q in single if a <= q["n"] < min(a + 5, 80)]
        if g: units.append({"sec": "R", "part": 3, "label": f"{g[0]['n']}-{g[-1]['n']}", "head": "第66-85题：请选出正确答案。", "qs": g})
    seen = set()
    for g in d.get("r80", []):
        qs = []
        for x in g.get("qs", []):
            n = int(x["n"]); seen.add(n)
            o = [tidy(strip_letter(y)) for y in x.get("o", [])]
            if len(o) != 4 or not all(o): probs.append(f"{n}: phương án {o}")
            if A.get(str(n)) not in list("ABCD"): probs.append(f"{n}: đáp án {A.get(str(n))}")
            qs.append({"n": n, "t": "c", "s": "★ " + tidy(re.sub(r"^★\s*", "", x.get("s", ""))), "o": (o + [""] * 4)[:4], "a": A.get(str(n), "")})
        if qs: units.append({"sec": "R", "part": 3, "label": f"{qs[0]['n']}-{qs[-1]['n']}", "head": "第66-85题：请选出正确答案。", "passage": [tidy(g.get("passage", ""))], "qs": qs})
    for n in range(80, 86):
        if n not in seen: probs.append(f"{n}: thiếu")
    # viết 86-95
    W = {int(x["n"]): x for x in d.get("w86", [])}; WA = d.get("write_answers") or {}
    wq = []
    for n in range(86, 96):
        words = [tidy(w) for w in W.get(n, {}).get("w", []) if w and w.strip()]
        alts = WA.get(str(n)) or []
        if isinstance(alts, str): alts = [alts]
        alts = [tidy(y) for a in alts for y in re.split(r"\s+/\s+|／", a) if y.strip()]
        ok = [s for s in alts if Counter(norm(s)) == Counter(norm("".join(words)))]
        if not ok: probs.append(f"{n}: đáp án không khớp từ {alts} / {words}")
        wq.append({"n": n, "t": "b", "w": words, "a": ok or alts or [""]})
    ex = "那座桥　800年的　历史　有　了 → 那座桥有800年的历史了。"
    units.append({"sec": "W", "part": 1, "label": "86-90", "head": "第86-95题：完成句子。", "ex": ex, "qs": wq[:5]})
    units.append({"sec": "W", "part": 1, "label": "91-95", "head": "第86-95题：完成句子。", "ex": ex, "qs": wq[5:]})
    # viết 96-100: cắt tranh
    W = {int(x["n"]): x for x in d.get("w96", [])}; ref = d.get("ref96") or {}
    pq = []
    for n in range(96, 101):
        x = W.get(n, {}); img = ""
        try:
            pg = re.sub(r"\D", "", str(x.get("page", ""))); tag = "q"
            src = os.path.join(sys.argv[2], "tmp", f"{tag}{int(pg):03d}.jpg")
            im = Image.open(src); w, h = im.size; bx = x["box"]
            while isinstance(bx, list) and len(bx) == 1 and isinstance(bx[0], list): bx = bx[0]
            y0, x0, y1, x1 = bx
            pad = 8
            box = (max(0, int(x0 * w / 1000) - pad), max(0, int(y0 * h / 1000) - pad), min(w, int(x1 * w / 1000) + pad), min(h, int(y1 * h / 1000) + pad))
            if box[2] - box[0] > 40 and box[3] - box[1] > 40:
                f = f"{pid}_{n}.jpg"; im.crop(box).convert("RGB").save(os.path.join(OUT, "assets", f), quality=85)
                img = f"/hsk2-exam/assets/{f}"
        except Exception as e:
            probs.append(f"{n}: tranh {e}")
        if not x.get("word"): probs.append(f"{n}: thiếu từ")
        q = {"n": n, "t": "w", "head": "看图，用词造句。", "word": tidy(x.get("word", "")), "img": img, "min": 5}
        if ref.get(str(n)): q["ref"] = tidy(ref[str(n)])
        pq.append(q)
    units.append({"sec": "W", "part": 2, "label": "96-100", "head": "第96-100题：看图，用词造句。", "qs": pq})
    P = {"id": pid, "level": 4, "name": f"{cfg['name']} · 第{int(k)}套", "audio": [f"/hsk2-exam/audio/{pid}.mp3"], "dur": {"R": 40 * 60, "W": 25 * 60}, "units": units}
    if d.get("script"): P["script"] = d["script"].strip()
    nq = sum(len(u["qs"]) for u in units)
    if nq != 100: probs.append(f"tổng {nq} câu")
    return P, probs

if __name__ == "__main__":
    cfg = json.load(open(sys.argv[1], encoding="utf-8")); src = sys.argv[2]
    want = sys.argv[3:] or list(cfg["tests"].keys())
    for k in want:
        f = os.path.join(src, f"{cfg['book']}{int(k):02d}.json")
        if not os.path.exists(f): print(k, "chưa OCR"); continue
        P, probs = build(cfg, k, json.load(open(f, encoding="utf-8")))
        mp3 = os.path.join(cfg["audio"], f"{int(k):02d}.mp3"); dst = os.path.join(OUT, "audio", P["id"] + ".mp3")
        if os.path.exists(mp3) and not os.path.exists(dst):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-b:a", "32k", dst], check=True)
        if not os.path.exists(dst): P["hidden"] = True; probs.append("chưa có file nghe → ẩn")
        print(P["id"], "lỗi:", len(probs))
        for p in probs[:12]: print("   ", p)
        json.dump(P, open(os.path.join(OUT, "papers", P["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
