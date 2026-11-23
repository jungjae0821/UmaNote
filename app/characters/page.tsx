import type { Metadata } from "next";
import { todayKr } from "@/lib/dates";
import { getBanners, getCards } from "@/lib/gametora";
import { krRelease } from "@/lib/release";
import { CharactersView, type ListCard } from "./CharactersView";

export const metadata: Metadata = { title: "캐릭터" };
export const revalidate = 3600;

export default async function CharactersPage() {
  const today = todayKr();
  const all = await getCards();
  const banners = await getBanners(all);
  const cards: ListCard[] = all.map((c) => {
    const kr = krRelease(c, banners);
    return {
      id: c.id,
      lane: c.lane,
      name: c.name,
      title: c.title,
      rarity: c.rarity,
      art: c.art,
      releaseKr: kr.day,
      newUntil: kr.newUntil,
      obtained: c.obtained,
      supportType: c.supportType,
      aptitude: c.aptitude,
    };
  });
  return (
    <>
      <div className="page-head">
        <h1>캐릭터</h1>
      </div>
      <CharactersView cards={cards} today={today} />
    </>
  );
}
