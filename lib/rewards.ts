/** 일본 게임 아이템 ID. 일반 뽑기권과 전용·확정권을 분리한다. */
export const REWARD_ITEMS = { 43: "free", 41: "trainTickets", 111: "supportTickets", 144: "rainbowCrystals", 145: "goldCrystals", 149: "rainbowShards", 150: "goldShards" } as const;
export const CRYSTAL_FIELDS = ["rainbowCrystals", "rainbowShards", "goldCrystals", "goldShards"] as const;
export const CRYSTAL_NAMES = { rainbowCrystals: "무지개 해방 결정", rainbowShards: "무지개 결정 조각", goldCrystals: "금 해방 결정", goldShards: "금 결정 조각" } as const;
export type CrystalField = typeof CRYSTAL_FIELDS[number];
export type Materials = Partial<Record<CrystalField, number>> & { specialTickets?: Record<string, number> };
export type Rewards = Materials & { free: number; trainTickets: number; supportTickets: number };
export const ZERO_REWARDS: Rewards = { free: 0, trainTickets: 0, supportTickets: 0 };

/** 사용자 시트에 열이 없는 재료. 시트 행이 원래 보상을 대신할 때 원래 보상의 값을 이어받는다 (시트에는 무지개 조각만 있다) */
export const SHEET_MISSING_FIELDS = ["goldShards", "rainbowCrystals", "goldCrystals"] as const;

/** 시트 행이 대신하는 원래 보상들의 금 결정 조각·해방 결정 합 */
export function sheetMissingMaterials(rows: Materials[]): Materials {
  const out: Materials = {};
  for (const key of SHEET_MISSING_FIELDS) out[key] = rows.reduce((a, r) => a + (r[key] ?? 0), 0);
  return out;
}

export function addRewards(rows: Rewards[]): Rewards {
  const out: Rewards = { ...ZERO_REWARDS, specialTickets: {} };
  for (const row of rows) {
    for (const key of ["free", "trainTickets", "supportTickets", ...CRYSTAL_FIELDS] as const) out[key] = (out[key] ?? 0) + (row[key] ?? 0);
    for (const [name, count] of Object.entries(row.specialTickets ?? {})) out.specialTickets![name] = (out.specialTickets![name] ?? 0) + count;
  }
  return out;
}

export function itemRewards(items: { id: number; num: number; name?: string }[]): Rewards {
  return addRewards(items.map(({ id, num, name }) => {
    const key = REWARD_ITEMS[id as keyof typeof REWARD_ITEMS];
    if (key) return { ...ZERO_REWARDS, [key]: num };
    // 確定券・引換券・専用ガチャ券は通常ピックアップの回数に換算しない。
    if (name && /ガチャ|Scout|뽑기|引換券|交換チケット|メイクデビュー|메이크\s*데뷔|가챠|확정.*(?:티켓|권)|(?:캐릭터|서포트).*교환권/i.test(name)) return { ...ZERO_REWARDS, specialTickets: { [name]: num } };
    return { ...ZERO_REWARDS };
  }));
}

export function hasRewards(r: Rewards): boolean {
  return r.free + r.trainTickets + r.supportTickets + CRYSTAL_FIELDS.reduce((a, k) => a + (r[k] ?? 0), 0) + Object.values(r.specialTickets ?? {}).reduce((a, n) => a + n, 0) > 0;
}

export function describeRewards(r: Rewards): string {
  return [r.free > 0 && `쥬얼 ${r.free.toLocaleString("ko-KR")}`, r.trainTickets > 0 && `육성 ${r.trainTickets}장`, r.supportTickets > 0 && `서포트 ${r.supportTickets}장`, ...CRYSTAL_FIELDS.map(k => (r[k] ?? 0) > 0 && `${CRYSTAL_NAMES[k]} ${r[k]}개`), ...Object.entries(r.specialTickets ?? {}).map(([name, n]) => `${name} ${n}장`)].filter(Boolean).join(", ");
}
