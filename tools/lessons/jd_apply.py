# Gắn phần 精读 (phân tích bài khoá theo khối từ) vào bài giảng HSK4 2.0 dạng slide (window.L)
#  - chèn window.L.jd = {...} và L.wbOff (tắt các trang Sách bài tập) ngay sau khối dữ liệu
#  - vá trình dựng slide: sau "Đọc bài khoá" của mỗi bài khoá và sau trang Văn hoá thêm các trang 精读
# Dùng: python3 jd_apply.py <thư mục bài giảng> <tiền tố jd> [NN ...]
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MARK = "/*JD-V1*/"

CSS = """
/*JD-V1*/
.jd{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;flex:1;min-height:0}
.jd .jl{overflow:auto;padding-right:6px}
.jd .sg{padding:16px 20px;border-radius:14px;margin-bottom:12px;border:2px solid transparent}
.jd .sg .s{font:700 31px/1.8 var(--zh)}
.jd .sg .vn{font:500 19px/1.5 var(--ui);margin-top:4px}
.jd .sg .who{font:700 18px var(--ui);color:var(--ink2);margin-right:6px}
.jd .jk{cursor:pointer;border:3px solid var(--c);border-radius:999px;padding:0 8px;margin:0 2px;position:relative;transition:background .15s}
.jd .jk sup{position:absolute;top:-14px;right:-10px;background:var(--c);color:#fff;font:800 13px/22px var(--ui);min-width:22px;height:22px;border-radius:11px;text-align:center}
.jd .jk.on{background:color-mix(in srgb,var(--c) 18%,#fff)}
.jd .jr{border:2px solid var(--c);border-radius:18px;padding:26px 30px;overflow:auto;display:flex;flex-direction:column;gap:14px;background:#fff}
.jd .jr .t{font:800 44px/1.2 var(--zh)}
.jd .jr .pyl{font:600 20px var(--ui);color:var(--c)}
.jd .jr .mn{font:600 22px var(--ui)}
.jd .fr{background:color-mix(in srgb,var(--c) 10%,#fff);border-left:6px solid var(--c);padding:12px 16px;border-radius:10px;font:800 28px var(--zh)}
.jd .fr small{display:block;font:700 15px var(--ui);color:var(--ink2);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
.jd .nt{font:500 19px/1.55 var(--ui);color:var(--ink2)}
.jd .lb2{font:800 15px var(--ui);color:var(--ink2);letter-spacing:.06em;text-transform:uppercase}
.jd .ex{display:flex;gap:10px;align-items:flex-start;padding:6px 0}
.jd .ex .z{font:700 25px/1.5 var(--zh)}
.jd .ex .vn{font:500 18px var(--ui);display:block}
.jd .ex button{flex:none;width:38px;height:38px;border-radius:50%;border:2px solid var(--rule);display:grid;place-items:center}
.jd .ex button svg{width:18px;height:18px}
.jd .ty{border:2px dashed var(--c);border-radius:12px;padding:12px 16px;font:600 20px/1.5 var(--ui)}
.jd .ty b{color:var(--c)}
.jd .none{font:500 20px var(--ui);color:var(--ink2);margin:auto 0}
"""

JS = r"""
/*JD-V1*/function jdSlides(st,col,key,title,lineWho){var J=L.jd&&L.jd[key];if(!J||!J.length)return;
var groups=[],g=[],len=0,nk=0;J.forEach(function(s){var c=(s.ch||[]).length;if(g.length&&(len+s.s.length>85||nk+c>3)){groups.push(g);g=[];len=0;nk=0;}g.push(s);len+=s.s.length;nk+=c;});if(g.length)groups.push(g);
function esc2(x){return String(x||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
groups.forEach(function(G,gi){var K=[];var lastLine=-1;
 var left=G.map(function(s){var h=esc2(s.s);var cs=(s.ch||[]).slice().sort(function(a,b){return b.t.length-a.t.length;});var used=[];
  cs.forEach(function(c){var i=s.s.indexOf(c.t);while(i>=0&&used.some(function(u){return i<u[1]&&i+c.t.length>u[0];}))i=s.s.indexOf(c.t,i+1);if(i>=0){used.push([i,i+c.t.length,c]);}});
  used.sort(function(a,b){return a[0]-b[0];});var out='',p=0;used.forEach(function(u){out+=esc2(s.s.slice(p,u[0]))+'<b class="jk" data-k="'+K.length+'">'+esc2(u[2].t)+'<sup>'+(K.length+1)+'</sup></b>';K.push(u[2]);p=u[1];});out+=esc2(s.s.slice(p));
  var who=(lineWho&&s.line!==lastLine&&lineWho(s.line))?'<span class="who">'+lineWho(s.line)+'</span>':'';lastLine=s.line;
  return '<div class="sg"><div class="s zh">'+who+out+'</div><div class="vn">'+esc2(s.vn)+'</div></div>';}).join('');
 add(st,col,head(st,'Phân tích bài khoá · 精读',title,groups.length>1?'Phần '+(gi+1)+'/'+groups.length+' · bấm vào cụm được khoanh để xem khung câu và câu thay thế':'Bấm vào cụm được khoanh để xem khung câu và câu thay thế')+
  '<div class="body"><div class="jd"><div class="jl">'+left+'</div><div class="jr">'+(K.length?'':'<div class="none">Đoạn này câu đơn giản, đọc to và dịch nhanh rồi qua phần sau.</div>')+'</div></div></div>','',function(el){
  var R=el.querySelector('.jr');function show(k){var c=K[k];if(!c)return;el.querySelectorAll('.jk').forEach(function(x){x.classList.toggle('on',+x.dataset.k===k);});
   R.innerHTML='<div><div class="t zh">'+esc2(c.t)+'</div><div class="pyl py">'+esc2(c.py)+'</div><div class="mn">'+esc2(c.vn)+'</div></div>'+
   (c.frame?'<div class="fr"><small>Khung câu · 句式</small>'+esc2(c.frame)+'</div>':'')+(c.note?'<div class="nt">'+esc2(c.note)+'</div>':'')+
   '<div><div class="lb2">Thay thế · 替换</div>'+(c.ex||[]).map(function(e){return '<div class="ex"><button data-say="'+esc2(e[0])+'">'+SPK+'</button><div><span class="z zh">'+esc2(e[0])+'</span><span class="vn">'+esc2(e[1])+'</span></div></div>';}).join('')+'</div>'+
   (c.try?'<div class="ty"><b>Đến lượt em · </b>'+esc2(c.try.replace(/^Nói:\s*/,''))+'</div>':'');}
  el.querySelector('.jl').addEventListener('click',function(e){var b=e.target.closest('.jk');if(b){e.stopPropagation();show(+b.dataset.k);stop();say(K[+b.dataset.k].t);}});
  if(K.length)show(0);});
});}
"""

GEN = [  # vá chung để cùng một khuôn chạy được cả HSK4 2.0 và HSK4 3.0 (không có bài 5, văn hoá, đề thật…)
  ("'HSK标准教程 4 · HSK Garden'", None),
  ('<div class="cv-tag">HSK标准教程 4 · HSK Garden</div>', '<div class="cv-tag">\'+(L.tag||\'HSK标准教程 4 · HSK Garden\')+\'</div>'),
  ("L.exam.code+'</b>đề thật</span></div></div>'", "(L.exam?L.exam.code:'—')+'</b>'+(L.exam&&L.exam.label||'đề thật')+'</span></div></div>'"),
  ("function rail(here){", "function stOn(i){if(i>=1&&i<=5)return !!L.texts[i-1];if(i===6)return !!L.culture;if(i===8)return !!L.kz;if(i===9)return !!L.exam;if(i===10)return !!(L.yy&&L.yy.length);return true;}\nfunction rail(here){"),
  ("+ST.map(function(s,i){\n    return '<li class=\"'+(i===here", "+ST.map(function(s,i){if(!stOn(i))return '';\n    return '<li class=\"'+(i===here"),
  ("if(t.n===4)add(4,'--l4','<div class=\"div2\">", "if(t.n===SPLIT)add(SPLIT,'--l'+SPLIT,'<div class=\"div2\">"),
  ("<p>Bài khoá 4 · Bài khoá 5 · Văn hoá · Luyện tập · Vận dụng</p>", "<p>'+(L.s2txt||'Bài khoá 4 · Bài khoá 5 · Văn hoá · Luyện tập · Vận dụng')+'</p>"),
  ("Gọi 2–3 bạn nộp video tóm tắt bài khoá 1–3 nói lại trước lớp.", "'+(L.s2warm||'Gọi 2–3 bạn nộp video tóm tắt bài khoá 1–3 nói lại trước lớp.')+'"),
  ("if(t.n===4){var P1=[],E1=[]", "if(t.n===SPLIT){var P1=[],E1=[]"),
  ("x.n<=3", "x.n<SPLIT"),
  ("addReview(P1,E1,'课文一～三',4,'--l4','Kiểm tra bài cũ')", "addReview(P1,E1,L.s1range||'课文一～三',SPLIT,'--l'+SPLIT,'Kiểm tra bài cũ')"),
  ("if(t.n===3){var F=L.fushu;", "if(t.n===SPLIT-1&&L.fushu){var F=L.fushu;"),
  ("(function(){var C=L.culture;", "(function(){var C=L.culture;if(!C)return;"),
  ("(function(){var X=L.exam;", "(function(){var X=L.exam;if(!X)return;"),
  ("(function(){var X=L.lianxi,W=L.wb,AB='ABCDE';", "(function(){var X=L.lianxi||{groups:[]},W=L.wb,AB='ABCDE';"),
  ("'Đề thật '+X.code", "(X.title||'Đề thật '+X.code)"),
  ("add(st,col,head(st,'Kiểm tra hiểu bài','判断对错')+'<div class=\"body\"><div class=\"tfl\">'+t.tf.map(",
   "if(t.mc)add(st,col,head(st,'Kiểm tra hiểu bài','阅读理解 · chọn đáp án đúng')+'<div class=\"body\"><div class=\"mcl\">'+t.mc.map(function(q,i){return '<div class=\"mc1\" data-a=\"'+q[2]+'\"><div class=\"mcq zh\"><span class=\"k\">'+(i+1)+'</span>'+q[0]+'</div><div class=\"mco\">'+q[1].map(function(o,j){return '<button class=\"zh\" data-j=\"'+j+'\"><b>'+'ABCD'[j]+'</b>'+o+'</button>';}).join('')+'</div></div>';}).join('')+'</div></div>','',function(el){el.querySelectorAll('.mc1').forEach(function(r){r.addEventListener('click',function(e){var b=e.target.closest('button');if(!b||r.dataset.done)return;r.dataset.done=1;var a=+r.dataset.a;r.querySelectorAll('button').forEach(function(x){if(+x.dataset.j===a)x.classList.add('ok');else if(x===b)x.classList.add('no');});});});});\n  if(t.tf)add(st,col,head(st,'Kiểm tra hiểu bài','判断对错')+'<div class=\"body\"><div class=\"tfl\">'+t.tf.map("),
  ("jdSlides(6,'--cu','cu','文化 · '+L.culture.title);", "if(L.culture)jdSlides(6,'--cu','cu','文化 · '+L.culture.title);"),
  ("var GRAD=", "var SPLIT=L.split||4;\nvar GRAD="),
  ("var t=i>=1&&i<=5?L.texts[i-1]:null;", "if(!stOn(i))return '';var t=i>=1&&i<=5?L.texts[i-1]:null;"),
]
GCSS = """
/*GEN-V1*/
.mcl{display:flex;flex-direction:column;gap:22px}
.mc1 .mcq{font:700 28px/1.5 var(--zh);display:flex;gap:12px;align-items:baseline}
.mc1 .mcq .k{font:800 18px var(--ui);background:var(--c);color:#fff;border-radius:50%;min-width:30px;height:30px;display:inline-grid;place-items:center}
.mc1 .mco{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0 0 42px}
.mc1 .mco button{border:2px solid var(--rule);border-radius:12px;padding:10px 14px;font:600 22px var(--zh);text-align:left;display:flex;gap:10px;align-items:center}
.mc1 .mco button b{font:800 16px var(--ui);color:var(--ink2)}
.mc1 .mco button.ok{border-color:#2e9e5b;background:#e6f6ec}
.mc1 .mco button.no{border-color:#c0392b;background:#fbeaea}
"""

def patch_generic(s):
    if "/*GEN-V1*/" in s: return s
    for a, b in GEN:
        if b is None: continue
        if a not in s: raise SystemExit("không tìm thấy chỗ vá: " + a[:80])
        s = s.replace(a, b)
    i = s.index("</style>")
    return s[:i] + GCSS + s[i:]

def patch_renderer(s):
    if MARK in s: return patch_generic(s)
    # CSS
    i = s.index("</style>")
    s = s[:i] + CSS + s[i:]
    # hàm dựng 精读: đặt ngay trước "// bài khoá"
    a = s.index("// bài khoá")
    s = s[:a] + JS + s[a:]
    # sau trang đọc (trước // đúng sai) của từng bài khoá
    b = s.index("  // đúng sai")
    s = s[:b] + "  jdSlides(st,col,String(t.n),t.scene,function(i){var l=t.lines[i];return l&&l[0]?l[0]+'：':'';});\n" + s[b:]
    # sau trang Văn hoá: chèn trước '// Luyện tập'
    c = s.index("// Luyện tập (sách bài học + sách bài tập)")
    s = s[:c] + "jdSlides(6,'--cu','cu','文化 · '+L.culture.title);\n" + s[:0] + s[c:]
    # tắt Sách bài tập
    d = s.index("  // Sách bài tập · Nghe 1")
    s = s[:d] + "  if(L.wbOff)return;\n" + s[d:]
    return patch_generic(s)

def clean_jd(jd):
    """Sửa nhẹ dữ liệu 精读: khối từ cách quãng (尽管……但是) → khoanh phần đầu có trong câu; bỏ câu ví dụ lẫn chữ Latin."""
    for segs in jd.values():
        for g in segs:
            keep = []
            for c in g.get("ch", []):
                if c["t"] not in g["s"]:
                    parts = [x for x in re.split(r"……|…|——|／|/", c["t"]) if x.strip("，。、 ")]
                    hit = next((x.strip("，。、 ") for x in parts if x.strip("，。、 ") and x.strip("，。、 ") in g["s"]), None)
                    if not hit: continue
                    c["frame"] = c.get("frame") or c["t"]
                    c["t"] = hit
                c["ex"] = [e for e in c.get("ex", []) if not re.search(r"[A-Za-z]", re.sub(r"HSK|App|APP|WiFi|KTV|VIP", "", e[0]))] or c.get("ex", [])[:0]
                keep.append(c)
            g["ch"] = keep
    return jd

def inject_data(s, jd):
    jd = clean_jd(jd)
    s = re.sub(r"<script>/\*JD-DATA\*/.*?</script>\n?", "", s, flags=re.S)
    m = re.search(r"window\.L\s*=", s)
    end = s.index("</script>", m.start()) + len("</script>")
    blob = "<script>/*JD-DATA*/window.L.jd=" + json.dumps(jd, ensure_ascii=False) + ";window.L.wbOff=true;</script>\n"
    return s[:end] + "\n" + blob + s[end:]

if __name__ == "__main__":
    folder, prefix = sys.argv[1], sys.argv[2]
    nums = sys.argv[3:] or [f[7:9] for f in sorted(os.listdir(folder)) if re.match(r"LESSON_\d\d\.html$", f)]
    for nn in nums:
        f = os.path.join(folder, f"LESSON_{nn}.html")
        jf = os.path.join(HERE, "jd", f"{prefix}-{nn}.json")
        if not os.path.exists(jf): print("bỏ qua (chưa có jd)", nn); continue
        s = open(f, encoding="utf-8").read()
        s = inject_data(patch_renderer(s), json.load(open(jf, encoding="utf-8")))
        open(f, "w", encoding="utf-8").write(s)
        print("ok", f)
