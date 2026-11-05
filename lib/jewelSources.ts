// 사료계산기의 고정 보상표. 숫자마다 출처를 적는다. 모두 일본서버 기준이고 무료 쥬얼이다.
import { jpToKr, monthStart } from "./dates.ts";
import type { Income } from "./jewelPlan.ts";

/** 통상 로그인 보너스: 7일 주기로 1·3·5일째 20, 7일째 50 = 7일마다 110 (melos003.com/entry/uma-jewel, kamigame.jp 2024-04) */
export const LOGIN_BONUS = { days: 7, jewels: 110 } as const;

/** 팀 경기장: 매주 월요일 클래스에 따라 지급 (appmedia.jp/umamusume_game/6072874, game8.jp/umamusume/375464) */
export const TEAM_TRIALS_WEEKLY = [0, 0, 25, 50, 100, 150, 250] as const;
export type TeamClass = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 챔피언스 미팅 결승 결과 */
export type CmLeague = "grade" | "open";
export type CmResult = "none" | "out" | "B3" | "B2" | "B1" | "A3" | "A2" | "A1";

type CmTable = Record<CmLeague, Record<Exclude<CmResult, "none" | "out">, number>>;

/** 2026년 3월(일본) 개최분까지 (game8.jp/umamusume/390471) */
const CM_BEFORE_2026_04: CmTable = {
  grade: { A1: 2200, A2: 1800, A3: 1200, B1: 1200, B2: 900, B3: 700 },
  open: { A1: 1000, A2: 850, A3: 700, B1: 700, B2: 600, B3: 500 },
};
/** 2026년 4월(일본) 개최분부터 (gamewith.jp/uma-musume/article/show/272329). 오픈 B 2위 600은 출처 표기 그대로 */
const CM_FROM_2026_04: CmTable = {
  grade: { A1: 3000, A2: 2400, A3: 1800, B1: 1800, B2: 1500, B3: 1200 },
  open: { A1: 1500, A2: 1350, A3: 1200, B1: 1200, B2: 600, B3: 900 },
};
const CM_TABLE_CHANGE_KR = jpToKr(monthStart(2026, 4));

/** 결승 보상만 센다. 예선 라운드 승리 보상은 개최마다 표가 달라 넣지 않는다 */
export function cmJewels(league: CmLeague, result: CmResult, startKr: number): number {
  if (result === "none" || result === "out") return 0;
  return (startKr >= CM_TABLE_CHANGE_KR ? CM_FROM_2026_04 : CM_BEFORE_2026_04)[league][result];
}

/**
 * 레전드 레이스 첫 1착 보상 (game8.jp/umamusume/376819).
 * 개최 하나에 상대 레전드마다 기간이 따로 열리는 레이스가 있어서(2022년부터 2명), 레이스마다 한 번씩 센다.
 * 출처는 상대마다 주는지 밝히지 않는다
 */
export const LEGEND_RACE_FIRST_WIN = 150;

/** 리그 오브 히어로즈 랭크 도달 보상 (gamewith.jp/uma-musume/article/show/396435). 고른 랭크까지 앞 랭크 보상을 모두 받는다 */
export const LOH_RANKS = [
  { id: "BRONZE1", name: "브론즈 1", jewels: 0 },
  { id: "BRONZE2", name: "브론즈 2", jewels: 30 },
  { id: "BRONZE3", name: "브론즈 3", jewels: 30 },
  { id: "BRONZE4", name: "브론즈 4", jewels: 30 },
  { id: "SILVER1", name: "실버 1", jewels: 50 },
  { id: "SILVER2", name: "실버 2", jewels: 50 },
  { id: "SILVER3", name: "실버 3", jewels: 100 },
  { id: "SILVER4", name: "실버 4", jewels: 100 },
  { id: "GOLD1", name: "골드 1", jewels: 150 },
  { id: "GOLD2", name: "골드 2", jewels: 150 },
  { id: "GOLD3", name: "골드 3", jewels: 300 },
  { id: "GOLD4", name: "골드 4", jewels: 300 },
  { id: "PLATINUM1", name: "플래티넘 1", jewels: 500 },
  { id: "PLATINUM2", name: "플래티넘 2", jewels: 500 },
  { id: "PLATINUM3", name: "플래티넘 3", jewels: 500 },
  { id: "PLATINUM4", name: "플래티넘 4", jewels: 500 },
] as const;

/** 고른 랭크(LOH_RANKS 순번)까지 받는 쥬얼 합계. -1이면 참가하지 않음 */
export function lohJewels(rank: number): number {
  return LOH_RANKS.slice(0, rank + 1).reduce((a, r) => a + r.jewels, 0);
}

/** 리그 오브 히어로즈 일본서버 개최 시작일. gametora 데이터에 없어서 gamewith 개최 이력을 옮겼다 */
const LOH_STARTS_JP: [number, number, number][] = [
  [2023, 5, 12], [2023, 7, 13], [2023, 9, 13], [2023, 11, 12],
  [2024, 1, 12], [2024, 5, 14], [2024, 7, 22], [2024, 9, 23], [2024, 11, 21],
  [2025, 2, 16], [2025, 5, 24], [2025, 8, 15], [2025, 11, 21],
  [2026, 2, 15], [2026, 5, 22], [2026, 8, 14],
];

/** 리그 오브 히어로즈 개최일(한국서버 예상일) */
export function lohStartsKr(): number[] {
  return LOH_STARTS_JP.map(([y, m, d]) => jpToKr(monthStart(y, m) + d - 1));
}

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

/** 개최일이 정해진 대회. 서버에서 일정만 넘기고, 보상 쥬얼은 고른 단계로 브라우저에서 채운다 */
export type Scheduled = {
  kind: "cm" | "legend" | "loh";
  id: string;
  name: string;
  startKr: number;
  endKr: number;
  /** 레전드 레이스만: 개최 안의 레이스(상대 레전드)마다 열리는 날. 없으면 개최 시작일 하나로 본다 */
  raceStartsKr?: number[];
};

/** 레전드 레이스 보상 id는 `개최 id#레이스 순번`이다. 개최 id만 꺼낸다 */
export function legendEditionId(incomeId: string): string {
  return incomeId.split("#")[0];
}

const KIND_NAME = { cm: "챔피언스 미팅", legend: "레전드 레이스", loh: "리그 오브 히어로즈" } as const;

/** 고른 단계로 대회 보상을 기간 보상 목록에 끼워 넣을 수 있는 모양으로 바꾼다. 0쥬얼인 대회는 뺀다 */
export function competitionIncomes(schedule: Scheduled[], c: CompetitionInput): Income[] {
  return schedule.flatMap((s): Income[] => {
    if (s.kind === "legend") {
      if (!c.legendRace) return [];
      const starts = s.raceStartsKr?.length ? s.raceStartsKr : [s.startKr];
      const base = s.name ? `${KIND_NAME.legend} ${s.name}` : KIND_NAME.legend;
      return starts.map((day, i) => ({
        id: `${s.id}#${i + 1}`,
        source: "legend",
        name: starts.length > 1 ? `${base} (${i + 1}/${starts.length})` : base,
        startKr: day,
        endKr: s.endKr,
        free: LEGEND_RACE_FIRST_WIN,
        trainTickets: 0,
        supportTickets: 0,
      }));
    }
    const free =
      s.kind === "cm" ? cmJewels(c.cmLeague, c.cmResult, s.startKr) : lohJewels(c.lohRank);
    if (free === 0) return [];
    // 챔피언스 미팅은 결승이 끝나야 보상이 나오므로 마지막 날을 기준으로 센다
    const day = s.kind === "cm" ? s.endKr : s.startKr;
    return [
      {
        id: s.id,
        source: s.kind,
        name: s.name ? `${KIND_NAME[s.kind]} ${s.name}` : KIND_NAME[s.kind],
        startKr: day,
        endKr: s.endKr,
        free,
        trainTickets: 0,
        supportTickets: 0,
      },
    ];
  });
}

/** (today, target) 사이의 월요일 수. 일 번호 0(1970-01-01)은 목요일이다 */
export function mondaysBetween(today: number, target: number): number {
  let n = 0;
  for (let d = today + 1; d < target; d++) if ((d + 3) % 7 === 0) n++;
  return n;
}

type Gift = { jp: [number, number, number]; name: string; jewels: number; kind: "gift" | "login"; source: string };

/**
 * 일본서버 운영 선물(선물함 배포)과 특별 로그인 보너스. 공식 공지 umamusume.jp/news/detail?id=N 에서 옮겼다.
 * ぱかライブTV 방송 기념 선물과 같은 공지의 챌린지 보상은 한 줄로 합쳤다.
 * 점검·오류 보상(お詫び)은 찾은 것이 모두 쥬얼이 아니었고, 한일 동시 진행이었던 신데렐라 그레이 방영 캠페인도 뺐다.
 * 2026-11-05 기준으로 공식 공지·공략 사이트를 교차 확인했다. 공지가 지워진 2026년 7월 초는 방송 요약으로만 확인했다.
 * 개인 성적에 따라 달라지는 보상(마스터즈 챌린지, Beyond Memories 이벤트, 시험 코인 교환)은 수량이 공개되지 않아 넣지 않았다.
 */
const GIFTS: Gift[] = [
  { jp: [2025, 7, 31], name: "ぱかライブTV Vol.55 방송 기념 선물", jewels: 150 + 200, kind: "gift", source: "id=2693" },
  { jp: [2025, 8, 14], name: "4.5주년 카운트다운 로그인 보너스", jewels: 150 * 10, kind: "login", source: "id=2727, gamebiz 410719, game8 710465" },
  { jp: [2025, 8, 23], name: "ぱかライブTV Vol.56 방송 기념 선물", jewels: 150 + 450, kind: "gift", source: "id=2727" },
  { jp: [2025, 8, 24], name: "4.5주년 기념 쥬얼 선물", jewels: 3000, kind: "gift", source: "id=2727" },
  { jp: [2025, 8, 24], name: "4.5주년 기념 로그인 보너스", jewels: 3000, kind: "login", source: "id=2727" },
  { jp: [2025, 9, 29], name: "ぱかライブTV Vol.57 방송 기념 선물", jewels: 150 + 450, kind: "gift", source: "id=2806" },
  { jp: [2025, 10, 24], name: "극장판 좀비랜드 사가 콜라보 기념 로그인 보너스", jewels: 500, kind: "login", source: "gamebiz 414841, gamepedia 47423" },
  { jp: [2025, 10, 29], name: "ぱかライブTV Vol.58 방송 기념 선물", jewels: 150 + 50, kind: "gift", source: "id=2881" },
  { jp: [2025, 10, 29], name: "새 육성 시나리오 「ゆこま温泉郷」 공개 기념 로그인 보너스", jewels: 1500, kind: "login", source: "id=2881, game8 746406" },
  { jp: [2025, 11, 28], name: "ぱかライブTV Vol.59 방송 기념 선물", jewels: 150 + 550, kind: "gift", source: "id=2940" },
  { jp: [2025, 12, 11], name: "크리스마스 캠페인 쥬얼 선물", jewels: 500, kind: "gift", source: "id=2940" },
  { jp: [2025, 12, 25], name: "ぱかライブTV Vol.60 방송 기념 선물", jewels: 150 + 350, kind: "gift", source: "id=2998" },
  { jp: [2025, 12, 26], name: "연말 카운트다운 로그인 보너스", jewels: 150 * 6, kind: "login", source: "id=2998" },
  // 첫날 1500, 이후 300씩 9일
  { jp: [2026, 1, 1], name: "새해 특별 로그인 보너스", jewels: 1500 + 300 * 9, kind: "login", source: "id=2998, id=2984" },
  { jp: [2026, 1, 29], name: "ぱかライブTV Vol.61 방송 기념 선물", jewels: 150 + 600, kind: "gift", source: "id=3036" },
  { jp: [2026, 2, 14], name: "5주년 카운트다운 로그인 보너스", jewels: 150 * 10, kind: "login", source: "gamewith 545130, game8 762809" },
  { jp: [2026, 2, 14], name: "발렌타인 캠페인 쥬얼 선물", jewels: 500, kind: "gift", source: "id=3036, 공식 X 2026-02-14" },
  { jp: [2026, 2, 23], name: "ぱかライブTV Vol.62 (5주년) 방송 기념 선물", jewels: 150 + 800, kind: "gift", source: "id=3097" },
  { jp: [2026, 2, 24], name: "5주년 기념 쥬얼 선물", jewels: 3000, kind: "gift", source: "id=3097" },
  { jp: [2026, 2, 24], name: "5주년 기념 로그인 보너스 제1탄", jewels: 3000, kind: "login", source: "id=3097" },
  { jp: [2026, 3, 11], name: "개발자 레터 기념 쥬얼 선물", jewels: 1500, kind: "gift", source: "id=3128" },
  { jp: [2026, 3, 11], name: "5주년 기념 로그인 보너스 제2탄", jewels: 150 * 15, kind: "login", source: "gamewith 545130, game8 762809" },
  { jp: [2026, 3, 14], name: "화이트데이 캠페인 쥬얼 선물", jewels: 500, kind: "gift", source: "id=3117, 공식 X 2026-03-14" },
  { jp: [2026, 3, 18], name: "신데렐라 그레이 누계 900만 부 돌파 기념 선물", jewels: 900, kind: "gift", source: "공식 X 2026-03-18" },
  { jp: [2026, 3, 28], name: "ぱかライブTV' 첫 방송 기념 선물", jewels: 500, kind: "gift", source: "id=3174" },
  { jp: [2026, 4, 1], name: "만우절 기념 선물", jewels: 500, kind: "gift", source: "공식 X 2026-04-01, game8 775733" },
  { jp: [2026, 4, 29], name: "ぱかライブTV' #2 방송 기념 선물", jewels: 300, kind: "gift", source: "id=3225" },
  { jp: [2026, 5, 28], name: "ぱかライブTV' #3 방송 기념 선물", jewels: 300, kind: "gift", source: "id=3263" },
  { jp: [2026, 6, 27], name: "ぱかライブTV' #4 방송 기념 선물", jewels: 300, kind: "gift", source: "id=3315" },
  { jp: [2026, 6, 29], name: "새 육성 시나리오 「トレセン軒」 공개 기념 로그인 보너스", jewels: 1500, kind: "login", source: "id=3315" },
  { jp: [2026, 7, 30], name: "ぱかライブTV' #5 방송 기념 선물", jewels: 300, kind: "gift", source: "id=3377" },
  { jp: [2026, 8, 12], name: "KFC 콜라보 기념 로그인 보너스", jewels: 500, kind: "login", source: "id=3388" },
  { jp: [2026, 8, 14], name: "5.5주년 카운트다운 로그인 보너스", jewels: 150 * 10, kind: "login", source: "id=3391" },
  { jp: [2026, 8, 23], name: "ぱかライブTV' #6 방송 기념 선물", jewels: 500, kind: "gift", source: "id=3415" },
  { jp: [2026, 8, 24], name: "5.5주년 기념 쥬얼 선물", jewels: 3000, kind: "gift", source: "id=3407" },
  { jp: [2026, 8, 24], name: "5.5주년 기념 로그인 보너스", jewels: 300 * 10, kind: "login", source: "id=3407" },
  { jp: [2026, 9, 11], name: "카타르 개선문상 프리미엄 파트너 취임 기념 선물", jewels: 500, kind: "gift", source: "id=3442" },
  { jp: [2026, 9, 28], name: "ぱかライブTV' #7 방송 기념 선물", jewels: 300, kind: "gift", source: "id=3479" },
  { jp: [2026, 10, 19], name: "스타 블로섬 누계 50만 부 돌파 기념 선물", jewels: 150, kind: "gift", source: "id=3499" },
  { jp: [2026, 10, 22], name: "긴급 점검 감사 선물", jewels: 150, kind: "gift", source: "id=3523" },
  { jp: [2026, 10, 25], name: "ぱかライブTV' #8 방송 기념 선물", jewels: 300, kind: "gift", source: "id=3528" },
  { jp: [2026, 10, 26], name: "새 육성 시나리오 「駿大祭」 공개 기념 로그인 보너스", jewels: 1500, kind: "login", source: "id=3509" },
  // 『うまゆる』 방영 기념: 9/27부터 매주 150. 지금까지 시작한 6회분만 넣었다 (공식 일정상 2027-03까지 26회)
  ...[[2026, 9, 27], [2026, 10, 5], [2026, 10, 12], [2026, 10, 19], [2026, 10, 26], [2026, 11, 2]].map(
    ([y, m, d], i): Gift => ({ jp: [y, m, d], name: `うまゆる 방영 기념 로그인 보너스 ${i + 1}회`, jewels: 150, kind: "login", source: "id=3466" }),
  ),
];

/** 운영 선물과 특별 로그인 보너스를 한국서버 예상일의 기간 보상으로 */
export function giftIncomes(): Income[] {
  return GIFTS.map((g, i) => {
    const day = jpToKr(monthStart(g.jp[0], g.jp[1]) + g.jp[2] - 1);
    return {
      id: `gift-${i}`,
      source: g.kind,
      name: g.name,
      startKr: day,
      endKr: day,
      free: g.jewels,
      trainTickets: 0,
      supportTickets: 0,
    };
  });
}
