import { monthStart, SERVER_GAP_DAYS } from "./dates.ts";
import type { Income } from "./jewelPlan.ts";
import { ZERO_REWARDS, type Rewards } from "./rewards.ts";

const SHARD_HISTORY = "https://wikiwiki.jp/vip_umamusu/虹の結晶片（仮";
const LAB = "https://wikiwiki.jp/vip_umamusu/アグネスタキオンの因子研究";
const date = (s: string) => { const [y,m,d] = s.split("-").map(Number); return monthStart(y,m)+d-1+SERVER_GAP_DAYS; };
const entry = (id: string, category: string, name: string, start: string, end: string, rewards: Partial<Rewards>, reference: string, condition = "기간 내 보상 전부 획득"): Income => ({
  id, source: "limited", category, name, startKr: date(start), endKr: date(end), ...ZERO_REWARDS, ...rewards, reference, condition,
});

/** Reference planner's event history stops in April 2026; later confirmed editions. */
export function supplementalIncomes(): Income[] {
  const rows: Income[] = [];
  rows.push(entry('anniversary-gift-first','anniversary-gift','1주년 기념 쥬얼 선물','2022-02-24','2022-02-24',{free:3000},'https://game.watch.impress.co.jp/docs/news/1390588.html'));
  rows.push(entry('anniversary-gift-fourth','anniversary-gift','4주년 기념 쥬얼 선물','2025-02-24','2025-02-24',{free:3000},'https://prtimes.jp/main/html/rd/p/000001067.000005593.html'));
  // Anniversary-only extra chapters; normal character/main stories remain outside scope.
  rows.push(entry('event-story-5th','event-story','5주년 기념 스토리 전 3화','2026-02-24','2026-03-30',{free:60},'https://umamusume.jp/news/detail?id=3089','기념 스토리 3화 최초 열람; 각 20쥬얼'));
  rows.push(entry('event-story-5half','event-story','5.5주년 기념 스토리 전 3화','2026-08-27','2026-09-30',{free:60},'https://dmg.umamusume.jp/news/detail/?id=3404','전체 목표 달성 후 기념 스토리 3화 최초 열람; 각 20쥬얼'));
  for (const [i,start,end] of [
    [21,"2026-05-11","2026-05-20"], [22,"2026-06-15","2026-06-23"], [23,"2026-07-10","2026-07-21"],
    [24,"2026-09-11","2026-09-18"], [25,"2026-10-13","2026-10-22"], [26,"2026-11-10","2026-11-19"],
  ] as const) rows.push(entry(`research-${i}`, "research", i === 24 ? "아그네스 타키온의 궁극 인자연구" : `아그네스 타키온의 인자연구 #${i}`, start, end, { free: 1200, rainbowShards: 1, goldShards: 1 }, LAB));
  for (const [i,start,end] of [[13,"2026-06-29","2026-07-10"],[14,"2026-10-26","2026-11-08"]] as const)
    rows.push(entry(`exam-${i}`, "exam", `트레이너 기능시험 #${i} 교환소`, start,end,{ free:900,trainTickets:3,supportTickets:3,rainbowShards:1,goldShards:1 },"https://game8.jp/umamusume/417292","트라이얼 코인으로 교환소 재고 전부 교환; 미션 보상 별도"));
  for (const [i,start,end] of [
    [1,"2022-10-19","2022-10-28"],[2,"2023-01-20","2023-01-30"],[3,"2023-04-28","2023-05-10"],[4,"2023-08-14","2023-08-24"],[5,"2024-08-24","2024-09-05"],
  ] as const) rows.push(entry(`walk-${i}`,"walk","우마 산책 캠페인",start,end,{free:150,goldShards:1},"https://game8.jp/umamusume/488111","세 장소의 1회 한정 보상 획득"));
  for (const [id,name,start,end,free,round] of [
    ["white-era","하얀 시대","2025-12-11","2025-12-14",250,"5R"],
    ["beyond","Beyond Memories","2026-08-24","2026-08-27",300,"6R"],
  ] as const) {
    const reference=id === "beyond" ? "https://gamewith.jp/uma-musume/article/show/573486" : "https://gamewith.jp/uma-musume/article/show/534282";
    rows.push(entry(`raid-${id}`,"raid",`${name} 개인 보상`,start,end,{free,rainbowShards:1,goldShards:1},reference,"개인 목표 달성"));
    rows.push(entry(`raid-${id}-community`,"raid-community",`${name} 전체 달성 보상`,end,end,{specialTickets:{[`★2 이상 확정 메이크 데뷔 ${round}`]:2,[`SR 이상 확정 메이크 데뷔 ${round}`]:2,[`SSR 확정 메이크 데뷔 ${round}`]:1}},reference,"집계 완료 후 전체 목표 달성 및 이벤트 참여 보상"));
  }
  rows.push(entry("top-umadol-community","raid-community","모두 함께 톱 우마돌 프로젝트 전체 달성 보상","2022-04-05","2022-04-08",{specialTickets:{"★2 이상 확정 메이크 데뷔 제2R":1,"SSR 확정 메이크 데뷔 제2R":1}},"https://game8.jp/umamusume/446703","이벤트에 참여하고 전체 팬 수 목표 달성"));
  for (const [start,end] of [
    ["2026-02-24","2026-03-30"],["2026-08-24","2026-09-30"],
  ]) rows.push(entry(`anniversary-shop-${start}`,"shop","주년 기념 한정 교환소",start,end,{rainbowShards:1,goldShards:1},SHARD_HISTORY,"기념 교환소 결정 조각 재고 교환"));
  for(const [label,first,second,third,end] of [
    ["5주년","2026-02-14","2026-02-24","2026-03-11","2026-03-30"],
    ["5.5주년","2026-08-14","2026-08-24","2026-09-11","2026-09-30"],
  ]){
    const source="https://wikiwiki.jp/vip_umamusu/ショップ";
    rows.push(entry(`${label}-friend-shop`,"event-shop",`${label} 기념 친구 Pt 교환소`,first,end,{trainTickets:2,supportTickets:2},source,"기념 교환소 한정 재고를 친구 Pt로 교환"));
    rows.push(entry(`${label}-money-tickets`,"event-shop",`${label} 기념 머니 교환소 티켓`,second,end,{trainTickets:2,supportTickets:2,specialTickets:{"★2 이상 확정 메이크 데뷔 (기념 교환소 지정 풀)":3,"SR 이상 확정 메이크 데뷔 (기념 교환소 지정 풀)":3}},source,"머니·친구 Pt의 확정권 재고 및 머니 일반권 재고 교환"));
    rows.push(entry(`${label}-money-tickets-3`,"event-shop",`${label} 기념 교환소 제3탄 추가 티켓`,third,end,{trainTickets:1,supportTickets:1},source,"제3탄에서 추가된 머니 교환소 재고 교환"));
  }
  rows.push(entry("crystal-release-gift","operator-gift","해방 결정 도입 기념 선물","2021-09-21","2021-09-21",{rainbowCrystals:1,goldCrystals:1},SHARD_HISTORY));
  return rows;
}
