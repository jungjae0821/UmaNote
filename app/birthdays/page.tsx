import type { Metadata } from "next";
import { charIcon } from "@/lib/art";
import { todayKr } from "@/lib/dates";
import { getCards, getCharacters } from "@/lib/gametora";
import { BirthdaysView, type BdChar } from "./BirthdaysView";

export const metadata: Metadata = { title: "생일달력" };
export const revalidate = 3600;

export default async function BirthdaysPage() {
  const today = todayKr();
  const [characters, cards] = await Promise.all([getCharacters(), getCards()]);
  // 캐릭터마다 한국서버에 가장 먼저 나온 육성 의상을 대표 일러스트로
  const artOf = new Map<number, string>();
  for (const c of cards
    .filter((c) => c.lane === "train" && c.releaseKr !== null && c.releaseKr <= today)
    .sort((a, b) => (a.releaseKr ?? 0) - (b.releaseKr ?? 0))) {
    if (!artOf.has(c.charId)) artOf.set(c.charId, c.art);
  }
  const list: BdChar[] = characters
    .filter((c) => c.playableKr && c.birthMonth >= 1 && c.birthMonth <= 6)
    .map((c) => ({ charId: c.charId, name: c.name, month: c.birthMonth, day: c.birthDay, icon: charIcon(c.charId), art: artOf.get(c.charId) ?? charIcon(c.charId) }));

  return (
    <>
      <div className="page-head">
        <h1>생일달력</h1>
      </div>
      <BirthdaysView list={list} today={today} />
    </>
  );
}
