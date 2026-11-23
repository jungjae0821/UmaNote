import type { Income } from "./jewelPlan.ts";
import { dayFromTimestamp, SERVER_GAP_DAYS } from "./dates.ts";
import { latestSheetRow } from "./sheetRewards.ts";
import { itemRewards, hasRewards, addRewards } from "./rewards.ts";
import { isEventReward } from "./rewardScope.ts";

/** Read data literals only. Calls, expressions and template interpolation are rejected. */
function readLiteral(source: string, start: number): unknown {
  let p = start;
  const space = () => { while (/\s/.test(source[p] ?? "") && p < source.length) p++; };
  const string = () => {
    const quote = source[p++];
    let out = "";
    while (p < source.length) {
      const c = source[p++];
      if (c === quote) return out;
      if (quote === "`" && c === "$" && source[p] === "{") throw Error("Template expression is not data");
      if (c !== "\\") { out += c; continue; }
      const escaped = source[p++];
      if (escaped === "u" || escaped === "x") {
        const size = escaped === "u" ? 4 : 2, hex = source.slice(p, p + size);
        if (!new RegExp(`^[0-9a-fA-F]{${size}}$`).test(hex)) throw Error("Invalid string escape");
        out += String.fromCharCode(parseInt(hex, 16)); p += size;
      } else out += ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" } as Record<string, string>)[escaped] ?? escaped;
    }
    throw Error("Unterminated data string");
  };
  const parse = (): unknown => {
    space();
    const c = source[p];
    if (["'", '"', "`"].includes(c)) return string();
    if (source.startsWith("JSON.parse(", p)) {
      p += 11; space();
      if (!["'", '"', "`"].includes(source[p])) throw Error("Expected JSON string");
      const value = JSON.parse(string()); space();
      if (source[p++] !== ")") throw Error("Invalid JSON literal");
      return value;
    }
    if (c === "[" || c === "{") {
      const array = c === "[", end = array ? "]" : "}";
      const values: unknown[] = [], object: Record<string, unknown> = Object.create(null);
      p++; space();
      while (source[p] !== end) {
        if (array) values.push(parse());
        else {
          space();
          const quoted = ["'", '"', "`"].includes(source[p]);
          const key = quoted ? string() : source.slice(p).match(/^[\w$]+/)?.[0];
          if (key === undefined) throw Error("Invalid object key");
          if (!quoted) p += key.length;
          space(); if (source[p++] !== ":") throw Error("Expected colon");
          object[key] = parse();
        }
        space();
        if (source[p] === end) break;
        if (source[p++] !== ",") throw Error("Expected comma");
        space();
      }
      p++; return array ? values : object;
    }
    const token = source.slice(p).match(/^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)\b/)?.[0];
    if (!token) throw Error("Expression is not data");
    p += token.length; return JSON.parse(token);
  };
  return parse();
}

function plannerTable(app: string, source: string, label: string): unknown {
  const imports = app.match(/import\{([^}]+)\}from"\.\/chunks\/uma-data\.[^"]+"/)?.[1];
  const exports = source.match(/export\{([^}]+)\}/)?.[1];
  if (!imports || !exports) throw Error("Planner module bindings missing");
  const bindings = new Map(imports.split(",").map(s => { const [exp, local] = s.trim().split(" as "); return [local ?? exp, exp]; }));
  const exported = new Map(exports.split(",").map(s => { const [local, exp] = s.trim().split(" as "); return [exp ?? local, local]; }));
    const consumer = app.match(new RegExp(`\\w+\\("${label}",(\\w+)\\)`))?.[1];
    if (!consumer) return undefined;
    const variable = exported.get(bindings.get(consumer ?? "") ?? "");
    if (!variable || !/^[\w$]+$/.test(variable)) throw Error(`Planner ${label} binding missing`);
    const declaration = new RegExp(`(?:\\bconst\\s+|[,;])${variable.replace(/\$/g, "\\$")}\\s*=`).exec(source);
    if (!declaration) throw Error(`Planner ${label} data missing`);
    return readLiteral(source, declaration.index + declaration[0].length);
}

export type PlannerEditionKind = "research" | "exam" | "masters";
/** 일본서버 회차 일정. start, end는 일본서버 타임스탬프(초) */
export type PlannerEdition = { kind: PlannerEditionKind; id: number; title: string; start: number; end: number };

/** 인자연구, 트레이너 기능시험, 마스터즈 챌린지의 발표된 일본서버 회차 전부 */
export function plannerEditions(app: string, source: string): PlannerEdition[] {
  const rows: PlannerEdition[] = [];
  for (const [label, kind] of [["Spark Laboratory", "research"], ["Trainer Aptitude Tests", "exam"], ["Masters Challenges", "masters"]] as const) {
    const events = plannerTable(app, source, label);
    if (!Array.isArray(events)) throw Error(`Planner ${label} is not an array`);
    for (const event of events) {
      if (!Number.isInteger(event.id) || !Number.isFinite(event.start_date) || !Number.isFinite(event.end_date)) throw Error(`Invalid ${label} schedule`);
      rows.push({ kind, id: event.id, title: event.title ?? `${label} #${event.id}`, start: event.start_date, end: event.end_date });
    }
  }
  return rows;
}

/** Discover announced JP editions; amounts always come from the user's sheet. */
export function plannerEventSchedules(app: string, source: string): Income[] {
  return plannerEditions(app, source)
    .filter((e) => dayFromTimestamp(e.start) > latestSheetRow(e.kind).startJp)
    .map((e) => ({ id: `${e.kind}-${e.id}`, source: "limited", category: e.kind, name: e.title,
      startKr: dayFromTimestamp(e.start) + SERVER_GAP_DAYS, endKr: dayFromTimestamp(e.end) + SERVER_GAP_DAYS,
      free: 0, trainTickets: 0, supportTickets: 0, reference: "https://uma.guide/pull-planner/" }));
}

/** Import actual limited rewards and per-day special logins on every refresh. */
export function plannerRewardIncomes(app: string, source: string): Income[] {
  const rows = plannerEventSchedules(app, source);
  const names: Record<string, number> = { Carats: 43, "Trainee Scout Ticket": 41, "Support Card Scout Ticket": 111, "Rainbow Crystal Shard": 149, "SSR Crystal Shard": 149, "Gold Crystal Shard": 150, "SR Crystal Shard": 150, "Rainbow Crystal": 144, "Gold Crystal": 145 };
  const slots = (r: Record<string, unknown>) => [...new Set(Object.keys(r).filter(k => /^item_(id|name)(?:_\d+)?$/.test(k)).map(k => k.match(/_\d+$/)?.[0] ?? ""))].map(suffix => ({
    id: Number(r[`item_id${suffix}`] ?? names[String(r[`item_name${suffix}`])] ?? -1),
    num: Number(r[`item_num${suffix}`] ?? 0), name: String(r[`item_name_jp${suffix}`] ?? r[`item_name${suffix}`] ?? ""),
  })).filter(i => Number.isInteger(i.num) && i.num >= 0);
  const push = (id: string, source: Income["source"], name: string, start: number, end: number, rewards: ReturnType<typeof itemRewards>, group?: number, loginDay?: number) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end >= 1_900_000_000 || !hasRewards(rewards) || !isEventReward({source,name}) || /シンデレラグレイ|Cinderella Gray/.test(name)) return;
    const startJp = dayFromTimestamp(start), endJp = dayFromTimestamp(end);
    rows.push({ id, source, category: source === "gift" ? "anniversary-gift" : source, name, startJp, endJp,
      startKr: startJp + SERVER_GAP_DAYS, endKr: endJp + SERVER_GAP_DAYS, ...rewards, eventGroupId: group, loginDay, reference: "https://uma.guide/pull-planner/" });
  };
  const logins = plannerTable(app, source, "Login Bonuses");
  if (Array.isArray(logins)) for (const l of logins) {
    if (l.type === 1 || !Array.isArray(l.rewards)) continue;
    const byDay = new Map<number, ReturnType<typeof itemRewards>[]>();
    for (const r of l.rewards) {
      const count = Number(r.count ?? 1), at = Number(l.start_date) + (count - 1) * 86400;
      if (!Number.isInteger(count) || count < 1 || at > Number(l.end_date)) continue;
      byDay.set(count, [...(byDay.get(count) ?? []), itemRewards(slots(r))]);
    }
    for (const [count, rewards] of byDay) {
      const at = Number(l.start_date) + (count - 1) * 86400;
      push(`login-${l.id}-${count}`, "login", `${l.title} (${count}일차)`, at, at, addRewards(rewards), undefined, count);
    }
  }
  const missions = plannerTable(app, source, "Missions");
  if (Array.isArray(missions)) for (const m of missions) {
    if (m.mission_type !== 4) continue;
    push(`mission-${m.id}`, "limited", m.title ?? m.mission_name_jp ?? "기간 한정 미션", Number(m.start_date), Number(m.end_date), itemRewards(slots(m)), m.event_id);
  }
  const gifts = plannerTable(app, source, "Anniversary Gifts");
  if (Array.isArray(gifts)) for (const g of gifts) push(`anniversary-gift-${g.id}`, "gift", g.title, Number(g.start_date), Number(g.start_date), itemRewards([{id:43,num:Number(g.reward_quantity1)}]));
  return rows;
}

export type StorySchedule = { id: number; name_ko?: string; name_ja?: string; start_ja?: number; end_ja?: number; start_ko?: number; end_ko?: number };
export function storyScheduleIncomes(stories: StorySchedule[]): Income[] {
  return stories.filter(s => s.start_ja && s.end_ja && dayFromTimestamp(s.start_ja) > latestSheetRow("story").startJp).map(s => ({
    id: `story-${s.id}`, source: "story", category: "story", name: s.name_ko || s.name_ja || `스토리 이벤트 #${s.id}`,
    startKr: s.start_ko ? dayFromTimestamp(s.start_ko) : dayFromTimestamp(s.start_ja!) + SERVER_GAP_DAYS,
    endKr: s.end_ko ? dayFromTimestamp(s.end_ko) : dayFromTimestamp(s.end_ja!) + SERVER_GAP_DAYS,
    startJp: dayFromTimestamp(s.start_ja!), free: 0, trainTickets: 0, supportTickets: 0,
  }));
}

type CharacterCard = { char_id: number; release?: string; release_ko?: string; name_ko?: string; name_jp?: string };
const isoDay = (iso?: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
export function characterScheduleIncomes(cards: CharacterCard[]): Income[] {
  const first = new Map<number, { card: CharacterCard; day: number }>();
  for (const card of cards) {
    const day = isoDay(card.release);
    if (!Number.isFinite(day) || !Number.isInteger(card.char_id)) continue;
    if (!first.has(card.char_id) || first.get(card.char_id)!.day > day) first.set(card.char_id, { card, day });
  }
  // 한국서버 출시일이 나오면 그 날짜를, 없으면 일본서버 출시일 + 476일을 쓴다. 시트 대조는 일본 날짜(startJp)로 한다
  return [...first.values()].filter(({ day }) => day > latestSheetRow("character-story").startJp).map(({ card, day }) => {
    const kr = isoDay(card.release_ko);
    const startKr = Number.isFinite(kr) ? kr : day + SERVER_GAP_DAYS;
    return {
      id: `character-story-${card.char_id}`, source: "limited", category: "character-story", name: `${card.name_ko || card.name_jp || card.char_id} 스토리 1~4화`,
      startKr, endKr: startKr, startJp: day, endJp: day, free: 0, trainTickets: 0, supportTickets: 0,
    };
  });
}
