// Danh sách gọn của kho bài giảng / kho đề (bỏ trường htmlContent nặng) — trang chủ tải cái này thay vì cả collection.
//  GET /api/bank?col=lectures_bank            → [{ id, ...fields, hasHtml }]
//  GET /api/bank?col=lectures_bank&id=X&html=1 → trang HTML của bài (htmlContent) để mở trong iframe
// Đọc qua Firestore REST (quy tắc cho phép đọc công khai), cache ở CDN vài phút.
import { NextResponse } from "next/server";

const P = "hanh-trinh-hsk", KEY = "AIzaSyAFU1Dicvso2qqyP20V91dvZ0EK9btvTKA";
const BASE = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const COLS = new Set(["lectures_bank", "hsk3_exams_bank"]);

const val = (v) => {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return { __ts: Date.parse(v.timestampValue) };
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(val);
  if ("mapValue" in v) return obj(v.mapValue.fields || {});
  return null;
};
const obj = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)]));

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const col = sp.get("col");
  if (!COLS.has(col)) return NextResponse.json({ error: "col?" }, { status: 400 });
  const id = sp.get("id");
  if (id) {
    const r = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}?key=${KEY}&mask.fieldPaths=htmlContent`, { cache: "no-store" });
    const d = r.ok ? await r.json() : null;
    const html = d?.fields?.htmlContent?.stringValue || "<!doctype html><meta charset=utf-8><p style='font-family:sans-serif;padding:40px'>Không tải được nội dung.</p>";
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } });
  }
  const out = []; let page = "";
  try {
    for (let i = 0; i < 20; i++) {
      const r = await fetch(`${BASE}/${col}?key=${KEY}&pageSize=300${page ? `&pageToken=${page}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error("firestore " + r.status);
      const d = await r.json();
      for (const doc of d.documents || []) {
        const f = doc.fields || {}; const hasHtml = !!f.htmlContent?.stringValue; delete f.htmlContent;
        out.push({ id: doc.name.split("/").pop(), ...obj(f), hasHtml });
      }
      if (!d.nextPageToken) break; page = encodeURIComponent(d.nextPageToken);
    }
  } catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 502 }); }
  return NextResponse.json(out, { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=86400" } });
}
