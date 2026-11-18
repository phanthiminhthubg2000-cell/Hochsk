# -*- coding: utf-8 -*-
"""
Đề thi thật HSK4 (bản 2.0, PDF có chữ: H41001…H41333) → đề cho Phòng thi HSK 2.0
  python3 tools/exam/parse_hsk4_v2.py <thư mục chứa H41xxx.pdf (+ .mp3)>
Ra: public/hsk2-exam/papers/<id>.json, tranh câu 96-100 ở public/hsk2-exam/assets, file nghe nén ở public/hsk2-exam/audio
Cấu trúc HSK4: nghe 1-10 đúng/sai, 11-45 chọn A-D; đọc 46-55 chọn từ điền chỗ trống (bảng A-F), 56-65 sắp xếp 3 câu,
66-85 đọc hiểu; viết 86-95 sắp xếp từ thành câu, 96-100 nhìn tranh dùng từ đặt câu.
"""
import json, os, re, subprocess, sys, glob
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "hsk2-exam")
for d in ("papers", "assets", "audio"): os.makedirs(os.path.join(OUT, d), exist_ok=True)
LET = "ABCDEF"
TF = ["对（√）", "错（×）"]
nos = lambda s: re.sub(r"\s+", "", s or "")
norm = lambda x: re.sub(r"[\s，。、？！?!,.；;：:\"“”（）()…·]", "", x or "")
CJK = r"[一-鿿，。、：；！？“”（）]"
QNUM = re.compile(r"^(\d{1,3})\s*[．.、]\s*(.*)$")
# Đáp án/đề in sai trong tệp gốc (soát tay): {(mã đề, câu): [đáp án]}
FIX_W = {}

def tidy(x):
    if isinstance(x, list): return [tidy(i) for i in x]
    if not isinstance(x, str): return x
    x = re.sub(r"(?<=%s)\s+(?=[\dA-Za-z%%℃])|(?<=[\dA-Za-z%%℃])\s+(?=%s)|(?<=%s)\s+(?=%s)" % (CJK, CJK, CJK, CJK), "", x)
    return x.strip()

def clean_lines(pdf, code):
    raw = subprocess.run(["pdftotext", "-raw", pdf, "-"], capture_output=True, text=True).stdout
    out = []
    for l in raw.split("\n"):
        s = l.strip()
        if re.fullmatch(r"[a-z.]|%s ?- ?\d+|-? ?\d+ ?-?|" % code, s): continue
        s = re.sub(r"\s+[a-z]$", "", s)
        s = s.replace("„„", "……").replace("„", "…")
        if out and re.match(r"^[”’」）。，、！？]", s) and not QNUM.match(s):
            m = re.match(r"^([”’」）。，、！？]+)\s*(.*)$", s); out[-1] += m.group(1); s = m.group(2)
            if not s: continue
        out.append(s)
    return out

def find(L, pat, start=0):
    for i in range(max(0, start), len(L)):
        if re.search(pat, nos(L[i])): return i
    return -1

def split_opts(s, letters="ABCD"):
    pos, want = [], letters[0]
    for m in re.finditer(r"(?:^|\s|(?<=[一-鿿”。）√]))([A-F])(?:\s+|(?=[一-鿿“\d]))", s):
        L = m.group(1)
        if L == want and L in letters:
            pos.append((L, m.start(1), m.end())); want = chr(ord(L) + 1)
    if not pos or pos[0][1] != 0: return None
    res = {}
    for i, (L, a, b) in enumerate(pos):
        e = pos[i + 1][1] if i + 1 < len(pos) else len(s)
        res[L] = re.sub(r"\s*√\s*$", "", s[b:e]).strip()
    return res

def numbered(lines, lo, hi):
    """Gom các dòng theo câu đánh số lo..hi (thứ tự tăng): {n: [dòng...]}, kèm nhóm 'a-b.'"""
    qs, cur, groups, grp = {}, None, [], None
    for l in lines:
        if not l: continue
        g = re.match(r"^(\d{2,3})\s*[-—–]\s*(\d{2,3})\s*[．.、]?\s*$", l)
        if g and lo <= int(g.group(1)) <= hi:
            grp = {"range": (int(g.group(1)), int(g.group(2))), "lines": []}; groups.append(grp); cur = None; continue
        m = QNUM.match(l)
        if m and lo <= int(m.group(1)) <= hi and int(m.group(1)) not in qs and (cur is None or int(m.group(1)) > cur):
            cur = int(m.group(1)); qs[cur] = [m.group(2).strip()] if m.group(2).strip() else []
            continue
        if re.match(r"^(第\d|例如|第[一二三]部分|[一二三]、)", nos(l)): cur = None; continue
        if grp is not None and (cur is None or cur < grp["range"][0]): grp["lines"].append(l); continue
        if cur is not None: qs[cur].append(l)
    return qs, groups

def parse(pdf):
    code = os.path.basename(pdf)[:-4]
    L = clean_lines(pdf, code)
    iL1 = find(L, r"第1-10题"); iL2 = find(L, r"第11-25题", iL1); iL3 = find(L, r"第26-45题", iL2)
    iR = find(L, r"^二、阅读", iL3)
    iR1b = find(L, r"第51-55题", iR); iR2 = find(L, r"第56-65题", iR1b); iR3 = find(L, r"第66-85题", iR2)
    iW = find(L, r"^三、书写", iR3); iW2 = find(L, r"第96-100题", iW)
    iS = find(L, r"卷听力材料", iW2); iA = find(L, r"卷答案", iW2)
    iEnd = min([x for x in (iS, iA) if x > 0] or [len(L)])
    return code, L, dict(iL1=iL1, iL2=iL2, iL3=iL3, iR=iR, iR1b=iR1b, iR2=iR2, iR3=iR3, iW=iW, iW2=iW2, iS=iS, iA=iA, iEnd=iEnd)

def answers(L, iA):
    A = L[iA:]; txt = "\n".join(A); ans = {}
    for m in re.finditer(r"(\d{1,2})\s*[．.]\s*([√×]|[A-F]{3}|[A-F])(?![A-Za-z])", txt):
        n = int(m.group(1))
        if 1 <= n <= 85 and n not in ans: ans[n] = m.group(2)
    w = {}; cur = None
    i0 = next((i for i, l in enumerate(A) if re.match(r"^86\s*[．.]", l)), -1)
    for l in (A[i0:] if i0 >= 0 else []):
        m = QNUM.match(l)
        if m and 86 <= int(m.group(1)) <= 100: cur = int(m.group(1)); w[cur] = m.group(2); continue
        if re.search(r"部分|参考答案|^H41", nos(l)): continue
        if cur: w[cur] += l
    return ans, w

def wordbank(lines):
    for l in lines:
        o = split_opts(l, "ABCDEF")
        if o and len(o) == 6: return o
    return None

def blank_split(stem):
    """'你去买啤酒吗？（ ）帮我…' → (pre, post)"""
    s = " ".join(stem)
    m = re.search(r"[（(]\s*[）)]", s)
    if not m: return None
    return tidy(s[:m.start()]), tidy(s[m.end():])

def crop_pics(pdf, code, page_hint):
    """Tranh câu 96-100: lấy 6 ảnh lớn trên trang 第二部分 (ảnh đầu là ví dụ), xếp theo vị trí đọc."""
    import pdfplumber
    out = {}
    with pdfplumber.open(pdf) as P:
        for pi, page in enumerate(P.pages):
            txt = page.extract_text() or ""
            if "96" not in txt or "100" not in txt or "看图" not in nos(txt): continue
            imgs = [im for im in page.images if (im["x1"] - im["x0"]) > 35 and (im["bottom"] - im["top"]) > 35]
            imgs.sort(key=lambda im: (round(im["top"] / 40), im["x0"]))
            if len(imgs) < 5: continue
            imgs = imgs[-5:]   # bỏ ảnh ví dụ nếu có
            for k, im in enumerate(imgs):
                n = 96 + k
                bb = (max(0, im["x0"]), max(0, im["top"]), min(page.width, im["x1"]), min(page.height, im["bottom"]))
                f = os.path.join(OUT, "assets", f"{code.lower()}_{n}.jpg")
                page.crop(bb).to_image(resolution=170).original.convert("RGB").save(f, quality=85)
                out[n] = f"/hsk2-exam/assets/{code.lower()}_{n}.jpg"
            break
    return out

def build(pdf):
    code, L, I = parse(pdf)
    probs, units = [], []
    ans, wans = answers(L, I["iA"]) if I["iA"] > 0 else ({}, {})
    if I["iA"] < 0: probs.append("không thấy trang đáp án")
    # ---- nghe ----
    q1, _ = numbered(L[I["iL1"]:I["iL2"]], 1, 10)
    for a, b in [(1, 5), (6, 10)]:
        qs = []
        for n in range(a, b + 1):
            st = tidy(re.sub(r"[（(]\s*[）)]\s*$", "", " ".join(q1.get(n, [])))).lstrip("★").strip()
            if not st: probs.append(f"{n}: không thấy câu")
            av = ans.get(n)
            if av not in ("√", "×"): probs.append(f"{n}: đáp án {av}")
            qs.append({"n": n, "t": "c", "s": "★ " + st, "o": TF, "a": "A" if av == "√" else "B"})
        units.append({"sec": "L", "part": 1, "label": f"{a}-{b}", "head": "第1-10题：判断对错。", "qs": qs})
    for lo, hi, part, head in [(11, 25, 2, "第11-25题：请选出正确答案。"), (26, 45, 3, "第26-45题：请选出正确答案。")]:
        seg = L[I["iL2"]:I["iL3"]] if lo == 11 else L[I["iL3"]:I["iR"]]
        qd, _ = numbered(seg, lo, hi)
        for a in range(lo, hi + 1, 5):
            qs = []
            for n in range(a, min(a + 4, hi) + 1):
                o = split_opts(" ".join(qd.get(n, [])))
                o = [tidy(o.get(k, "")) for k in "ABCD"] if o else ["", "", "", ""]
                if any(not x for x in o): probs.append(f"{n}: phương án {o}")
                if ans.get(n) not in list("ABCD"): probs.append(f"{n}: đáp án {ans.get(n)}")
                qs.append({"n": n, "t": "c", "o": o, "a": ans.get(n, "")})
            units.append({"sec": "L", "part": part, "label": f"{a}-{min(a + 4, hi)}", "head": head, "qs": qs})
    # ---- đọc 1: chọn từ ----
    for lo, hi, seg in [(46, 50, L[I["iR"]:I["iR1b"]]), (51, 55, L[I["iR1b"]:I["iR2"]])]:
        bank = wordbank(seg)
        if not bank: probs.append(f"{lo}-{hi}: không thấy bảng từ"); bank = {k: "" for k in LET}
        ex = next((l for l in seg if l.startswith("例如")), "")
        exi = seg.index(ex) if ex in seg else -1
        exL = ex[3:].strip()
        if lo == 51 and exi >= 0 and exi + 1 < len(seg) and seg[exi + 1].startswith("B"): exL += "<br>" + seg[exi + 1]
        mx = re.search(r"[（(]\s*([A-F])\s*[）)]", exL); exk = mx.group(1) if mx else ""
        exL = re.sub(r"[（(]\s*([A-F])\s*[）)]", r"（<b class='exa'>\1</b>）", tidy(exL))
        qd, _ = numbered(seg, lo, hi)
        qs = []
        for n in range(lo, hi + 1):
            lines = qd.get(n, [])
            if lo == 51:   # hội thoại A/B: giữ xuống dòng giữa hai lượt
                txt = []
                for l in lines:
                    if re.match(r"^[AB]：", l) or not txt: txt.append(l)
                    else: txt[-1] += l
                stem = ["<br>".join(tidy(t) for t in txt)]
            else: stem = lines
            ps = blank_split(stem)
            if not ps: probs.append(f"{n}: không thấy chỗ trống"); ps = (tidy(" ".join(stem)), "")
            if ans.get(n) not in list(LET): probs.append(f"{n}: đáp án {ans.get(n)}")
            qs.append({"n": n, "t": "m", "a": ans.get(n, ""), "pre": ps[0], "post": ps[1]})
        units.append({"sec": "R", "part": 1, "label": f"{lo}-{hi}", "head": f"第{lo}-{hi}题：选词填空。", "ref": {"kind": "words", "items": [{"k": k, "hz": tidy(bank.get(k, ""))} for k in LET]},
                      "unique": True, "qs": qs, "ex": exL, "exUsed": exk})
    # ---- đọc 2: sắp xếp ----
    qd, _ = numbered(L[I["iR2"]:I["iR3"]], 56, 65)
    for a, b in [(56, 60), (61, 65)]:
        qs = []
        for n in range(a, b + 1):
            parts = {}; cur = None
            for l in qd.get(n, []):
                m = re.match(r"^([ABC])\s*(.*)$", l)
                if m and m.group(1) not in parts: cur = m.group(1); parts[cur] = m.group(2); continue
                if cur: parts[cur] += l
            parts = {k: tidy(v) for k, v in parts.items()}
            if len(parts) != 3: probs.append(f"{n}: sắp xếp {parts}")
            order = ans.get(n, "")
            if not re.fullmatch(r"[ABC]{3}", order or ""): probs.append(f"{n}: đáp án {order}")
            w = [parts.get(k, "") for k in "ABC"]
            qs.append({"n": n, "t": "b", "head": "排列顺序", "w": w, "a": ["".join(parts.get(k, "") for k in order)] if order else [""], "key": order})
        units.append({"sec": "R", "part": 2, "label": f"{a}-{b}", "head": "第56-65题：排列顺序。", "ex": "A 可是今天起晚了　B 平时我骑自行车上下班　C 所以就打车来公司 → B A C", "qs": qs})
    # ---- đọc 3 ----
    seg = L[I["iR3"]:I["iW"]]
    j = next((i for i, l in enumerate(seg) if QNUM.match(l) and int(QNUM.match(l).group(1)) == 66), 0)
    qd, groups = numbered(seg[j:], 66, 85)
    single = []
    for n in range(66, 86):
        lines = qd.get(n, [])
        if not lines: continue
        star = [i for i, l in enumerate(lines) if l.startswith("★")]
        if not star: probs.append(f"{n}: không thấy ★"); continue
        k = star[0]; p = tidy(" ".join(lines[:k]))
        rest = lines[k:]; o = None; s = rest[0]
        for i, l in enumerate(rest[1:], 1):
            o2 = split_opts(" ".join(rest[i:]))
            if o2 and len(o2) == 4: o = o2; s = " ".join(rest[:i]); break
        if not o: probs.append(f"{n}: phương án"); o = {}
        if ans.get(n) not in list("ABCD"): probs.append(f"{n}: đáp án {ans.get(n)}")
        single.append({"n": n, "t": "c", "p": p, "s": tidy(s), "o": [tidy(o.get(x, "")) for x in "ABCD"], "a": ans.get(n, "")})
    # câu 80-85: đoạn văn chung cho 2 câu (đoạn nằm ở câu đầu nhóm)
    for g in groups:
        a, b = g["range"]; lines = g["lines"]
        star = [i for i, l in enumerate(lines) if l.startswith("★")]
        P = tidy(" ".join(lines[:star[0]])) if star else ""
        for k, n in enumerate(range(a, b + 1)):
            if k >= len(star): probs.append(f"{n}: thiếu ★ trong nhóm"); break
            seg2 = lines[star[k]:(star[k + 1] if k + 1 < len(star) else len(lines))]
            o = None; sq = seg2[0]
            for i in range(1, len(seg2)):
                o2 = split_opts(" ".join(seg2[i:]))
                if o2 and len(o2) == 4: o = o2; sq = " ".join(seg2[:i]); break
            if not o: probs.append(f"{n}: phương án"); o = {}
            if ans.get(n) not in list("ABCD"): probs.append(f"{n}: đáp án {ans.get(n)}")
            single.append({"n": n, "t": "c", "p": P if k == 0 else "", "s": tidy(sq), "o": [tidy(o.get(x, "")) for x in "ABCD"], "a": ans.get(n, "")})
    byn = {q["n"]: q for q in single}
    for a in range(66, 86):
        if a not in byn: probs.append(f"{a}: không thấy câu")
    grp_units = []
    for g in groups:
        a, b = g["range"]
        if a in byn and not byn[a]["p"]: byn[a]["p"] = tidy(" ".join(g["lines"]))
    singles = [byn[n] for n in range(66, 86) if n in byn]
    i = 0
    while i < len(singles):
        q = singles[i]
        if q["n"] >= 80:
            nxt = singles[i + 1] if i + 1 < len(singles) else None
            P = q.pop("p", ""); qq = [q]
            if nxt and not nxt.get("p"): nxt.pop("p", None); qq.append(nxt); i += 1
            grp_units.append({"sec": "R", "part": 3, "label": f"{qq[0]['n']}-{qq[-1]['n']}", "head": "第66-85题：请选出正确答案。", "passage": [P], "qs": qq})
        i += 1
    s66 = [q for q in singles if q["n"] < 80]
    for a in range(66, 80, 5):
        grp = [q for q in s66 if a <= q["n"] < min(a + 5, 80)]
        if grp: units.append({"sec": "R", "part": 3, "label": f"{grp[0]['n']}-{grp[-1]['n']}", "head": "第66-85题：请选出正确答案。", "qs": grp})
    units += grp_units
    # ---- viết 1: sắp xếp từ ----
    qd, _ = numbered(L[I["iW"]:I["iW2"]], 86, 95)
    wq = []
    for n in range(86, 96):
        words = [x for x in " ".join(qd.get(n, [])).split() if x]
        alts = [tidy(x) for x in re.split(r"\s*/\s*", wans.get(n, "")) if x.strip()]
        alts = FIX_W.get((code, n), alts)
        ok = [s for s in alts if Counter(norm(s)) == Counter(norm("".join(words)))]
        if not ok: probs.append(f"{n}: đáp án không khớp từ {alts} / {words}")
        wq.append({"n": n, "t": "b", "w": words, "a": ok or alts or [""]})
    units.append({"sec": "W", "part": 1, "label": "86-90", "head": "第86-95题：完成句子。", "ex": "那座桥　800年的　历史　有　了 → 那座桥有800年的历史了。", "qs": wq[:5]})
    units.append({"sec": "W", "part": 1, "label": "91-95", "head": "第86-95题：完成句子。", "ex": "那座桥　800年的　历史　有　了 → 那座桥有800年的历史了。", "qs": wq[5:]})
    # ---- viết 2: nhìn tranh ----
    seg = " ".join(L[I["iW2"]:I["iEnd"]])
    words = {int(m.group(1)): m.group(2) for m in re.finditer(r"(9[6-9]|100)\s*[．.]\s*([一-鿿]+)", seg)}
    pics = crop_pics(pdf, code, None)
    pq = []
    for n in range(96, 101):
        if n not in words: probs.append(f"{n}: không thấy từ")
        if n not in pics: probs.append(f"{n}: không cắt được tranh")
        q = {"n": n, "t": "w", "head": "看图，用词造句。", "word": words.get(n, ""), "img": pics.get(n, ""), "min": 5}
        if wans.get(n): q["ref"] = tidy(wans[n])
        pq.append(q)
    units.append({"sec": "W", "part": 2, "label": "96-100", "head": "第96-100题：看图，用词造句。", "qs": pq})
    # ---- lời nghe ----
    script = ""
    if I["iS"] > 0:
        S = L[I["iS"] + 1:(I["iA"] if I["iA"] > I["iS"] else len(L))]
        e = find(S, r"听力考试现在结束")
        script = "\n".join(S[: e + 1 if e >= 0 else len(S)])
    nq = sum(len(u["qs"]) for u in units)
    if nq != 100: probs.append(f"tổng {nq} câu")
    P = {"id": code.lower(), "level": 4, "name": f"HSK四级真题 {code}", "audio": [f"/hsk2-exam/audio/{code}.mp3"], "dur": {"R": 40 * 60, "W": 25 * 60}, "units": units}
    if script: P["script"] = script
    return P, probs

if __name__ == "__main__":
    SRC = sys.argv[1]
    for pdf in sorted(glob.glob(os.path.join(SRC, "H41*.pdf"))):
        P, probs = build(pdf)
        code = os.path.basename(pdf)[:-4]
        mp3 = os.path.join(SRC, code + ".mp3")
        dst = os.path.join(OUT, "audio", code + ".mp3")
        if os.path.exists(mp3) and not os.path.exists(dst):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-b:a", "32k", dst], check=True)
        KEYS = json.load(open(os.path.join(os.path.dirname(__file__), "hsk4_keys.json"), encoding="utf-8"))
        if P["id"] in KEYS:
            for u in P["units"]:
                for q in u["qs"]: q.update(KEYS[P["id"]].get(str(q["n"]), {}))
            probs = [x for x in probs if "đáp án" not in x and "trang đáp án" not in x] + ["(đáp án tự giải, lấy từ hsk4_keys.json)"]
        if not os.path.exists(dst): P["hidden"] = True; probs.append("chưa có file nghe → ẩn")
        print(P["id"], "câu:", sum(len(u["qs"]) for u in P["units"]), "| lỗi:", len(probs))
        for p in probs[:14]: print("   ", p)
        json.dump(P, open(os.path.join(OUT, "papers", P["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
