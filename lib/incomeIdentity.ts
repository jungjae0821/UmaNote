import type { Income } from "./jewelPlan.ts";

/** Same notice can also announce a later Christmas/anniversary gift separately. */
export function incomeIdentity(i: Income): string {
  const a = i.name.match(/(\d+(?:\.\d+)?)(?:st|nd|rd|th)?\s*Anniversary/i)?.[1] ?? i.name.match(/(\d+(?:\.\d+)?)\s*(?:周年|주년)/)?.[1];
  if (a && i.source === "gift" && i.free === 3000 && /Gift|ジュエル|쥬얼|プレゼント/i.test(i.name) && !/ぱかライブ|파카라이브|ログイン|로그인/.test(i.name)) return `anniversary-${a}-${i.startKr}`;
  const notice = i.reference?.match(/umamusume\.jp\/news\/detail\/?\?id=(\d+)/)?.[1];
  if (!notice) return i.id;
  const kind = /ぱかライブ|파카라이브/.test(i.name) ? "broadcast" : /レター|레터/.test(i.name) ? "letter" : /メンテナンス|점검|메인터넌스/.test(i.name) ? "maintenance" : i.category === "anniversary-gift" ? "anniversary" : `gift-${i.startKr}`;
  return `notice-${notice}-${kind}`;
}

export function uniqueIncomes(incomes: Income[]): Income[] {
  const result = new Map<string, Income>();
  for (const i of new Map(incomes.map(i => [i.id, i])).values()) {
    const key = incomeIdentity(i), previous = result.get(key);
    // Live/archive official records take precedence over a hand-entered alias.
    if (!previous || i.id.startsWith("operator-news-") || !previous.id.startsWith("operator-news-")) result.set(key, i);
  }
  return [...result.values()];
}
