import os,json,re,time,concurrent.futures as cf
from google import genai
from google.genai import types
c=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
A=json.load(open("qa_raw.json"))
out=json.load(open("qa_vn.json")) if os.path.exists("qa_vn.json") else {}
P="""Dịch sang tiếng Việt tự nhiên (dành cho học viên người Việt học HSKK). Trả JSON:
{{"sample_vn":"bản dịch bài nói (giữ xuống dòng \\n giữa các đoạn như bản gốc)","outline_vn":["dịch từng ý dàn ý, ngắn gọn"],"keys_vn":{{"cụm":"nghĩa tiếng Việt ngắn trong ngữ cảnh"}}}}
DÀN Ý: {o}
CÁC CỤM CẦN DỊCH: {k}
BÀI NÓI:
{s}
Chỉ trả JSON."""
def go(it):
    keys=re.findall(r"【(.+?)】",it["sample"]); s=re.sub(r"[【】]","",it["sample"])
    for i in range(8):
        m=["gemini-3.8-flash","gemini-3.5-flash-lite"][i%2]
        try:
            r=c.models.generate_content(model=m,contents=P.format(o=json.dumps(it["outline"],ensure_ascii=False),k=json.dumps(keys,ensure_ascii=False),s=s),config=types.GenerateContentConfig(response_mime_type="application/json",temperature=0.2))
            d=json.loads(r.text); d=d[0] if isinstance(d,list) else d
            assert len(d["outline_vn"])==len(it["outline"]); d["_m"]=m; return str(it["id"]),d
        except Exception as e: time.sleep(4)
    return str(it["id"]),None
with cf.ThreadPoolExecutor(8) as ex:
    for k,d in ex.map(go,[a for a in A if str(a["id"]) not in out]):
        if d: out[k]=d
json.dump(out,open("qa_vn.json","w"),ensure_ascii=False,indent=0)
print(len(out), {m:sum(1 for v in out.values() if v["_m"]==m) for m in set(v["_m"] for v in out.values())})
