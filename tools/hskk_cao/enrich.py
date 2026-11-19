import os,json,time,concurrent.futures as cf
from google import genai
from google.genai import types
c=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
R=json.load(open("retell_text.json"))
out=json.load(open("retell_enrich.json")) if os.path.exists("retell_enrich.json") else {}
P="""Bạn là giáo viên luyện thi HSKK 高级 cho người Việt. Đây là đoạn văn của phần 听后复述 (nghe rồi kể lại):
{t}
Trả JSON:
{{"vn":"bản dịch tiếng Việt tự nhiên, đủ ý",
 "points":[{{"zh":"ý chính 1, ngắn gọn bằng tiếng Trung (≤15 chữ), đúng thứ tự trong bài","vn":"nghĩa"}}, … 4-6 ý; ý cuối là câu chốt/ý nghĩa nếu bài có],
 "keys":[{{"zh":"từ/cụm quan trọng cần giữ khi kể lại (có trong bài)","py":"pinyin có dấu","vn":"nghĩa"}}, … 5-7 mục],
 "frame":"khung kể lại gợi ý bằng tiếng Trung có chỗ trống …, ví dụ: 有一天，……。……以后，……。最后……。这个故事告诉我们……",
 "type":"故事 (kể chuyện) hoặc 说理 (nghị luận/giải thích)"}}
Chỉ trả JSON."""
def go(k):
    for i in range(8):
        m=["gemini-3.8-flash","gemini-3.5-flash-lite"][i%2]
        try:
            r=c.models.generate_content(model=m,contents=P.format(t=R[k]),config=types.GenerateContentConfig(response_mime_type="application/json",temperature=0.3))
            d=json.loads(r.text); d=d[0] if isinstance(d,list) else d; d["_m"]=m; return k,d
        except Exception as e: time.sleep(5)
    return k,None
with cf.ThreadPoolExecutor(6) as ex:
    for k,d in ex.map(go,[k for k in R if k not in out]):
        if d: out[k]=d; print(k,d["_m"])
json.dump(out,open("retell_enrich.json","w"),ensure_ascii=False,indent=1)
