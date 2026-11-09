import { monthStart } from "./dates.ts";

// 이벤트 일정 달력. 날짜는 모두 한국서버 예상일(일본서버 + 476일)의 일 번호이고 끝날도 이벤트 기간에 든다

export type EventKind =
  | "legend"
  | "cm"
  | "loh"
  | "story"
  | "exam"
  | "carnival"
  | "teamscout"
  | "anniversary"
  | "g1"
  | "mission";

/** 달력 막대 색을 나누는 묶음. 색 하나에 종류가 여럿이라 막대 안에 종류 이름을 함께 적는다 */
export type EventGroup = "race" | "story" | "training" | "mission";

export const KINDS: Record<EventKind, { label: string; group: EventGroup }> = {
  legend: { label: "레전드 레이스", group: "race" },
  cm: { label: "챔피언스 미팅", group: "race" },
  loh: { label: "리그 오브 히어로즈", group: "race" },
  story: { label: "스토리 이벤트", group: "story" },
  exam: { label: "기능시험", group: "training" },
  carnival: { label: "레이싱 카니발", group: "training" },
  // 일본 이름은 目指せ最強チーム. 한국서버 공식 이름을 확인하지 못해 게임 안 내용(우마무스메 스카우트)으로 부른다
  teamscout: { label: "팀 스카우트", group: "training" },
  anniversary: { label: "주년 기념", group: "mission" },
  g1: { label: "G1 기념", group: "mission" },
  mission: { label: "기념 미션", group: "mission" },
};

export const GROUPS: { value: EventGroup; label: string }[] = [
  { value: "race", label: "경기" },
  { value: "story", label: "스토리" },
  { value: "training", label: "육성" },
  { value: "mission", label: "기념 미션" },
];

export type GameEvent = {
  id: string;
  kind: EventKind;
  /** 막대와 목록에 쓰는 이름. 종류 이름은 빼고 적는다 (예: "재팬컵") */
  name: string;
  /** 거리·상대 같은 덧붙임. 없으면 빈 문자열 */
  detail: string;
  startKr: number;
  endKr: number;
};

export const groupOf = (e: GameEvent) => KINDS[e.kind].group;

/** [from, to] 기간과 하루라도 겹치는 이벤트 */
export function overlapping(events: GameEvent[], from: number, to: number): GameEvent[] {
  return events.filter((e) => e.startKr <= to && e.endKr >= from);
}

export type Bar = {
  event: GameEvent;
  /** 그 주 안의 시작 칸(0 = 일요일)과 칸 수 */
  col: number;
  span: number;
  lane: number;
  /** 지난주부터 이어지거나 다음 주로 이어지면 그쪽 모서리를 각지게 그린다 */
  fromBefore: boolean;
  toAfter: boolean;
};

export type Week = {
  /** 이 주 일요일의 일 번호. 달 바깥 날도 칸은 그리되 흐리게 둔다 */
  start: number;
  bars: Bar[];
  lanes: number;
};

/** 긴 이벤트가 위 줄을 차지하도록 시작이 빠른 것, 같으면 긴 것부터 줄에 놓는다 */
function byPlacement(a: GameEvent, b: GameEvent) {
  return a.startKr - b.startKr || b.endKr - a.endKr || a.id.localeCompare(b.id);
}

/**
 * 한 달 달력의 주별 막대 배치. 막대는 주마다 끊어 그리고, 겹치지 않게 가장 위의 빈 줄에 놓는다.
 * 앞뒤 달 날짜 칸에는 막대를 그리지 않는다. 아래 목록이 그달 이벤트만 세므로 달력도 그 범위에 맞춘다
 */
export function monthWeeks(events: GameEvent[], year: number, month: number): Week[] {
  const first = monthStart(year, month);
  const last = monthStart(year, month + 1) - 1;
  // 1970-01-01(일 번호 0)은 목요일
  const firstSunday = first - ((first + 4) % 7);
  const weeks: Week[] = [];
  for (let start = firstSunday; start <= last; start += 7) {
    const end = start + 6;
    const laneEnds: number[] = [];
    const bars: Bar[] = [];
    const from = Math.max(start, first);
    const to = Math.min(end, last);
    for (const event of overlapping(events, from, to).sort(byPlacement)) {
      const s = Math.max(event.startKr, from);
      const e = Math.min(event.endKr, to);
      let lane = laneEnds.findIndex((until) => until < s);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = e;
      bars.push({
        event,
        col: s - start,
        span: e - s + 1,
        lane,
        fromBefore: event.startKr < from,
        toAfter: event.endKr > to,
      });
    }
    weeks.push({ start, bars, lanes: laneEnds.length });
  }
  return weeks;
}

export type Status = { state: "live" | "next" | "done"; days: number };

/** 진행 중이면 남은 날(오늘 포함), 시작 전이면 시작까지 남은 날 */
export function statusOf(e: GameEvent, today: number): Status {
  if (e.endKr < today) return { state: "done", days: 0 };
  if (e.startKr > today) return { state: "next", days: e.startKr - today };
  return { state: "live", days: e.endKr - today + 1 };
}

/** 오늘 이후 가장 먼저 시작하는 이벤트들 (같은 날 시작하는 것을 모두) */
export function nextStarts(events: GameEvent[], today: number): GameEvent[] {
  const upcoming = events.filter((e) => e.startKr > today);
  if (upcoming.length === 0) return [];
  const day = Math.min(...upcoming.map((e) => e.startKr));
  return upcoming.filter((e) => e.startKr === day).sort(byPlacement);
}

// gametora 기간 한정 미션 이름(일본어 원문)에서 달력에 쓸 이름을 만든다
const G1_MISSION = /G[1Ⅰ]記念ミッション/;
export const isG1Mission = (original: string) => G1_MISSION.test(original);
const ANNIVERSARY = /(Half|[\d.]+)(?:st|nd|rd|th)? Anniversary.*?第(\d)弾/;
/** G1 기념 미션 이름에서 레이스 이름만 꺼낸다. "秋のGⅠ記念ミッション 第2弾 天皇賞（秋）" → "天皇賞（秋）" */
export function g1RaceOf(original: string): string {
  const rest = original.replace(/^.*?G[1Ⅰ]記念ミッション\s*(?:第.弾)?\s*/, "").trim();
  return rest.replace(/^\((.*)\)$/, "$1").replace(/^JBC(\d+)$/, "JBC $1");
}

/** "4.5th Anniversary 記念ミッション 第2弾" → "4.5주년 기념 미션 2탄" */
export function anniversaryName(original: string): string | null {
  const m = original.match(ANNIVERSARY);
  if (!m) return null;
  const age = m[1] === "Half" ? "하프 애니버서리" : `${m[1]}주년`;
  return `${age} 기념 미션 ${m[2]}탄`;
}
