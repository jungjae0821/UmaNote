import { formatFull, formatMd } from "@/lib/dates";
import { EVENT_KIND_NAME, getBanners, getCards, getEvents } from "@/lib/gametora";
import type { SearchItem } from "@/lib/search";

export const revalidate = 3600;

export async function GET() {
  const cards = await getCards();
  const [banners, events] = await Promise.all([getBanners(cards), getEvents(cards)]);
  const items: SearchItem[] = [
    ...cards.map(
      (c): SearchItem => ({
        group: c.lane === "train" ? "육성 우마무스메" : "서포트 카드",
        title: c.name,
        sub: c.title,
        href: `/characters/${c.lane === "train" ? "t" : "s"}${c.id}`,
        img: c.art,
      }),
    ),
    ...banners
      .filter((b) => b.pickups.length > 0)
      .map(
        (b): SearchItem => ({
          group: "픽업",
          title: [...new Set(b.pickups.map((p) => p.card.name))].join(", "),
          sub: `${b.lane === "train" ? "육성" : "서포트"} · ${formatFull(b.start)} ~ ${formatMd(b.end)}`,
          href: `/futures?banner=${b.id}`,
          img: b.art ?? b.pickups[0]?.card.art,
        }),
      ),
    ...events.map(
      (e): SearchItem => ({
        group: "이벤트",
        title: e.name,
        sub: `${EVENT_KIND_NAME[e.kind]} · ${formatFull(e.start)} ~ ${formatMd(e.end)}`,
        href: `/events#${e.id}`,
      }),
    ),
  ];
  return Response.json(items);
}
