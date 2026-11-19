# -*- coding: utf-8 -*-
"""JSON do ocr_hsk6.py đọc ra → đề HSK6 2.0 cho Phòng thi HSK 2.0
  python3 tools/exam/hsk6_ocr_to_paper.py <pages.json> <thư mục OCR> [số đề ...]
pages.json cần thêm: "id" (tiền tố mã đề), "name", "audio" (thư mục, tệp 01.mp3…), tuỳ chọn "codes":{"1":"H61327"}"""
import json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "hsk2-exam")
CJK = r"[一-鿿，。、：；！？“”（）《》—…]"

def tidy(x):
    if isinstance(x, list): return [tidy(i) for i in x]
    if not isinstance(x, str): return x
    x = re.sub(r"(?<=%s)[ \t\n\r]+(?=%s)" % (CJK, CJK), "", x)
    return x.strip()
def strip_letter(o):
    o = o if isinstance(o, str) else ""
    return re.sub(r"^\s*[A-F]\s*[．.、]?\s*", "", o).strip()
def opts(o, probs, n):
    o = [tidy(strip_letter(x)) for x in (o or [])]
    if len(o) != 4 or not all(o) or any(re.fullmatch(r"[.…。]+", x) for x in o): probs.append(f"{n}: phương án {o}")
    return (o + [""] * 4)[:4]

def N(x):
    try: return int(x["n"]) if isinstance(x, dict) else None
    except Exception: return None
def dmap(lst): return {N(x): x for x in (lst or []) if N(x)}
def load(src, book, k, part):
    f = os.path.join(src, f"{book}{int(k):02d}.{part}.json")
    return json.load(open(f, encoding="utf-8")) if os.path.exists(f) else {}

def build(cfg, src, k):
    book = cfg["book"]; probs = []
    D = {p: load(src, book, k, p) for p in ("listen", "read1", "read2", "write", "ans")}
    for sub, key in (("read2a", "r71"), ("read2b", "r81")):
        x = load(src, book, k, sub)
        if x.get(key): D["read2"] = {**D["read2"], key: x[key] if isinstance(x[key], list) else [x[key]]}
    hs = [load(src, book, k, f"h{a}") for a in (71, 76)]
    if all(h.get("items") for h in hs): D["read2"] = {**D["read2"], "r71": hs}
    gs = [load(src, book, k, f"g{a}") for a in (81, 85, 89, 93, 97)]
    if all(g.get("qs") for g in gs): D["read2"] = {**D["read2"], "r81": gs}
    D["read2"]["r81"] = [g for g in (D["read2"].get("r81") or []) if isinstance(g, dict) and (g.get("range") or [81])[0] >= 81]
    for p, v in D.items():
        if not v: probs.append(f"thiếu phần {p}")
    A = {str(n): str(v).strip().upper()[:1] for n, v in (D["ans"].get("answers") or {}).items()}
    def ans(n, let="ABCD"):
        v = A.get(str(n), "")
        if v not in let: probs.append(f"{n}: đáp án '{v}'")
        return v
    code = (cfg.get("codes") or {}).get(str(k))
    pid = code.lower() if code else f"{cfg['id']}-{int(k):02d}"
    units = []
    # ---------- nghe ----------
    L = dmap(D["listen"].get("L"))
    def lq(n): return {"n": n, "t": "c", "o": opts(L.get(n, {}).get("o"), probs, n), "a": ans(n)}
    for a in (1, 6, 11):
        units.append({"sec": "L", "part": 1, "label": f"{a}-{a + 4}", "head": "第1-15题：请选出与所听内容一致的一项。", "qs": [lq(n) for n in range(a, a + 5)]})
    for a in (16, 21, 26):
        units.append({"sec": "L", "part": 2, "label": f"{a}-{a + 4}", "head": "第16-30题：请选出正确答案。", "qs": [lq(n) for n in range(a, a + 5)]})
    G = [g for g in (D["listen"].get("groups") or []) if isinstance(g, list) and len(g) == 2 and 31 <= g[0] <= g[1] <= 50]
    G = sorted(G); ok = G and G[0][0] == 31 and G[-1][1] == 50 and all(G[i][1] + 1 == G[i + 1][0] for i in range(len(G) - 1))
    if not ok: G = [[a, min(a + 3, 50)] for a in range(31, 51, 4)]
    for a, b in G:
        units.append({"sec": "L", "part": 3, "label": f"{a}-{b}", "head": "第31-50题：请选出正确答案。", "qs": [lq(n) for n in range(a, b + 1)]})
    # ---------- đọc ----------
    R = dmap(D["read1"].get("r51"))
    for a in (51, 56):
        units.append({"sec": "R", "part": 1, "label": f"{a}-{a + 4}", "head": "第51-60题：请选出有语病的一项。", "qs": [{"n": n, "t": "c", "o": opts(R.get(n, {}).get("o"), probs, n), "a": ans(n)} for n in range(a, a + 5)]})
    R = dmap(D["read1"].get("r61"))
    for a in (61, 66):
        qs = []
        for n in range(a, a + 5):
            x = R.get(n, {}); p = tidy(x.get("p", ""))
            p = re.sub(r"_*\s*(\d)\s*_+|_{2,}\s*(\d)\s*_*", lambda m: f"__{m.group(1) or m.group(2)}__", p)
            if not p: probs.append(f"{n}: thiếu đoạn văn")
            o = ["\u3000".join(strip_letter(y).split()) for y in (x.get("o") or [])]
            qs.append({"n": n, "t": "c", "p": p, "o": opts(o, probs, n), "a": ans(n)})
        units.append({"sec": "R", "part": 2, "label": f"{a}-{a + 4}", "head": "第61-70题：选词填空。", "qs": qs})
    for g in [g for g in (D["read2"].get("r71") or []) if isinstance(g, dict)]:
        try: a, b = [int(v) for v in g.get("range", [0, 0])]
        except Exception: probs.append("71: range"); continue
        items = [tidy(strip_letter(x)) for x in g.get("items", [])]
        if len(items) != 5: probs.append(f"{a}: {len(items)} câu lựa chọn")
        pas = []
        for t in (g.get("passage") or []):
            t = tidy(re.sub(r"[（(]\s*(\d{2})\s*[）)]\s*_*", r"{\1}", t if isinstance(t, str) else ""))
            if pas and (re.match(r"[，。；：、？！）”…]", t) or re.search(r"\{\d+\}$", pas[-1])): pas[-1] += t
            elif t: pas.append(t)
        for n in range(a, b + 1):
            if f"{{{n}}}" not in "".join(pas): probs.append(f"{n}: không thấy chỗ trống trong đoạn văn")
        units.append({"sec": "R", "part": 3, "label": f"{a}-{b}", "head": "第71-80题：选句填空。", "passage": pas, "ref": {"kind": "txt", "items": [{"k": "ABCDE"[i], "hz": t} for i, t in enumerate(items[:5])]}, "unique": True,
                      "qs": [{"n": n, "t": "m", "a": ans(n, "ABCDE")} for n in range(a, b + 1)]})
    seen = set()
    for g in [g for g in (D["read2"].get("r81") or []) if isinstance(g, dict)]:
        qs = []
        for x in g.get("qs", []):
            n = N(x)
            if not n: continue
            seen.add(n)
            qs.append({"n": n, "t": "c", "s": tidy(x.get("s", "")), "o": opts(x.get("o"), probs, n), "a": ans(n)})
        if qs: units.append({"sec": "R", "part": 4, "label": f"{qs[0]['n']}-{qs[-1]['n']}", "head": "第81-100题：请选出正确答案。", "passage": [p for p in tidy(g.get("passage") or []) if isinstance(p, str)], "qs": qs})
    for n in range(81, 101):
        if n not in seen: probs.append(f"{n}: thiếu")
    # ---------- viết ----------
    W = D["write"].get("w101") or {}
    rd = [p for p in tidy(W.get("read") or []) if p]
    if sum(len(p) for p in rd) < 500: probs.append(f"101: bài đọc ngắn ({sum(len(p) for p in rd)} chữ)")
    q = {"n": 101, "t": "w", "read": rd, "readSec": 600, "min": 300,
         "prompt": "仔细阅读下面这篇文章，时间为10分钟。阅读时不能抄写、记录。10分钟后，阅读材料将被收回。",
         "prompt2": "请将这篇文章缩写成一篇短文，时间为35分钟。标题自拟。只需复述文章内容，不需加入自己的观点。字数为400字左右。"}
    if W.get("ref"):
        ref = W["ref"]; ref = "\n".join(tidy(ref)) if isinstance(ref, list) else tidy(ref)
        q["ref"] = (str(W.get("title")) + "\n" if W.get("title") else "") + ref
    units.append({"sec": "W", "part": 1, "label": "101", "head": "第101题：缩写。", "qs": [q]})
    nq = sum(len(u["qs"]) for u in units)
    if nq != 101: probs.append(f"tổng {nq} câu")
    P = {"id": pid, "level": 6, "name": f"{cfg['name']}{' ' + code if code else ' · 第' + str(int(k)) + '套'}", "audio": [f"/hsk2-exam/audio/{pid}.mp3"], "dur": {"R": 50 * 60, "W": 45 * 60}, "units": units}
    if D["listen"].get("script"): P["script"] = D["listen"]["script"].strip()
    return P, probs

if __name__ == "__main__":
    cfg = json.load(open(sys.argv[1], encoding="utf-8")); src = sys.argv[2]
    for k in sys.argv[3:] or list(cfg["tests"].keys()):
        P, probs = build(cfg, src, k)
        mp3 = os.path.join(cfg["audio"], f"{int(k):02d}.mp3"); dst = os.path.join(OUT, "audio", P["id"] + ".mp3")
        if os.path.exists(mp3) and not os.path.exists(dst):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-b:a", "32k", dst], check=True)
        if not os.path.exists(dst): P["hidden"] = True; probs.append("chưa có file nghe → ẩn")
        bad = [p for p in probs if not p.startswith("101")]
        if len(bad) > 15: P["hidden"] = True
        print(P["id"], "lỗi:", len(probs))
        for p in probs[:14]: print("   ", p)
        json.dump(P, open(os.path.join(OUT, "papers", P["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
