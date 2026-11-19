# -*- coding: utf-8 -*-
"""HSK 3.0 cấp 6 (đề mô phỏng scan) → đề cho Phòng thi HSK 3.0 (public/hsk-exam)
  GEMINI_API_KEY=... python3 tools/exam/ocr_hsk6v3.py <thư mục nguồn h6> <thư mục làm việc> [ocr|build]
Nguồn: HSK3.0模拟（一）六级 第一套/第二套.pdf, 六级试卷N-听力文本.pdf, 六级试卷N-答案解析.pdf, 六级试卷N-听力录音.mp3"""
import glob, json, os, re, subprocess, sys, time
SRC, WK = sys.argv[1], sys.argv[2]; MODE = sys.argv[3] if len(sys.argv) > 3 else "ocr"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.makedirs(WK, exist_ok=True)
def F(pat): return sorted(glob.glob(os.path.join(SRC, pat)))
U = lambda s: s.encode("unicode_escape").decode().replace("\\u", "#U")  # tên tệp sau khi giải nén zip
TESTS = {1: {"q": F("*" + U("第一套") + "*.pdf") + F("*第一套*.pdf"), "s": F("*" + U("试卷1-听力文本") + "*") + F("*试卷1-听力文本*"), "a": F("*" + U("试卷1-答案解析") + "*") + F("*试卷1-答案解析*"), "mp3": F("*" + U("试卷1-听力录音") + "*") + F("*试卷1-听力录音*")},
         2: {"q": F("*" + U("第二套") + "*.pdf") + F("*第二套*.pdf"), "s": F("*" + U("试卷2-听力文本") + "*") + F("*试卷2-听力文本*"), "a": F("*" + U("试卷2-答案解析") + "*") + F("*试卷2-答案解析*"), "mp3": F("*" + U("试卷2-听力录音") + "*") + F("*试卷2-听力录音*")}}

def imgs(pdf, a, b, tag):
    out = []
    for p in range(a, b + 1):
        f = os.path.join(WK, f"{tag}{p:02d}.jpg")
        if not os.path.exists(f): subprocess.run(["pdftoppm", "-r", "130", "-f", str(p), "-l", str(p), "-jpeg", "-singlefile", pdf, f[:-4]], check=True)
        out.append((f"{tag}{p}", open(f, "rb").read()))
    return out
npages = lambda pdf: int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout).group(1))

H = "Đây là các trang scan của đề mô phỏng HSK 3.0 cấp 6 (中文水平考试HSK 3.0（六级）全真模拟试卷). Nhãn [PAGE Qx]=trang đề, [PAGE Sx]=lời bài nghe, [PAGE Ax]=đáp án và giải thích. Chép CHÍNH XÁC chữ Hán, không sửa. Phương án chỉ ghi nội dung, bỏ chữ cái A/B/C/D đầu.\n"
SPEC = {
 "listen": (("q", 3, 6), ("s", 1, 99)), "read": (("q", 8, 21),), "write": (("q", 23, 24),), "ans": (("a", 1, 99),),
}
PROMPT = {
 "listen": 'Phần 一、听力 câu 1-40. JSON: {"L":[{"n":1,"o":["phương án A","B","C","D"]},…40],"groups":[[9,13],…] (nhóm câu dùng chung một đoạn nghe từ câu 9 trở đi, theo lời bài nghe),"script":"toàn bộ lời bài nghe, giữ số câu và 男：女："}',
 "read": 'Phần 二、阅读 câu 41-80. JSON: {"r41":[{"range":[41,45],"passage":["đoạn",…] (chỗ trống ___41___ thay bằng {41}),"qs":[{"n":41,"o":["phương án A","B","C","D"]},…]},{"range":[46,50],…}],"r51":[{"range":[51,55],"passage":[…] (chỗ trống (51)____ thay bằng {51}),"items":["A…","B…","C…","D…","E…","F…"]},{"range":[56,60],…}],"r61":[{"range":[61,64],"passage":[…],"qs":[{"n":61,"s":"câu hỏi","o":["phương án A","B","C","D"]},…]},… đến 80]}',
 "write": 'Phần 三、写作 câu 81-82, và bài mẫu (范文/参考范文) nếu trang đáp án có. JSON: {"w":[{"n":81,"prompt":"đề bài nguyên văn","min":150,"ref":"bài mẫu hoặc rỗng"},{"n":82,"prompt":"…","min":300,"ref":"…"}]}',
 "ans": 'Chỉ đọc đáp án câu 1-80. JSON: {"answers":{"1":"A",…,"80":"C"}}',
}

def ocr():
    from google import genai
    from google.genai import types
    c = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    for k, t in TESTS.items():
        for part, srcs in SPEC.items():
            dst = os.path.join(WK, f"v6_{k}.{part}.json")
            if os.path.exists(dst): continue
            parts = []
            for key, a, b in srcs:
                pdf = t[key][0]; b = min(b, npages(pdf))
                for lab, im in imgs(pdf, a, b, f"{k}{key.upper()}"):
                    parts += [f"[PAGE {lab}]", types.Part.from_bytes(data=im, mime_type="image/jpeg")]
            parts.append(H + PROMPT[part] + "\nChỉ trả JSON.")
            for lan in range(8):
                m = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"][lan % 2]
                try:
                    r = c.models.generate_content(model=m, contents=parts, config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0, max_output_tokens=60000))
                    d = json.loads(r.text); d = d[0] if isinstance(d, list) else d
                    json.dump(d, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1); print(k, part, "xong", m, flush=True); break
                except Exception as e: print(k, part, m, str(e)[:100], flush=True); time.sleep(8 * (lan + 1))

def tidy(x):
    if isinstance(x, list): return [tidy(i) for i in x]
    if not isinstance(x, str): return x
    return re.sub(r"(?<=[一-鿿，。、：；！？“”（）])\s+(?=[一-鿿，。、：；！？“”（）])", "", x).strip()
def norm_pas(lst):
    # đoạn văn có thể bị tách quanh chỗ trống thành [chuỗi, {"46": …}, chuỗi]: ghép lại, chỗ trống → {46}
    paras, cur, prev_str = [], "", False
    for x in lst or []:
        if isinstance(x, dict):
            cur += "".join("{%s}" % k for k in x if str(k).isdigit()); prev_str = False
        else:
            x = str(x)
            if prev_str and cur.strip(): paras.append(cur); cur = ""
            cur += x; prev_str = True
    if cur.strip(): paras.append(cur)
    out = []
    for p in paras:  # đoạn bắt đầu bằng dấu câu hoặc ngay sau chỗ trống là phần tiếp của đoạn trước
        if out and (re.match(r"\s*[，。；：、？！）”…]", p) or re.search(r"\{\d+\}\s*$", out[-1]) or re.search(r"[（(]\s*\d+\s*[）)]\s*_*\s*$", out[-1])): out[-1] += p
        else: out.append(p)
    paras = out
    return [tidy(re.sub(r"\s*(\{\d+\})\s*", r"\1", p)) for p in paras]
def strip_letter(o): return re.sub(r"^\s*[A-F]\s*[．.、]?\s*", "", o or "").strip()

def build():
    for k, t in TESTS.items():
        D = {p: json.load(open(os.path.join(WK, f"v6_{k}.{p}.json"), encoding="utf-8")) for p in SPEC}
        raw = {str(n): str(v).strip() for n, v in D["ans"]["answers"].items()}; probs = []
        OPT = {int(x["n"]): x.get("o") for x in D["listen"]["L"]}
        for g in D["read"]["r41"] + D["read"]["r61"]:
            for x in g["qs"]: OPT[int(x["n"])] = x.get("o")
        for g in D["read"]["r51"]:
            for n in range(g["range"][0], g["range"][1] + 1): OPT[n] = g["items"]
        A = {}
        for n, v in raw.items():
            if re.fullmatch(r"[A-Fa-f]", v): A[n] = v.upper(); continue
            os_ = [tidy(strip_letter(o)) for o in (OPT.get(int(n)) or []) if isinstance(o, str)]
            hit = [i for i, o in enumerate(os_) if o and (o == tidy(v) or o in v or tidy(v) in o)]
            A[n] = "ABCDEF"[hit[0]] if len(hit) == 1 else ""
        if os.path.exists(os.path.join(WK, f"v6_{k}.fix.json")):
            fx = json.load(open(os.path.join(WK, f"v6_{k}.fix.json"), encoding="utf-8"))
            A.update(fx.get("answers", {}))
            for w in D["write"]["w"]:
                if str(w["n"]) in fx.get("prompts", {}): w["prompt"] = fx["prompts"][str(w["n"])]
        def ans(n, let="ABCD"):
            v = A.get(str(n), "");
            if v not in let: probs.append(f"{n}: đáp án '{v}'")
            return v
        def opts(o, n):
            o = [tidy(strip_letter(x)) for x in (o or [])]
            if len(o) != 4 or not all(o): probs.append(f"{n}: phương án {o}")
            return (o + [""] * 4)[:4]
        L = {int(x["n"]): x for x in D["listen"]["L"]}
        lq = lambda n: {"n": n, "t": "c", "o": opts(L.get(n, {}).get("o"), n), "a": ans(n)}
        units = [{"sec": "L", "part": 1, "head": "第1-8题 请选出与所听内容一致的一项。", "label": f"{a}-{a + 3}", "qs": [lq(n) for n in range(a, a + 4)]} for a in (1, 5)]
        G = sorted(g for g in D["listen"].get("groups", []) if isinstance(g, list) and len(g) == 2 and 9 <= g[0] <= g[1] <= 40)
        okG = G and G[0][0] == 9 and G[-1][1] == 40 and all(G[i][1] + 1 == G[i + 1][0] for i in range(len(G) - 1))
        if not okG: probs.append(f"nhóm nghe {G}"); G = [[a, min(a + 3, 28)] for a in range(9, 29, 4)] + [[a, min(a + 3, 40)] for a in range(29, 41, 4)]
        for a, b in G:
            units.append({"sec": "L", "part": 2 if a <= 28 else 3, "head": "第9-28题 请选出正确答案。" if a <= 28 else "第29-40题 请选出正确答案。", "label": f"{a}-{b}", "qs": [lq(n) for n in range(a, b + 1)]})
        for g in D["read"]["r41"]:
            a, b = g["range"]; pas = [re.sub(r"_*\s*(4\d|50)\s*_+", r"{\1}", p) for p in norm_pas(g["passage"])]
            units.append({"sec": "R", "part": 1, "head": "第41-50题 选词填空。", "label": f"{a}-{b}", "passage": pas, "qs": [{"n": x["n"], "t": "c", "o": opts(x.get("o"), x["n"]), "a": ans(x["n"])} for x in g["qs"]]})
        for g in D["read"]["r51"]:
            a, b = g["range"]; pas = [re.sub(r"[（(]\s*(\d{2})\s*[）)]\s*_*", r"{\1}", p) for p in norm_pas(g["passage"])]
            for n in range(a, b + 1):
                if f"{{{n}}}" not in "".join(pas): probs.append(f"{n}: thiếu chỗ trống")
            items = [tidy(strip_letter(x)) for x in g["items"]]
            units.append({"sec": "R", "part": 2, "head": "第51-60题 选句填空。", "label": f"{a}-{b}", "passage": pas, "ref": {"kind": "txt", "items": [{"k": "ABCDEF"[i], "hz": x} for i, x in enumerate(items[:6])]}, "unique": True, "qs": [{"n": n, "t": "m", "a": ans(n, "ABCDEF")} for n in range(a, b + 1)]})
        for g in D["read"]["r61"]:
            qs = [{"n": x["n"], "t": "c", "s": tidy(x.get("s", "")), "o": opts(x.get("o"), x["n"]), "a": ans(x["n"])} for x in g["qs"]]
            units.append({"sec": "R", "part": 3, "head": "第61-80题 请选出正确答案。", "label": f"{qs[0]['n']}-{qs[-1]['n']}", "passage": norm_pas(g["passage"]), "qs": qs})
        for w in D["write"]["w"]:
            q = {"n": w["n"], "t": "w", "prompt": tidy(w["prompt"]), "min": int(w.get("min") or (150 if w["n"] == 81 else 300))}
            if w.get("ref"): q["ref"] = tidy(w["ref"])
            units.append({"sec": "W", "part": 1 if w["n"] == 81 else 2, "head": "第81-82题 写作。", "label": str(w["n"]), "qs": [q]})
        nq = sum(len(u["qs"]) for u in units)
        if nq != 82: probs.append(f"tổng {nq} câu")
        pid = f"hsk6-0{k}"; au = f"HSK6_3.0_DE_0{k}.mp3"; dst = os.path.join(ROOT, "public/hsk3-exam/audio", au)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst): subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", t["mp3"][0], "-ac", "1", "-b:a", "32k", dst], check=True)
        P = {"id": pid, "level": 6, "name": f"模拟试卷 {k}", "audio": [f"/hsk3-exam/audio/{au}"], "dur": {"R": 40 * 60, "W": 45 * 60}, "units": units, "script": D["listen"].get("script", "")}
        json.dump(P, open(os.path.join(ROOT, "public/hsk-exam/papers", pid + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
        print(pid, "lỗi:", len(probs)); [print("   ", p) for p in probs[:12]]

if __name__ == "__main__":
    ocr() if MODE == "ocr" else build()
