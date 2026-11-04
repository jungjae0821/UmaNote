"use client";

import { useEffect, useMemo, useState } from "react";
import { BannerArt } from "@/components/BannerArt";
import { CardArt } from "@/components/CardArt";
import { buildOdds, draw } from "@/lib/gachaDraw";
import type { BannerImage, BannerOption, PoolCard } from "@/lib/gachaPool";
import type { Lane } from "@/lib/umapyoi";

const STORAGE_KEY = "umanote:sim:v1";
const JEWELS_PER_PULL = 150;
const CEILING = 200;
const RARITY_NAME: Record<Lane, Record<number, string>> = {
  train: { 3: "★3", 2: "★2", 1: "★1" },
  support: { 3: "SSR", 2: "SR", 1: "R" },
};

type BannerRecord = {
  lane: Lane;
  pulls: number;
  /** 천장 포인트. 교환하면 200씩 줄어든다 */
  points: number;
  /** 뽑아서 나온 레어도별 장수 [★1, ★2, ★3] */
  counts: [number, number, number];
  /** 카드 ID → 뽑아서 나온 장수 */
  got: Record<string, number>;
  /** 카드 ID → 천장으로 교환한 장수 */
  exchanged: Record<string, number>;
};

type Store = Record<string, BannerRecord>;

const emptyRecord = (lane: Lane): BannerRecord => ({
  lane,
  pulls: 0,
  points: 0,
  counts: [0, 0, 0],
  got: {},
  exchanged: {},
});

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function save(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 기록이 남는다
  }
}

/** 0.0001% 단위 → "0.75%" */
function pct(weight: number): string {
  return `${Number((weight / 10_000).toFixed(4))}%`;
}

const num = (n: number) => n.toLocaleString("ko-KR");

type Props = { lane: Lane; banner: BannerOption; image: BannerImage; pool: PoolCard[] };

type Result = { card: PoolCard; key: number };

export function Simulator({ lane, banner, image, pool }: Props) {
  const [store, setStore] = useState<Store>({});
  const [results, setResults] = useState<Result[]>([]);
  const [round, setRound] = useState(0);

  useEffect(() => setStore(load()), []);

  const rec = store[banner.id] ?? emptyRecord(lane);
  const rarityName = RARITY_NAME[lane];
  // 육성은 같은 우마무스메가 여러 번 나와도 카드로 쌓이지 않으니 횟수로 센다
  const countWord = lane === "train" ? "횟수" : "장수";
  const countUnit = lane === "train" ? "회" : "장";
  const byId = useMemo(() => new Map(pool.map((c) => [c.id, c])), [pool]);
  const pickups = useMemo(() => pool.filter((c) => c.pickup), [pool]);

  const { normal, last, sums, lastSums } = useMemo(() => buildOdds(pool), [pool]);

  function update(fn: (r: BannerRecord) => BannerRecord) {
    setStore((prev) => {
      const next = { ...prev, [banner.id]: fn(prev[banner.id] ?? emptyRecord(lane)) };
      save(next);
      return next;
    });
  }

  function pull(times: 1 | 10) {
    const cards = Array.from({ length: times }, (_, i) => draw(times === 10 && i === 9 ? last : normal));
    update((r) => {
      const counts: BannerRecord["counts"] = [...r.counts];
      const got = { ...r.got };
      for (const c of cards) {
        counts[c.rarity - 1] += 1;
        got[c.id] = (got[c.id] ?? 0) + 1;
      }
      return { ...r, pulls: r.pulls + times, points: r.points + times, counts, got };
    });
    setRound((n) => n + 1);
    setResults(cards.map((card, i) => ({ card, key: round * 10 + i })));
  }

  function exchange(card: PoolCard) {
    update((r) =>
      r.points < CEILING
        ? r
        : {
            ...r,
            points: r.points - CEILING,
            exchanged: { ...r.exchanged, [card.id]: (r.exchanged[card.id] ?? 0) + 1 },
          },
    );
  }

  function reset() {
    if (!window.confirm("이 배너의 뽑기 기록과 천장 포인트를 지울까요?")) return;
    setStore((prev) => {
      const next = { ...prev };
      delete next[banner.id];
      save(next);
      return next;
    });
    setResults([]);
  }

  const laneTotal = Object.values(store)
    .filter((r) => r.lane === lane)
    .reduce((t, r) => ({ pulls: t.pulls + r.pulls, top: t.top + r.counts[2] }), { pulls: 0, top: 0 });

  const pickupGot = pickups.reduce((n, c) => n + (rec.got[c.id] ?? 0), 0);
  const topRate = rec.pulls > 0 ? `${((rec.counts[2] / rec.pulls) * 100).toFixed(2)}%` : "–";
  const owned = [3, 2].map((rarity) => ({
    rarity,
    cards: pool
      .filter((c) => c.rarity === rarity && (rec.got[c.id] || rec.exchanged[c.id]))
      .map((c) => ({ card: c, got: rec.got[c.id] ?? 0, exchanged: rec.exchanged[c.id] ?? 0 })),
  }));

  return (
    <div className={`sim-grid sim-${lane}`}>
      <section className="sim-main" aria-label="뽑기">
        <BannerArt image={image} alt={`${banner.label} 픽업 배너`} />
        <div className="sim-actions">
          <button type="button" className="sim-pull" onClick={() => pull(1)}>
            1회 뽑기
            <small>{num(JEWELS_PER_PULL)} 쥬얼</small>
          </button>
          <button type="button" className="sim-pull sim-pull-10" onClick={() => pull(10)}>
            10회 뽑기
            <small>{num(JEWELS_PER_PULL * 10)} 쥬얼</small>
            <small>10번째 칸은 {rarityName[2]} 이상</small>
          </button>
        </div>

        <div className="sim-results" aria-live="polite">
          {results.length === 0 ? (
            <p className="sim-empty">
              뽑기 버튼을 누르면 나온 {lane === "train" ? "우마무스메" : "카드"}가 여기에 보여요.
            </p>
          ) : (
            <ol className={`rc-list${results.length === 1 ? " is-single" : ""}`}>
              {results.map(({ card, key }, i) => (
                <li
                  key={key}
                  className={`rc rc-r${card.rarity}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <CardArt lane={lane} src={card.art} fallback={card.art} />
                  <span className="rc-badges">
                    <span className="rc-rarity">{rarityName[card.rarity]}</span>
                    {card.pickup && <span className={`chip chip-${lane}`}>픽업</span>}
                  </span>
                  <b className="rc-name" title={card.title ? `${card.name} ${card.title}` : card.name}>
                    {card.name}
                  </b>
                </li>
              ))}
            </ol>
          )}
        </div>

        <Ceiling lane={lane} points={rec.points} pickups={pickups} onExchange={exchange} />
      </section>

      <aside className="sim-side">
        <section className="box" aria-labelledby="sim-stats">
          <div className="box-head">
            <h2 id="sim-stats">이 배너 기록</h2>
            {rec.pulls > 0 && (
              <button type="button" className="sim-reset" onClick={reset}>
                기록 지우기
              </button>
            )}
          </div>
          <dl className="stats">
            <div>
              <dt>뽑은 횟수</dt>
              <dd>{num(rec.pulls)}회</dd>
            </div>
            <div>
              <dt>쓴 쥬얼</dt>
              <dd>{num(rec.pulls * JEWELS_PER_PULL)}</dd>
            </div>
            <div>
              <dt>
                {rarityName[3]} 나온 {countWord}
              </dt>
              <dd>
                {num(rec.counts[2])}
                {countUnit} <small>{topRate}</small>
              </dd>
            </div>
            <div>
              <dt>픽업 나온 {countWord}</dt>
              <dd>
                {num(pickupGot)}
                {countUnit}
              </dd>
            </div>
          </dl>
          <p className="stats-lane">
            {lane === "train" ? "육성" : "서포트"} 배너 전체 {num(laneTotal.pulls)}회, {rarityName[3]}{" "}
            {num(laneTotal.top)}
            {countUnit}
          </p>

          {owned.some((g) => g.cards.length > 0) && (
            <div className="owned">
              {owned.map((g) => {
                if (g.cards.length === 0) return null;
                const list = (
                  <ul>
                    {g.cards.map(({ card, got, exchanged }) => (
                      <li key={card.id}>
                        <span>
                          {card.name}
                          {card.pickup && <i className={`owned-pick owned-pick-${lane}`}>픽업</i>}
                        </span>
                        <b>
                          ×{got + exchanged}
                          {exchanged > 0 && <small> 교환 {exchanged}</small>}
                        </b>
                      </li>
                    ))}
                  </ul>
                );
                // 최고 레어도는 늘 펼쳐 두고, 금방 길어지는 아래 레어도 목록은 접어 둔다
                return g.rarity === 3 ? (
                  <div key={g.rarity}>
                    <h3>
                      {rarityName[g.rarity]} {g.cards.length}종
                    </h3>
                    {list}
                  </div>
                ) : (
                  <details key={g.rarity} className="owned-more">
                    <summary>
                      {rarityName[g.rarity]} {g.cards.length}종
                    </summary>
                    {list}
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <details className="box rates">
          <summary>제공 비율</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">레어도</th>
                <th scope="col">1–9번째</th>
                <th scope="col">10번째</th>
              </tr>
            </thead>
            <tbody>
              {[3, 2, 1].map((r) => (
                <tr key={r}>
                  <th scope="row">{rarityName[r]}</th>
                  <td>{pct(sums[r])}</td>
                  <td>{pct(lastSums[r])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pickups.length > 0 && (
            <ul className="rates-picks">
              {pickups.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.name} <small>{c.title}</small>
                  </span>
                  <b>{pct(c.weight)}</b>
                </li>
              ))}
            </ul>
          )}
          <p className="rates-note">
            {rarityName[3]} {pool.filter((c) => c.rarity === 3).length}종, {rarityName[2]}{" "}
            {pool.filter((c) => c.rarity === 2).length}종, {rarityName[1]} {pool.filter((c) => c.rarity === 1).length}종이
            나와요.
          </p>
        </details>
      </aside>
    </div>
  );
}

type CeilingProps = { lane: Lane; points: number; pickups: PoolCard[]; onExchange: (c: PoolCard) => void };

// 천장 포인트를 노선 한 구간으로 그린다. 0에서 출발해 200번째 역에서 픽업 카드와 교환
function Ceiling({ lane, points, pickups, onExchange }: CeilingProps) {
  const filled = Math.min(points, CEILING) / CEILING;
  const ready = points >= CEILING && pickups.length > 0;
  return (
    <section className={`ceil ceil-${lane}${ready ? " is-ready" : ""}`} aria-labelledby="ceil-title">
      <div className="ceil-head">
        <h2 id="ceil-title">천장</h2>
        <p>
          <b>{points}</b> / {CEILING} 포인트
          {points >= CEILING * 2 && <small> 교환 {Math.floor(points / CEILING)}회 가능</small>}
        </p>
      </div>
      <div
        className="ceil-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={CEILING}
        aria-valuenow={Math.min(points, CEILING)}
        aria-label="천장 포인트"
      >
        <span className="ceil-fill" style={{ width: `${filled * 100}%` }} />
        {[0, 50, 100, 150].map((p) => (
          <span key={p} className={`ceil-st${points >= p ? " is-passed" : ""}`} style={{ left: `${(p / CEILING) * 100}%` }}>
            <small>{p}</small>
          </span>
        ))}
        <span className="ceil-end">
          <small>교환</small>
        </span>
      </div>
      {ready ? (
        <div className="ceil-swap">
          <p>픽업 카드 하나와 바꿀 수 있어요.</p>
          <ul>
            {pickups.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onExchange(c)}>
                  {c.name} 교환
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        pickups.length === 0 && <p className="ceil-left">이 배너는 픽업 카드가 없어서 교환할 수 없어요.</p>
      )}
    </section>
  );
}
