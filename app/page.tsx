import Link from "next/link";
import { HomeJewels } from "@/components/HomeJewels";
import { Icon } from "@/components/Icon";
import { Live } from "@/components/Live";
import { PickupCard } from "@/components/PickupCard";
import { charIcon } from "@/lib/art";
import { formatMd, todayKr, untilText } from "@/lib/dates";
import { EVENT_KIND_NAME, getBanners, getCards, getCharacters, getEvents, type Banner } from "@/lib/gametora";
import { upcomingBirthdays } from "@/lib/birthdays";
import "./home.css";

export const revalidate = 3600;

const isLive = (b: { start: number; end: number }, today: number) => b.start <= today && today <= b.end;

export default async function Home() {
  const today = todayKr();
  const cards = await getCards();
  const [banners, events, characters] = await Promise.all([getBanners(cards), getEvents(cards), getCharacters()]);

  const regular = banners.filter((b) => !b.paidOnly);
  const liveBanners = regular.filter((b) => isLive(b, today));
  const liveTrain = liveBanners.filter((b) => b.lane === "train");
  const liveSupport = liveBanners.filter((b) => b.lane === "support");
  const nextOf = (lane: Banner["lane"]) => regular.find((b) => b.lane === lane && b.start > today);
  const nextTrain = nextOf("train");
  const nextSupport = nextOf("support");
  const pickupEnd = Math.min(...liveBanners.map((b) => b.end));

  const story = events.filter((e) => e.kind === "story");
  const liveStory = story.find((e) => isLive(e, today));
  const nextStory = story.find((e) => e.start > today);
  const heroStory = liveStory ?? nextStory;
  const races = events
    .filter((e) => e.kind !== "story" && e.end >= today && e.start <= today + 45)
    .slice(0, 4);
  const birthdays = upcomingBirthdays(characters, today, 5);
  // 히어로 바탕은 보너스 캐릭터의 대표색으로
  const colorOf = (charId?: number) => characters.find((c) => c.charId === charId)?.color;
  const heroColors = (heroStory?.bonusCards ?? []).slice(0, 2).map((c) => colorOf(c.charId)).filter(Boolean);
  const heroStyle = heroColors.length
    ? { background: `linear-gradient(120deg, ${heroColors[0]} 0%, ${heroColors[1] ?? heroColors[0]} 100%)` }
    : undefined;

  return (
    <>
      <div className="page-head">
        <h1>진행 중인 컨텐츠</h1>
      </div>

      <div className="home">
        <div className="home-main stack">
          {heroStory && (
            <section>
              <h2 className="section-title">이벤트</h2>
              <article className="hero" style={heroStyle}>
                <img
                  className="hero-art"
                  src={heroStory.art}
                  alt={heroStory.name}
                  fetchPriority="high"
                />
                <div className="hero-over">
                  <div>
                    <p className="hero-kind">
                      {EVENT_KIND_NAME.story} · {formatMd(heroStory.start)} ~ {formatMd(heroStory.end)} ·{" "}
                      <Live start={heroStory.start} end={heroStory.end} today={today} dark />
                    </p>
                    <h3 className="hero-name">{heroStory.name}</h3>
                  </div>
                  <div className="hero-btns">
                    <Link href="/calculator" className="btn on-image">
                      <Icon name="calc" />
                      사료 계산기
                    </Link>
                    <Link href="/simulator" className="btn on-image">
                      <Icon name="cards" />
                      뽑기 시뮬레이션
                    </Link>
                  </div>
                </div>
              </article>
            </section>
          )}

          <section>
            <h2 className="section-title">픽업 가챠</h2>
            <div className="panel glass">
              <div className="panel-head">
                <b>진행 중 픽업</b>
                {liveBanners.length > 0 && <Live start={today} end={pickupEnd} today={today} />}
              </div>
              {liveBanners.length === 0 ? (
                <p className="empty">지금 진행 중인 픽업이 없습니다.</p>
              ) : (
                <div className="ccards">
                  {[...liveTrain, ...liveSupport].flatMap((b) =>
                    b.pickups.map((p) => (
                      <PickupCard
                        key={`${b.id}-${p.card.id}`}
                        card={p.card}
                        rate={p.rate}
                        isNew={p.isNew}
                        action={{ href: `/simulator?lane=${b.lane}&banner=${b.id}`, label: "시뮬레이션" }}
                      />
                    )),
                  )}
                </div>
              )}
              {(nextTrain || nextSupport) && (
                <div className="next-rows">
                  {[nextTrain, nextSupport].map(
                    (b) =>
                      b && (
                        <Link key={b.id} href={`/futures?banner=${b.id}`} className="next-row">
                          <span className="next-when">
                            다음 {b.lane === "train" ? "육성" : "서포트"} 픽업 · {formatMd(b.start)} 시작
                          </span>
                          <span className="next-faces">
                            {b.pickups.slice(0, 3).map((p) => (
                              <img key={p.card.id} src={p.card.art} alt="" />
                            ))}
                          </span>
                          <b>{[...new Set(b.pickups.map((p) => p.card.name))].join(", ") || "픽업 정보 없음"}</b>
                          <Live start={b.start} end={b.end} today={today} />
                        </Link>
                      ),
                  )}
                </div>
              )}
            </div>
          </section>

          {races.length > 0 && (
            <section>
              <h2 className="section-title">경기</h2>
              <div className="races">
                {races.map((e) => (
                  <Link key={e.id} href={`/events#${e.id}`} className="race panel glass">
                    {e.rivals && e.rivals[0] && <img src={e.rivals[0].art} alt="" />}
                    <div>
                      <div className="race-top">
                        <b>{EVENT_KIND_NAME[e.kind]}</b>
                        <Live start={e.start} end={e.end} today={today} />
                      </div>
                      <p className="race-name">{e.name}</p>
                      <div className="tags-row">
                        <span className="tag">
                          {formatMd(e.start)} ~ {formatMd(e.end)}
                        </span>
                        {e.race && (
                          <span className="tag">
                            {e.race.track ? `${e.race.track} ` : ""}
                            {e.race.ground} {e.race.distance}m
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="section-title">그 외 컨텐츠</h2>
            <div className="panel glass rows">
              {liveStory && (liveStory.rewardSupports ?? []).length > 0 && (
                <div className="row">
                  <b className="row-label">이벤트 보상</b>
                  <div>
                    <p className="row-name">{liveStory.rewardSupports!.map((c) => `${c.name} (서포트 카드)`).join(", ")}</p>
                    <p className="row-sub">{liveStory.name} 보상</p>
                  </div>
                  <Live start={liveStory.start} end={liveStory.end} today={today} />
                </div>
              )}
              {nextStory && (
                <div className="row">
                  <b className="row-label">다음 이벤트</b>
                  <div>
                    <p className="row-name">{nextStory.name}</p>
                    <p className="row-sub">
                      {EVENT_KIND_NAME.story} · {formatMd(nextStory.start)} ~ {formatMd(nextStory.end)}
                    </p>
                  </div>
                  <Live start={nextStory.start} end={nextStory.end} today={today} />
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="home-side stack">
          <section>
            <h2 className="section-title">다가오는 생일</h2>
            <div className="panel glass bd-list">
              {birthdays.map((b) => (
                <div key={b.charId} className="bd">
                  <img src={charIcon(b.charId)} alt="" loading="lazy" />
                  <div>
                    <b>{b.name}</b>
                    <span>
                      {b.month}/{b.day}
                    </span>
                  </div>
                  <span className={`chip${b.until === 0 ? " urgent" : ""}`}>{untilText(b.until)}</span>
                </div>
              ))}
              <Link href="/birthdays" className="more">
                생일달력
                <Icon name="chevronRight" />
              </Link>
            </div>
          </section>
          <section>
            <h2 className="section-title">내 쥬얼</h2>
            <HomeJewels today={today} />
          </section>
        </aside>
      </div>
    </>
  );
}
