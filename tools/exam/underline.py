# Tìm cụm chữ có gạch chân trong PDF (dùng cho câu hỏi "画线词语/句子")
import pdfplumber, re, sys
def underlined(pdf):
    out = []
    with pdfplumber.open(pdf) as P:
        for pg in P.pages:
            segs = [(l["x0"], l["x1"], l["top"]) for l in pg.lines if abs(l["top"] - l["bottom"]) < 1.5 and l["x1"] - l["x0"] > 8]
            segs += [(r["x0"], r["x1"], r["top"]) for r in pg.rects if r["height"] < 1.6 and r["width"] > 8]
            if not segs: continue
            for x0, x1, y in segs:
                cs = [c for c in pg.chars if c["x0"] >= x0 - 1 and c["x1"] <= x1 + 1 and -1.5 <= y - c["bottom"] <= 5]
                cs.sort(key=lambda c: c["x0"])
                t = "".join(c["text"] for c in cs).strip()
                if len(re.findall(r"[一-鿿]", t)) >= 2: out.append(t)
    return out
if __name__ == "__main__":
    for f in sys.argv[1:]: print(f, underlined(f))
