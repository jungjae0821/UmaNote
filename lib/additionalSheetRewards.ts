import data from "./data/sheetRewards.json" with { type: "json" };
import type { Income } from "./jewelPlan.ts";
import { hasRewards, sheetMissingMaterials } from "./rewards.ts";
import { SERVER_GAP_DAYS } from "./dates.ts";

const rows = data.additionalRows;
const day = (i: Income) => i.startJp ?? i.startKr - SERVER_GAP_DAYS;
const year = (d: number) => new Date(d * 86400000).getUTCFullYear();
const anniversary = (s: string) => s.match(/(\d+(?:\.\d+)?)(?:st|nd|rd|th)?\s*Anniversary/i)?.[1] ?? s.match(/(\d+(?:\.\d+)?)\s*주년/)?.[1];
const countdown = (s: string) => /カウントダウン|카운트\s*다운/.test(s);
const phase = (s: string) => Number(s.match(/제\s*(\d+)탄|第\s*(\d+)弾/)?.slice(1).find(Boolean) ?? 2);
const families: [string, RegExp][] = [
  ["summer", /UMA Summer/i], ["umatube", /우마튜브|ウマチューブ|ウマTube/i], ["beyond", /Beyond Memories/i],
  ["kfc", /KFC|ケンタッキー|フライドチキン/i], ["number", /Number/i], ["megailumi", /メガイルミ|메가\s*일루미/],
  ["umabox", /ウマ箱3|うま箱3|우마바코3/], ["cinderella", /シンデレラグレイ|신데렐라\s*그레이/],
  ["golshi", /ピスピス|ゴルシちゃん|고루시짱/], ["movie", /新時代の扉|신시대의\s*문|劇場版[『「]?ウマ娘/],
  ["valentine", /バレンタイン|발렌타인/], ["white", /ホワイトデー|화이트데이/], ["april", /エイプリル|コスモピュエラ|만우절|코스모퓨/],
  ["gacha-fix", /ガチャ.*不具合|가챠.*결함/], ["maintenance", /メンテナンス|메인터넌스/], ["balance", /秋川|理事長|アキカワ|이사장/],
  ["auto-delete", /自動削除|자동\s*삭제/], ["escape", /リアル脱出|탈출\s*게임/], ["bocz", /BoC.z/i],
  ["download2100", /2100万|2100만/], ["download2300", /2300万|2300만/], ["money-shop", /サポートPt|サポートポイント|특별\s*머니|特別マニー/],
  ["zombie", /ゾンビランドサガ|좀비랜드\s*사가/], ["yearend", /年末|연말/], ["newyear", /新春|お正月|설날/],
  ["mecha", /メカウマ|메카\s*우마|메카우마/], ["island", /無人島|무인도/], ["onsen", /ゆこま|ユコマ|유코마/], ["tresenken", /トレセン軒|트레센켄/],
];
const family = (s: string) => families.find(([, pattern]) => pattern.test(s))?.[0];

function covers(i: Income, r: typeof rows[number]): boolean {
  const category = i.category ?? i.source, delta = Math.abs(day(i) - r.startJp);
  if (i.source === "gift" && /ぱかライブ|파카라이브/.test(i.name)) return false;
  const a = anniversary(r.name), other = anniversary(i.name);
  const rf = family(r.name), f = family(i.name);
  // Campaign-wide login matching also corrects source login start-date shifts.
  if (a && r.role === "login" && i.source === "login" && a === other) {
    if (countdown(r.name)) return countdown(i.name);
    const loginPhase = /캠페인/.test(i.name) ? phase(i.name) : phase(i.name) === 2 && /第2弾/.test(i.name) ? 3 : 2;
    return !countdown(i.name) && phase(r.name) === loginPhase;
  }
  if (a && r.role === "mission" && a === other && /mission|limited/.test(category)) return phase(i.name) === phase(r.name);
  if (a && /기념 쥬얼/.test(r.name) && (i.source === "gift" || /anniversary-gift/.test(category))) return (a === other || (category === "anniversary-gift" && delta <= 1)) && i.free === 3000;
  if (r.role === "shop" && a && /event-shop|^shop$/.test(category) && /교환소|주년|Anniversary/.test(i.name)) {
    const campaign = rows.filter(x => anniversary(x.name) === a);
    return day(i) >= Math.min(...campaign.map(x => x.startJp)) - 1 && day(i) <= Math.max(...campaign.map(x => x.startJp)) + 1;
  }
  if (r.role === "shop" && rf === "money-shop" && /^event-shop-1002/.test(i.id) && delta <= 1) return true;
  if (r.role === "raid") {
    if (category === "raid-community") return false;
    if (rf === "summer" && category === "event-story" && /#1007/.test(i.name)) return true;
    return category === "raid" && rf === f && delta <= 4;
  }
  if (r.role === "walk") return category === "walk" && delta <= 1;
  if (r.role === "scenario-score") return category === "sheet-scenario-score" && rf === f && delta <= 1;
  if (r.role === "mission" && !a) return /limited/.test(category) && delta <= 2 && (/新育成シナリオ/.test(i.name) || (rf !== undefined && rf === f));
  if ((rf === "yearend" || rf === "newyear") && r.role === "login") return i.source === "login" && rf === f && year(day(i)) === year(r.startJp);
  if (r.role === "login") return (i.source === "login" || i.source === "gift") && rf !== undefined && rf === f && delta <= 14;
  if (r.role === "shop") return /event-shop|^shop$/.test(category) && rf !== undefined && rf === f && delta <= 1;
  return (i.source === "gift" || i.source === "login") && rf !== undefined && rf === f && delta <= 1 && !/ぱかライブ|파카라이브/.test(i.name);
}

/** Shared by server event data and the existing client-side manual gift list. */
export function removeAdditionalSheetDuplicates(incomes: Income[]): Income[] {
  return incomes.flatMap(original => {
    let i = original;
    if (i.category === "raid-community" && rows.some(r => r.role === "raid" && family(r.name) === family(i.name) && Math.abs(day(i) - r.startJp) <= 4 && Object.keys(r.specialTickets).some(k => /SSR/.test(k)))) {
      i = { ...i, specialTickets: Object.fromEntries(Object.entries(i.specialTickets ?? {}).filter(([k]) => !/SSR/.test(k))) };
      if (!hasRewards(i)) return [];
    }
    if (rows.some(r => r.id === i.id)) return [];
    const matching = rows.filter(r => covers(i, r));
    if (!matching.length) return [i];
    // The sheet's ordinary shop inventory doesn't replace distinct dedicated tickets.
    if (matching.some(r => r.role === "shop") && Object.keys(i.specialTickets ?? {}).length) {
      const dedicated = { ...i, free: 0, trainTickets: 0, supportTickets: 0, rainbowShards: 0, goldShards: 0, rainbowCrystals: 0, goldCrystals: 0 };
      return hasRewards(dedicated) ? [dedicated] : [];
    }
    return [];
  });
}

export function applyAdditionalSheetRewards(incomes: Income[]): Income[] {
  // 시트에 없는 금 결정 조각·해방 결정은 시트 행이 대신하는 원래 보상에서 이어받는다 (여러 행이면 날짜가 가장 가까운 행)
  const replaced = new Map<string, Map<string, Income>>();
  for (const i of incomes) {
    // 이미 가져온 시트 행이면 자기 값을 그대로 이어받는다 (두 번 적용해도 같은 결과)
    const self = rows.filter(r => r.id === i.id);
    const matching = self.length ? self : rows.filter(r => covers(i, r));
    if (!matching.length) continue;
    const row = matching.reduce((a, b) => Math.abs(day(i) - a.startJp) <= Math.abs(day(i) - b.startJp) ? a : b);
    if (!replaced.has(row.id)) replaced.set(row.id, new Map());
    replaced.get(row.id)!.set(i.id, i);
  }
  const imported: Income[] = rows.map(r => ({ id: r.id, name: r.name,
    source: r.role === "login" ? "login" : r.role === "gift" ? "gift" : "limited",
    category: "sheet-extra", startJp: r.startJp, startKr: r.startKr, endKr: r.startKr,
    free: r.free, trainTickets: r.trainTickets, supportTickets: r.supportTickets, rainbowShards: r.rainbowShards,
    ...sheetMissingMaterials([...(replaced.get(r.id)?.values() ?? [])]),
    // 시나리오 평가점 보상은 금·무지개 결정 조각이 번갈아 2개씩 나온다 (마스터 single_mode_scenario_record)
    ...(r.role === "scenario-score" ? { goldShards: r.rainbowShards } : {}),
    specialTickets: r.specialTickets as Record<string, number>,
    reference: `${data.reference}?range=${encodeURIComponent(`'${r.sheet}'!A${r.row}:H${r.row}`)}`,
    condition: "사용자가 지정한 시트의 해당 날짜 보상",
  }));
  return [...removeAdditionalSheetDuplicates(incomes), ...imported].sort((a, b) => a.startKr - b.startKr || a.id.localeCompare(b.id));
}
