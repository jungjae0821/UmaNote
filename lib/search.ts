export type SearchGroup = "육성 우마무스메" | "서포트 카드" | "픽업" | "이벤트";

export type SearchItem = { group: SearchGroup; title: string; sub: string; href: string; img?: string };

export const SEARCH_GROUPS: SearchGroup[] = ["육성 우마무스메", "서포트 카드", "픽업", "이벤트"];

const norm = (s: string) => s.toLowerCase().replace(/[\s·・\-\[\]【】()]/g, "");

/** 이름 일부로 찾는다. 앞에서 맞는 것을 먼저, 묶음마다 최대 limit개 */
export function searchItems(items: SearchItem[], query: string, limit = 6): SearchItem[] {
  const q = norm(query);
  if (!q) return [];
  const scored = items.flatMap((it) => {
    const t = norm(it.title);
    const s = norm(it.sub);
    const at = t.indexOf(q);
    if (at >= 0) return [{ it, score: at === 0 ? 0 : 1 }];
    if (s.includes(q)) return [{ it, score: 2 }];
    return [];
  });
  scored.sort((a, b) => a.score - b.score);
  return SEARCH_GROUPS.flatMap((g) => scored.filter((x) => x.it.group === g).slice(0, limit).map((x) => x.it));
}
