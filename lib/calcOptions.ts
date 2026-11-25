// 사료계산기에서 사용자가 고르는 선택지와 그 기본값.
// 홈의 '내 쥬얼'도 저장값을 읽을 때 이 목록으로 검사한다. 보상 시트(JSON)를 끌어오지 않게
// 다른 모듈을 가져오지 않는다. 그래야 홈 브라우저 번들에 시트 데이터가 실리지 않는다.

/** 데일리 미션 ⑤ 육성 완료 20 + 전부 클리어 30 (gametora missions/daily) */
export const DAILY_MISSION_JEWELS = 50;

/** 월정액(ウマスク): 구매할 때 유료 500, 30일 동안 매일 무료 50. 2024-12-19 일본서버 판매 시작 (gamebiz.jp/news/396105) */
export const MONTHLY = { paidOnBuy: 500, freePerDay: 50, days: 30 } as const;

/** 팀 경기장 클래스 (1~6, 0은 넣지 않음) */
export type TeamClass = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 챔피언스 미팅 결승 결과 */
export type CmLeague = "grade" | "open";
export type CmResult = "none" | "out" | "B3" | "B2" | "B1" | "A3" | "A2" | "A1";

/** 리그 오브 히어로즈 랭크 도달 보상 (gamewith.jp/uma-musume/article/show/396435). 고른 랭크까지 앞 랭크 보상을 모두 받는다 */
export const LOH_RANKS = [
  { id: "BRONZE1", name: "브론즈 1", jewels: 0 },
  { id: "BRONZE2", name: "브론즈 2", jewels: 50 },
  { id: "BRONZE3", name: "브론즈 3", jewels: 50 },
  { id: "BRONZE4", name: "브론즈 4", jewels: 50 },
  { id: "SILVER1", name: "실버 1", jewels: 100 },
  { id: "SILVER2", name: "실버 2", jewels: 100 },
  { id: "SILVER3", name: "실버 3", jewels: 100 },
  { id: "SILVER4", name: "실버 4", jewels: 100 },
  { id: "GOLD1", name: "골드 1", jewels: 300 },
  { id: "GOLD2", name: "골드 2", jewels: 300 },
  { id: "GOLD3", name: "골드 3", jewels: 300 },
  { id: "GOLD4", name: "골드 4", jewels: 300 },
  { id: "PLATINUM1", name: "플래티넘 1", jewels: 500 },
  { id: "PLATINUM2", name: "플래티넘 2", jewels: 500 },
  { id: "PLATINUM3", name: "플래티넘 3", jewels: 500 },
  { id: "PLATINUM4", name: "플래티넘 4", jewels: 500 },
] as const;

/** 대회·경기 보상 중 사용자가 고르는 단계 */
export type CompetitionInput = {
  teamClass: TeamClass;
  cmLeague: CmLeague;
  cmResult: CmResult;
  /** LOH_RANKS 순번, -1이면 참가하지 않음 */
  lohRank: number;
  legendRace: boolean;
};

export const EMPTY_COMPETITION: CompetitionInput = {
  teamClass: 0,
  cmLeague: "grade",
  cmResult: "none",
  lohRank: -1,
  legendRace: false,
};

/** none: 패스 보상을 넣지 않음, standard: 무료 보상만 끝까지, premium: 프리미엄 패스를 사고 끝까지 */
export type PassPlan = "none" | "standard" | "premium";

/**
 * 상점 월간 교환: 교환처마다 육성·서포트 가챠 티켓을 한 달에 정해진 횟수만큼 바꿀 수 있다. 매달 1일 12:00에 횟수가 초기화된다.
 * 횟수는 1회당 1장이며 육성·서포트가 따로 같은 횟수다. SR 이상 확정 티켓은 넣지 않는다.
 * 일본서버 기준 wikiwiki.jp/vip_umamusu ショップ (2026-11-22 갱신). GameWith·神ゲー攻略도 같다.
 * game8.jp/umamusume/373403은 무지개·금 편자를 월 1회로 적었지만 SR 이상 확정 티켓 횟수와 섞인 것으로 보고 따르지 않는다.
 * 트레이너 메달(서클) 교환에는 일반 육성·서포트 티켓이 없다 (★3·★2 이상·SR 이상 확정 티켓만 있음).
 * 대신 무지개 결정 조각(8,000메달)·금 결정 조각(2,000메달)을 월 1개씩 바꿀 수 있다 (같은 위키 ショップ, 2026-04-11 기준).
 */
export const SHOP_MONTHLY = [
  { id: "friend", name: "친구 포인트", cost: "20,000pt", perMonth: 1, shardsPerMonth: 0 },
  { id: "rainbow", name: "무지개 편자", cost: "2개", perMonth: 2, shardsPerMonth: 0 },
  { id: "gold", name: "금 편자", cost: "10개", perMonth: 2, shardsPerMonth: 0 },
  { id: "silver", name: "은 편자", cost: "50개", perMonth: 2, shardsPerMonth: 0 },
  { id: "clover", name: "클로버", cost: "200개", perMonth: 2, shardsPerMonth: 0 },
  { id: "medal", name: "트레이너 메달", cost: "무지개 8,000·금 2,000메달", perMonth: 0, shardsPerMonth: 1 },
] as const;
export type ShopSource = (typeof SHOP_MONTHLY)[number]["id"];
export const SHOP_SOURCES: ShopSource[] = SHOP_MONTHLY.map((s) => s.id);
