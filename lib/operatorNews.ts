import type { Income } from "./jewelPlan.ts";
import type { RewardRecord } from "./rewardCatalog.ts";
import { ZERO_REWARDS, hasRewards } from "./rewards.ts";
import { dayFromTimestamp, SERVER_GAP_DAYS } from "./dates.ts";
import { incomeIdentity } from "./incomeIdentity.ts";

export type OperatorNews = { announce_id: number; title: string; message?: string; post_at: number };
const plain = (html: string) => html.replace(/<br\s*\/?>|<\/h[1-6]>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const number = (s: string) => Number(s.replaceAll(",", ""));

/** Parse explicit distribution blocks; event summaries aren't additional gifts. */
export function operatorNewsRewards(news: OperatorNews[], known: Income[] = []): RewardRecord[] {
  const rows: RewardRecord[] = [];
  for (const r of new Map(news.map(r => [r.announce_id, r])).values()) {
    if (!Number.isInteger(r.announce_id) || !Number.isFinite(r.post_at)) continue;
    const body = plain(r.message ?? "");
    const broadcast = /ぱかライブ/.test(r.title) && /プレゼント内容/.test(body);
    const standalone = /プレゼント|開発者レター|ダウンロード突破/.test(r.title) && !/販売|フォロー|RTキャンペーン|カード.*配布/.test(r.title);
    const compensation = /メンテナンス|不具合|障害|お詫び/.test(r.title) && /お送り|お贈り|補てん|補填|補償|お詫び内容/.test(body);
    if ((!broadcast && !standalone && !compensation) || r.announce_id === 971) continue;
    if (r.announce_id === 399 && news.some(n => n.announce_id === 400)) continue;
    let blocks: string[] = [];
    const heading = /(?:プレゼント|お詫び|補てん|補填|補償)(?:の)?内容\s*\n?([\s\S]*?)(?=配布日時|対象のトレーナー|対象のお客様|受け取り|受取期間|注意事項|■対象|■受取|■配布|$)/g;
    for (const match of body.matchAll(heading)) blocks.push(match[1]);
    if (broadcast) blocks = blocks.slice(0, 1);
    if (/開発者レター/.test(r.title)) blocks = [body.match(/ジュエル\s*[\d,]+個をプレゼント/)?.[0] ?? ""];
    if (compensation && !blocks.length) blocks = body.match(/(?:ジュエル\s*[\d,]+個|[\d,]+ジュエル)[^\n]{0,100}(?:お送り|お贈り)/g) ?? [];
    const reward = { ...ZERO_REWARDS, specialTickets: {} as Record<string, number> };
    for (const block of blocks) {
      if (/有償ジュエル/.test(block)) continue;
      for (const m of block.matchAll(/ジュエル\s*[×x]?\s*([\d,]+)\s*個|([\d,]+)\s*ジュエル/g)) reward.free += number(m[1] ?? m[2]);
      for (const m of block.matchAll(/(SSR(?:確定)?メイクデビュー(?:ガチャ)?(?:第[１２３４５６1-6]R)?|SSR確定ガチャチケット)(?:[」\s]*[×x]\s*(\d+))?/g)) reward.specialTickets[m[1]] = (reward.specialTickets[m[1]] ?? 0) + Number(m[2] ?? 1);
      for (const [pattern, field] of [[/虹の結晶片\s*[×x]?\s*(\d+)\s*個/g, "rainbowShards"], [/金の結晶片\s*[×x]?\s*(\d+)\s*個/g, "goldShards"], [/虹の解放結晶\s*[×x]?\s*(\d+)\s*個/g, "rainbowCrystals"], [/金の解放結晶\s*[×x]?\s*(\d+)\s*個/g, "goldCrystals"], [/育成ウマ娘ガチャチケット\s*[×x]?\s*(\d+)\s*枚/g, "trainTickets"], [/サポートカードガチャチケット\s*[×x]?\s*(\d+)\s*枚/g, "supportTickets"]] as const)
        for (const match of block.matchAll(pattern)) reward[field] = (reward[field] ?? 0) + Number(match[1]);
    }
    if (!hasRewards(reward) || /シンデレラグレイ/.test(r.title)) continue;
    if (r.announce_id === 970) reward.free = 450;
    let at = dayFromTimestamp(r.post_at);
    const distribution = body.match(/配布日時\s*\n?(\d{4})年(\d+)月(\d+)日/);
    if (distribution) at = Math.floor(Date.UTC(+distribution[1], +distribution[2] - 1, +distribution[3]) / 86400000);
    if (compensation) {
      const first = body.search(/(?:お詫び|補てん|補填|補償)(?:の)?内容/);
      const update = [...(first >= 0 ? body.slice(0, first) : body).matchAll(/【(\d+)\/(\d+)[^】]*(?:追記|更新)】/g)].at(-1);
      if (update) at = Math.floor(Date.UTC(new Date(r.post_at * 1000).getUTCFullYear(), +update[1] - 1, +update[2]) / 86400000);
    }
    const explicit = /開発者レター/.test(r.title) ? body.match(/(\d+)月(\d+)日\d+時にジュエル/) : compensation ? body.match(/(?:■)?受取期間\s*\n?(\d+)\/(\d+)/) : null;
    if (explicit) at = Math.floor(Date.UTC(new Date(r.post_at * 1000).getUTCFullYear(), +explicit[1] - 1, +explicit[2]) / 86400000);
    // Compare identity and all currencies; a changed grant must replace the old alias.
    const candidate: Income = { id: `operator-news-${r.announce_id}`, name: r.title, source: "gift", category: "operator-gift", startKr: at + SERVER_GAP_DAYS, endKr: at + SERVER_GAP_DAYS, ...reward, reference: `https://umamusume.jp/news/detail?id=${r.announce_id}` };
    if (known.some(g => incomeIdentity(g) === incomeIdentity(candidate) && g.startKr === candidate.startKr &&
      (["free", "trainTickets", "supportTickets", "rainbowCrystals", "rainbowShards", "goldCrystals", "goldShards"] as const).every(k => (g[k] ?? 0) === (candidate[k] ?? 0)) &&
      Object.entries(g.specialTickets ?? {}).sort().toString() === Object.entries(candidate.specialTickets ?? {}).sort().toString())) continue;
    rows.push({ id: `operator-news-${r.announce_id}`, source: "operator-gift", name: r.title, startJp: at, endJp: at, ...reward,
      reference: `https://umamusume.jp/news/detail?id=${r.announce_id}`, condition: compensation ? "공지의 보상 지급 대상에 해당할 때 수령" : "운영팀 별도 지급 선물 수령" });
  }
  return rows.sort((a, b) => a.startJp - b.startJp);
}
