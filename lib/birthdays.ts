import { isNpc, type Birthday } from "./birthdayCalendar";
import { GAMETORA_IMG } from "./art";
import { fetchJson, logFailure } from "./fetchJson";
import { KO_NAME_FALLBACK } from "./koNameFallback";

const UMAPYOI = "https://umapyoi.net/api/v1";
const GAMETORA = "https://gametora.com/data";
const REVALIDATE = 86_400;

type RawBirthday = {
  id: number;
  /** 일부 캐릭터는 null */
  game_id: number | null;
  birth_month: number;
  birth_day: number;
  name_jp: string;
  sns_icon: string;
};

type RawCharacter = {
  char_id: number;
  name_ko?: string;
  name_ja?: string;
  birth_month?: number;
  birth_day?: number;
};

// gametora 캐릭터 표. 실패하면 빈 목록이라 한국어 이름과 보충 생일만 빠진다
async function getGametoraCharacters(): Promise<RawCharacter[]> {
  try {
    const manifest = await fetchJson<Record<string, string>>(`${GAMETORA}/manifests/umamusume.json`, REVALIDATE);
    return await fetchJson<RawCharacter[]>(`${GAMETORA}/umamusume/characters.${manifest.characters}.json`, REVALIDATE);
  } catch (err) {
    logFailure("gametora 캐릭터 표", err);
    return [];
  }
}

/** umapyoi 생일 목록에 gametora에만 생일이 있는 캐릭터를 더하고, NPC는 뺀다. 아이콘 원본(약 100KB)은 커서 96px webp로 줄여 받는다 */
export async function getBirthdays(): Promise<Birthday[]> {
  const [list, gametora] = await Promise.all([
    fetchJson<RawBirthday[]>(`${UMAPYOI}/character/birthday`, REVALIDATE),
    getGametoraCharacters(),
  ]);
  const ko = new Map(gametora.flatMap((c) => (c.name_ko ? [[c.char_id, c.name_ko] as const] : [])));

  const fromUmapyoi: Birthday[] = list
    .filter((b) => b.birth_month && b.birth_day && !isNpc(b.game_id))
    .map((b) => ({
      id: b.id,
      name: (b.game_id === null ? undefined : ko.get(b.game_id)) ?? KO_NAME_FALLBACK[b.name_jp] ?? b.name_jp,
      month: b.birth_month,
      day: b.birth_day,
      icon: `${b.sns_icon}?w=96&fm=webp`,
    }));

  // umapyoi에 생일이 비어 있거나 아예 없는 캐릭터는 gametora 생일로 채운다 (NPC는 여기서도 뺀다).
  // 같은 캐릭터가 두 번 나오지 않도록 캐릭터 ID와 일본어 이름 둘 다로 거른다. ID는 umapyoi와 겹치지 않게 음수로 둔다
  const seenIds = new Set(list.map((b) => b.game_id));
  const seenJa = new Set(list.map((b) => b.name_jp));
  const fromGametora: Birthday[] = gametora
    .filter((c) => c.birth_month && c.birth_day && !isNpc(c.char_id) && !seenIds.has(c.char_id) && !(c.name_ja && seenJa.has(c.name_ja)))
    .map((c) => ({
      id: -c.char_id,
      name: c.name_ko ?? (c.name_ja && KO_NAME_FALLBACK[c.name_ja]) ?? c.name_ja ?? String(c.char_id),
      month: c.birth_month as number,
      day: c.birth_day as number,
      icon: `${GAMETORA_IMG}/characters/icons/chr_icon_${c.char_id}.png`,
    }));

  return [...fromUmapyoi, ...fromGametora].sort(
    (a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name, "ko"),
  );
}
