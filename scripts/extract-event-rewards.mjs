// Read the public Japanese master DB; do not execute downloaded site code.
import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { itemRewards, addRewards, hasRewards } from '../lib/rewards.ts';

const path=process.argv[2]??'.audit/rewards/master.mdb';
const bytes=await fs.readFile(path);
const db=new DatabaseSync(path,{readOnly:true});
const reference='https://github.com/SimpleSandman/UmaMusumeMetaMasterMDB/blob/master/master/master.mdb';
const all=t=>db.prepare(`SELECT * FROM ${t}`).all();
const text=new Map(all('text_data').map(r=>[`${r.category}:${r.index}`,r.text.replaceAll('\\n',' ')]));
const name=id=>text.get(`23:${id}`)??`아이템 #${id}`;
const day=v=>{
 if(typeof v==='number')return Math.floor((v+32400)/86400);
 const match=String(v).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
 return match?Math.floor(Date.UTC(+match[1],+match[2]-1,+match[3])/86400000):NaN;
};
const rows=[], evidence=[];
const ids=new Set([43,41,111,144,145,149,150]);
function slots(row,prefix='item'){
 const result=[];
 for(const key of Object.keys(row)){
  const m=key.match(new RegExp(`^${prefix}_id(_\\d+)?$`));if(!m)continue;
  const suffix=m[1]??'',id=row[key],category=row[`${prefix}_category${suffix}`];
  const num=row[`${prefix}_num${suffix}`]??row[`reward_num${suffix}`]??0;
  if(ids.has(id)||[40,41,42].includes(category))result.push({id,num,name:name(id)});
 }
 return itemRewards(result);
}
function push(id,source,label,start,end,rewards,tables,extra={}){
 if(!hasRewards(rewards))return;
 const r={id,source,name:label,startJp:day(start),endJp:day(end??start),...rewards,reference,evidence:tables,...extra};
 if(!Number.isInteger(r.startJp)||r.endJp<r.startJp)throw Error(`Invalid dates: ${id}`);
 rows.push(r);
}
function mark(table,mode,count,details){evidence.push({table,mode,count,details});}
const mission=all('mission_data');
const timed=mission.filter(m=>day(m.start_date)>=day('2021-02-24')&&day(m.end_date)<day('2030-01-01'));
// Canonical event missions are merged by their mission ID, including nested step missions.
for(const m of timed){
 const title=[text.get(`187:${m.event_id}`),text.get(`67:${m.id}`)].filter(Boolean).join(' · ')||`이벤트 미션 #${m.id}`;
 if(/シンデレラグレイ|Cinderella Gray/i.test(title))continue;
 push(`mission-${m.id}`,'limited',title,m.start_date,m.end_date,slots(m),['mission_data'],{condition:text.get(`67:${m.id}`)??`이벤트 미션 ${m.id} 달성`});
}
mark('mission_data','timed-event-missions',timed.length,'상시·데일리·일반 성장 미션은 수집 범위 밖');

// Research box contents multiply item_num by the finite stock box_num.
const researchRewards=all('factor_research_box_reward'),boxes=all('factor_research_box');
for(const e of all('factor_research_data')){
 const boxIds=new Set(boxes.filter(b=>b.factor_research_event_id===e.factor_research_event_id).map(b=>b.box_id));
 const reward=addRewards(researchRewards.filter(r=>boxIds.has(r.box_id)).map(r=>slots({...r,item_num:r.item_num*r.box_num})));
 push(`research-${e.factor_research_event_id-1000}`,'research',`아그네스 타키온의 인자연구 #${e.factor_research_event_id-1000}`,e.start_date,e.ending_date,reward,['factor_research_data','factor_research_box','factor_research_box_reward']);
}
mark('factor_research_box_reward','finite-box-stock',researchRewards.length,'상자 재고를 전부 획득하는 경우; 무한 반복으로 계산하지 않음');

// Trial exams: first clears and the exchange are different rewards.
const exchanges=all('item_exchange'),examRows=all('training_challenge_exam');
const examMasters=all('training_challenge_master').sort((a,b)=>a.start_date-b.start_date);
const usedExamShops=new Set();
for(const [i,e]of examMasters.entries()){
 const examIds=new Set(Object.keys(e).filter(k=>/^exam_id_|^ex_exam_id$|^free_exam_id$/.test(k)).map(k=>e[k]).filter(Boolean));
 const reward=addRewards(examRows.filter(r=>examIds.has(r.id)).map(r=>slots(r)));
 push(`exam-first-clear-${i+1}`,'exam-first-clear',`트레이너 기능시험 #${i+1} 시험 첫 클리어`,e.start_date,e.end_date,reward,['training_challenge_master','training_challenge_exam']);
 usedExamShops.add(e.shop_id);
 const shop=exchanges.filter(r=>r.item_exchange_top_id===e.shop_id);
 push(`exam-${i+1}`,'exam',`트레이너 기능시험 #${i+1} 교환소`,e.start_date,e.end_result_date,addRewards(shop.map(r=>itemRewards([{id:r.change_item_id,num:r.change_item_num*r.change_item_limit_num,name:name(r.change_item_id)}]))),['training_challenge_master','item_exchange']);
}
mark('training_challenge_exam','each-exam-first-clear-once',examRows.length,'입문/EX/프리 시험 첫 클리어까지 포함');

// Carnivals: the first-clear awards differ by difficulty; never assume 6 x 150.
const carnivals=all('challenge_match_data'),races=all('challenge_match_race');
for(const e of carnivals){
 const raceRewards=addRewards(races.filter(r=>r.challenge_match_id===e.challenge_match_id).map(r=>slots(r,'first_clear_item')));
 push(`carnival-first-${e.challenge_match_id}`,'carnival-first-clear',`레이싱 카니발 #${e.challenge_match_id} 첫 클리어`,e.start_date,e.ending_date,raceRewards,['challenge_match_data','challenge_match_race']);
 // Export the exchange separately; timed mission rows already exist by ID.
 push(`carnival-shop-${e.challenge_match_id}`,'carnival-shop',`레이싱 카니발 #${e.challenge_match_id} 교환소`,e.start_date,e.end_date,addRewards(exchanges.filter(r=>r.item_exchange_top_id===e.item_exchange_top_id).map(r=>itemRewards([{id:r.change_item_id,num:r.change_item_num*r.change_item_limit_num,name:name(r.change_item_id)}]))),['challenge_match_data','item_exchange']);
}
mark('challenge_match_race','each-difficulty-first-clear-once',races.length,'HARD/VH/EXTREME의 서로 다른 보상');

// Team rank reward plus missions; event totals in the reference are replaced only for known current reward versions.
const teamRank=all('team_building_rank_reward_group');
for(const e of all('team_building_data').filter(e=>e.start_date>=1713740400)){
 const editions=all('team_building_data').sort((a,b)=>a.start_date-b.start_date);
 const n=editions.findIndex(r=>r.team_building_event_id===e.team_building_event_id)+1;
 push(`team-rank-${n}`,'team-rank',`팀 스카우트 #${n} 팀 랭크 도달`,e.start_date,e.ending_date,addRewards(teamRank.map(r=>slots(r))),['team_building_data','team_building_rank_reward_group']);
}
mark('team_building_rank_reward_group','rank-plus-distinct-missions',teamRank.length,'2024년 4월 이후 보상표만 현재 마스터로 대체');

// Raid personal and community rewards have different receipt dates.
const raidIndividual=all('collect_raid_individual_reward'),raidAll=all('collect_raid_all_reward');
const raidNames={1001:['illumination','KIRARI MAGIC SHOW'],1002:['summer','UMA Summer'],1003:['umatube','우마튜브 채널 구독자 1억 명 도전']};
for(const e of all('collect_raid_master')){
 const [key,label]=raidNames[e.id]??[e.id,`협동 이벤트 #${e.id}`];
 push(`raid-${key}`,'raid',`${label} 개인 보상`,e.start_date,e.calc_start_date,addRewards(raidIndividual.filter(r=>r.individual_reward_set_id===e.individual_reward_set_id).map(r=>slots(r))),['collect_raid_master','collect_raid_individual_reward']);
 push(`raid-${key}-community`,'raid-community',`${label} 전체 달성 보상`,e.calc_end_date,e.end_date,addRewards(raidAll.filter(r=>r.all_reward_set_id===e.all_reward_set_id).map(r=>slots(r))),['collect_raid_master','collect_raid_all_reward']);
}
mark('collect_raid_individual_reward','personal-goal',raidIndividual.length);
mark('collect_raid_all_reward','community-goal-and-participation',raidAll.length,'집계 완료 후 지급; 개인 보상과 분리');
const mapPoints=all('map_event_map_point');
for(const e of all('map_event_data'))push('raid-victory','map-event','꽃피는 빅토리 클럽',e.start_date,e.end_date,addRewards(mapPoints.filter(r=>r.event_id===e.event_id).map(r=>slots(r))),['map_event_data','map_event_map_point']);
mark('map_event_map_point','all-reachable-points',mapPoints.length);

// Every finite event shop line is included, including guaranteed/special scout tickets.
const handledShops=new Set([...usedExamShops,...carnivals.map(e=>e.item_exchange_top_id)]);
const finiteExchange=exchanges.filter(r=>r.start_date>=1609459200&&r.end_date<1900000000&&!handledShops.has(r.item_exchange_top_id)&&r.change_item_limit_type===1);
for(const r of finiteExchange){
 const reward=itemRewards([{id:r.change_item_id,num:r.change_item_num*r.change_item_limit_num,name:name(r.change_item_id)}]);
 // Crafting a crystal from its shards is conversion, not a new event grant.
 if([43,144,145,149,150].includes(r.pay_item_id))continue;
 push(`event-shop-${r.id}`,'event-shop',`이벤트 교환소 #${r.item_exchange_top_id} · ${name(r.change_item_id)}`,r.start_date,r.end_date,reward,['item_exchange'],{shopId:r.item_exchange_top_id,condition:`${name(r.pay_item_id)} ${r.pay_item_num}개씩, 재고 ${r.change_item_limit_num}회 교환`});
}
mark('item_exchange','finite-event-shop-stock',finiteExchange.length,'상시 월간 교환소, 유료 구매, 결정 조각 합성은 이벤트 공급량과 분리');

// Limited expeditions pay their fixed stock once per destination, not every ten hours.
const jobs=all('jobs_reward'),jobSchedules=all('jobs_limited_schedule');
for(const e of jobSchedules){
 const eligible=jobs.filter(r=>r.limited_schedule_id===e.id&&r.limited_max_count>0);
 const rewards=eligible.map(r=>{
  const remapped={};for(const [k,v]of Object.entries(r))remapped[k.replace(/^main_reward_(\d+)_item_(id|category|num)$/,'item_$2_$1')]=v;
  const reward=slots(remapped);return addRewards(Array.from({length:r.limited_max_count},()=>reward));
 });
 push(`limited-jobs-${e.id}`,'limited-jobs',`기간 한정 전국 흥행 #${e.id}`,e.start_date,e.ending_date,addRewards(rewards),['jobs_limited_schedule','jobs_reward']);
}
mark('jobs_reward','finite-limited-expedition-stock',jobs.filter(r=>r.limited_schedule_id).length,'상시 흥행 및 랜덤 추가 드롭 제외');

// Commemorative event stories; normal main/character/scenario progression is intentionally outside scope.
const extraStories=all('story_extra_story_data');
for(const r of extraStories)push(`event-story-${r.id}`,'event-story',`기념 이벤트 스토리 #${r.story_extra_id} ${r.episode_index_id}화`,r.start_date,Math.max(r.start_date,r.notice_end_date),slots(r,'add_reward'),['story_extra_story_data']);
mark('story_extra_story_data','commemorative-event-chapters',extraStories.length);

// Keep complete beta monthly-match reward choices, with weekly reset boundaries.
const ratingGroups=all('rating_race_reward_group');
const groupReward=id=>addRewards(ratingGroups.filter(r=>r.reward_group_id===id).map(r=>slots(r)));
for(const e of all('rating_race_data')){
 const phases=all('rating_race_phase_schedule').filter(r=>r.rating_race_data_id===e.id);
 const ranks=all('rating_race_rating_rank').filter(r=>r.rating_race_data_id===e.id);
 for(const phase of phases){
  if(phase.phase===1){
   const eligible=ranks.filter(r=>phase.week===1||r.rating_rank>e.rating_rank_reset_limit);
   push(`monthly-match-${e.id}-week-${phase.week}`,'monthly-match','먼슬리 매치 β 클래스 도달 보상 (클래스 10)',phase.start_date,phase.end_date,addRewards(eligible.map(r=>groupReward(r.reward_group_id))),['rating_race_phase_schedule','rating_race_rating_rank','rating_race_reward_group'],{condition:'매주 클래스 10 도달; 초기화 전 획득분만 재계산'});
  } else {
   const weekend=all('rating_race_weekend_reward').filter(r=>r.rating_race_data_id===e.id);
   push(`monthly-match-${e.id}-weekend-${phase.week}`,'monthly-match','먼슬리 매치 β 위크엔드 900Pt',phase.start_date,phase.end_date,addRewards(weekend.map(r=>groupReward(r.reward_group_id))),['rating_race_weekend_reward','rating_race_reward_group'],{condition:'위크엔드 챌린지 900Pt까지 누적 획득'});
   if(phase.phase===3){
    const finals=all('rating_race_finale_reward').filter(r=>r.rating_race_data_id===e.id);
    const best=finals.sort((a,b)=>b.rating_rank-a.rating_rank||a.finish_order-b.finish_order)[0];
    push(`monthly-match-${e.id}-final`,'monthly-match','먼슬리 매치 β 피날레 (클래스 10 1착)',phase.start_date,phase.end_date,groupReward(best.reward_group_id),['rating_race_finale_reward','rating_race_reward_group'],{condition:'클래스 10 피날레 1착; 다른 착순과 중복 수령하지 않음'});
   }
  }
 }
}
mark('rating_race_reward_group','weekly-class-weekend-and-finale',ratingGroups.length);

const report={checkedAt:new Date().toISOString().slice(0,10),masterSha256:createHash('sha256').update(bytes).digest('hex'),masterDataThrough:'2025-10-10',reference,scope:'time-limited-event-rewards-only',rows:rows.sort((a,b)=>a.startJp-b.startJp||a.id.localeCompare(b.id)),evidence};
await fs.writeFile('lib/data/eventMaster.json',JSON.stringify({...report,rows:undefined},null,2).replace(/\n\}$/,`,\n  "rows": [\n${report.rows.map(r=>'    '+JSON.stringify(r)).join(',\n')}\n  ]\n}`)+'\n');
console.log(JSON.stringify({records:rows.length,sourceTables:evidence.length,categories:Object.fromEntries([...new Set(rows.map(r=>r.source))].map(k=>[k,rows.filter(r=>r.source===k).length]))},null,2));
