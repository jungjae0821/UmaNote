// 한국서버 출시 상태. gametora의 release_ko가 늦게 채워져도 가챠 일정이 있으면 그 날짜로 판단한다.
import type { Banner, Card } from "./gametora";

/** 출시 뒤 픽업 배너가 없는 카드(이벤트 보상 등)를 신규로 보는 기간 */
const NEW_DAYS_WITHOUT_BANNER = 14;

export type KrRelease = {
  /** 한국서버 출시일(확정 또는 가챠 일정). 모르면 null */
  day: number | null;
  /** 이 날까지 신규로 표시. 첫 픽업 배너가 끝나는 날 */
  newUntil: number | null;
  /** 날짜가 gametora 추정 배너에서 온 것 */
  estimated: boolean;
};

/** banners는 시작일 오름차순이어야 한다 (getBanners가 그렇게 돌려준다) */
export function krRelease(card: Card, banners: Banner[]): KrRelease {
  const first = banners.find((b) => b.lane === card.lane && b.pickups.some((p) => p.card.id === card.id));
  const day = card.releaseKr ?? first?.start ?? null;
  if (day === null) return { day: null, newUntil: null, estimated: false };
  const sameTime = first && first.start <= day + 1 && first.end >= day;
  return {
    day,
    newUntil: sameTime ? first.end : day + NEW_DAYS_WITHOUT_BANNER - 1,
    estimated: card.releaseKr === null && !!first?.estimated,
  };
}

/** 위 결과를 오늘 기준 상태로: 예정 · 신규 · 출시 */
export function releaseState(r: KrRelease, today: number): "upcoming" | "new" | "released" {
  if (r.day === null || r.day > today) return "upcoming";
  return r.newUntil !== null && today <= r.newUntil ? "new" : "released";
}
