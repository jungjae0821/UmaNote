// Read official announcement facts through umapyoi.net's public archive.
import fs from 'node:fs/promises';
import { giftIncomes } from '../lib/jewelSources.ts';
import { operatorNewsRewards } from '../lib/operatorNews.ts';

const base='https://umapyoi.net/api/v1/news';
const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json();};
let news;
if(process.argv[2])news=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
else{
 const ids=await get(base),collected=[];
 for(let offset=0;offset<ids.length;offset+=128){
  const pages=await Promise.all([0,32,64,96].filter(i=>offset+i<ids.length).map(i=>get(`${base}/latest/32/${offset+i}`)));
  collected.push(...pages.flat());
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 news=[...new Map(collected.map(r=>[r.announce_id,r])).values()];
 if(news.length!==ids.length)throw Error(`Announcement coverage mismatch: ${news.length}/${ids.length}`);
}
const rows=operatorNewsRewards(news,giftIncomes());
const output={checkedAt:new Date(Date.now()+9*3600000).toISOString().slice(0,10),announcementCount:news.length,lastAnnouncementId:Math.max(...news.map(r=>r.announce_id)),reference:'https://umapyoi.net/',rows:rows.sort((a,b)=>a.startJp-b.startJp)};
await fs.writeFile('lib/data/operatorRewards.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({announcements:news.length,grants:rows.length,latest:rows.slice(-12).map(r=>({id:r.id,name:r.name,free:r.free,specialTickets:r.specialTickets}))},null,2));
