# -*- coding: utf-8 -*-
"""
Chuyển đề thi thật HSK5 (bản 2.0, PDF có chữ: H51001…H51333) thành đề cho Phòng thi HSK 2.0
  python3 tools/exam/parse_hsk5_v2.py <thư mục chứa H51xxx.pdf + .mp3>
Kết quả: public/hsk2-exam/papers/<id>.json, ảnh câu 100 ở public/hsk2-exam/assets, file nghe nén ở public/hsk2-exam/audio
"""
import json, os, re, subprocess, sys, glob, shutil, random

SRC = sys.argv[1]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "hsk2-exam")
for d in ("papers", "assets", "audio"): os.makedirs(os.path.join(OUT, d), exist_ok=True)

def clean_lines(pdf):
    raw = subprocess.run(["pdftotext", "-raw", pdf, "-"], capture_output=True, text=True).stdout
    out = []
    for l in raw.split("\n"):
        s = l.strip()
        if re.fullmatch(r"[a-z.]|H5\d{4} ?- ?\d+|-? ?\d+ ?-?|", s): continue
        s = re.sub(r"\s+[a-z]$", "", s)          # chữ watermark dính cuối dòng
        s = s.replace("„„", "……").replace("„", "…")
        if out and re.match(r"^[”’」）]", s):    # dấu đóng ngoặc bị tách sang dòng sau
            m = re.match(r"^([”’」）]+)\s*(.*)$", s); out[-1] += m.group(1); s = m.group(2)
            if not s: continue
        out.append(s)
    return out

nos = lambda s: re.sub(r"\s+", "", s)
LET = "ABCD"
# Đáp án in sai trong tệp gốc (đã soát lại theo các từ cho sẵn)
FIX_W = {("H51008", 96): ["那个学生对猜谜语产生了兴趣。"]}

def split_opts(s):
    """'A 穿 B 带 C 挂 D 戴' → {'A':'穿',...}; nhận cả dòng chỉ có 'C .. D ..'"""
    pos = []; want = None
    for m in re.finditer(r"(?:^|\s|(?<=[\u4e00-\u9fff”。）]))([A-D])(?:\s+|(?=[\u4e00-\u9fff“\d]))", s):
        L = m.group(1)
        if want is None: want = L
        if L == want:
            pos.append((L, m.start(1), m.end())); want = chr(ord(L) + 1)
    if not pos or pos[0][1] != 0: return None
    res = {}
    for i, (L, a, b) in enumerate(pos):
        e = pos[i + 1][1] if i + 1 < len(pos) else len(s)
        res[L] = s[b:e].strip()
    return res

QNUM = re.compile(r"^(\d{1,3})\s*[．.、]\s*(.*)$")

def join_para(lines):
    # nối dòng, ngắt đoạn khi dòng ngắn và kết thúc bằng dấu câu
    paras, cur = [], ""
    merged = []
    for l in lines:
        if merged and re.fullmatch(r"[”’」。，、！？：；]+", l): merged[-1] += l
        else: merged.append(l)
    for l in merged:
        cur += l
        if len(l) < 30 and re.search(r"[。！？”]$", l): paras.append(cur); cur = ""
    if cur: paras.append(cur)
    return [p for p in paras if p]

def parse_block(lines, lo, hi, ordered=True):
    """Trả về [{n, stem(lines), opts{}, group}] và các nhóm bài đọc {range:(a,b), lines}"""
    qs, groups, cur, grp = [], [], None, None
    for l in lines:
        if not l: continue
        g = re.match(r"^(\d{2,3})\s*[-—–]\s*(\d{2,3})\s*[．.、]?\s*$", l)
        if g and lo <= int(g.group(1)) <= hi:
            grp = {"range": (int(g.group(1)), int(g.group(2))), "lines": []}; groups.append(grp); cur = None; continue
        m = QNUM.match(l)
        if m and lo <= int(m.group(1)) <= hi and int(m.group(1)) not in {q["n"] for q in qs} and (not ordered or not qs or int(m.group(1)) > qs[-1]["n"]):
            n = int(m.group(1)); rest = m.group(2).strip()
            cur = {"n": n, "stem": [], "opts": {}, "group": grp if grp and grp["range"][0] <= n <= grp["range"][1] else None}
            qs.append(cur)
            o = split_opts(rest) if rest else None
            if o: cur["opts"].update(o)
            elif rest: cur["stem"].append(rest)
            continue
        o = split_opts(l)
        if cur is not None and o and (not cur["opts"] or min(o) > max(cur["opts"])):
            cur["opts"].update(o); continue
        if cur is not None and cur["opts"] and len(cur["opts"]) < 4 and not o:
            # phương án dài bị xuống dòng
            k = max(cur["opts"]); cur["opts"][k] += l; continue
        if cur is None or (grp and cur["n"] < grp["range"][0]):
            if grp is not None: grp["lines"].append(l)
            continue
        if not cur["opts"]: cur["stem"].append(l)
        elif grp is not None and cur["n"] >= grp["range"][1]: grp["lines"].append(l)
    return qs, groups

def find(lines, pat, start=0):
    for i in range(start, len(lines)):
        if re.search(pat, nos(lines[i])): return i
    return -1

def dedupe(s):
    return s

def parse(pdf):
    L = clean_lines(pdf)
    pid = os.path.basename(pdf)[:-4]
    iL = find(L, r"第1[-—]20题")
    iR = find(L, r"^二[、]?阅读", iL)
    iR2 = find(L, r"第二部分", iR); iR3 = find(L, r"第三部分", iR2)
    iW = find(L, r"^三[、]?书写", iR3)
    iS = find(L, r"卷听力材料", iW); iA = find(L, r"卷答案", iW)
    ends = [x for x in (iS, iA) if x > 0]; iEnd = min(ends) if ends else len(L)
    lq, _ = parse_block(L[iL:iR], 1, 45, ordered=False)
    r1, g1 = parse_block(L[iR:iR2], 46, 60)
    r2, _ = parse_block(L[iR2:iR3], 61, 70)
    r3, g3 = parse_block(L[iR3:iW], 71, 90)
    W = L[iW:iEnd]
    # đáp án
    ans, wans = {}, {}
    if iA > 0:
        A = L[iA:]
        txt = "\n".join(A)
        for m in re.finditer(r"(\d{1,2})\s*[．.]\s*([A-D])\b", txt):
            n = int(m.group(1))
            if 1 <= n <= 90 and n not in ans: ans[n] = m.group(2)
        iw = next((i for i, l in enumerate(A) if re.match(r"^91\s*[．.]", l)), -1)
        if iw > 0:
            cur = None
            for l in A[iw:]:
                m = QNUM.match(l)
                if m and 91 <= int(m.group(1)) <= 98: cur = int(m.group(1)); wans[cur] = m.group(2); continue
                if re.search(r"第二部分", nos(l)): break
                if cur and not re.search(r"部分", l): wans[cur] += l
    script = ""
    if iS > 0:
        S = L[iS + 1:(iA if iA > iS else len(L))]
        e = find(S, r"听力考试现在结束")
        script = "\n".join(S[: e + 1 if e >= 0 else len(S)])
    return pid, L, lq, r1, g1, r2, r3, g3, W, ans, wans, script

CJK = r"[\u4e00-\u9fff，。、：；！？“”（）]"
def tidy(x):
    if isinstance(x, list): return [tidy(i) for i in x]
    if not isinstance(x, str): return x
    x = re.sub(r"(?<=%s)\s+(?=[\dA-Za-z%%])|(?<=[\dA-Za-z%%])\s+(?=%s)|(?<=%s)\s+(?=%s)" % (CJK, CJK, CJK, CJK), "", x)
    return x.strip()

def opts4(q):
    return [q["opts"].get(k, "").strip() for k in LET]

def blanks(text, a, b):
    return re.sub(r"(?<![\d.])\s*\b(%s)\b\s*(?![\d.%%])" % "|".join(str(i) for i in range(a, b + 1)), lambda m: "{%s}" % m.group(1), text)

def build(pdf):
    pid, L, lq, r1, g1, r2, r3, g3, W, ans, wans, script = parse(pdf)
    units, probs = [], []
    def chk(q, n):
        o = opts4(q)
        if any(not x for x in o): probs.append(f"{n}: thiếu phương án {o}")
        if n not in ans: probs.append(f"{n}: thiếu đáp án")
        return o
    # nghe
    byn = {q["n"]: q for q in lq}
    for a, b in [(1, 5), (6, 10), (11, 15), (16, 20), (21, 25), (26, 30), (31, 35), (36, 40), (41, 45)]:
        qs = []
        for n in range(a, b + 1):
            q = byn.get(n)
            if not q: probs.append(f"{n}: không thấy câu"); continue
            qs.append({"n": n, "t": "c", "o": chk(q, n), "a": ans.get(n, "")})
        units.append({"sec": "L", "part": 1 if b <= 20 else 2, "label": f"{a}-{b}", "head": "第1-20题：请选出正确答案。" if b <= 20 else "第21-45题：请选出正确答案。", "qs": qs})
    # đọc 1
    byn = {q["n"]: q for q in r1}
    for g in g1:
        a, b = g["range"]
        marked = [re.sub(r"(?:(?<=[\s，。、：；“”（）])|^)(%s)(?=[\s，。、：；！？”]|$)" % "|".join(str(i) for i in range(a, b + 1)), lambda m: "{%s}" % m.group(1), l) for l in g["lines"]]
        paras = [re.sub(r"\s*(\{\d+\})\s*", r"\1", p) for p in join_para(marked)]
        found = sum(("{%d}" % n) in "".join(paras) for n in range(a, b + 1))
        if found != b - a + 1: probs.append(f"{a}-{b}: chỉ thấy {found} chỗ trống")
        qs = [{"n": n, "t": "c", "o": chk(byn[n], n), "a": ans.get(n, "")} for n in range(a, b + 1) if n in byn]
        units.append({"sec": "R", "part": 1, "label": f"{a}-{b}", "head": "第46-60题：请选出正确答案。", "passage": paras, "qs": qs})
    # đọc 2
    byn = {q["n"]: q for q in r2}
    for a, b in [(61, 65), (66, 70)]:
        qs = []
        for n in range(a, b + 1):
            q = byn.get(n)
            if not q: probs.append(f"{n}: không thấy câu"); continue
            qs.append({"n": n, "t": "c", "p": "".join(q["stem"]), "o": chk(q, n), "a": ans.get(n, "")})
        units.append({"sec": "R", "part": 2, "label": f"{a}-{b}", "head": "第61-70题：请选出与试题内容一致的一项。", "qs": qs})
    # đọc 3
    byn = {q["n"]: q for q in r3}
    for g in g3:
        a, b = g["range"]
        qs = [{"n": n, "t": "c", "s": "".join(byn[n]["stem"]), "o": chk(byn[n], n), "a": ans.get(n, "")} for n in range(a, b + 1) if n in byn]
        units.append({"sec": "R", "part": 3, "label": f"{a}-{b}", "head": "第71-90题：请选出正确答案。", "passage": join_para(g["lines"]), "qs": qs})
    # viết
    wq = []
    w99 = None
    for i, l in enumerate(W):
        m = QNUM.match(l)
        if m and 91 <= int(m.group(1)) <= 98:
            n = int(m.group(1)); words = [x for x in m.group(2).split() if x]
            a = [x.strip() for x in re.split(r"\s*/\s*", wans.get(n, "")) if x.strip()]
            a = FIX_W.get((pid, n), a)
            if not a: probs.append(f"{n}: thiếu đáp án viết")
            wq.append({"n": n, "t": "b", "w": words, "a": a or [""]})
        if m and int(m.group(1)) == 99:
            j = i + 1; w = ""
            while j < len(W) and not QNUM.match(W[j]) and not re.search(r"部分", W[j]):
                if not re.search(r"写一篇|^，", W[j]): w += " " + W[j]
                j += 1
            w99 = "、".join([x for x in re.split(r"[\s、，,]+", w) if x])
    units.append({"sec": "W", "part": 1, "label": "91-98", "head": "第91-98题：完成句子。", "ex": "发表　这篇论文　什么时候　是　的 → 这篇论文是什么时候发表的？", "qs": wq})
    units.append({"sec": "W", "part": 2, "label": "99", "head": "第99-100题：写短文。", "qs": [{"n": 99, "t": "w", "prompt": f"请结合下列词语（要全部使用），写一篇80字左右的短文。\n{w99}", "word": w99 or "", "min": 80}]})
    units.append({"sec": "W", "part": 2, "label": "100", "head": "第99-100题：写短文。", "qs": [{"n": 100, "t": "w", "prompt": "请结合这张图片写一篇80字左右的短文。", "img": f"/hsk2-exam/assets/{pid}_100.jpg", "min": 80}]})
    # gạch chân (画线词语/句子) ở phần đọc
    try:
        sys.path.insert(0, os.path.dirname(__file__)); from underline import underlined
        for t in underlined(pdf):
            t = tidy(t)
            if "这篇论文" in t: continue
            done = False
            for u in units:
                if u["sec"] != "R" or done: continue
                for i, para in enumerate(u.get("passage", [])):
                    if t in re.sub(r"</?[ub]>", "", tidy(para)) and ("<b>%s<" % t) not in para:
                        u["passage"][i] = tidy(para).replace(t, "<u><b>%s</b></u>" % t, 1); done = True; break
                for q in u["qs"]:
                    if not done and q.get("p") and t in tidy(q["p"]):
                        q["p"] = tidy(q["p"]).replace(t, "<u><b>%s</b></u>" % t, 1); done = True
            if not done: probs.append("không đặt được gạch chân: " + t)
    except Exception as e:
        probs.append("gạch chân lỗi: %s" % e)
    for u in units:
        if "passage" in u: u["passage"] = tidy(u["passage"])
        for q in u["qs"]:
            for k in ("o", "p", "s", "w", "a"):
                if k in q and not (k == "a" and q["t"] == "c"): q[k] = tidy(q[k])
    if len(wq) != 8: probs.append(f"viết: {len(wq)} câu ghép")
    if not w99: probs.append("99: không thấy từ")
    nq = sum(len(u["qs"]) for u in units)
    if nq != 100: probs.append(f"tổng {nq} câu")
    P = {"id": pid.lower(), "level": 5, "name": f"HSK五级真题 {pid}", "audio": [f"/hsk2-exam/audio/{pid}.mp3"], "dur": {"R": 45 * 60, "W": 40 * 60}, "units": units}
    if script: P["script"] = script
    return P, probs

if __name__ == "__main__":
    allp = {}
    for pdf in sorted(glob.glob(os.path.join(SRC, "H51*.pdf"))):
        P, probs = build(pdf)
        if any("thiếu đáp án" in x or "không thấy câu" in x for x in probs):
            P["hidden"] = True   # đề thiếu đáp án / thiếu câu: chưa đưa vào phòng thi
        allp[P["id"]] = P
        print(P["id"], "câu:", sum(len(u["qs"]) for u in P["units"]), "kịch bản:", bool(P.get("script")), "| lỗi:", len(probs))
        for p in probs[:12]: print("   ", p)
        if not P.get("hidden"): json.dump(P, open(os.path.join(OUT, "papers", P["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
