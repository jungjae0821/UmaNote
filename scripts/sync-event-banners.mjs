// 일본서버 공식 공지(umapyoi.net 미러)에서 챔피언스 미팅·리그 오브 히어로즈·레전드 레이스의
// "개최" 배너를 찾아 회차 ID에 붙인다. 한국서버는 일본보다 1년 넘게 늦어서 스냅숏으로 충분하다.
// 실행: node scripts/sync-event-banners.mjs
import fs from "node:fs/promises";

const NEWS = "https://umapyoi.net/api/v1/news";
const GAMETORA = "https://gametora.com/data";
const DAY = 86_400;
// 공지 시각은 일본 시간 기준 날짜로 비교한다
const jpDay = (ts) => Math.floor((ts + 9 * 3600) / DAY);

const json = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

async function allNews() {
  const ids = await json(NEWS);
  const news = [];
  // 한 번에 32건까지만 준다
  for (let off = 0; off < ids.length; off += 128) {
    const pages = await Promise.all([0, 32, 64, 96].map((d) => json(`${NEWS}/latest/32/${off + d}`).catch(() => [])));
    news.push(...pages.flat().filter((n) => n?.announce_id && n.image));
  }
  return news;
}

async function gametora(key) {
  const manifest = await json(`${GAMETORA}/manifests/umamusume.json`);
  return json(`${GAMETORA}/umamusume/${key}.${manifest[key]}.json`);
}

const [news, cm, loh, legend] = await Promise.all([
  allNews(),
  gametora("events/champions-meeting"),
  gametora("events/league-of-heroes"),
  gametora("events/legend-race"),
]);

const RULES = {
  cm: /^レースイベント「チャンピオンズミーティング[^」]*」開催！$/,
  loh: /^レースイベント「リーグ オブ ヒーローズ」開催！$/,
  legend: /^レジェンドレース開催！$/,
};
const candidates = Object.fromEntries(
  Object.entries(RULES).map(([kind, re]) => [kind, news.filter((n) => re.test(n.title.trim())).map((n) => ({ day: jpDay(n.post_at), image: n.image.split("?")[0] }))]),
);

const banners = {};
const misses = [];
// 회차 시작일과 가장 가까운 개최 공지. 공지는 시작 며칠 뒤(본선 시작일)에 올라온다
function attach(kind, id, start) {
  const day = jpDay(start);
  const best = candidates[kind]
    .map((c) => ({ ...c, delta: c.day - day }))
    .filter((c) => c.delta >= -2 && c.delta <= 8)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
  if (best) banners[`${kind}-${id}`] = best.image;
  else if (start * 1000 < Date.now()) misses.push(`${kind}-${id}`);
}
for (const e of cm) attach("cm", e.id, e.start);
for (const e of loh) attach("loh", e.id, e.start);
// 레전드 레이스 ID는 앱과 같이 첫 경주 ID를 쓴다
for (const e of legend) if (e.races?.[0]) attach("legend", e.races[0].id, e.start);

const out = { checkedAt: new Date().toISOString().slice(0, 10), reference: "https://umapyoi.net/api/v1/news", banners };
await fs.writeFile(new URL("../lib/data/eventBanners.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`배너 ${Object.keys(banners).length}개, 못 찾은 지난 회차 ${misses.length}개`, misses.join(" "));
