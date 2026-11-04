import { MapScroller } from "@/components/MapScroller";
import { formatShort } from "@/lib/dates";
import type { Gacha, Lane } from "@/lib/umapyoi";

type Station = { day: number; lane: Lane; gachas: Gacha[]; live: boolean };

type Props = { gachas: Gacha[]; today: number; from: number; to: number };

// 같은 노선에서 앞 역과 이만큼(비율)보다 가까우면 라벨을 선 반대편으로 보낸다.
// 라벨 폭 160px ÷ 최소 선로 폭 768px(960 - 양쪽 여백 96×2) ≈ 0.21에 여유를 둔 값
const CROWDED = 0.24;
// 이 날 수 안에 붙어 시작하는 픽업은 역 하나로 합친다
const MERGE_DAYS = 2;

function stationsFor(lane: Lane, gachas: Gacha[], today: number, from: number): Station[] {
  const stations: Station[] = [];
  const sorted = gachas.filter((g) => g.lane === lane).sort((a, b) => a.startKr - b.startKr);
  for (const g of sorted) {
    const day = Math.max(g.startKr, from);
    const live = g.startKr <= today && today <= g.endKr;
    const last = stations.at(-1);
    const lastStart = last && Math.max(...last.gachas.map((x) => x.startKr));
    // 범위보다 먼저 시작해 맨 앞에 붙는 픽업도 같은 자리라 한 역으로 합친다
    if (last && lastStart !== undefined && (g.startKr - lastStart <= MERGE_DAYS || last.day === day)) {
      last.gachas.push(g);
      last.live ||= live;
    } else {
      stations.push({ day, lane, gachas: [g], live });
    }
  }
  return stations;
}

function StationLabel({ s }: { s: Station }) {
  const names = s.gachas.flatMap((g) => g.pickups.map((p) => (p.rarity ? `${p.name} ${p.rarity}` : p.name)));
  const shown = names.slice(0, 2);
  const startJp = Math.min(...s.gachas.map((g) => g.startJp));
  return (
    <>
      <span className="st-names">
        {shown.map((n) => (
          <span key={n}>{n}</span>
        ))}
        {names.length > shown.length && <span className="st-more">외 {names.length - shown.length}명</span>}
      </span>
      <span className="st-date">{formatShort(Math.min(...s.gachas.map((g) => g.startKr)))} 시작</span>
      <span className="st-jp">일본 {formatShort(startJp)}</span>
    </>
  );
}

export function LineMap({ gachas, today, from, to }: Props) {
  const span = to - from;
  const frac = (day: number) => Math.min(Math.max((day - from) / span, 0), 1);
  const pos = (day: number) => ({ "--x": frac(day) }) as React.CSSProperties;

  const lanes: Lane[] = ["train", "support"];

  return (
    <MapScroller>
      <div className="map-inner">
        {lanes.map((lane) => (
          <div key={lane} className={`ln ln-${lane}`} style={{ "--x": frac(today) } as React.CSSProperties} aria-hidden="true" />
        ))}
        <div className="today" style={pos(today)}>
          <span>오늘 {formatShort(today)}</span>
        </div>
        {lanes.map((lane) => {
          const stations = stationsFor(lane, gachas, today, from);
          let prev = -1;
          let flip = false;
          return (
            <ol key={lane} className={`stations stations-${lane}`} aria-label={lane === "train" ? "육성 우마무스메 픽업" : "서포트 카드 픽업"}>
              {stations.map((s) => {
                const f = frac(s.day);
                flip = prev >= 0 && f - prev < CROWDED ? !flip : false;
                prev = f;
                return (
                  <li
                    key={s.day}
                    className={`st${s.live ? " st-live" : ""}${flip ? " st-flip" : ""}`}
                    style={pos(s.day)}
                  >
                    <span className="st-dot" aria-hidden="true" />
                    <span className="st-label">
                      <StationLabel s={s} />
                    </span>
                  </li>
                );
              })}
            </ol>
          );
        })}
      </div>
    </MapScroller>
  );
}
