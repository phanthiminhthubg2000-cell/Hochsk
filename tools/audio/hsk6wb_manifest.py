# Gắn audio gốc Sách bài tập HSK6 vào danh mục giọng đọc (public/audio/tts/manifest.json: lời đọc → file)
# Khoá = lời đọc đã chuẩn hoá (bỏ thẻ HTML, gộp khoảng trắng) — giống strip() của Con đường và say() của bài giảng
import json, os, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
MAN = os.path.join(ROOT, "public/audio/tts/manifest.json")
AUD = os.path.join(ROOT, "public/audio/hsk6wb")
norm = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", str(s or ""))).strip()
man = json.load(open(MAN, encoding="utf-8"))
man = {k: v for k, v in man.items() if not v.startswith(("../hsk6wb/", "../hsk6kw/"))}
TM = json.load(open(os.path.join(ROOT, "public/audio/hsk6kw/timings.json")))
n = 0
for L in range(1, 41):
    f = os.path.join(ROOT, f"public/data/con-duong/hsk6-{L:02d}.json")
    ls = json.load(open(f, encoding="utf-8"))["HSK"]["listen"]
    pairs = [(q.get("say"), f"{L:02d}-q{i+1}.mp3") for i, q in enumerate(ls[0]["qs"])]
    pairs += [(ls[1].get("say"), f"{L:02d}-p2.mp3"), (ls[2].get("say"), f"{L:02d}-p3a.mp3"), (ls[3].get("say"), f"{L:02d}-p3b.mp3")]
    for say, fn in pairs:
        if say and os.path.exists(os.path.join(AUD, fn)):
            man[norm(say)] = "../hsk6wb/" + fn; n += 1
    # bài khoá: mỗi đoạn → audio gốc cả bài, phát đúng khúc (#t=đầu,cuối)
    T = json.load(open(f, encoding="utf-8"))["T"]
    sg = TM.get(f"{L:02d}", {}).get("seg")
    if sg and len(sg) == len(T):
        for t, (a, b) in zip(T, sg):
            man[norm(t["zh"])] = f"../hsk6kw/{L:02d}.mp3#t={a},{b}"; n += 1
json.dump(man, open(MAN, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("gắn", n, "đoạn nghe")
