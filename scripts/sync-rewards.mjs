// 공개 사이트의 코드 실행 없이 JSON 리터럴만 읽는다. 일본 날짜를 그대로 보존한다.
import fs from 'node:fs/promises';
import ts from 'typescript';
import { itemRewards, hasRewards, ZERO_REWARDS } from '../lib/rewards.ts';
import { isEventReward } from '../lib/rewardScope.ts';

const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r; };
const html = await (await get('https://uma.guide/pull-planner/')).text();
const appPath = html.match(/<script[^>]*src="([^" ]*\/app\.[^" ]+\.js)"/)?.[1];
if (!appPath) throw new Error('uma.guide app module not found');
const app = await (await get(new URL(appPath, 'https://uma.guide'))).text();
const dataPath = app.match(/from"(\.\/chunks\/uma-data\.[^"]+\.js)"/)?.[1];
if (!dataPath) throw new Error('uma.guide data module not found');
const source = ts.createSourceFile('data.js', await (await get(new URL(dataPath, new URL(appPath, 'https://uma.guide')))).text(), ts.ScriptTarget.Latest, true);
const values = new Map();
function literal(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (n.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(n)) return -literal(n.operand);
  if (ts.isIdentifier(n) && values.has(n.text)) return values.get(n.text);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
  if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.map(p => [p.name.text, literal(p.initializer)]));
  if (ts.isCallExpression(n) && n.expression.getText(source) === 'JSON.parse') return JSON.parse(literal(n.arguments[0]));
  throw new Error('Not a data literal');
}
for (const st of source.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) { try { values.set(d.name.text, literal(d.initializer)); } catch {} }
// Resolve exports by the consumer's descriptive usage, rather than relying on minified names.
const imports = app.match(/import\{([^}]+)\}from"\.\/chunks\/uma-data\.[^"]+"/)?.[1];
const bindings = new Map(imports.split(',').map(s => { const [exp, local] = s.trim().split(' as '); return [local ?? exp, exp]; }));
const exported = new Map();
for (const st of source.statements) if (ts.isExportDeclaration(st)) for (const e of st.exportClause.elements) exported.set(e.name.text, values.get(e.propertyName?.text ?? e.name.text));
const tables = {};
for (const m of app.matchAll(/\w+\("(Spark Laboratory|Trainer Aptitude Tests|Dream Team|Main Story|Racing Carnivals|Anniversary Gifts|Masters Challenges|Showtime|Story Events|Missions|Login Bonuses)",(\w+)\)/g)) tables[m[1]] = exported.get(bindings.get(m[2]));
if (Object.keys(tables).length !== 11) throw new Error('uma.guide reward schema changed');
const extrasBinding=app.match(/\w+\("Umamusume Stories",(\w+)\.umaStories/)?.[1];
const characterStories=exported.get(bindings.get(extrasBinding))?.umaStories;
if(!Array.isArray(characterStories))throw new Error('uma.guide character story schema changed');

const rows = [], excluded = /シンデレラグレイ|Cinderella Gray|신데렐라 그레이/i;
const day = seconds => Math.floor((seconds + 9 * 3600) / 86400);
const push = (id, source, name, start, end, rewards, extra = {}) => {
  if (!start || !hasRewards(rewards) || excluded.test(name) || !isEventReward({source,name})) return;
  rows.push({ id, source, name, startJp: day(start), endJp: day(end ?? start), ...rewards, reference: 'https://uma.guide/pull-planner/', ...extra });
};
const names = { 'Spark Laboratory': ['research','아그네스 타키온의 인자연구'], 'Trainer Aptitude Tests': ['exam','트레이너 기능시험'], 'Dream Team': ['team','팀 스카우트'], 'Racing Carnivals': ['carnival','레이싱 카니발'], 'Masters Challenges': ['masters','마스터즈 챌린지'], Showtime: ['showtime','후지 키세키의 쇼타임'] };
for (const [table, [kind, label]] of Object.entries(names)) for (const r of tables[table]) {
  const items = [];
  for (let i = 1; i <= 4; i++) {
    const type = r[`reward_type${i}`] ?? r[`reward_type_${i}`], num = Number(r[`reward_quantity${i}`] ?? r[`reward_quantity_${i}`]) || 0;
    const id = { Carats: 43, 'SR Crystal Shard': 150, 'SSR Crystal Shard': 149, 'SSR Crystal': 144, 'SR Crystal': 145 }[type];
    if (id) items.push({ id, num });
  }
  items.push({ id: 41, num: r.trainee_tickets ?? (kind === 'exam' ? 3 : kind === 'team' ? 2 : 0) }, { id: 111, num: r.support_tickets ?? (kind === 'exam' ? 3 : kind === 'team' ? 2 : 0) });
  const rewards=itemRewards(items);
  // JP trial coin shop: six 150-jewel exchanges are documented by the Oct 2025 edition.
  if(kind==='exam' && r.id>=6) rewards.free=900;
  // 마스터즈는 레이스마다 Lv1 첫 클리어 금 결정 조각 1개, Lv2 무지개 1개라서 둘이 같다 (uma.guide #9는 금을 빠뜨렸다)
  if(kind==='masters') rewards.goldShards=Math.max(rewards.goldShards??0,rewards.rainbowShards??0);
  push(`${kind}-${r.id}`, kind, `${label} #${r.id}`, r.start_date, r.end_date, rewards, { optional: kind === 'masters' ? 'masters' : undefined });
}
// Gift-box anniversary distributions are separate from login rewards and missions.
for(const r of tables['Anniversary Gifts']) push(`anniversary-gift-${r.id}`,'anniversary-gift',r.title,r.start_date,r.start_date,itemRewards([{id:43,num:r.reward_quantity1}]),{reference:r.source_url??'https://uma.guide/pull-planner/'});
const itemByName = { Carats: 43, 'Trainee Scout Ticket': 41, 'Support Card Scout Ticket': 111, 'Rainbow Crystal Shard': 149, 'Gold Crystal Shard': 150, 'Rainbow Crystal': 144, 'Gold Crystal': 145 };
// A login day or mission can pay a card AND jewels; don't drop secondary reward slots.
const rewardSlots = row => Object.keys(row).filter(k=>/^item_(?:id|name)(?:_\d+)?$/.test(k)).reduce((out,k)=>{
 const suffix=k.match(/_\d+$/)?.[0]??'';
 if(!out.some(i=>i.suffix===suffix))out.push({suffix,id:row[`item_id${suffix}`]??itemByName[row[`item_name${suffix}`]]??-1,num:row[`item_num${suffix}`]??0,name:row[`item_name_jp${suffix}`]??row[`item_name${suffix}`]});
 return out;
},[]);
for (const r of tables['Story Events']) push(`story-${r.story_event_id}`, 'story', `스토리 이벤트 #${r.story_event_id}`, r.start_date, r.end_date, itemRewards(r.combined_item_totals.map(i => ({ id: itemByName[i.item_name] ?? Number(i.item_name.match(/ID (\d+)/)?.[1]) ?? -1, num: i.total_item_num, name: i.item_name }))), { components: 'point+story' });
const missions = new Map(), legacyAggregateMissions=new Set();
for (const m of tables.Missions) {
  const rewards = itemRewards(rewardSlots(m));
  if (hasRewards(rewards)) missions.set(m.id, { ...m, rewards });
}
// GameTora has event-specific missions and nested step rewards absent from the general list.
const manifest = await (await get('https://gametora.com/data/manifests/umamusume.json')).json();
const gtKeys = ['missions/limited','missions/trainerexam-limited','missions/teamscout-limited','missions/racingcarnival-limited','missions/legendrace-limited','missions/story-limited','missions/collectraid-limited'];
const [items,characters]=await Promise.all([
 get(`https://gametora.com/data/umamusume/items.${manifest.items}.json`).then(r=>r.json()),
 get(`https://gametora.com/data/umamusume/characters.${manifest.characters}.json`).then(r=>r.json()),
]);
const itemNames = new Map(items.map(i => [i.id, i.name_ko ?? i.name_jp]));
const characterNames=new Map(characters.map(c=>[c.char_id,c.name_ko||c.name_ja||c.name_en]));
// Character stories are shared by costumes. Count episodes 1–4 (20 each) once per character.
const seenCharacters=new Set();
for(const r of [...characterStories].sort((a,b)=>a.start_date-b.start_date)){
 if(seenCharacters.has(r.chara_id))continue;
 seenCharacters.add(r.chara_id);
 const release=Math.max(r.start_date,Date.UTC(2021,1,24,3)/1000);
 push(`character-story-${r.chara_id}`,'character-story',`${characterNames.get(r.chara_id)??`캐릭터 #${r.chara_id}`} 스토리 1~4화`,release,release,itemRewards([{id:43,num:20*4}]),{charaId:r.chara_id,components:'character-episodes-1-4',condition:'신규 캐릭터의 스토리 1~4화 최초 열람; 각 20쥬얼, 의상·복각으로 재지급되지 않음'});
}
const gameToraData = await Promise.all(gtKeys.map(async key => [key, await (await get(`https://gametora.com/data/umamusume/${key}.${manifest[key]}.json`)).json()]));
function visit(m, parent, key) {
  const start = m.startDate ?? parent.startDate, end = m.endDate ?? parent.endDate;
  if (start && end) {
    const rewards = itemRewards([{ id: m.itemId, num: m.itemNumber, name: itemNames.get(m.itemId) }]);
    if (hasRewards(rewards)) missions.set(m.id, { id: m.id, title: parent.eventOriginal ?? m.originalText ?? key, start_date: start / 1000, end_date: end / 1000, rewards, eventKey: key, reference: 'https://gametora.com/umamusume/missions' });
  }
  for (const child of m.subMissions ?? []) visit(child, { ...parent, startDate: start, endDate: end }, key);
}
for (const [key, groups] of gameToraData) for (const group of Array.isArray(groups) ? groups : [groups]) for (const m of group.missions) visit(m, group, key);
// Hand-kept team/carnival totals already contain the event missions. Keep one total per edition.
for (const [kind,key] of [['team','missions/teamscout-limited'],['carnival','missions/racingcarnival-limited']]) for (const r of rows.filter(r=>r.source===kind)) {
  const included = [...missions.values()].filter(m=>m.eventKey===key && Math.abs(day(m.start_date)-r.startJp)<=1);
  for (const m of included) missions.delete(m.id);
  if(kind==='team' && Number(r.id.split('-')[1])<=4) for(const m of included) legacyAggregateMissions.add(`mission-${m.id}`);
  r.components='event-total-including-missions';
  // First-clear races (6 x 150) plus the actual edition's jewel mission; shop + mission shards.
  if(kind==='carnival') r.free=900+included.reduce((s,m)=>s+m.rewards.free,0);
}
for (const m of missions.values()) if(m.end_date<1_900_000_000) push(`mission-${m.id}`, 'limited', m.title, m.start_date, m.end_date, m.rewards, { reference: m.reference ?? 'https://uma.guide/pull-planner/' });
// Story chapters are in uma.guide totals; bingo and gold shards are also checked against GameTora.
for(const key of ['events/story-events-bingo','events/story-events-rewards']) {
 const data=await(await get(`https://gametora.com/data/umamusume/${key}.${manifest[key]}.json`)).json();
 for(const e of data){const row=rows.find(r=>r.id===`story-${e.id}`);if(!row)continue;
  // 빙고 항목의 시트 번호는 그 보상표가 시작되는 시트다. 다음 항목 앞까지 같은 보상표를 쓴다
  // (2026-03 이후 스토리 이벤트는 시트 1 항목 하나가 1~3장을 맡는다). 마지막 무한 반복 시트는 1장으로 센다
  const sheets=[...(e.bingo??[])].sort((a,b)=>(a.sheet??a.sheet_num)-(b.sheet??b.sheet_num));
  const items=sheets.flatMap((b,i)=>{const count=i+1<sheets.length?(sheets[i+1].sheet??sheets[i+1].sheet_num)-(b.sheet??b.sheet_num):1;return Array.from({length:count},()=>b.line_rewards).flat();}).concat(e.rewards??[]);
  if(key.endsWith('bingo')){const b=itemRewards(items.map(i=>({id:i.item_id,num:i.item_num})));row.free+=b.free;row.trainTickets+=b.trainTickets;row.supportTickets+=b.supportTickets;}
  if(key.endsWith('bingo')) row.goldShards=items.filter(i=>i.item_id===150).reduce((s,i)=>s+i.item_num,0);
 }
}
for (const l of tables['Login Bonuses']) {
  if (l.type === 1 || l.end_date>=1_900_000_000) continue; // regular/account-start login is outside event scope
  for (const r of l.rewards ?? []) {
    const at = l.start_date + ((r.count ?? 1) - 1) * 86400;
    const rewards = itemRewards(rewardSlots(r));
    push(`login-${l.id}-${r.count ?? r.id ?? 1}`, 'login', `${l.title} (${r.count ?? 1}일차)`, at, at, rewards);
  }
}
const master=JSON.parse(await fs.readFile('lib/data/eventMaster.json','utf8'));
const operator=JSON.parse(await fs.readFile('lib/data/operatorRewards.json','utf8'));
// Replace reference aggregates with first-clear + exchange + mission components from the master.
const unique = new Map(rows.filter(r=>r.source!=='carnival' && !(r.source==='team'&&Number(r.id.split('-')[1])>=5)).map(r => [r.id,r]));
for(const r of master.rows){if(legacyAggregateMissions.has(r.id))continue;if(r.id.startsWith('mission-')&&unique.has(r.id))continue;unique.set(r.id,r);}
for(const r of operator.rows)unique.set(r.id,r);
// GameTora's current first-clear exam table extends beyond the archived master DB.
const examKey='db-files/training_challenge_exam';
const currentExams=await(await get(`https://gametora.com/data/umamusume/${examKey}.${manifest[examKey]}.json`)).json();
for(const [edition,firstId] of [[11,63],[12,70],[13,77],[14,84]]){
 const laterDates={13:[[2026,6,29],[2026,7,10]],14:[[2026,10,26],[2026,11,8]]};
 const event=unique.get(`exam-${edition}`)??(laterDates[edition]?{startJp:Math.floor(Date.UTC(...[laterDates[edition][0][0],laterDates[edition][0][1]-1,laterDates[edition][0][2]])/86400000),endJp:Math.floor(Date.UTC(...[laterDates[edition][1][0],laterDates[edition][1][1]-1,laterDates[edition][1][2]])/86400000)}:null);if(!event)continue;
 const reward=addExamRewards(currentExams.filter(r=>r.id>=firstId&&r.id<firstId+7));
 if(hasRewards(reward))unique.set(`exam-first-clear-${edition}`,{...event,...reward,id:`exam-first-clear-${edition}`,source:'exam-first-clear',name:`트레이너 기능시험 #${edition} 시험 첫 클리어`,reference:'https://gametora.com/umamusume',evidence:['training_challenge_exam']});
}
function addExamRewards(exams){return itemRewards(exams.flatMap(r=>Object.keys(r).filter(k=>/^item_id_\d+$/.test(k)).map(k=>({id:r[k],num:r[k.replace('item_id','item_num')],name:itemNames.get(r[k])}))));}
for(const r of unique.values()) if(r.source==='story' && r.rainbowShards===3 && !('goldShards' in r)) r.goldShards=3;
const output = { checkedAt: new Date().toISOString().slice(0,10), scope:'time-limited-event-rewards-only', sources: ['https://gametora.com/umamusume/missions','https://uma.guide/pull-planner/',master.reference], rows: [...unique.values()].filter(isEventReward).sort((a,b)=>a.startJp-b.startJp||a.id.localeCompare(b.id)) };
await fs.writeFile('lib/data/rewards.json', JSON.stringify({...output,rows:undefined},null,2).replace(/\n\}$/,`,\n  "rows": [\n${output.rows.map(r=>'    '+JSON.stringify(r)).join(',\n')}\n  ]\n}`)+'\n');
console.log(JSON.stringify({ checkedAt: output.checkedAt, count: output.rows.length, categories: Object.fromEntries([...new Set(output.rows.map(r=>r.source))].map(k=>[k,output.rows.filter(r=>r.source===k).length])) },null,2));
