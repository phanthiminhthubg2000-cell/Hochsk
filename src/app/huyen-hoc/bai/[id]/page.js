// Trang một bài học của 玄门学宫 — dựng sẵn tĩnh cho từng bài
import { LESSONS } from "../../../../lib/hh";
import Lesson from "./Lesson";

export function generateStaticParams() { return LESSONS.map((l) => ({ id: l.id })); }
export async function generateMetadata({ params }) {
  const { id } = await params; const l = LESSONS.find((x) => x.id === id);
  return { title: l ? `${l.zh} · ${l.vi} — 玄门学宫` : "玄门学宫" };
}
export default async function Page({ params }) { const { id } = await params; return <Lesson id={id} />; }
