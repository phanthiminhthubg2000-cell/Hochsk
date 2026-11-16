# HSK4 3.0 → khuôn slide của HSK4 2.0 (window.L), để dạy theo bài khoá + 精读
# Nguồn: tools/lessons/src/hsk4-3/BNN.json (dữ liệu cũ dạng window.LESSON, đã tách ra)
# Khuôn : public/lectures/hsk4-v2/LESSON_03.html (đã vá jd_apply) — lấy phần HTML/CSS/JS, thay dữ liệu
# Ra    : public/lectures/hsk4-3/LESSON_NN.html + img/lNN_warm.jpg
# Dùng  : python3 hsk4v3_deck.py [NN ...]   (cần tools/lessons/jd/hsk4v3-NN.json nếu muốn có 精读)
import json, os, re, sys
from pypinyin import pinyin, Style
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../.."))
OUT = os.path.join(ROOT, "public/lectures/hsk4-3")
TPL = os.path.join(ROOT, "public/lectures/hsk4-v2/LESSON_03.html")
sys.path.insert(0, HERE)
from jd_apply import inject_data, patch_renderer

POS = {"名": "danh từ", "动": "động từ", "形": "tính từ", "副": "phó từ", "连": "liên từ", "量": "lượng từ", "介": "giới từ", "代": "đại từ",
       "助": "trợ từ", "叹": "thán từ", "数": "số từ", "后缀": "hậu tố"}
CN = "一二三四五六七八九十"
strip = lambda s: re.sub(r"<[^>]+>", "", str(s or "")).strip()
FEM = re.compile(r"女|丽|娜|芳|玲|美|燕|红|梅|静|婷|雪|月|妈|姐|妹|奶|安妮|玛丽|小雨|小夏|琳|雅|莉|兰|萍|霞|婆|太太|小姐|阿姨|欣|悦|佳|晶|颖|露|丹|妮|莎|蕾|薇")

def pos_vn(p):
    return " / ".join(POS.get(x, x) for x in p.split("／") if x) if p else ""

def py_of(s):
    syl = [x[0] for x in pinyin(s, style=Style.TONE)]
    t3 = [x[0] for x in pinyin(s, style=Style.TONE3)]
    for i, ch in enumerate(s):  # biến điệu 一 / 不
        nxt = t3[i + 1][-1] if i + 1 < len(t3) and t3[i + 1][-1:].isdigit() else ""
        if ch == "一" and nxt: syl[i] = "yí" if nxt == "4" else "yì"
        if ch == "不" and nxt == "4": syl[i] = "bú"
    return " ".join(syl).replace(" ，", "，")

def split_line(p):
    m = re.match(r"^([^：:，。？！“”]{1,8})[：:](.+)$", p)
    return (m.group(1), m.group(2)) if m else ("", p)

def warm_collage(nn, items):
    ims = []
    for path, _ in items:
        try: ims.append(Image.open(os.path.join(OUT, path)).convert("RGB"))
        except Exception: ims.append(Image.new("RGB", (400, 300), "#eee"))
    cols = 3 if len(ims) > 4 else 2
    rows = (len(ims) + cols - 1) // cols
    W, H, G = 420, 315, 14
    can = Image.new("RGB", (cols * W + (cols + 1) * G, rows * H + (rows + 1) * G), "white")
    d = ImageDraw.Draw(can)
    try: f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
    except Exception: f = ImageFont.load_default()
    for k, im in enumerate(ims):
        im.thumbnail((W, H))
        x, y = G + (k % cols) * (W + G), G + (k // cols) * (H + G)
        can.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
        d.rounded_rectangle([x + 8, y + 8, x + 58, y + 58], 10, fill="#1F2A44")
        d.text((x + 33, y + 33), "ABCDEFGH"[k], font=f, fill="white", anchor="mm")
    rel = f"img/l{nn}_warm.jpg"
    can.save(os.path.join(OUT, rel), quality=82)
    return rel

def grammar_card(g):
    rules = []
    for i, f in enumerate(g.get("forms") or []):
        ex = (g.get("ex") or [[g.get("text", "")]])
        rules.append([strip(f), strip((ex[i] if i < len(ex) else ex[0])[0])])
    if g.get("text") and not rules: rules.append(["", strip(g["text"])])
    return {"title": strip(g.get("title") or g.get("word")), "use": g.get("vn", ""), "rules": rules,
            "check": [[strip(e[1]), strip(e[0]), strip(e[2])] for e in (g.get("err") or []) if len(e) >= 3],
            "prac": [[strip(b[0]).replace("________________", "________"), "", strip(b[2])] for b in (g.get("book") or []) if len(b) >= 3]}

def diff_of(b):
    head = b.get("head") or []
    rows = []
    for j, w in enumerate(head[1:]):
        parts = [strip(r[j + 1]) for r in b.get("rows", []) if r[0] != "共同点" and j + 1 < len(r) and r[j + 1]]
        rows.append([w, "；".join(parts)])
    same = next((strip(r[1]) for r in b.get("rows", []) if r[0] == "共同点"), "")
    return {"title": strip(b.get("pair", "")).replace(" — ", " · "), "rows": ([["Giống", same]] if same else []) + rows}

def build(nn, B, Bprev):
    M = B["META"]
    TX = B["TEXT"]
    texts = []
    for i, t in enumerate(TX):
        dialog = "对话" in (t.get("sub") or "")
        lines = []
        for p in t["paras"]:
            who, s = split_line(strip(p)) if dialog else ("", strip(p))
            lines.append([who, ("f" if FEM.search(who) else "m") if who else "n", s])
        texts.append({"n": i + 1, "kind": "对话" if dialog else "短文", "scene": strip(t.get("title")), "scenevn": strip(t.get("scene_vn")) or strip(t.get("scene")) or strip(t.get("sub")),
                      "audio": t.get("audio"), "qs": [[strip(q[0]), ""] for q in t.get("qs", [])][:3],
                      "mc": [[strip(q[0]), [strip(o) for o in q[1]], q[2]] for q in t.get("qs", []) if isinstance(q[1], list)],
                      "lines": lines, "words": []})
    full = ["".join(l[2] for l in t["lines"]) for t in texts]
    wp = {}
    for p in B.get("WPAT") or []:
        key = re.split(r"[……／，（ ]", p["w"])[0]
        wp.setdefault(key, []).append(p)
    gr = {g["word"]: g for g in B.get("GRAMMAR") or []}
    bx = {}
    for b in B.get("BIANXI") or []:
        for w in (b.get("head") or [])[1:]: bx.setdefault(w, b)
    seen = set()
    for v in B["V"]:
        z = v[0]
        ins = split_line(strip(v[6]))[1] if v[6] else ""
        ti = next((i for i, f in enumerate(full) if ins and ins[:12] in f), None)
        if ti is None: ti = next((i for i, f in enumerate(full) if z in f), len(texts) - 1)
        w = {"z": z, "py": v[1], "pos": pos_vn(v[2]), "vn": v[3], "ex": [x for x in [ins, strip(v[7])] if x], "colloc": v[9] or []}
        if v[10]: w["extra"] = strip(v[10])
        if z in gr: w["grammar"] = grammar_card(gr[z]); seen.add(z)
        if z in bx and bx[z].get("pair") not in seen: w["diff"] = diff_of(bx[z]); seen.add(bx[z].get("pair"))
        if z in wp: w["write"] = [[strip(p["frames"][0]), strip(p.get("use")), strip(p["ex"][0][0])] for p in wp[z]]
        texts[ti]["words"].append(w)
    for k, g in gr.items():  # điểm ngữ pháp không trùng từ nào → thẻ riêng
        if k in seen: continue
        ti = next((i for i, f in enumerate(full) if strip(g.get("text"))[:10] in f), 0)
        texts[ti]["words"].append({"z": k, "py": strip(g.get("py")), "pos": "ngữ pháp", "vn": strip(re.sub(r"<[^>]+>", "", g.get("vn", "")))[:80], "ex": [strip(g.get("text"))] + [strip(e[0]) for e in (g.get("ex") or [])][:2],
                                   "colloc": [], "gram": True, "grammar": grammar_card(g)})
    # khởi động
    W0 = (B.get("WARM") or [{}])[0]
    warm = {"title": W0.get("title", "Khởi động"), "sub": "Chọn hình tương ứng với từ ngữ bên dưới"}
    if W0.get("type") == "pics":
        warm["pic"] = warm_collage(nn, W0["items"])
        ans = {it[1].split(" ")[0]: "ABCDEFGH"[k] for k, it in enumerate(W0["items"])}
        warm["items"] = [[o.split(" ")[1], " ".join(o.split(" ")[2:]), ans.get(o.split(" ")[0], "")] for o in W0["opts"]]
        qs = W0.get("qs") or []
        if qs:
            warm["q"], warm["qvn"] = strip(qs[0][0]), strip(qs[0][1])
            if len(qs) > 1: warm["qlist"] = [strip(q[0]) + "<span class='vn'>" + strip(q[1]) + "</span>" for q in qs[1:]]
    # luyện tập sách
    groups = []
    for g in (B.get("PRACTICE") or {}).get("ex1", [])[:2]:
        groups.append({"opts": g["bank"], "items": [[strip(it[0]).replace("{}", "____"), it[1][0]] for it in g["items"]]})
    # đề luyện HSK 3.0
    H = B.get("HSK") or {}
    listen = []
    for q in H.get("l", []):
        ls = [list(split_line(x)) for x in q["d"].split("|")]
        listen.append({"n": q["n"], "kind": "chọn", "lines": ls, "q": strip(q["q"]), "o": q["o"], "a": q["a"], "link": strip(q.get("why"))})
    read = []
    for blk in H.get("r3", []):
        for q in blk["qs"]:
            read.append({"n": q["n"], "text": "\n".join(blk["text"]), "q": strip(q["s"]), "o": q["o"], "a": q["a"], "link": strip(q.get("why"))})
    write = [{"n": (H.get("w") or {}).get("start", 1) + i, "parts": o.split("|"), "ans": [o.replace("|", "") + ("" if o.endswith(("。", "？", "！")) else "。")], "link": ""}
             for i, o in enumerate((H.get("w") or {}).get("order", []))]
    exam = {"code": "HSK4 3.0", "label": "đề luyện", "title": "Đề luyện HSK4 (3.0)", "listen": listen, "read": read, "write": write} if (listen or read) else None
    A, SP, WR = B.get("APPLY") or {}, B.get("SPEAK") or {}, B.get("WRITE") or {}
    yy = []
    if A.get("qs"):
        yy.append({"kind": "list", "vn": "Hoạt động nhóm", "zh": strip(A.get("theme")), "letters": False, "task": strip(A.get("topic")), "taskvn": strip(A.get("topic_vn")),
                   "items": [strip(q[0]) for q in A["qs"]]})
    if SP.get("qs"):
        yy.append({"kind": "list", "vn": "Luyện nói", "zh": strip(SP.get("topic")), "letters": False, "task": strip(SP.get("topic")), "taskvn": strip(SP.get("topic_vn")),
                   "items": [strip(q[0]) + "<span class='vn'>" + strip(q[1]) + "</span>" for q in SP["qs"]]})
    hw = [{"s": "Buổi 1", "zh": "第一次课", "range": "课文一 ～ 课文二", "col": "--l1", "tasks": [
              {"t": "Đọc và dịch 2 bài khoá", "kind": "Video đọc", "req": ["Đọc to 课文一 và 课文二, đọc xong mỗi câu thì dịch sang tiếng Việt", "Dùng lại ít nhất 3 khung câu ở trang 精读 để tự đặt câu mới"]}]},
          {"s": "Buổi 2", "zh": "第二次课", "range": "课文三 · 课文四 · 运用", "col": "--l3", "tasks": [
              t for t in [
                  {"t": "Luyện nói · " + strip(SP.get("short") or SP.get("topic")), "kind": "Video nói", "req": [strip(SP.get("req"))] + [strip(x) for x in SP.get("check", [])]} if SP else None,
                  {"t": "Viết · " + strip(WR.get("topic")), "kind": "Viết", "req": [strip(WR.get("topic_vn"))]} if WR else None] if t]}]
    nw = sum(1 for t in texts for w in t["words"] if not w.get("gram"))
    goals = [["Chủ đề", strip(M.get("tagline"))], ["Từ vựng", f"{nw} từ HSK4 (3.0)."],
             ["Ngữ pháp", "Học ngay trong thẻ từ: " + " · ".join(gr.keys())], ["Bài khoá", "4 bài khoá · mỗi bài có trang 精读: khoanh khối từ, khung câu, câu thay thế."],
             ["Vận dụng", strip(A.get("theme")) or "Hoạt động nhóm"]]
    L = {"num": int(nn), "zh": M["title"], "py": py_of(M["title"]), "vn": M.get("vn", ""), "topic": strip(M.get("tagline")), "tag": "新HSK教程 4 · HSK4 (3.0)",
         "goals": goals, "warm": warm, "texts": texts, "lianxi": {"groups": groups} if groups else None, "exam": exam, "yy": yy, "hw": hw,
         "wbOff": True, "split": 3, "s1range": "课文一～二", "s2txt": "Bài khoá 3 · Bài khoá 4 · Luyện tập · Vận dụng", "s2warm": "Gọi 2–3 bạn đọc và dịch lại bài khoá 1–2, đặt câu với khung câu đã học."}
    if Bprev:
        L["prev"] = {"num": Bprev["META"]["num"], "zh": Bprev["META"]["title"], "words": [{"z": v[0], "py": v[1], "vn": v[3]} for v in Bprev["V"]],
                     "errs": [[strip(e[1]), strip(e[0]), strip(e[2])] for g in Bprev.get("GRAMMAR", []) for e in (g.get("err") or []) if len(e) >= 3]}
    return L

def render(L, jd):
    s = patch_renderer(open(TPL, encoding="utf-8").read())
    s = re.sub(r"<script>/\*JD-DATA\*/.*?</script>\n?", "", s, flags=re.S)
    m = re.search(r"<script>window\.L\s*=", s)
    end = s.index("</script>", m.start()) + len("</script>")
    s = s[:m.start()] + "<script>window.L = " + json.dumps(L, ensure_ascii=False) + ";</script>" + s[end:]
    s = re.sub(r"<title>.*?</title>", f"<title>HSK4 3.0 · Bài {L['num']} · {L['zh']}</title>", s, count=1)
    if jd: s = inject_data(s, jd)
    return s

if __name__ == "__main__":
    nums = sys.argv[1:] or [f"{n:02d}" for n in range(1, 21)]
    src = lambda n: os.path.join(HERE, "src/hsk4-3", f"B{n}.json")
    for nn in nums:
        B = json.load(open(src(nn), encoding="utf-8"))
        pn = f"{int(nn) - 1:02d}"
        Bp = json.load(open(src(pn), encoding="utf-8")) if os.path.exists(src(pn)) else None
        L = build(nn, B, Bp)
        jf = os.path.join(HERE, "jd", f"hsk4v3-{nn}.json")
        jd = json.load(open(jf, encoding="utf-8")) if os.path.exists(jf) else None
        open(os.path.join(OUT, f"LESSON_{nn}.html"), "w", encoding="utf-8").write(render(L, jd))
        print("ok", nn, "jd" if jd else "(chưa có 精读)", [len(t["words"]) for t in L["texts"]])
