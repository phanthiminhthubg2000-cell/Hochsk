import json,glob,seg
D=glob.glob("/tmp/claude-0/-home-claude/c1d1be6c-69c3-53e6-9a09-0acc6c18fa4e/scratchpad/hskk/x_ĐỀ_THI_HSKK_CAO_C/*/")[0]
def calc(code):
    d=json.load(open(f"ext_{code}.json")); S=seg.sil(D+f"Copy of {code}.mp3")
    longs=[i for i,(a,b) in enumerate(S) if b-a>=60][:3]; out=[]
    for k,i in enumerate(longs):
        end=S[i][0]
        if S[i][0]-S[i-1][1]<1.5: end=S[i-1][0]
        n=len(d["retell"][k]["text"]); est=n/4.3
        cands=[s for s in S if s[1]<end-5 and s[1]>end-est-25 and s[1]-s[0]>=0.9]
        st=min(cands,key=lambda s:abs((end-s[1])-est)-0.15*(s[1]-s[0]))[1] if cands else end-est
        out.append([round(st-0.15,2),round(end+0.3,2),round(end-st,1),round(est,1)])
    return out
R={}
for c in ["H90000","H91001","H91002","H91003","H91004","H91105","H91106","H91107","H91416"]:
    R[c]=calc(c); print(c,R[c])
json.dump(R,open("segs2.json","w"))
