import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { itemRewards, addRewards, hasRewards } from "../lib/rewards.ts";
import { catalogIncomes, mergeIncomes, type RewardRecord } from "../lib/rewardCatalog.ts";
import { supplementalIncomes } from "../lib/rewardSupplement.ts";
import { cmJewels, competitionIncomes, EMPTY_COMPETITION, giftIncomes, lohJewels, LEGEND_RACE_FIRST_WIN, LEGEND_RACE_WIN_REWARD, LEGEND_RACE_TROPHY_REWARD } from "../lib/jewelSources.ts";
import { monthStart, SERVER_GAP_DAYS } from "../lib/dates.ts";
import { plan, pullsFor, type PlanInput } from "../lib/jewelPlan.ts";
import { SHEET_REWARDS } from "../lib/sheetRewards.ts";
import { isEventReward } from "../lib/rewardScope.ts";

const data=JSON.parse(readFileSync(new URL("../lib/data/rewards.json",import.meta.url),"utf8")) as {checkedAt:string; rows:RewardRecord[]};
const rows=mergeIncomes(catalogIncomes(data.rows),supplementalIncomes());
const jp=(y:number,m:number,d:number)=>monthStart(y,m)+d-1+SERVER_GAP_DAYS;
// 시트의 첫 트레이닝 패스 시작일이 들어가는 10일
const PASS0=SHEET_REWARDS.trainingPass.datesKr[0];
const base:PlanInput={today:PASS0-2,target:PASS0+8,paid:0,free:0,trainTickets:0,supportTickets:0,monthly:false,pass:"none",teamClass:0,incomes:[]};

test("일본 아이템 ID별로 결정·조각을 구분하고 확정 티켓을 일반 뽑기에 더하지 않는다",()=>{
 const r=itemRewards([{id:144,num:2},{id:145,num:1},{id:149,num:19},{id:150,num:4},{id:41,num:2},{id:111,num:3},{id:999,num:1,name:"SSR確定ガチャチケット"}]);
 const p=plan({...base,target:0,...r});
 assert.equal(p.rainbowCrystals,2);assert.equal(p.goldCrystals,1);assert.equal(p.rainbowShards,19);assert.equal(p.goldShards,4);
 assert.equal(p.specialTickets?.SSR確定ガチャチケット,1);
 assert.equal(pullsFor(p,"support",false).total,3);
 assert.ok(hasRewards(itemRewards([{id:149,num:1}])));
});

test("보유 결정·조각, 이벤트 획득, 프리미엄 패스 조각을 별도로 더한다",()=>{
 const event={id:"research",name:"research",source:"limited" as const,startKr:PASS0,endKr:PASS0+2,free:1200,trainTickets:0,supportTickets:0,rainbowShards:1,goldShards:1};
 const p=plan({...base,rainbowCrystals:2,rainbowShards:19,pass:"premium",incomes:[event,event]});
 assert.equal(p.rainbowCrystals,2);assert.equal(p.rainbowShards,21);assert.equal(p.goldShards,1);
 assert.equal(p.earnedMaterials.rainbowShards,2);assert.equal(p.eventFree,1200);
 assert.equal(plan({...base,incomes:[event],excludedIncomeIds:[event.id]}).eventFree,0);
});

test("일본 인자연구 26회와 2024년 3월 보상 증액을 반영한다",()=>{
 const labs=rows.filter(r=>r.category==="research");
 assert.equal(labs.length,26);
 assert.equal(labs.find(r=>r.id==="research-4")?.free,900);
 assert.equal(labs.find(r=>r.id==="research-5")?.free,1200);
 assert.ok(labs.every(r=>r.rainbowShards===1&&r.goldShards===1));
 assert.equal(labs.find(r=>r.id==="research-14")?.startKr,jp(2025,9,9));
 const p=plan({...base,today:jp(2025,9,8),target:jp(2025,9,20),incomes:labs});
 assert.equal(p.eventFree,1200);assert.equal(p.rainbowShards,1);
});

test("기능시험 14회 교환소와 첫 클리어를 분리하고 일본 2024년 2월부터 쥬얼 재고 900",()=>{
 const exams=rows.filter(r=>r.category==="exam");
 assert.equal(exams.length,14);
 for(const r of exams){assert.equal(r.trainTickets,3);assert.equal(r.supportTickets,3);assert.equal(r.rainbowShards,1);assert.equal(r.goldShards,1);}
 assert.equal(exams.find(r=>r.id==="exam-11")?.free,900);
  assert.equal(exams.find(r=>r.id==="exam-6")?.free,900);
  const first=rows.filter(r=>r.category==="exam-first-clear");
  assert.equal(first.length,14);
  assert.equal(first.find(r=>r.id==="exam-first-clear-11")?.free,800);
});

test("로그인 보상을 일차별로 나눠 목표일 뒤의 로그인분을 미리 넣지 않는다",()=>{
 const login=rows.filter(r=>r.source==="login"&&r.name.includes("4.5th Anniversary")&&!r.name.includes("カウントダウン"));
 assert.ok(login.length>=10);
 const start=jp(2025,8,24);
 const daily=login.filter(r=>r.startKr>=start&&r.startKr<start+10);
 assert.equal(addRewards(daily).free,3000);
 const p=plan({...base,today:start-1,target:start+1,incomes:daily});
 assert.equal(p.giftFree,300);
 assert.ok(giftIncomes().every(r=>r.source!=="login"));
});

test("팀·카니발을 랭크·난이도별 첫 클리어·교환소·미션으로 분리해 중복 없이 더한다",()=>{
 assert.equal(rows.filter(r=>r.category==="team"||r.category==="team-rank").length,8);
 assert.equal(rows.filter(r=>r.category==="carnival-first-clear").length,7);
 assert.equal(rows.filter(r=>r.category==="carnival-shop").length,7);
 assert.ok(!data.rows.some(r=>r.id==="mission-2401041"));
 assert.equal(rows.filter(r=>r.id==="mission-2300041").length,1);
 assert.equal(rows.find(r=>r.id==="team-rank-8")?.free,1600);
 assert.equal(rows.find(r=>r.id==="carnival-first-1")?.free,900);
 assert.equal(rows.find(r=>r.id==="carnival-first-7")?.free,1100);
 assert.ok(!rows.some(r=>r.id==="carnival-1"||r.id==="team-8"));
});

test("스토리 포인트·스토리 열람·빙고와 금 조각을 함께 반영한다",()=>{
 const r=rows.find(r=>r.id==="story-1040")!;
 assert.equal(r.free,3000);assert.equal(r.rainbowShards,3);assert.equal(r.goldShards,3);
 assert.equal(r.trainTickets,2);assert.equal(r.supportTickets,2);
});

test("캐릭터 스토리 1~4화는 신규 캐릭터당 80쥬얼을 한 번만 합산한다",()=>{
 const stories=rows.filter(r=>r.category==='character-story');
 assert.ok(stories.length>100);
 assert.ok(stories.every(r=>r.free===80&&r.trainTickets===0&&r.supportTickets===0));
 assert.equal(new Set(stories.map(r=>r.id)).size,stories.length);
 const r=stories.at(-1)!;
 const p=plan({...base,today:r.startKr-1,target:r.startKr+1,incomes:[r,r]});
 assert.equal(p.eventFree,80);
 assert.equal(plan({...base,today:r.startKr-1,target:r.startKr,incomes:[r]}).eventFree,0);
 assert.equal(plan({...base,today:r.startKr,target:r.startKr+2,incomes:[r]}).eventFree,0);
});

test("레전드 레이스는 최초 승리 150과 트로피 100을 합쳐 상대당 총 250쥬얼이다",()=>{
 assert.equal(LEGEND_RACE_WIN_REWARD,150);
 assert.equal(LEGEND_RACE_TROPHY_REWARD,100);
 assert.equal(LEGEND_RACE_FIRST_WIN,250);
 const schedule=[{kind:'legend' as const,id:'legend-test',name:'테스트',startKr:2,endKr:8,raceStartsKr:[2,5]}];
 const rewards=competitionIncomes(schedule,{...EMPTY_COMPETITION,legendRace:true});
 assert.deepEqual(rewards.map(r=>r.free),[250,250]);
 assert.equal(plan({...base,today:0,target:10,incomes:rewards}).competitionFree,500);
 assert.equal(competitionIncomes(schedule,EMPTY_COMPETITION).length,0);
});

test("챔미 2024년 인상, 오픈 B2 오류, LOH 일본 보상과 티켓·조각",()=>{
 assert.equal(cmJewels("grade","A1",jp(2024,4,10)),3000);
 assert.equal(cmJewels("open","B2",jp(2024,4,10)),1050);
 assert.equal(lohJewels(15),3750);
 const r=competitionIncomes([{kind:"loh",id:"loh",name:"",startKr:1,endKr:2}],{...EMPTY_COMPETITION,lohRank:15})[0];
 assert.equal(r.trainTickets,2);assert.equal(r.supportTickets,2);assert.equal(r.rainbowShards,2);assert.equal(r.goldShards,2);
});

test("추가 수집 데이터는 이벤트 보상만 포함하고 월간 교환소·일반 성장 보상은 포함하지 않는다",()=>{
 const excluded=new Set(['monthly-shop','mainStory','permanent','achievement','dailyLegend','umaStory']);
 assert.ok(rows.every(r=>!excluded.has(r.category??'')));
 assert.ok(!rows.some(r=>/^(medal|friend|silver|gold|rainbow|clover)-shop-/.test(r.id)));
 assert.ok(rows.every(r=>r.endKr<jp(2030,1,1)));
});

test("기존 정기 수입에 이벤트·운영 지급을 더하고 추가 수집의 상시 교환소·성장 보상은 제외한다",()=>{
 const event={id:'lab',name:'아그네스 타키온의 인자연구',source:'limited' as const,startKr:PASS0,endKr:PASS0+2,free:1200,trainTickets:1,supportTickets:2,rainbowShards:1};
 const unrelated=[
  {...event,id:'shop',name:'월간 교환소',category:'monthly-shop'},
  {...event,id:'growth',name:'성장 업적',category:'achievement'},
  {...event,id:'normal-login',name:'일반 로그인',source:'login' as const},
 ];
 const gift={...event,id:'broadcast',name:'파카라이브 보상',source:'gift' as const,free:300,trainTickets:0,supportTickets:0,rainbowShards:0};
 const p=plan({...base,monthly:true,pass:'premium',teamClass:6,incomes:[event,gift,...unrelated]});
 assert.deepEqual(p.incomes.map(r=>r.id),['lab','broadcast']);
 assert.equal(p.free,10*50+10*50+1850+110+250+1200+300);assert.equal(p.paid,850);
 assert.equal(p.trainTickets,5);assert.equal(p.supportTickets,6);assert.equal(p.rainbowShards,2);
 assert.equal(Object.values(p.specialTickets??{}).reduce((s,n)=>s+n,0),0);
 assert.ok(rows.every(isEventReward));
});

test("점검·오류·파카라이브·별도 티켓 지급을 중복 없이 반영한다",()=>{
 assert.equal(rows.find(r=>r.id==='operator-news-3555')?.free,150);
 assert.equal(rows.find(r=>r.id==='operator-news-3555')?.startKr,jp(2026,11,20));
 assert.equal(rows.find(r=>r.id==='operator-news-3283')?.free,50);
 assert.equal(rows.find(r=>r.id==='operator-news-970')?.free,450);
 assert.ok(!rows.some(r=>r.id==='operator-news-971'));
 const ticket=rows.find(r=>r.id==='operator-news-3504')!;
 assert.equal(Object.values(ticket.specialTickets??{}).reduce((s,n)=>s+n,0),1);
 assert.equal(ticket.trainTickets+ticket.supportTickets,0);
 const broadcast=giftIncomes().find(r=>r.name.includes("ぱかライブTV' #6"))!;
 const sameDay=rows.filter(r=>r.source==='gift'&&r.startKr===broadcast.startKr);
 assert.ok(!sameDay.some(r=>r.free===broadcast.free));
 const p=plan({...base,today:broadcast.startKr-1,target:broadcast.startKr+1,incomes:[broadcast,...sameDay]});
 assert.equal(p.giftFree,500);
});

test("협동 이벤트 전체 달성 보상은 집계일에 별도로 지급한다",()=>{
 const personal=rows.find(r=>r.id==='raid-umatube')!;
 const community=rows.find(r=>r.id==='raid-umatube-community')!;
 assert.equal(personal.free,300);assert.equal(personal.rainbowShards,1);
 assert.equal(Object.keys(personal.specialTickets??{}).length,0);
 assert.ok(community.startKr>personal.startKr);
 assert.equal(Object.values(community.specialTickets??{}).reduce((s,n)=>s+n,0),5);
 const p=plan({...base,today:personal.startKr-1,target:community.startKr,incomes:[personal,community]});
 assert.equal(Object.values(p.specialTickets??{}).reduce((s,n)=>s+n,0),0);
});

test("이벤트 한정 교환소에는 일반권·확정권·결정 조각을 모두 포함한다",()=>{
 const eventShop=rows.filter(r=>r.category==='event-shop'&&r.name.includes('#12015'));
 const total=addRewards(eventShop);
 assert.equal(total.trainTickets,3);assert.equal(total.supportTickets,3);
 assert.equal(total.rainbowShards,1);assert.equal(total.goldShards,1);
 assert.equal(Object.values(total.specialTickets??{}).reduce((s,n)=>s+n,0),2);
 const friend=addRewards(rows.filter(r=>r.category==='event-shop'&&r.name.includes('#12016')));
 assert.equal(Object.values(friend.specialTickets??{}).reduce((s,n)=>s+n,0),2);
 const money=addRewards(rows.filter(r=>r.category==='event-shop'&&r.name.includes('#1002')));
 assert.equal(money.rainbowShards,2);assert.equal(money.goldShards,2);
 assert.equal(Object.values(money.specialTickets??{}).reduce((s,n)=>s+n,0),32);
});

test("기간 한정 흥행 보상은 각 장소의 한정 재고만 한 번씩 합산한다",()=>{
 const r=rows.find(r=>r.id==='limited-jobs-3')!;
 assert.equal(Object.values(r.specialTickets??{}).reduce((s,n)=>s+n,0),6);
 assert.equal(r.trainTickets+r.supportTickets,0);
});

test("먼슬리 매치 β는 클래스 초기화·주말 누적·피날레를 각각 합산한다",()=>{
 const event=rows.filter(r=>r.category==='monthly-match');
 const total=addRewards(event);
 assert.equal(total.free,4570);assert.equal(total.trainTickets,4);assert.equal(total.supportTickets,4);
 assert.equal(total.rainbowShards,2);assert.equal(total.goldShards,2);
});

test("보상 목록 전체의 ID·날짜·수량·출처 유효성과 신데렐라 그레이 제외",()=>{
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 for(const r of rows){
   assert.ok(r.reference?.startsWith("https://"),r.id);
   assert.ok(Number.isInteger(r.startKr)&&r.endKr>=r.startKr,r.id);
   assert.ok(hasRewards(r),r.id);
   for(const n of [r.free,r.trainTickets,r.supportTickets,r.rainbowCrystals??0,r.goldCrystals??0,r.rainbowShards??0,r.goldShards??0,...Object.values(r.specialTickets??{})])assert.ok(Number.isInteger(n)&&n>=0,`${r.id}: ${n}`);
   assert.ok(!/シンデレラグレイ|Cinderella Gray/i.test(r.name),r.id);
 }
});
