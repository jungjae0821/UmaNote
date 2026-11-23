"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { SupportTypeIcon } from "@/components/SupportTypeIcon";
import type { ViewBanner } from "@/lib/bannerView";
import { formatMdTime, relative } from "@/lib/dates";
import { buildOdds, draw } from "@/lib/gachaDraw";
import { formatRate, type PoolCard } from "@/lib/gachaPool";
import type { Lane } from "@/lib/gametora";

const STORAGE_KEY = "umanote:sim:v2";
const JEWELS_PER_PULL = 150;
const CEILING = 200;
const RARITY_NAME: Record<Lane, string[]> = { train: ["", "★1", "★2", "★3"], support: ["", "R", "SR", "SSR"] };

type BannerRecord = {
  lane: Lane;
  pulls: number;
  /** 천장 포인트. 교환하면 200씩 줄어든다 */
  points: number;
  /** 뽑아서 나온 레어도별 수 [★1, ★2, ★3] */
  counts: [number, number, number];
  /** 카드 ID → 뽑아서 나온 수 */
  got: Record<string, number>;
  /** 카드 ID → 천장으로 교환한 수 */
  exchanged: Record<string, number>;
  /** 최근 뽑기 기록 (최신이 앞) */
  log: { round: number; times: number; top: string[] }[];
};
type Store = Record<string, BannerRecord>;

const emptyRecord = (lane: Lane): BannerRecord => ({ lane, pulls: 0, points: 0, counts: [0, 0, 0], got: {}, exchanged: {}, log: [] });

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}
function persist(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 기록이 남는다
  }
}

const num = (n: number) => n.toLocaleString("ko-KR");

export function Simulator({ lane, banner, pool, today }: { lane: Lane; banner: ViewBanner; pool: PoolCard[]; today: number }) {
  const [store, setStore] = useState<Store>({});
  const [results, setResults] = useState<{ card: PoolCard; key: number }[]>([]);
  const [round, setRound] = useState(0);
  const [show, setShow] = useState<number[]>([3, 2, 1]);

  useEffect(() => setStore(load()), []);

  const rec = store[banner.id] ?? emptyRecord(lane);
  const names = RARITY_NAME[lane];
  const pickups = useMemo(() => pool.filter((c) => c.pickup), [pool]);
  const { normal, last } = useMemo(() => buildOdds(pool), [pool]);

  function update(fn: (r: BannerRecord) => BannerRecord) {
    setStore((prev) => {
      const next = { ...prev, [banner.id]: fn(prev[banner.id] ?? emptyRecord(lane)) };
      persist(next);
      return next;
    });
  }

  function pull(times: 1 | 10) {
    const cards = Array.from({ length: times }, (_, i) => draw(times === 10 && i === 9 ? last : normal));
    const nextRound = round + 1;
    update((r) => {
      const counts: BannerRecord["counts"] = [...r.counts];
      const got = { ...r.got };
      for (const c of cards) {
        counts[c.rarity - 1] += 1;
        got[c.id] = (got[c.id] ?? 0) + 1;
      }
      const top = cards.filter((c) => c.rarity === 3).map((c) => c.name);
      const log = [{ round: r.log.length ? r.log[0].round + 1 : 1, times, top }, ...r.log].slice(0, 30);
      return { ...r, pulls: r.pulls + times, points: r.points + times, counts, got, log };
    });
    setRound(nextRound);
    setResults(cards.map((card, i) => ({ card, key: nextRound * 10 + i })));
  }

  function exchange(card: PoolCard) {
    update((r) => (r.points < CEILING ? r : { ...r, points: r.points - CEILING, exchanged: { ...r.exchanged, [card.id]: (r.exchanged[card.id] ?? 0) + 1 } }));
  }

  function reset() {
    if (!window.confirm("이 배너의 뽑기 기록과 천장 포인트를 지울까요?")) return;
    setStore((prev) => {
      const next = { ...prev };
      delete next[banner.id];
      persist(next);
      return next;
    });
    setResults([]);
  }

  const pickupGot = pickups.reduce((n, c) => n + (rec.got[c.id] ?? 0), 0);
  const topRate = rec.pulls > 0 ? `${((rec.counts[2] / rec.pulls) * 100).toFixed(2)}%` : "–";
  const shown = results.filter((r) => show.includes(r.card.rarity));
  const filled = Math.min(rec.points, CEILING) / CEILING;
  const ready = rec.points >= CEILING && pickups.length > 0;
  const status = relative(banner.start, banner.end, today);

  return (
    <div className="sim">
      <div className="sim-main stack">
        <section className="sim-banner panel glass">
          {banner.art ? <img src={banner.art} alt="" /> : <span className="art-fallback sim-fallback" aria-hidden>{pickups.slice(0, 4).map((c) => <img key={c.id} src={c.art} alt="" />)}</span>}
          <div>
            <div className="sim-b-top">
              <span className="sim-period">
                {formatMdTime(banner.startTs)} ~ {formatMdTime(banner.endTs)}
              </span>
              {status.state !== "ended" && (
                <span className={`chip${status.urgent ? " urgent" : ""}`}>{status.text}</span>
              )}
            </div>
            <ul className="sim-picks">
              {pickups.map((c) => (
                <li key={c.id}>
                  <img src={c.art} alt="" loading="lazy" />
                  <span>
                    <small>{c.title}</small>
                    <b>
                      <SupportTypeIcon type={c.supportType} />
                      {c.name}
                    </b>
                  </span>
                  <span className="tag">{formatRate(c.weight)}</span>
                </li>
              ))}
              {pickups.length === 0 && <li className="sim-none">픽업 대상이 없는 배너입니다.</li>}
            </ul>
          </div>
        </section>

        <section className="sim-pull panel glass" aria-label="뽑기">
          <div className="sim-actions">
            <button type="button" className="pull-btn" onClick={() => pull(1)}>
              단차
              <small>{num(JEWELS_PER_PULL)} 쥬얼</small>
            </button>
            <button type="button" className="pull-btn ten" onClick={() => pull(10)}>
              10연차
              <small>
                {num(JEWELS_PER_PULL * 10)} 쥬얼 · 10번째 {names[2]} 이상
              </small>
            </button>
          </div>
          {results.length > 0 && (
            <div className="sim-filter" role="group" aria-label="결과 등급">
              {[3, 2, 1].map((r) => (
                <button
                  key={r}
                  type="button"
                  className="filter-chip"
                  aria-pressed={show.includes(r)}
                  onClick={() => setShow((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))}
                >
                  {names[r]}
                </button>
              ))}
            </div>
          )}
          <div className="sim-results" aria-live="polite">
            {results.length === 0 ? (
              <p className="empty">단차나 10연차를 누르면 나온 {lane === "train" ? "우마무스메" : "카드"}가 여기에 나옵니다.</p>
            ) : shown.length === 0 ? (
              <p className="empty">고른 등급의 결과가 없습니다.</p>
            ) : (
              <ol className="rc-list">
                {shown.map(({ card, key }, i) => (
                  <li key={key} className={`rc r${card.rarity}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <span className="rc-art">
                      <img src={card.art} alt="" />
                      <span className="rc-rarity">{names[card.rarity]}</span>
                      {card.pickup && <span className="rc-pick">픽업</span>}
                    </span>
                    <b title={`${card.name} ${card.title}`}>
                      <SupportTypeIcon type={card.supportType} />
                      {card.name}
                    </b>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      <aside className="sim-side stack">
        <section className="panel glass" aria-labelledby="ceil-title">
          <div className="side-head">
            <h2 id="ceil-title">천장</h2>
            <p>
              <b>{num(rec.points)}</b> / {CEILING} 포인트
            </p>
          </div>
          <div className="ceil-track" role="progressbar" aria-valuemin={0} aria-valuemax={CEILING} aria-valuenow={Math.min(rec.points, CEILING)} aria-label="천장 포인트">
            <span style={{ width: `${filled * 100}%` }} />
          </div>
          {ready ? (
            <div className="ceil-swap">
              <p>픽업 하나와 바꿀 수 있습니다.</p>
              {pickups.map((c) => (
                <button key={c.id} type="button" className="btn primary" onClick={() => exchange(c)}>
                  <SupportTypeIcon type={c.supportType} />
                  {c.name} 교환
                </button>
              ))}
            </div>
          ) : (
            <p className="ceil-left">{pickups.length === 0 ? "픽업이 없어 교환할 수 없는 배너입니다." : `교환까지 ${num(CEILING - rec.points)}회`}</p>
          )}
        </section>

        <section className="panel glass" aria-labelledby="stat-title">
          <div className="side-head">
            <h2 id="stat-title">이 배너 기록</h2>
            {rec.pulls > 0 && (
              <button type="button" className="btn" onClick={reset}>
                <Icon name="reset" />
                초기화
              </button>
            )}
          </div>
          <dl className="stats">
            <div>
              <dt>총 횟수</dt>
              <dd>{num(rec.pulls)}회</dd>
            </div>
            <div>
              <dt>쓴 쥬얼</dt>
              <dd>{num(rec.pulls * JEWELS_PER_PULL)}</dd>
            </div>
            <div>
              <dt>{names[3]}</dt>
              <dd>
                {num(rec.counts[2])} <small>{topRate}</small>
              </dd>
            </div>
            <div>
              <dt>픽업 획득</dt>
              <dd>{num(pickupGot + Object.values(rec.exchanged).reduce((a, b) => a + b, 0))}</dd>
            </div>
          </dl>
          {rec.log.length > 0 && (
            <ol className="sim-log">
              {rec.log.map((l) => (
                <li key={l.round}>
                  <span>
                    {l.round}번째 · {l.times === 10 ? "10연차" : "단차"}
                  </span>
                  <b>{l.top.length ? l.top.join(", ") : `${names[3]} 없음`}</b>
                </li>
              ))}
            </ol>
          )}
        </section>

      </aside>
    </div>
  );
}
