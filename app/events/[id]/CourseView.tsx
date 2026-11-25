import type { Course } from "@/lib/gametora";

export const SEASON = ["", "봄", "여름", "가을", "겨울", "봄"];
export const WEATHER = ["", "맑음", "흐림", "비", "눈"];
export const CONDITION = ["", "양호", "약간 무름", "무름", "불량"];
export const TIME = ["", "아침", "낮", "저녁", "밤"];
export const DISTANCE = ["", "단거리", "마일", "중거리", "장거리"];
export const TURN: Record<number, string> = { 1: "우회전", 2: "좌회전", 4: "직선" };
export const INOUT: Record<number, string> = { 2: "내회전", 3: "외회전", 4: "외→내" };
export const STAT = ["", "스피드", "스태미나", "파워", "근성", "지능"];
const PHASE = ["초반", "중반", "종반", "라스트 스퍼트"];
const PHASE_SHORT = ["초반", "중반", "종반", "스퍼트"];

const pct = (m: number, len: number) => `${(m / len) * 100}%`;
const slopeText = (s: number) => `${s > 0 ? "오르막" : "내리막"} ${Math.abs(s / 10000).toFixed(1)}%`;

export function Facts({ items }: { items: [string, string | undefined][] }) {
  return (
    <dl className="evd-facts">
      {items
        .filter((x): x is [string, string] => !!x[1])
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/** 출발점부터 결승선까지를 가로 띠 세 줄(구간·직선과 코너·경사)로 그린다 */
export function CourseMap({ c }: { c: Course }) {
  const len = c.length;
  const ticks = Array.from({ length: Math.floor(len / 200) + 1 }, (_, i) => i * 200);
  const segments = [
    ...c.straights.map((s) => ({ ...s, kind: "straight", label: s.frontType === 1 ? "홈 직선" : "직선" })),
    ...c.corners.map((s) => ({ ...s, kind: "corner", label: `${s.number}코너` })),
  ].sort((a, b) => a.start - b.start);
  const marks = [
    { m: c.positionKeepEnd, label: "포지션 킵 끝" },
    ...(c.spurtStart ? [{ m: c.spurtStart.meters, label: "스퍼트 시작" }] : []),
  ];
  return (
    <div className="evd-map" role="img" aria-label={`${len}m 코스 구간 그림`}>
      <div className="evd-row">
        <span className="evd-row-name">구간</span>
        <div className="evd-bar">
          {c.phases.map((p) => (
            <span key={p.id} className={`evd-seg phase-${p.id}`} style={{ left: pct(p.start, len), width: pct(p.end - p.start, len) }} title={`${PHASE[p.id]} ${p.start}–${p.end}m`}>
              {PHASE_SHORT[p.id]}
            </span>
          ))}
        </div>
      </div>
      <div className="evd-row">
        <span className="evd-row-name">코스</span>
        <div className="evd-bar">
          {segments.map((s) => (
            <span key={`${s.kind}-${s.start}`} className={`evd-seg ${s.kind}`} style={{ left: pct(s.start, len), width: pct(s.end - s.start, len) }} title={`${s.label} ${s.start}–${s.end}m`}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="evd-row">
        <span className="evd-row-name">경사</span>
        <div className="evd-bar">
          {c.slopes.map((s) => (
            <span key={s.start} className={`evd-seg ${s.slope > 0 ? "up" : "down"}`} style={{ left: pct(s.start, len), width: pct(s.end - s.start, len) }} title={`${slopeText(s.slope)} ${s.start}–${s.end}m`}>
              {s.slope > 0 ? "▲" : "▼"}
            </span>
          ))}
          {c.slopes.length === 0 && <span className="evd-flat">평지</span>}
        </div>
      </div>
      <div className="evd-row evd-axis-row">
        <span className="evd-row-name" />
        <div className="evd-axis">
          {marks.map((k) => (
            <span key={k.label} className="evd-mark" style={{ left: pct(k.m, len) }}>
              <i />
              {k.label} {k.m}m
            </span>
          ))}
          {ticks.map((t) => (
            <span key={t} className={`evd-tick${t === 0 ? " start" : t === len ? " end" : ""}${t % 400 ? " minor" : ""}`} style={{ left: pct(t, len) }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SectionList({ c }: { c: Course }) {
  const rows = [
    ...c.straights.map((s) => ({ ...s, label: s.frontType === 1 ? "홈 직선" : "직선", note: "" })),
    ...c.corners.map((s) => ({ ...s, label: `${s.number}코너`, note: "" })),
    ...c.slopes.map((s) => ({ ...s, label: s.slope > 0 ? "오르막" : "내리막", note: `${Math.abs(s.slope / 10000).toFixed(1)}%` })),
  ].sort((a, b) => a.start - b.start || a.label.localeCompare(b.label));
  return (
    <table className="evd-sections">
      <thead>
        <tr>
          <th scope="col">구간</th>
          <th scope="col">위치</th>
          <th scope="col">길이</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.label}-${r.start}`}>
            <th scope="row">
              {r.label}
              {r.note && <span className="evd-note"> {r.note}</span>}
            </th>
            <td>
              {r.start}–{r.end}m
            </td>
            <td>{r.end - r.start}m</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 코스 구조 섹션: 기준 스탯 등 요약, 구간 그림, 구간표 */
export function CourseSection({ c }: { c: Course }) {
  return (
    <section>
      <h2 className="section-title">코스 구조</h2>
      <div className="panel glass evd-course">
        <Facts
          items={[
            ["기준 스탯", c.statThresholds.map((s) => STAT[s]).filter(Boolean).join(", ") || undefined],
            ["바퀴 수", `${Math.max(c.laps.length, 1)}바퀴`],
            ["포지션 킵 끝", `${c.positionKeepEnd}m`],
            ["스퍼트 시작", c.spurtStart ? `${c.spurtStart.meters}m` : undefined],
          ]}
        />
        <CourseMap c={c} />
        <SectionList c={c} />
      </div>
    </section>
  );
}

/** 경기장·코스·방향·계절·날씨·마장 상태. weather·condition이 0이면 "고정 없음" */
export function RaceSection({
  race,
  course,
}: {
  race: { track?: string; ground: string; distance: number; season?: number; weather?: number; condition?: number; time?: number };
  course?: Course;
}) {
  const fixed = race.weather !== undefined;
  return (
    <section>
      <h2 className="section-title">경기 조건</h2>
      <div className="panel glass">
        <Facts
          items={[
            ["경기장", race.track],
            ["코스", `${race.ground} ${race.distance}m`],
            ["거리 구분", course ? DISTANCE[course.distance] : undefined],
            ["방향", course ? [TURN[course.turn], INOUT[course.inout]].filter(Boolean).join(" · ") : undefined],
            ["계절", race.season ? SEASON[race.season] : undefined],
            ["날씨", fixed ? WEATHER[race.weather ?? 0] || "고정 없음" : undefined],
            ["마장 상태", fixed ? CONDITION[race.condition ?? 0] || "고정 없음" : undefined],
            ["시간대", race.time ? TIME[race.time] : undefined],
          ]}
        />
      </div>
    </section>
  );
}
